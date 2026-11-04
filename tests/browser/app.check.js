'use strict';
// End to end for the salesman's page (spec 003): the real doGet renders App.html with the real
// server code running against fake sheets; the page's google.script.run calls are wired back to
// that same server code. Opened in Chromium at a cheap-phone size. Run: npm run check:browser.
// Usage: node tests/browser/app.check.js [screenshot-folder]

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
  'next_followup', 'last_note', 'created_at', 'updated_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);
const SH = 'b'.repeat(64);
const D = (iso) => new Date(iso);
const EVIL = '<img src=x onerror="window.__xss=1">';

function buildWorld() {
  const site = (id, rep, name, phone, created) => [id, rep, rep === 'RIA' ? 'North' : 'Center', name, 'Dealer', 'DHA',
    `${name} contact`, phone, 'Tile Adhesives', 'Visited / Lead', '', '', '', D(created), '', D(created), D(created)];
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives', 'Waterproofing Job', 'Floor Hardeners', 'Bonding Agents & Sealants', 'Waterproofing Products',
    'Tile Grouts', 'Structural Grouts', 'Restoration & Repair Products', 'Admixtures', 'Surface Protection',
    'Mortars, Plasters & Putties'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer']
    .forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  lists.push(['area', 'DHA', 'North', 'RIA', true, 10], ['area', 'F-11', 'North', 'AUR', true, 20],
    ['area', 'Gulberg', 'Center', 'SH', true, 10]);
  const diary = makeSpreadsheet({
    Sites: [SITES,
      site('S000001', 'RIA', 'F-11 Tower', '923001234567', '2026-10-01T05:00:00Z'),
      site('S000002', 'SH', 'Gulberg Mall', '923007654321', '2026-10-02T05:00:00Z'),
      site('S000003', 'RIA', EVIL, '', '2026-10-03T05:00:00Z')],
    Activity: [ACTIVITY],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D('2026-10-01T05:00:00Z')],
      ['rep', 'SH', SH, true, D('2026-10-01T05:00:00Z')]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(),
    LockService: makeLockService(),
    CacheService: makeCacheService(),
    HtmlService: makeHtmlService(),
  });
  return { s: src.sandbox, diary };
}

// In the page, before its own script: google.script.run → window.__server (real server code).
function stub() {
  window.__calls = [];
  window.__offline = false;
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
          window.__calls.push(prop);
          if (window.__offline) {
            setTimeout(() => failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' }), 30);
            return;
          }
          window.__server(prop, JSON.stringify(args)).then(
            (json) => {
              // The server did the work, but the reply never reaches the phone.
              if (window.__loseReply) return failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' });
              return success && success(JSON.parse(json));
            },
            (error) => failure && failure({ message: String(error.message || error).replace(/^Error: /, '') }));
        };
      },
    });
  }
  window.google = { script: { get run() { return runner(null, null); } } };
}

