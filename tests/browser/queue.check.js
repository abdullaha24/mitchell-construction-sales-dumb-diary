'use strict';
// The instant-save queue (spec 005) in the hard cases the 4b review found: phone storage blocked,
// several failed new sites, reopening after a save that landed, order and late replies, a newer
// save replacing an older failed one, and Back on a retried save. Real doGet and server code on
// fake sheets; Chromium at a cheap-phone size. Run: npm run check:browser.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.log('SKIPPED: Playwright is not installed here.');
  process.exit(0);
}

const { loadSrc } = require('../helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeHtmlService, makeCacheService,
  makePropertiesService,
} = require('../helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('../fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);

function buildWorld() {
  const D = new Date('2026-10-01T05:00:00Z');
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer', 'Consultant'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ['S000001', 'RIA', 'North', 'F-11 Tower', 'Dealer', '', '', '923001234567', '', 'Visited / Lead', '', '', '', D, '', D, D]],
    Activity: [ACTIVITY], Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

// google.script.run → the real server code. __offline: fail without reaching the server.
// __loseReply: the server saves, the phone never hears back. __delay: a slow network.
function stub() {
  window.__calls = [];
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
          window.__calls.push(prop);
          if (window.__offline) {
            setTimeout(() => failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' }), 20);
            return;
          }
          const go = () => window.__server(prop, JSON.stringify(args)).then(
            (json) => {
              if (window.__loseReply && prop !== 'repSaveStatus') {
                return failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' });
              }
              return success && success(JSON.parse(json));
            },
            (error) => failure && failure({ message: String(error.message || error).replace(/^Error: /, '') }));
          if (window.__delay) setTimeout(go, window.__delay); else go();
        };
      },
    });
  }
  window.google = { script: { get run() { return runner(null, null); } } };
}

// A phone where the page may not keep anything (third-party storage blocked).
function blockStorage() {
  const deny = () => { throw new Error('storage blocked'); };
  Object.defineProperty(window, 'localStorage', { get: deny });
}

async function open(world, { blocked = false, timing } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  const file = path.join(dir, 'app.html');
  fs.writeFileSync(file, world.s.doGet({ parameter: { k: RIA } }).getContent());
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.exposeFunction('__server', (name, argsJson) => JSON.stringify(world.s[name](...JSON.parse(argsJson))));
  if (timing) await page.addInitScript((t) => { window.__timing = t; }, timing);
  await page.addInitScript(stub);
  if (blocked) await page.addInitScript(blockStorage);
  await page.goto(`file://${file}`);
  await page.waitForSelector('#who');
  await page.click('#tab-all'); // these cases are about his whole list (spec 005)
  return { page, context, dir };
}

const names = (page) => page.$$eval('.card .name', (els) => els.map((e) => e.textContent));
const failedNames = (page) => page.$$eval('.card.failed .name', (els) => els.map((e) => e.textContent));
async function addSite(page, name, { phone = '0321 0000000' } = {}) {
  await page.click('#newSite');
  await page.fill('#f-name', name);
  await page.click('#f-buyer .pill:has-text("Dealer")');
  await page.fill('#f-phone', phone);
  await page.click('#save');
}
let browser;
// ONLY=A (or B, C, D, E) runs a single case, e.g. to check it against an older page.
const want = (name) => !process.env.ONLY || name.split('/').includes(process.env.ONLY);

