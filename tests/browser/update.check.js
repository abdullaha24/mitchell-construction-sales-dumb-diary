'use strict';
// End to end for updating a site (spec 004): the real doGet renders App.html with the real
// server code running against fake sheets; the page's google.script.run calls go back to that
// same code. Chromium at a cheap-phone size. Run: npm run check:browser.
// Usage: node tests/browser/update.check.js [screenshot-folder]

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

function buildWorld() {
  const D = (iso) => new Date(iso);
  const site = (id, rep, name, phone, created) => [id, rep, rep === 'RIA' ? 'North' : 'Center', name, 'Dealer', 'DHA',
    'Asif', phone, 'Tile Adhesives', 'Visited / Lead', '', '', '', D(created), 'first visit', D(created), D(created)];
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives', 'Tile Grouts'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Credit Terms', 'Competitor Approved', 'Site Delayed', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  lists.push(['area', 'DHA', 'North', 'RIA', true, 10]);
  const diary = makeSpreadsheet({
    Sites: [SITES,
      site('S000001', 'RIA', 'F-11 Tower', '923001234567', '2026-10-03T05:00:00Z'),
      site('S000002', 'SH', 'Gulberg Mall', '923007654321', '2026-10-02T05:00:00Z'),
      site('S000003', 'RIA', 'Blue Area', '', '2026-10-01T05:00:00Z')],
    Activity: [ACTIVITY],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D('2026-10-01T05:00:00Z')]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(),
    CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

function stub() {
  window.__calls = [];
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
          window.__calls.push(prop);
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  const file = path.join(dir, 'app.html');
  fs.writeFileSync(file, world.s.doGet({ parameter: { k: RIA } }).getContent());

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 })).newPage();
  await page.exposeFunction('__server', (name, argsJson) => {
    if (!['repLoad', 'repCheckPhone', 'repAddSite', 'repUpdateSite', 'repEditSite', 'repSaveStatus'].includes(name)) throw new Error(`page called ${name}`);
    return JSON.stringify(world.s[name](...JSON.parse(argsJson)));
  });
  await page.addInitScript(stub);
  await page.goto(`file://${file}`);
  const row = (n) => Object.fromEntries(SITES.map((h, i) => [h, world.diary.getSheetByName('Sites').getDataRange().getValues()[n][i]]));
  const activity = () => world.diary.getSheetByName('Activity').getDataRange().getValues().slice(1);
  const openSite = async (name) => { await page.click(`.card:has-text("${name}")`); await page.waitForSelector('#siteView:not([hidden])'); };
  const save = async () => page.click('#save');
  const problem = async () => page.textContent('#u-problem');

  // ---- Site screen: details, stage pre-picked, Update form. ----
  await page.waitForSelector('.card');
  await openSite('F-11 Tower');
  assert.equal(await page.textContent('#siteHead h2'), 'F-11 Tower');
  assert.ok((await page.textContent('#siteHead')).includes('“first visit”'));
  assert.ok((await page.textContent('#siteHead')).includes('Asif · 0300 1234567'), 'number shown the familiar way');
  assert.equal(await page.getAttribute('#u-stage .pill:has-text("Visited / Lead")', 'aria-pressed'), 'true');
  assert.equal(await page.isHidden('#u-valueBox'), true);
  assert.equal(await page.isHidden('#u-phoneBox'), true, 'it has a number');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360, 'no sideways scrolling');

  // ---- Rate Quoted: total value and Cash / Credit are required. ----
  await page.click('#u-stage .pill:has-text("Rate Quoted")');
  assert.equal(await page.isVisible('#u-valueBox'), true);
  await save();
  assert.equal(await problem(), 'Type the total Rs. value.');
  await page.fill('#u-value', '450,000');
  await save();
  assert.equal(await problem(), 'Tap Cash or Credit.');
  await page.click('#u-terms .pill:has-text("Credit")');
  await page.click('#u-follow .pill:has-text("3 days")');
  await page.fill('#u-note', 'WP-100 @ 1,450');
  if (shots) await page.screenshot({ path: path.join(shots, 'update-quote.png'), fullPage: true });
  await save();
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.equal(await page.isVisible('#listView'), true, 'back to his list');
  assert.ok((await page.textContent('.card:has-text("F-11 Tower")')).includes('Rs. 450,000 · Credit'));
  assert.deepEqual([row(1).stage, row(1).value_rs, row(1).payment_terms, row(1).last_note],
    ['Rate Quoted', 450000, 'Credit', 'WP-100 @ 1,450']);
  if (shots) await page.screenshot({ path: path.join(shots, 'update-list.png') });

  // ---- A site with a date ahead keeps it unless he picks another; Back throws away the draft. ----
  await openSite('F-11 Tower');
  const firstFollow = page.locator('#u-follow .pill').first();
  assert.match(await firstFollow.textContent(), /^Keep \d+ \w{3}$/);
  assert.equal(await firstFollow.getAttribute('aria-pressed'), 'true');
  await page.fill('#u-note', 'not saved');
  await page.click('#cancel');
  await openSite('F-11 Tower');
  assert.equal(await page.inputValue('#u-note'), '', 'Back threw the unsaved update away');

  // ---- Won: no follow-up asked; value shown again. A correction after a lost reply is saved. ----
  await page.click('#u-stage .pill:has-text("Won (Order)")');
  assert.equal(await page.isHidden('#u-followBox'), true);
  assert.equal(await page.inputValue('#u-value'), '450000');
  assert.equal(await page.getAttribute('#u-terms .pill:has-text("Credit")', 'aria-pressed'), 'true');
  await page.evaluate(() => { window.__loseReply = true; });
  await save();
  await page.waitForSelector('.card.failed');
  assert.equal(row(1).value_rs, 450000, 'the first save did land');
  await page.click('.card.failed');
  assert.equal(await page.isVisible('#siteView'), true, 'reopened on the site, as he left it');
  assert.equal(await page.inputValue('#u-value'), '450000');
  assert.equal(await page.textContent('#u-problem'), 'Not saved: no signal. Check and tap Save again.');
  await page.fill('#u-value', '600,000');
  await page.evaluate(() => { window.__loseReply = false; });
  await save();
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.deepEqual([row(1).stage, row(1).next_followup, row(1).value_rs], ['Won (Order)', '', 600000], 'the correction was saved');

  // ---- Lost: a reason; Other needs a note. ----
  await openSite('F-11 Tower');
  await page.click('#u-stage .pill:has-text("Lost / Dead")');
  await save();
  assert.equal(await problem(), 'Tap a lost reason.');
  await page.click('#u-lost .pill:has-text("Other")');
  assert.equal(await page.textContent('#u-noteOpt'), '(needed for Other)');
  await save();
  assert.equal(await problem(), 'Write a short note for Other.');
  await page.fill('#u-note', 'went with a local brand');
  await save();
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.deepEqual([row(1).stage, row(1).lost_reason, row(1).last_note], ['Lost / Dead', 'Other', 'went with a local brand']);
  assert.deepEqual(activity().map((a) => `${a[4]} ${a[5]}>${a[6]}`), [
    'stage_change Visited / Lead>Rate Quoted', 'stage_change Rate Quoted>Won (Order)',
    'update >', 'stage_change Won (Order)>Lost / Dead',
  ], 'the corrected Won is a second history row (same stage: an update)');

  // ---- The number gate on a site without a number. ----
  await openSite('Blue Area');
  await page.click('#u-stage .pill:has-text("Sample / Trial")');
  assert.equal(await page.isVisible('#u-phoneBox'), true);
  assert.equal(await page.textContent('#u-phoneLabel'), "Add the contact's number to move this site to Sample / Trial");
  await save();
  assert.equal(await problem(), "Add the contact's number to move this site to Sample / Trial.");
  await page.fill('#u-phone', '0300 7654321');
  await page.waitForSelector('#u-phoneNote:not([hidden])');
  assert.equal(await page.textContent('#u-phoneNote'), 'Someone in the team already works with this contact.');
  // A draft survives a reload.
  await page.fill('#u-note', 'trial bags dropped');
  await page.reload();
  await openSite('Blue Area');
  assert.equal(await page.inputValue('#u-note'), 'trial bags dropped');
  assert.equal(await page.inputValue('#u-phone'), '0300 7654321');
  await save();
  await page.waitForSelector('#toast:has-text("Saved. Someone in the team already works with this contact.")');
  assert.deepEqual([row(3).stage, row(3).contact_phone], ['Sample / Trial', '923007654321']);
  assert.equal(await page.locator('.card:has-text("Blue Area") .nonum').count(), 0);

  // ---- Edit details: filled in, no follow-up, number can't be removed. ----
  await openSite('Blue Area');
  await page.click('#editDetails');
  assert.equal(await page.textContent('#formTitle'), 'Edit details');
  assert.equal(await page.inputValue('#f-name'), 'Blue Area');
  assert.equal(await page.inputValue('#f-phone'), '0300 7654321', 'filled in the familiar way');
  assert.equal(await page.isHidden('#f-followBox'), true);
  await page.fill('#f-phone', '');
  await save();
  assert.equal(await page.textContent('#formNote'), "A site's number can be changed, not removed.");
  await page.fill('#f-phone', '0321 5556666');
  await page.fill('#f-name', 'Blue Area Plaza');
  await save();
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.equal(await page.isVisible('#siteView'), true, 'back on the site screen');
  assert.equal(await page.textContent('#siteHead h2'), 'Blue Area Plaza');
  const last = activity().pop();
  assert.deepEqual([last[4], last[10]], ['details', 'Site name; Phone 923007654321 → 923215556666']);

  // ---- Back goes up one screen at a time. ----
  await page.click('#editDetails');
  await page.click('#cancel');
  assert.equal(await page.isVisible('#siteView'), true);
  await page.click('#cancel');
  assert.equal(await page.isVisible('#listView'), true);
  assert.equal(await page.locator('text=Gulberg Mall').count(), 0, "never another salesman's site");

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: updating a site behaves as spec 004 says.');
})().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