(async () => {
  const shots = process.argv[2];
  const world = buildWorld();
  const html = world.s.doGet({ parameter: { k: RIA } }).getContent();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  const file = path.join(dir, 'app.html');
  fs.writeFileSync(file, html);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  await page.exposeFunction('__server', (name, argsJson) => {
    const allowed = ['repLoad', 'repCheckPhone', 'repAddSite'];
    if (!allowed.includes(name)) throw new Error(`page called ${name}`);
    return JSON.stringify(world.s[name](...JSON.parse(argsJson)));
  });
  await page.addInitScript(stub);
  await page.goto(`file://${file}`);
  const calls = () => page.evaluate(() => window.__calls);
  const sitesRows = () => world.diary.getSheetByName('Sites').getDataRange().getValues();

  // ---- His list: his sites only, newest first; names as text; "No number yet". ----
  await page.waitForSelector('.card');
  assert.equal(await page.textContent('#who'), 'RIA');
  assert.deepEqual(await page.$$eval('.card .name', (els) => els.map((e) => e.textContent)), [EVIL, 'F-11 Tower']);
  assert.equal(await page.locator('text=Gulberg Mall').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('.card').nth(0).locator('.nonum').count(), 1);
  assert.equal(await page.locator('.card').nth(1).locator('.nonum').count(), 0);
  assert.deepEqual(await calls(), [], 'the list needs no server call');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360, 'no sideways scrolling');
  if (shots) await page.screenshot({ path: path.join(shots, 'app-list.png') });

  // ---- New Site: Tomorrow pre-picked; name and buyer type required. ----
  await page.click('#newSite');
  assert.equal(await page.getAttribute('#f-follow .pill:has-text("Tomorrow")', 'aria-pressed'), 'true');
  await page.click('#save');
  assert.equal(await page.textContent('#formNote'), 'Type the site name.');
  await page.fill('#f-name', 'Askari Heights');
  await page.click('#save');
  assert.equal(await page.textContent('#formNote'), 'Tap a buyer type.');
  await page.click('#f-buyer .pill:has-text("Project Owner")');

  // ---- Duplicate warnings: another salesman's number → only "someone in the team". ----
  // Checked as he types (after a short pause), without leaving the box.
  await page.fill('#f-phone', '+92 300 7654321');
  await page.waitForSelector('#phoneNote:not([hidden])');
  assert.equal(await page.textContent('#phoneNote'), 'Someone in the team already works with this contact.');
  await page.fill('#f-phone', '0300-1234567');
  await page.dispatchEvent('#f-phone', 'change');
  await page.waitForSelector('#phoneNote:has-text("You already have this number")');
  assert.equal(await page.textContent('#phoneNote'), 'You already have this number: F-11 Tower.');
  await page.fill('#f-phone', '0300-12');
  await page.dispatchEvent('#f-phone', 'change');
  await page.waitForSelector('#phoneNote:has-text("Check the number")');
  await page.click('#save');
  assert.equal(await page.textContent('#formNote'), 'Check the number.');

  // ---- Area: "Did you mean"; products; draft survives a reload. ----
  await page.click('#f-areas .pill:has-text("+ New area")');
  await page.fill('#f-newarea', 'dha phase 6');
  await page.waitForSelector('#areaSuggest .pill');
  assert.deepEqual(await page.$$eval('#areaSuggest .pill', (els) => els.map((e) => e.textContent)), ['Did you mean DHA?']);
  await page.click('#areaSuggest .pill');
  assert.equal(await page.getAttribute('#f-areas .pill:has-text("DHA")', 'aria-pressed'), 'true');
  await page.click('#f-products .pill:has-text("Tile Grouts")');
  await page.click('#f-products .pill:has-text("Mortars, Plasters & Putties")');
  await page.fill('#f-phone', '');
  await page.reload();
  await page.waitForSelector('#draftBanner:not([hidden])');
  await page.click('#newSite');
  assert.equal(await page.inputValue('#f-name'), 'Askari Heights', 'draft kept on the phone');
  assert.equal(await page.getAttribute('#f-products .pill:has-text("Tile Grouts")', 'aria-pressed'), 'true');

  // ---- No signal: plain message, nothing lost. ----
  await page.fill('#f-phone', '0321 5556666');
  await page.evaluate(() => { window.__offline = true; });
  await page.click('#save');
  await page.waitForSelector('#formNote:has-text("no signal")');
  assert.equal(await page.textContent('#formNote'), 'Not saved: no signal. Tap Save again.');
  assert.equal(await page.textContent('#toast'), 'Not saved: no signal. Tap Save again.', 'also shown above Save');
  assert.equal(await page.inputValue('#f-name'), 'Askari Heights');
  assert.equal(sitesRows().length, 4, 'nothing saved');

  // ---- Without a number: the first tap only asks. ----
  await page.evaluate(() => { window.__offline = false; });
  await page.fill('#f-phone', '');
  const before = (await calls()).length;
  await page.click('#save');
  assert.equal(await page.textContent('#save'), 'Save without a number?');
  assert.equal(await page.locator('#formNote:not([hidden])').count(), 0, 'no stale error while asking');
  assert.equal((await calls()).length, before, 'first tap must not save');
  if (shots) await page.screenshot({ path: path.join(shots, 'app-form.png'), fullPage: true });
  await page.click('#save');
  await page.waitForSelector('#toast:has-text("Saved")');

  // ---- Saved: top of his list, in the sheet, draft gone. ----
  assert.deepEqual(await page.$$eval('.card .name', (els) => els.map((e) => e.textContent)),
    ['Askari Heights', EVIL, 'F-11 Tower']);
  assert.equal(await page.locator('.card').nth(0).locator('.nonum').count(), 1);
  const saved = sitesRows()[4];
  assert.deepEqual([saved[0], saved[1], saved[3], saved[4], saved[5], saved[7], saved[8], saved[9]],
    ['S000004', 'RIA', 'Askari Heights', 'Project Owner', 'DHA', '', 'Tile Grouts | Mortars, Plasters & Putties', 'Visited / Lead']);
  assert.equal(await page.locator('#draftBanner:not([hidden])').count(), 0);

  // ---- Save tapped straight after typing a team number: the warning still shows. ----
  await page.click('#newSite');
  await page.fill('#f-name', 'Quick Save');
  await page.click('#f-buyer .pill:has-text("Dealer")');
  await page.fill('#f-phone', '0300 7654321');
  await page.click('#save');
  await page.waitForSelector('#toast:has-text("Saved. Someone in the team already works with this contact.")');
  assert.equal(sitesRows().length, 6);

  // ---- Reply lost on a weak signal, he taps Save again: saved once. ----
  await page.click('#newSite');
  await page.fill('#f-name', 'Once Only');
  await page.click('#f-buyer .pill:has-text("Dealer")');
  await page.fill('#f-phone', '0321 9998888');
  await page.evaluate(() => { window.__loseReply = true; });
  await page.click('#save');
  await page.waitForSelector('#formNote:has-text("no signal")');
  assert.equal(sitesRows().length, 7, 'the server did save it');
  await page.evaluate(() => { window.__loseReply = false; });
  await page.click('#save');
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.equal(sitesRows().length, 7, 'the second tap did not save it again');
  assert.equal((await page.$$eval('.card .name', (els) => els.map((e) => e.textContent))).filter((n) => n === 'Once Only').length, 1);

  // ---- A second site: a new area and a picked date. ----
  await page.click('#newSite');
  assert.equal(await page.inputValue('#f-name'), '', 'a fresh form after saving');
  await page.fill('#f-name', 'Saddar Site');
  await page.click('#f-buyer .pill:has-text("Dealer")');
  await page.fill('#f-phone', '0333 1112222');
  await page.click('#f-areas .pill:has-text("+ New area")');
  await page.fill('#f-newarea', 'Saddar');
  await page.click('#f-follow .pill:has-text("Pick date")');
  const today = await page.evaluate(() => document.getElementById('f-date').min);
  const [y, m, d] = today.split('-').map(Number);
  const picked = new Date(Date.UTC(y, m - 1, d + 10)).toISOString().slice(0, 10);
  await page.fill('#f-date', picked);
  await page.click('#save');
  await page.waitForSelector('#toast:has-text("Saved")');
  const second = sitesRows()[sitesRows().length - 1];
  assert.equal(second[5], 'Saddar');
  assert.equal(second[7], '923331112222');
  const lists = world.diary.getSheetByName('Lists').getDataRange().getValues();
  assert.deepEqual(lists[lists.length - 1].slice(0, 5), ['area', 'Saddar', 'North', 'RIA', true]);

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("PASS: the salesman's page behaves as spec 003 says.");
})().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