(async () => {
  browser = await chromium.launch();

  // ---- A. Storage blocked: retrying still has everything he typed. ----
  if (want('A')) {
  console.error('case A');
    const world = buildWorld();
    const { page, context } = await open(world, { blocked: true });
    assert.equal(await page.isVisible('#noStorage'), true, 'he is told this phone keeps nothing');
    await page.evaluate(() => { window.__offline = true; });
    await addSite(page, 'Blocked Storage Site', { phone: '0321 1111111' });
    await page.waitForSelector('.card.failed');
    await page.click('.card.failed');
    assert.equal(await page.inputValue('#f-name'), 'Blocked Storage Site');
    assert.equal(await page.inputValue('#f-phone'), '0321 1111111');
    await page.evaluate(() => { window.__offline = false; });
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    assert.deepEqual(await failedNames(page), []);
    assert.equal(world.diary.getSheetByName('Sites').getLastRow(), 3);
    await context.close();
  }

  // ---- B. Two failed new sites and a draft in progress: none overwrites another; Back keeps them. ----
  if (want('B')) {
  console.error('case B');
    const world = buildWorld();
    const { page, context } = await open(world);
    await page.evaluate(() => { window.__offline = true; });
    await addSite(page, 'Site A');
    await addSite(page, 'Site B');
    await page.waitForFunction(() => document.querySelectorAll('.card.failed').length === 2);
    // He starts another new site and leaves it as a draft.
    await page.click('#newSite');
    await page.fill('#f-name', 'Draft C');
    await page.click('#cancel');
    await page.click('.card.failed:has-text("Site A")');
    assert.equal(await page.inputValue('#f-name'), 'Site A');
    await page.click('#cancel');
    await page.click('.card.failed:has-text("Site B")');
    assert.equal(await page.inputValue('#f-name'), 'Site B');
    await page.click('#cancel');
    assert.deepEqual((await failedNames(page)).sort(), ['Site A', 'Site B'], 'Back keeps both');
    await page.click('#newSite');
    assert.equal(await page.inputValue('#f-name'), 'Draft C', 'his draft is untouched');
    await page.click('#cancel');
    await page.evaluate(() => { window.__offline = false; });
    await page.click('.card.failed:has-text("Site A")');
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    assert.deepEqual(await failedNames(page), ['Site B'], 'Site B is still there, still not saved');
    await context.close();
  }

  // ---- C. Closed just as a save landed: on reopening it is found, not shown twice or resent. ----
  if (want('C')) {
  console.error('case C');
    const world = buildWorld();
    const first = await open(world);
    await first.page.evaluate(() => { window.__loseReply = true; });
    await addSite(first.page, 'Landed Anyway');
    await first.page.waitForSelector('.card.failed');
    assert.equal(world.diary.getSheetByName('Sites').getLastRow(), 3, 'it did reach the sheet');
    const queued = await first.page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find((key) => key.indexOf('salesdiary.queue.') === 0)));
    await first.context.close();
    // Reopen (a fresh page from the server) with what the phone kept.
    const again = await open(world);
    await again.page.evaluate((q) => { localStorage.setItem('salesdiary.queue.RIA', q); }, queued);
    await again.page.reload();
    await again.page.waitForSelector('.card');
    await again.page.click('#tab-all');
    await again.page.waitForFunction(() => ![...document.querySelectorAll('.tag')].some((t) => t.textContent === 'Checking…'));
    assert.deepEqual((await names(again.page)).filter((n) => n === 'Landed Anyway').length, 1, 'shown once');
    assert.deepEqual(await failedNames(again.page), [], 'not shown as unsaved');
    assert.equal(world.diary.getSheetByName('Sites').getLastRow(), 3, 'nothing resent');
    await again.context.close();
  }

  // ---- D. One at a time, in order; a reply after the give-up is still honoured. ----
  if (want('D')) {
  console.error('case D');
    const world = buildWorld();
    const { page, context } = await open(world, { timing: { slow: 200, giveUp: 600 } });
    await page.evaluate(() => { window.__delay = 1200; });
    await addSite(page, 'First');
    await page.waitForSelector('.card:has-text("First") .tag.saving:has-text("Still sending")');
    await addSite(page, 'Second');
    await page.waitForSelector('.card.failed:has-text("First")'); // given up on at 0.6 s
    assert.equal(world.diary.getSheetByName('Sites').getLastRow(), 2, 'Second is not sent before First is answered');
    await page.waitForFunction(() => !document.querySelector('.card.failed')); // First's late "saved" is honoured
    await page.waitForFunction(() => !document.querySelector('.tag.saving'));
    const sites = world.diary.getSheetByName('Sites').getDataRange().getValues().slice(1).map((r) => r[3]);
    assert.deepEqual(sites, ['F-11 Tower', 'First', 'Second'], 'saved once each, in order');
    assert.deepEqual((await names(page)).filter((n) => n === 'First').length, 1);
    await context.close();
  }

  // ---- E/F. A failed update stays on Back; a newer update of the same site replaces it. ----
  if (want('E/F')) {
  console.error('case E/F');
    const world = buildWorld();
    const { page, context } = await open(world);
    await page.evaluate(() => { window.__offline = true; });
    await page.click('.card:has-text("F-11 Tower")');
    await page.click('#u-stage .pill:has-text("Sample / Trial")');
    await page.fill('#u-note', 'first try');
    await page.click('#save');
    await page.waitForSelector('.card.failed:has-text("F-11 Tower")');
    await page.click('.card.failed');
    assert.equal(await page.inputValue('#u-note'), 'first try');
    await page.click('#cancel');
    assert.deepEqual(await failedNames(page), ['F-11 Tower'], 'Back keeps the failed update');
    await page.evaluate(() => { window.__offline = false; });
    // He retries it with an extra word: the newer save replaces the failed one.
    await page.click('.card.failed');
    await page.fill('#u-note', 'first try, again');
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    assert.deepEqual(await failedNames(page), []);
    const row = world.diary.getSheetByName('Sites').getDataRange().getValues()[1];
    assert.deepEqual([row[9], row[14]], ['Sample / Trial', 'first try, again']);
    await context.close();
  }

  await browser.close();
  console.log('PASS: the save queue behaves as spec 005 says, in the hard cases.');
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
