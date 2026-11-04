'use strict';
// End to end for spec 007: the site card helpers (Call, WhatsApp, the last-spoken line, going
// cold, Snooze) and the area filter, on the real doGet + server code against fake sheets, in
// Chromium at a cheap-phone size. Dates are built around the real "today" in Pakistan time.
// Usage: node tests/browser/cards.check.js [screenshot-folder]

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
const { META_TIME_ZONE } = require('../fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);
const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in Pakistan, as yyyy-MM-dd, `offset` days away. */
function dayKey(offset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() + offset * DAY));
}
/** Midnight Pakistan time of a day `offset` days away, plus `hours`. */
function dayCell(offset, hours = 0) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}
const short = (key) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
const LONG_NOTE = 'Quoted WP-100 and WP-200 for the basement and the roof, consultant wants a trial patch first, '
  + 'then a meeting with the owner after Eid, then the final rate will be decided with the contractor on site';

function buildWorld() {
  const created = (n) => dayCell(-40, n); // later n = newer
  const lastYear = `${Number(dayKey(0).slice(0, 4)) - 1}-10-22`;
  const [ly, lm, ld] = lastYear.split('-').map(Number);
  const lastYearCell = new Date(Date.UTC(ly, lm - 1, ld, 6));
  const site = (o) => SITES.map((h) => ({
    rep: 'RIA', region: 'North', buyer_type: 'Dealer', products: 'Tile Adhesives', contact_name: 'Asif', ...o,
  })[h] ?? '');
  const rows = [
    site({ site_id: 'S000001', site_name: 'Cold Quote', area: 'DHA', contact_phone: '923001234567', stage: 'Rate Quoted',
      value_rs: 450000, payment_terms: 'Credit', next_followup: dayCell(-1), last_note: 'Quoted WP-100 @ Rs. 1,450, waiting for consultant',
      created_at: created(1), updated_at: dayCell(-1, 9), worked_at: dayCell(-7, 10), note_at: dayCell(-8, 10) }),
    site({ site_id: 'S000002', site_name: 'Warm Quote', area: 'DHA', contact_phone: '923331112222', stage: 'Rate Quoted',
      value_rs: 200000, payment_terms: 'Cash', next_followup: dayCell(2), created_at: created(2), worked_at: dayCell(-6, 10) }),
    site({ site_id: 'S000003', site_name: 'Trial Site', area: 'DHA', contact_phone: '924235761234', stage: 'Sample / Trial',
      next_followup: dayCell(0), created_at: created(3), worked_at: dayCell(-10, 10) }),
    site({ site_id: 'S000004', site_name: 'No Number', area: 'Gulberg', stage: 'Visited / Lead',
      next_followup: dayCell(3), created_at: created(4), worked_at: created(4) }),
    site({ site_id: 'S000005', site_name: 'No Number Due', area: 'Saddar', stage: 'Visited / Lead',
      next_followup: dayCell(-2), created_at: created(5), worked_at: created(5) }),
    site({ site_id: 'S000006', site_name: 'Old Note', area: 'D.H.A', contact_phone: '923451234000', stage: 'Visited / Lead',
      next_followup: dayCell(5), last_note: LONG_NOTE, note_at: lastYearCell, created_at: created(6), worked_at: dayCell(-1) }),
    site({ site_id: 'S000007', site_name: 'Abroad', area: 'Bahria', contact_phone: '971501234567', stage: 'Won (Order)',
      value_rs: 900000, payment_terms: 'Cash', created_at: created(7), worked_at: dayCell(-30) }),
    site({ site_id: 'S000008', site_name: 'Hand Typed', contact_phone: '923219876543', stage: 'Rate Quoted', value_rs: 100000,
      payment_terms: 'Cash', next_followup: dayCell(4), created_at: dayCell(-9, 10) }),
    site({ site_id: 'S000010', site_name: 'Spare Due', contact_phone: '923001112223', stage: 'Visited / Lead',
      next_followup: dayCell(-3), created_at: created(10), worked_at: created(10) }),
    site({ site_id: 'S000009', rep: 'SH', region: 'Center', site_name: 'Gulberg Mall', area: 'Gulberg', contact_phone: '923007654321',
      stage: 'Rate Quoted', value_rs: 1, payment_terms: 'Cash', next_followup: dayCell(-5), created_at: created(9), worked_at: dayCell(-20) }),
  ];
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  ['DHA', 'Gulberg', 'Saddar', 'Bahria', 'F-10'].forEach((v, i) => lists.push(['area', v, 'North', 'RIA', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, created(0)]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ['RIA', 'North'], ['SH', 'Center']],
    'Rep-Targets': [['Rep', 'Month', 'Target']],
    Targets: [['Region', 'Month', 'Target']],
  }, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary, lastYear };
}

