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
            setTimeout(() => failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' }), window.__offDelay || 20);
            return;
          }
          const go = () => window.__server(prop, JSON.stringify(args)).then(
            (json) => {
              if (window.__loseReply && prop !== 'repSaveStatus') {
                return failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' });
              }
              // __replyDelay: Google has saved it, but the reply reaches the phone late.
              if (window.__replyDelay) { const wait = window.__replyDelay; return setTimeout(() => success && success(JSON.parse(json)), wait); }
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
    // First's late "saved" is honoured. Second may be given up on too (its reply also takes
    // 1.2 s): wait until the sheet has both, then until the page shows nothing failed or saving.
    const deadline = Date.now() + 15000;
    while (world.diary.getSheetByName('Sites').getLastRow() < 4 && Date.now() < deadline) await page.waitForTimeout(50);
    await page.waitForFunction(() => !document.querySelector('.card.failed') && !document.querySelector('.tag.saving'));
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

  const fu = (siteRow) => (siteRow[13] instanceof Date ? siteRow[13].toISOString() : siteRow[13]);
  const activityRows = (world) => world.diary.getSheetByName('Activity').getDataRange().getValues().slice(1);

  if (want('G')) {
    // Spec 005 + 008: an Update lands but its reply is lost; he taps the orange card and saves it
    // again unchanged: the same save (seen is not part of it), saved once, nothing left stuck.
    console.error('case G');
    const world = buildWorld();
    const { page, context } = await open(world);
    await page.evaluate(() => { window.__loseReply = true; });
    await page.click('.card:has-text("F-11 Tower")');
    await page.click('#u-stage .pill:has-text("Sample / Trial")');
    await page.fill('#u-note', 'met him');
    await page.click('#save');
    await page.waitForSelector('.card.failed:has-text("F-11 Tower")');
    await page.evaluate(() => { window.__loseReply = false; });
    await page.click('.card.failed');
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    assert.deepEqual(activityRows(world).map((r) => r[4]), ['stage_change'], 'saved once');
    assert.deepEqual(await failedNames(page), [], 'nothing stuck as not saved');
    await context.close();
  }

  if (want('H')) {
    // An Update kept on the phone by version 9 (no `seen`, no base): after the update, its retry
    // saves as it always did, never refused as "changed".
    console.error('case H');
    const world = buildWorld();
    const { page, context } = await open(world);
    await page.evaluate(() => {
      const card = Object.assign(JSON.parse(JSON.stringify(data.sites[0])), { stage: 'Sample / Trial', note: 'from v9' });
      const state = { stage: 'Sample / Trial', value: '', terms: '', lostReason: '', followUp: 'tomorrow', date: '', note: 'from v9',
        phone: '', saveId: 'v9save00001' };
      const input = { stage: 'Sample / Trial', value: '', terms: '', lostReason: '', followUp: 'tomorrow', note: 'from v9', phone: '',
        saveId: 'v9save00001' };
      localStorage.setItem('salesdiary.queue.RIA', JSON.stringify([{ id: 'v9save00001', fn: 'repUpdateSite', siteId: 'S000001',
        input, card, state, status: 'saving' }]));
    });
    await page.reload();
    await page.click('#tab-all');
    await page.waitForSelector('.card.failed:has-text("F-11 Tower")');
    await page.click('.card.failed');
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    const row = world.diary.getSheetByName('Sites').getDataRange().getValues()[1];
    assert.deepEqual([row[9], row[14]], ['Sample / Trial', 'from v9'], 'saved as before, not refused');
    assert.deepEqual(await failedNames(page), []);
    await context.close();
  }

  if (want('I')) {
    // Spec 008: an Update draft kept on the phone, while the site was changed elsewhere (the admin,
    // or his other phone). Reopening it shows the site as it is now, keeps what he typed, says so;
    // saving keeps the other change's stage, value and follow-up.
    console.error('case I');
    const world = buildWorld();
    const { page, context, dir } = await open(world);
    await page.click('.card:has-text("F-11 Tower")');
    await page.fill('#u-note', 'draft note');
    const other = world.s.repUpdateSite(RIA, 'S000001', { stage: 'Rate Quoted', value: '500000', terms: 'Cash', followUp: '1week', note: 'other phone' });
    assert.equal(other.ok, true);
    const theirs = world.diary.getSheetByName('Sites').getDataRange().getValues()[1];
    // He opens the app again: Google serves the page with the site as it is now.
    fs.writeFileSync(path.join(dir, 'app.html'), world.s.doGet({ parameter: { k: RIA } }).getContent());
    await page.reload();
    await page.click('#tab-all');
    await page.click('.card:has-text("F-11 Tower")');
    assert.equal(await page.textContent('#u-problem'), 'This site was changed a moment ago. Check and tap Save again.');
    assert.equal(await page.inputValue('#u-note'), 'draft note', 'what he typed stays');
    assert.equal(await page.getAttribute('#u-stage .pill:has-text("Rate Quoted")', 'aria-pressed'), 'true');
    assert.equal(await page.inputValue('#u-value'), '500000');
    assert.match(await page.textContent('#u-follow .pill[aria-pressed=true]'), /^Keep /);
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    const row = world.diary.getSheetByName('Sites').getDataRange().getValues()[1];
    assert.deepEqual([row[9], row[10], fu(row), row[14]], ['Rate Quoted', 500000, fu(theirs), 'draft note']);
    await context.close();
  }

  if (want('J')) {
    // Spec 008: his Update U1 (Visited → Sample / Trial) is still on its way when he opens the site
    // again; U1 then fails without landing; he adds a note and saves U2. U2's form was opened over
    // U1, so it carries U1's stage (the form's `seen` is what Google last confirmed, never U1's
    // card): the sheet gets the stage and the note, and U1's orange card goes because U2 carried it.
    console.error('case J');
    const world = buildWorld();
    const { page, context } = await open(world);
    await page.evaluate(() => { window.__offline = true; window.__offDelay = 1500; });
    await page.click('.card:has-text("F-11 Tower")');
    await page.click('#u-stage .pill:has-text("Sample / Trial")');
    await page.click('#save');
    await page.waitForSelector('.card:has-text("F-11 Tower") .tag.saving');
    await page.click('.card:has-text("F-11 Tower")');
    await page.waitForSelector('#siteView:not([hidden])');
    assert.equal(await page.textContent('#u-stage .pill[aria-pressed=true]'), 'Sample / Trial', 'the form shows his unconfirmed change');
    await page.waitForFunction(() => queue.length && queue[0].status === 'failed');
    await page.evaluate(() => { window.__offline = false; window.__offDelay = 0; });
    await page.fill('#u-note', 'second visit');
    await page.click('#save');
    await page.waitForSelector('#toast:has-text("Saved")');
    const row = world.diary.getSheetByName('Sites').getDataRange().getValues()[1];
    assert.deepEqual([row[9], row[14]], ['Sample / Trial', 'second visit'], 'his first change was not lost');
    assert.deepEqual(activityRows(world).map((r) => `${r[4]} ${r[5]}>${r[6]}`), ['stage_change Visited / Lead>Sample / Trial']);
    assert.deepEqual(await failedNames(page), [], 'U2 carried U1');
    await context.close();
  }

  if (want('K')) {
    // A failed save that a later Update did NOT carry (it joined the queue after that Update's
    // form was opened, e.g. another tab) is never dropped when that Update lands.
    console.error('case K');
    const world = buildWorld();
    const { page, context } = await open(world);
    await page.evaluate(() => { window.__delay = 800; });
    await page.click('.card:has-text("F-11 Tower")');
    await page.fill('#u-note', 'first');
    await page.click('#save');
    await page.evaluate(() => {
      const card = JSON.parse(JSON.stringify(data.sites[0]));
      queue.push({ id: 'otherTab001', fn: 'repUpdateSite', siteId: card.id, input: {}, card, state: { stage: card.stage },
        status: 'failed', message: 'Not saved: no signal.' });
    });
    await page.waitForSelector('#toast:has-text("Saved")');
    assert.equal(await page.evaluate(() => queue.filter((q) => q.id === 'otherTab001').length), 1, 'not carried: kept');
    await page.evaluate(() => { window.__delay = 0; });
    await context.close();
  }

  if (want('L')) {
    // Spec 008: U1 lands but its "saved" reply is slow, so the phone gives up (not saved). His
    // retry U2 carries it with a new note and lands. Then U1's late reply arrives: it says nothing
    // new and must not put U1's older card (or state) back on the page.
    console.error('case L');
    const world = buildWorld();
    const { page, context } = await open(world, { timing: { slow: 100, giveUp: 400 } });
    await page.evaluate(() => { window.__replyDelay = 2500; });
    await page.click('.card:has-text("F-11 Tower")');
    await page.click('#u-stage .pill:has-text("Sample / Trial")');
    await page.fill('#u-note', 'first');
    await page.click('#save');
    await page.waitForSelector('.card.failed:has-text("F-11 Tower")');
    await page.evaluate(() => { window.__replyDelay = 0; });
    assert.equal(world.diary.getSheetByName('Sites').getDataRange().getValues()[1][9], 'Sample / Trial', 'U1 did land');
    await page.click('.card.failed');
    await page.fill('#u-note', 'second');
    await page.click('#save');
    await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Saved');
    assert.equal(await page.evaluate(() => data.sites[0].note), 'second');
    await page.waitForTimeout(2600); // U1's late reply arrives now
    assert.equal(await page.evaluate(() => data.sites[0].note), 'second', "U2's card stays, not U1's late one");
    assert.equal(await page.evaluate(() => confirmed.S000001.stage), 'Sample / Trial');
    assert.deepEqual(await failedNames(page), []);
    const row = world.diary.getSheetByName('Sites').getDataRange().getValues()[1];
    assert.deepEqual([row[9], row[14]], ['Sample / Trial', 'second']);
    await context.close();
  }

  await browser.close();
  console.log('PASS: the save queue behaves as spec 005 says, in the hard cases.');
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