function stub() {
  window.__calls = [];
  window.__offline = false;
  window.__opened = [];
  // Call and WhatsApp links are recorded instead of followed (caught on the way down; the page's
  // own handler on the link still runs: it is what keeps the tap from opening the site screen).
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a) { e.preventDefault(); window.__opened.push(`${a.target} ${a.getAttribute('href')}`); }
  }, true);
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
          const go = () => window.__server(prop, JSON.stringify(args)).then(
            (json) => success && success(JSON.parse(json)),
            (error) => failure && failure({ message: String(error.message || error).replace(/^Error: /, '') }));
          if (window.__delay) setTimeout(go, window.__delay); else go();
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
    if (!['repLoad', 'repCheckPhone', 'repAddSite', 'repUpdateSite', 'repEditSite', 'repSaveStatus', 'repSnoozeSite'].includes(name)) {
      throw new Error(`page called ${name}`);
    }
    return JSON.stringify(world.s[name](...JSON.parse(argsJson)));
  });
  await page.addInitScript(stub);
  await page.goto(`file://${file}`);
  await page.waitForSelector('#who');

  const calls = () => page.evaluate(() => window.__calls.slice());
  const names = () => page.$$eval('#sites .card .name', (els) => els.map((e) => e.textContent));
  const card = (name) => page.locator(`#sites .card:has(.name:text-is("${name}"))`);
  const buttons = (name) => card(name).locator('.btnrow > *').allTextContents();
  const classes = async (name) => (await card(name).getAttribute('class')).split(' ');
  const noSideways = async (what) =>
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360, `no sideways scrolling: ${what}`);
  const sitesRow = (id) => {
    const values = world.diary.getSheetByName('Sites').getDataRange().getValues();
    const row = values.find((r) => r[0] === id);
    return Object.fromEntries(SITES.map((h, i) => [h, row[i]]));
  };
  const activity = () => world.diary.getSheetByName('Activity').getDataRange().getValues().slice(1)
    .map((r) => Object.fromEntries(ACTIVITY.map((h, i) => [h, r[i]])));
  const settled = () => page.waitForFunction(() => !document.querySelector('.tag.saving'));

  // ---- Today's Chase: the cards, their buttons, going cold, the last-spoken line. ----
  assert.deepEqual(await names(), ['Spare Due', 'No Number Due', 'Cold Quote', 'Trial Site']);
  assert.deepEqual(await buttons('Cold Quote'), ['Call', 'WhatsApp', 'Snooze']);
  assert.deepEqual(await buttons('Trial Site'), ['Call', 'Snooze'], 'a landline has no WhatsApp');
  assert.deepEqual(await buttons('No Number Due'), ['Snooze'], 'no number: no Call or WhatsApp');
  assert.equal(await card('Cold Quote').locator('a.call').getAttribute('href'), 'tel:+923001234567');
  assert.equal(await card('Cold Quote').locator('a.wa').getAttribute('href'), 'https://wa.me/923001234567', 'an empty chat (P6-3)');
  assert.equal(await card('Trial Site').locator('a.call').getAttribute('href'), 'tel:+924235761234');
  assert.ok((await classes('Cold Quote')).includes('cold') && (await classes('Cold Quote')).includes('late'), 'cold and late');
  assert.equal(await card('Cold Quote').locator('.tag.cold').textContent(), 'Going cold · no update for 7 days');
  assert.equal(await card('Trial Site').locator('.tag.cold').textContent(), 'Going cold · no update for 10 days');
  assert.ok(!(await classes('No Number Due')).includes('cold'), 'Visited / Lead never goes cold');
  assert.equal(await card('Cold Quote').locator('.said').textContent(),
    `${short(dayKey(-8))}: Quoted WP-100 @ Rs. 1,450, waiting for consultant`);
  assert.equal(await card('Trial Site').locator('.said').count(), 0, 'no note, no line');
  // The three buttons share one row inside the card on a 360px phone.
  const tops = await card('Cold Quote').locator('.btnrow > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  assert.equal(new Set(tops).size, 1, 'one row');
  const heights = await card('Cold Quote').locator('.btnrow > *').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  assert.ok(heights.every((h) => h >= 44), 'big enough to tap');
  await noSideways('Today\'s Chase');
  if (shots) await page.screenshot({ path: path.join(shots, 'cards-chase.png') });

  // ---- Call and WhatsApp: only the link, never the site screen, nothing sent or logged. ----
  await card('Cold Quote').locator('a.call').click();
  await card('Cold Quote').locator('a.wa').click();
  assert.deepEqual(await page.evaluate(() => window.__opened), ['_top tel:+923001234567', '_blank https://wa.me/923001234567']);
  assert.equal(await page.isHidden('#siteView'), true, 'a button never opens the site screen');
  assert.deepEqual(await calls(), [], 'not logged (P6-4): no trip to Google');

  // ---- Snooze: Cancel and tapping outside change nothing. ----
  await card('Cold Quote').locator('button.snooze').click();
  assert.equal(await page.isHidden('#siteView'), true, 'Snooze never opens the site screen');
  assert.equal(await page.isVisible('#snoozeSheet'), true);
  assert.equal(await page.textContent('#snoozeTitle'), 'Snooze Cold Quote to:');
  assert.deepEqual(await page.$$eval('#snoozeChoices .big', (els) => els.map((e) => e.textContent)),
    [`Tomorrow${short(dayKey(1))}`, `3 days${short(dayKey(3))}`, `1 week${short(dayKey(7))}`]);
  await noSideways('Snooze panel');
  if (shots) await page.screenshot({ path: path.join(shots, 'cards-snooze.png') });
  await page.click('#snoozeCancel');
  assert.equal(await page.isHidden('#snoozeSheet'), true);
  await card('Cold Quote').locator('button.snooze').click();
  await page.mouse.click(180, 60); // the dimmed list above the panel
  assert.equal(await page.isHidden('#snoozeSheet'), true);
  assert.deepEqual(await calls(), [], 'nothing sent');

  // ---- Snooze → 3 days: out of Today's Chase at once, still cold; saved as a snooze. ----
  await page.evaluate(() => { window.__delay = 700; });
  await card('Cold Quote').locator('button.snooze').click();
  await page.click('#snoozeChoices .big:has-text("3 days")');
  assert.deepEqual(await names(), ['Spare Due', 'No Number Due', 'Trial Site'], 'gone from Today\'s Chase at once');
  await page.waitForSelector(`#toast:has-text("Snoozed to ${short(dayKey(3))}")`);
  await page.click('#tab-hot');
  assert.equal(await card('Cold Quote').locator('.tag.saving').textContent(), 'Saving…');
  assert.ok((await classes('Cold Quote')).includes('cold'), 'Snooze does not reset going cold (P6-2)');
  assert.deepEqual(await buttons('Cold Quote'), ['Call', 'WhatsApp'], 'not due any more: no Snooze');
  await settled();
  await page.evaluate(() => { window.__delay = 0; });
  assert.ok((await classes('Cold Quote')).includes('cold'), 'still cold after Google confirms');
  let row = sitesRow('S000001');
  assert.equal(row.next_followup.getTime(), dayCell(3).getTime());
  assert.equal(row.worked_at.getTime(), dayCell(-7, 10).getTime(), 'worked_at untouched');
  assert.deepEqual(activity().map((a) => [a.site_id, a.action]), [['S000001', 'snooze']]);
  assert.ok((await calls()).includes('repSnoozeSite'));

  // ---- A snooze that didn't go through: orange on every tab; its tap reopens the panel. ----
  await page.click('#tab-chase');
  await page.evaluate(() => { window.__offline = true; });
  await card('Trial Site').locator('button.snooze').click();
  await page.click('#snoozeChoices .big:has-text("Tomorrow")');
  await page.waitForSelector('.card.failed');
  for (const tab of ['chase', 'hot', 'all']) {
    await page.click(`#tab-${tab}`);
    assert.equal((await names())[0], 'Trial Site', `failed snooze on top of ${tab}`);
  }
  assert.ok((await classes('Trial Site')).includes('cold'));
  assert.equal(await card('Trial Site').evaluate((e) => getComputedStyle(e).borderTopColor), 'rgb(180, 83, 9)',
    'a failed save on a going-cold card has the orange edge');
  await page.evaluate(() => { window.__offline = false; });
  await card('Trial Site').click();
  assert.equal(await page.isVisible('#snoozeSheet'), true, 'the panel, not the site screen');
  assert.equal(await page.textContent('#snoozeProblem'), 'Not saved: no signal. Tap a day again.');
  assert.equal(await page.isHidden('#snoozeCancel'), true);
  assert.deepEqual(await page.$$eval('#snoozeRetry button', (els) => els.map((e) => e.textContent)), ['Open site', "Don't snooze"]);
  await page.click('#snoozeChoices .big:has-text("Tomorrow")');
  await page.waitForFunction(() => !document.querySelector('.card.failed') && !document.querySelector('.tag.saving'));
  assert.equal(sitesRow('S000003').next_followup.getTime(), dayCell(1).getTime());
  assert.equal(activity().filter((a) => a.site_id === 'S000003').length, 1, 'saved once');

  // ---- A failed snooze never traps the site: Open site, and an Update replaces the snooze. ----
  await page.click('#tab-chase');
  await page.evaluate(() => { window.__offline = true; });
  await card('Spare Due').locator('button.snooze').click();
  await page.click('#snoozeChoices .big:has-text("Tomorrow")');
  await page.waitForSelector('.card.failed');
  await page.evaluate(() => { window.__offline = false; });
  await card('Spare Due').click();
  await page.click('#snoozeOpen');
  assert.equal(await page.isVisible('#siteView'), true, 'Open site: the site screen');
  assert.equal(await page.isHidden('#snoozeSheet'), true);
  assert.equal(await page.textContent('#siteHead h2'), 'Spare Due');
  await page.fill('#u-note', 'visited, call on Friday');
  await page.click('#save');
  await page.waitForFunction(() => !document.querySelector('.card.failed') && !document.querySelector('.tag.saving'));
  assert.deepEqual(activity().filter((a) => a.site_id === 'S000010').map((a) => a.action), ['update'],
    'the Update went through; the failed snooze is gone, never sent');
  assert.equal(await page.evaluate(() => queue.length), 0);

  // ---- A snooze Google refuses for good (the site was marked Lost elsewhere): Don't snooze. ----
  const sheet = world.diary.getSheetByName('Sites');
  const at = sheet.getDataRange().getValues().findIndex((r) => r[0] === 'S000005');
  sheet.getRange(at + 1, SITES.indexOf('stage') + 1).setValues([['Lost / Dead']]);
  await page.click('#tab-chase');
  await card('No Number Due').locator('button.snooze').click();
  await page.click('#snoozeChoices .big:has-text("1 week")');
  await page.waitForSelector('.card.failed');
  assert.ok((await card('No Number Due').textContent()).includes('Won and Lost sites have no follow-up.'));
  await card('No Number Due').click();
  await page.click('#snoozeOpen');
  assert.equal(await page.textContent('#siteHead h2'), 'No Number Due', 'he can still open it');
  await page.click('#cancel');
  assert.equal(await page.locator('.card.failed').count(), 1, 'Back keeps it, as for any failed save');
  await card('No Number Due').click();
  await page.click('#snoozeDrop');
  await page.waitForSelector('#toast:has-text("Not snoozed")');
  await page.waitForFunction(() => !document.querySelector('.card.failed'));
  await page.click('#tab-all');
  await page.waitForFunction(() => /Lost \/ Dead/.test(document.querySelector('#sites').textContent));
  assert.equal(await card('No Number Due').locator('.tag.lost').textContent(), 'Lost / Dead', 'his list as Google has it');
  assert.equal(await page.evaluate(() => queue.length), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('salesdiary.queue.RIA'))), [], 'gone for good');
  assert.equal(activity().filter((a) => a.site_id === 'S000005').length, 0);

  // ---- Hot Pipeline: 6 days is not cold; a row typed by hand goes cold from created_at. ----
  await page.click('#tab-hot');
  assert.ok(!(await classes('Warm Quote')).includes('cold'), '6 days: not yet');
  assert.equal(await card('Hand Typed').locator('.tag.cold').textContent(), 'Going cold · no update for 9 days');

  // ---- The site screen: Call / WhatsApp (no Snooze), going cold, the note with its day. ----
  await card('Cold Quote').click();
  assert.deepEqual(await page.$$eval('#siteHead .btnrow > *', (els) => els.map((e) => e.textContent)), ['Call', 'WhatsApp']);
  assert.equal(await page.textContent('#siteHead .tag.cold'), 'Going cold · no update for 7 days');
  assert.equal(await page.textContent('#siteHead .said'), `${short(dayKey(-8))}: “Quoted WP-100 @ Rs. 1,450, waiting for consultant”`);
  await noSideways('site screen');

  // ---- Edit details does not reset going cold (P6-2). ----
  await page.click('#editDetails');
  await page.fill('#f-name', 'Cold Quote B');
  await page.click('#save');
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.equal(await page.textContent('#siteHead .tag.cold'), 'Going cold · no update for 7 days');
  await page.click('#cancel');
  assert.ok((await classes('Cold Quote B')).includes('cold'));
  assert.equal(sitesRow('S000001').worked_at.getTime(), dayCell(-7, 10).getTime());

  // ---- An Update resets it at once, before Google confirms. ----
  await page.evaluate(() => { window.__delay = 700; });
  await card('Hand Typed').click();
  await page.fill('#u-note', 'called, rate holds');
  await page.click('#save');
  assert.ok(!(await classes('Hand Typed')).includes('cold'), 'not yellow any more, at once');
  assert.equal(await card('Hand Typed').locator('.said').textContent(), `${short(dayKey(0))}: called, rate holds`);
  await settled();
  await page.evaluate(() => { window.__delay = 0; });
  assert.ok(!(await classes('Hand Typed')).includes('cold'));
  row = sitesRow('S000008');
  const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';
  assert.ok(isDate(row.worked_at) && isDate(row.note_at) && row.worked_at.getTime() === row.note_at.getTime());

  // ---- All My Parties: no number, no buttons; abroad gets WhatsApp; a long, old note. ----
  await page.click('#tab-all');
  assert.equal(await card('No Number').locator('.btnrow').count(), 0, 'no number and not due: no buttons');
  assert.deepEqual(await buttons('Abroad'), ['Call', 'WhatsApp'], 'a number from abroad, Won: no Snooze');
  assert.equal(await card('Abroad').locator('a.wa').getAttribute('href'), 'https://wa.me/971501234567');
  const said = card('Old Note').locator('.said');
  assert.ok((await said.textContent()).startsWith(`${short(world.lastYear)} ${world.lastYear.slice(0, 4)}: Quoted WP-100`), 'another year shows the year');
  const box = await said.evaluate((e) => ({ height: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) }));
  assert.ok(box.height <= box.line * 2 + 1, 'two lines at most on the card');
  assert.equal(await page.locator('text=Gulberg Mall').count(), 0, 'never another salesman\'s site');
  await noSideways('All My Parties');

  // ---- The area filter: his areas, most sites first; with search; ✕ and All areas. ----
  const pills = () => page.$$eval('#areaRow .pill', (els) => els.map((e) => e.textContent));
  const picked = () => page.$$eval('#areaRow .pill[aria-pressed=true]', (els) => els.map((e) => e.textContent));
  assert.deepEqual(await pills(), ['All areas', 'DHA 4', 'Bahria 1', 'Gulberg 1', 'Saddar 1'],
    'DHA and D.H.A count as one, under the spelling most use; no F-10 (none of his sites); nobody else\'s areas');
  assert.deepEqual(await picked(), ['All areas']);
  assert.deepEqual(await page.$$eval('#areaRow .pill .n', (els) => els.map((e) => e.textContent)), ['4', '1', '1', '1'],
    'the count is its own badge, never part of the area name');
  const before = await calls();
  await page.click('#areaRow .pill:has-text("DHA 4")');
  assert.deepEqual(await names(), ['Old Note', 'Trial Site', 'Warm Quote', 'Cold Quote B'], 'his DHA sites, newest first');
  assert.deepEqual(await picked(), ['DHA 4']);
  if (shots) await page.screenshot({ path: path.join(shots, 'cards-area.png') });
  const search = async (text) => { await page.fill('#search', text); await page.waitForTimeout(200); return names(); };
  assert.deepEqual(await search('sample'), ['Trial Site'], 'area and search together');
  assert.deepEqual(await search('zzz'), []);
  assert.equal(await page.textContent('#sites .empty'), 'No site in DHA matches "zzz".');
  await page.click('#clearSearch');
  assert.equal((await names()).length, 4, '✕ clears the search, keeps the area');
  await page.click('#tab-chase');
  await page.click('#tab-all');
  assert.deepEqual(await picked(), ['DHA 4'], 'kept while switching tabs');
  await page.click('#areaRow .pill:has-text("DHA 4")');
  assert.equal((await names()).length, 9, 'tapping DHA again shows everything');
  await page.click('#areaRow .pill:has-text("Saddar 1")');
  await search('no number');
  assert.deepEqual(await names(), ['No Number Due']);
  await page.click('#areaRow .pill:has-text("All areas")');
  assert.deepEqual(await names(), ['No Number Due', 'No Number'], 'All areas keeps the search');
  assert.deepEqual(await calls(), before, 'the area filter needs no trip to Google');
  await page.click('#clearSearch');
  await noSideways('area row');

  // ---- Call / WhatsApp on a card still saving use the stored number, never the typed one. ----
  await page.evaluate(() => { window.__delay = 700; });
  await card('No Number').click();
  await page.click('#u-stage .pill:has-text("Sample / Trial")');
  await page.fill('#u-phone', '042 3576 1234');
  await page.click('#save');
  assert.equal(await card('No Number').locator('.tag.saving').count(), 1, 'still saving');
  assert.deepEqual(await card('No Number').locator('.btnrow > a').evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
    ['tel:+924235761234'], 'tidied as Google will store it; a landline gets no WhatsApp');
  await settled();
  assert.equal(sitesRow('S000004').contact_phone, '924235761234');
  await card('Abroad').click();
  await page.click('#editDetails');
  assert.equal(await page.inputValue('#f-phone'), '+971501234567', 'shown the way he knows it');
  await page.fill('#f-contact', 'Asif (Dubai)');
  await page.click('#save');
  const links = ['tel:+971501234567', 'https://wa.me/971501234567'];
  assert.deepEqual(await page.$$eval('#siteHead .btnrow > a', (els) => els.map((e) => e.getAttribute('href'))), links,
    'Edit details keeps the stored number');
  await page.click('#cancel');
  assert.equal(await card('Abroad').locator('.tag.saving').count(), 1, 'still saving');
  assert.deepEqual(await card('Abroad').locator('.btnrow > a').evaluateAll((els) => els.map((e) => e.getAttribute('href'))), links);
  await settled();

  // ---- + New Site lands on All My Parties with the search and the area cleared. ----
  await page.click('#areaRow .pill:has-text("Bahria 1")');
  await page.click('#newSite');
  await page.fill('#f-name', 'Fresh Lead');
  await page.click('#f-buyer .pill:has-text("Dealer")');
  await page.fill('#f-phone', '0300 9990001');
  await page.fill('#f-note', 'met at site');
  await page.click('#save');
  assert.deepEqual(await picked(), ['All areas']);
  assert.equal((await names())[0], 'Fresh Lead');
  assert.equal(await card('Fresh Lead').locator('.tag.saving').count(), 1, 'still saving');
  assert.deepEqual(await card('Fresh Lead').locator('.btnrow > a').evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
    ['tel:+923009990001', 'https://wa.me/923009990001'], 'a new site: the stored form while it saves');
  assert.equal(await card('Fresh Lead').locator('.said').textContent(), `${short(dayKey(0))}: met at site`);
  await settled();
  assert.equal(await card('Fresh Lead').locator('.said').textContent(), `${short(dayKey(0))}: met at site`, 'the server agrees');

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: the site card helpers and the area filter behave as spec 007 says.');
})().catch((error) => {
  console.error('FAIL:', error.stack || error.message);
  process.exit(1);
});
