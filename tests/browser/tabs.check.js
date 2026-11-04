'use strict';
// End to end for spec 006: the three tabs (Today's Chase, Hot Pipeline, All My Parties with
// search) and his target, on the real doGet + server code against fake sheets, in Chromium at
// a cheap-phone size. Dates are built around the real "today" in Pakistan time.
// Usage: node tests/browser/tabs.check.js [screenshot-folder]

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
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

/** Today in Pakistan, as yyyy-MM-dd, `offset` days away. */
function dayKey(offset, from = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(from + offset * DAY));
}
/** A follow-up cell: midnight Pakistan time, as the app writes it. */
function followCell(offset) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000);
}
const short = (key) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

const TARGETS = { RIA: 1234567, AUR: 7654321, SH: 5555555 };
const FILLERS = 120;

function buildWorld() {
  const created = (n) => new Date(Date.UTC(2026, 6, 1) + n * 60 * 60 * 1000); // later n = newer
  // [id, rep, name, area, contact, phone, stage, value, terms, follow-up offset (null = none), note, created n]
  const mine = [
    ['S000001', 'RIA', 'F-11 Tower', 'DHA', 'Asif', '923001234567', 'Visited / Lead', '', '', -3, 'first visit', 10],
    ['S000002', 'RIA', 'Bahria Plaza', 'Bahria', 'Kamran', '923331112222', 'Rate Quoted', 500000, 'Credit', -1, 'WP-100 @ 1,450', 20],
    ['S000003', 'RIA', 'Gulshan Homes', 'Gulshan', 'Bilal', '923451234000', 'Sample / Trial', '', '', 0, 'trial bags', 30],
    ['S000004', 'RIA', 'Askari Heights', 'DHA', 'Asif engineer', '923219876543', 'Rate Quoted', 900000, 'Cash', 2, '', 40],
    ['S000005', 'RIA', 'No Date Site', 'Saddar', 'Zahid', '', 'Visited / Lead', '', '', null, '', 50],
    ['S000006', 'RIA', 'Won Mall', 'DHA', 'Umar', '923001111111', 'Won (Order)', 2000000, 'Cash', null, '', 60],
    ['S000007', 'RIA', 'Lost Tower', 'DHA', 'Nadeem', '923002222222', 'Lost / Dead', 300000, 'Cash', null, 'went with rival', 70],
    ['S000009', 'RIA', 'Plot 71, Block 66', 'G-9', 'Tariq', '', 'Won (Order)', 100000, 'Cash', null, '', 5],
    ['S000008', 'SH', 'Gulberg Mall', 'Gulberg', 'Asif', '923001234567', 'Rate Quoted', 999999, 'Cash', -5, '', 80],
  ];
  const rows = mine.map(([id, rep, name, area, contact, phone, stage, value, terms, follow, note, n]) =>
    [id, rep, rep === 'RIA' ? 'North' : 'Center', name, 'Dealer', area, contact, phone, 'Tile Adhesives', stage, value, terms,
      stage === 'Lost / Dead' ? 'Price Too High' : '', follow === null ? '' : followCell(follow), note, created(n), created(n)]);
  // Older Visited / Lead sites with future follow-ups: only in All My Parties.
  for (let i = 1; i <= FILLERS; i++) {
    rows.push([`S${String(100 + i).padStart(6, '0')}`, 'RIA', 'North', `Filler ${i}`, 'Dealer', 'F-10', '', `92300555${String(1000 + i)}`,
      '', 'Visited / Lead', '', '', '', followCell(5), '', created(-i), created(-i)]);
  }
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer', 'Consultant'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, created(0)]],
  }, { name: 'Sales Diary' });
  // The 1st of this month at midnight Pakistan time: how Rep-Targets holds its months.
  const [year, monthNo] = dayKey(0).split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, monthNo - 1, 1) - 5 * 60 * 60 * 1000);
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ['RIA', 'North'], ['AUR', 'North'], ['SH', 'Center']],
    'Rep-Targets': [['Rep', 'Month', 'Target'], ...Object.entries(TARGETS).map(([rep, amount]) => [rep, monthStart, amount])],
    Targets: [['Region', 'Month', 'Target'], ['North', monthStart, 8888888]],
  }, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

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

async function openPage(browser, world, file, { clockAt } = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  if (clockAt !== undefined) await page.clock.install({ time: clockAt });
  await page.exposeFunction('__server', (name, argsJson) => {
    if (!['repLoad', 'repCheckPhone', 'repAddSite', 'repUpdateSite', 'repEditSite', 'repSaveStatus'].includes(name)) {
      throw new Error(`page called ${name}`);
    }
    return JSON.stringify(world.s[name](...JSON.parse(argsJson)));
  });
  await page.addInitScript(stub);
  await page.goto(`file://${file}`);
  await page.waitForSelector('#who');
  return { page, context };
}

const names = (page) => page.$$eval('#sites .card .name', (els) => els.map((e) => e.textContent));
const count = (page, tab) => page.textContent(`#tab-${tab} .count`);
const noSideways = async (page, what) =>
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360, `no sideways scrolling: ${what}`);

(async () => {
  const shots = process.argv[2];
  const world = buildWorld();
  const html = world.s.doGet({ parameter: { k: RIA } }).getContent();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  const file = path.join(dir, 'app.html');
  fs.writeFileSync(file, html);
  const browser = await chromium.launch();
  const { page } = await openPage(browser, world, file);
  const calls = () => page.evaluate(() => window.__calls.slice());

  // ---- His target: his own, this month; nobody else's on his page. ----
  const month = MONTH_NAMES[Number(dayKey(0).slice(5, 7)) - 1];
  assert.equal(await page.textContent('#target'), `${month} target: Rs. 1,234,567`);
  // On a 360px phone the button stays on one line and the amount stays in one piece, even for
  // the longest month and an 8-digit target.
  await page.evaluate(() => {
    const t = document.querySelector('#target span');
    t.textContent = 'Rs. 13,800,000';
    t.parentNode.firstChild.textContent = 'September target: ';
  });
  assert.equal(await page.evaluate(() => document.getElementById('newSite').getClientRects().length), 1);
  assert.ok(await page.evaluate(() => document.getElementById('newSite').getBoundingClientRect().height) < 56, '+ New Site on one line');
  assert.equal(await page.evaluate(() => document.querySelector('#target span').getClientRects().length), 1, 'amount not split');
  await noSideways(page, 'header');
  for (const other of ['7654321', '7,654,321', '5555555', '5,555,555', '8888888', '8,888,888']) {
    assert.ok(!html.includes(other), `${other} is not on RIA's page`);
  }

  // ---- Today's Chase: opens first; no date, then oldest late first, then today. ----
  assert.equal(await page.getAttribute('#tab-chase', 'aria-selected'), 'true');
  assert.deepEqual(await names(page), ['No Date Site', 'F-11 Tower', 'Bahria Plaza', 'Gulshan Homes']);
  assert.equal(await count(page, 'chase'), '4');
  assert.equal(await page.getAttribute('#tab-chase .count', 'class'), 'count late');
  assert.equal(await count(page, 'hot'), '3');
  assert.equal(await count(page, 'all'), String(8 + FILLERS));
  const card = (name) => page.locator(`#sites .card:has(.name:text-is("${name}"))`);
  assert.equal(await card('No Date Site').locator('.meta.nodate').textContent(), 'No follow-up date');
  assert.equal(await card('F-11 Tower').locator('.meta.late').textContent(), `Follow up: ${short(dayKey(-3))} · 3 days late`);
  assert.equal(await card('Bahria Plaza').locator('.meta.late').textContent(), `Follow up: ${short(dayKey(-1))} · 1 day late`);
  assert.ok((await card('Gulshan Homes').textContent()).includes('Follow up: Today'));
  assert.equal(await card('Gulshan Homes').locator('.meta.late').count(), 0, 'today is not late');
  assert.ok((await card('F-11 Tower').getAttribute('class')).split(' ').includes('late'), 'red edge');
  assert.equal(await page.locator('#searchBox').isHidden(), true, 'search only on All My Parties');
  assert.equal(await page.locator('text=Gulberg Mall').count(), 0, 'never another salesman\'s site');
  await noSideways(page, 'Today\'s Chase');
  if (shots) await page.screenshot({ path: path.join(shots, 'tabs-chase.png') });

  // ---- Hot Pipeline: biggest Rs. first, then the rest by follow-up. ----
  await page.click('#tab-hot');
  assert.deepEqual(await names(page), ['Askari Heights', 'Bahria Plaza', 'Gulshan Homes']);
  assert.ok((await card('Askari Heights').textContent()).includes('Rs. 900,000 · Cash'));
  assert.ok(!/total|in quotes/i.test(await page.textContent('#listView')), 'no total (owner, P5-2)');
  await noSideways(page, 'Hot Pipeline');
  if (shots) await page.screenshot({ path: path.join(shots, 'tabs-hot.png') });

  // ---- All My Parties: newest first, 50 at a time; search. ----
  await page.click('#tab-all');
  const all = await names(page);
  assert.equal(all.length, 50, 'first 50 only');
  assert.deepEqual(all.slice(0, 8), ['Lost Tower', 'Won Mall', 'No Date Site', 'Askari Heights', 'Gulshan Homes', 'Bahria Plaza', 'F-11 Tower', 'Plot 71, Block 66']);
  await page.click('#showMore');
  assert.equal((await names(page)).length, 100);
  await page.click('#showMore');
  assert.equal((await names(page)).length, 8 + FILLERS);
  assert.equal(await page.locator('#showMore').count(), 0);
  assert.equal(await page.locator('#searchBox').isVisible(), true);
  await noSideways(page, 'All My Parties');

  const search = async (text) => {
    await page.fill('#search', text);
    await page.waitForTimeout(200); // the search redraws once he pauses
    return names(page);
  };
  assert.deepEqual(await search('f11'), ['F-11 Tower'], 'dashes and capitals don\'t matter');
  assert.deepEqual(await search('ASIF dha'), ['Askari Heights', 'F-11 Tower'], 'all words, any order');
  assert.deepEqual(await search('0300 123'), ['F-11 Tower'], 'the number as he knows it');
  assert.deepEqual(await search('+92 300 1234'), ['F-11 Tower'], 'the number as stored');
  assert.deepEqual(await search('92345123'), ['Gulshan Homes']);
  assert.deepEqual(await search('rival'), ['Lost Tower'], 'the last note');
  assert.deepEqual(await search('66 71'), ['Plot 71, Block 66'], 'short numbers are separate words');
  assert.deepEqual(await search('0300 1234 567'), ['F-11 Tower'], 'a long number is one number');
  assert.deepEqual(await search('rate quoted'), ['Askari Heights', 'Bahria Plaza'], 'the stage');
  assert.deepEqual(await search('Gulberg'), [], 'never another salesman\'s site');
  assert.equal(await page.textContent('#sites .empty'), 'No site matches "Gulberg".');
  if (shots) await page.screenshot({ path: path.join(shots, 'tabs-search.png') });
  await page.click('#clearSearch');
  assert.equal(await page.inputValue('#search'), '');
  assert.equal((await names(page)).length, 50);
  assert.deepEqual(await calls(), [], 'tabs and search need no trip to Google');

  // ---- An Update goes back to the same tab; a site moved on leaves Today's Chase. ----
  await page.click('#tab-chase');
  await card('F-11 Tower').click();
  await page.click('#u-follow .pill:has-text("1 week")');
  await page.fill('#u-note', 'called, visit next week');
  await page.click('#save');
  assert.equal(await page.getAttribute('#tab-chase', 'aria-selected'), 'true');
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.deepEqual(await names(page), ['No Date Site', 'Bahria Plaza', 'Gulshan Homes']);
  assert.equal(await count(page, 'chase'), '3');

  await page.click('#tab-all');
  assert.deepEqual((await names(page)).slice(0, 8),
    ['Lost Tower', 'Won Mall', 'No Date Site', 'Askari Heights', 'Gulshan Homes', 'Bahria Plaza', 'F-11 Tower', 'Plot 71, Block 66'],
    'a saved update keeps the site in its place (newest first)');
  await page.click('#tab-chase');

  // ---- A save that didn't go through shows at the top of every tab. ----
  await page.evaluate(() => { window.__offline = true; });
  await card('Bahria Plaza').click();
  await page.click('#u-follow .pill:has-text("3 days")');
  await page.click('#save');
  await page.waitForSelector('.card.failed');
  for (const tab of ['chase', 'hot', 'all']) {
    await page.click(`#tab-${tab}`);
    assert.equal((await names(page))[0], 'Bahria Plaza', `failed save on top of ${tab}`);
    assert.ok((await page.textContent('#sites .card.failed')).includes('Not saved. Tap to try again.'));
  }
  await page.fill('#search', 'zzz-nothing');
  await page.waitForTimeout(200);
  assert.deepEqual(await names(page), ['Bahria Plaza'], 'even while searching');
  assert.equal(await page.textContent('#sites .empty'), 'No site matches "zzz-nothing".', 'and the tab still says why it is empty');
  await page.evaluate(() => { window.__offline = false; });
  await page.click('.card.failed');
  await page.click('#save');
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.equal(await page.locator('.card.failed').count(), 0);

  // ---- + New Site lands on All My Parties, search cleared, the new site on top. ----
  await page.click('#tab-hot');
  await page.evaluate(() => { window.__delay = 600; });
  await page.click('#newSite');
  assert.equal(await page.isHidden('#tabs'), true, 'no tabs on the form');
  await page.fill('#f-name', 'Fresh Lead');
  await page.click('#f-buyer .pill:has-text("Dealer")');
  await page.fill('#f-phone', '0300 9990001');
  await page.click('#save');
  assert.equal(await page.getAttribute('#tab-all', 'aria-selected'), 'true');
  assert.equal(await page.inputValue('#search'), '');
  assert.equal((await names(page))[0], 'Fresh Lead');
  assert.equal(await page.textContent('#sites .card:first-child .tag.saving'), 'Saving…');
  await page.waitForSelector('#toast:has-text("Saved")');
  await page.evaluate(() => { window.__delay = 0; });

  // ---- Coming back from a site keeps his place in a long list. ----
  await page.click('#showMore');
  await card('Filler 60').scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  assert.ok(y > 1000);
  await card('Filler 60').click();
  await page.click('#cancel');
  assert.equal(await page.evaluate(() => window.scrollY), y, 'same place after Back');
  await page.close();

  // ---- The day rolls over with the page left open; a wrong phone clock doesn't matter. ----
  const fresh = buildWorld();
  const freshFile = path.join(dir, 'fresh.html');
  fs.writeFileSync(freshFile, fresh.s.doGet({ parameter: { k: RIA } }).getContent());
  const wrong = await openPage(browser, fresh, freshFile, { clockAt: Date.now() - 3 * DAY });
  assert.deepEqual(await names(wrong.page), ['No Date Site', 'F-11 Tower', 'Bahria Plaza', 'Gulshan Homes'],
    'phone clock 3 days behind: still today\'s list');
  await wrong.page.clock.fastForward(2 * DAY);
  await wrong.page.waitForFunction(() => document.querySelectorAll('#sites .card').length === 5);
  assert.deepEqual(await names(wrong.page), ['No Date Site', 'F-11 Tower', 'Bahria Plaza', 'Gulshan Homes', 'Askari Heights'],
    'two days later Askari Heights is due');
  assert.equal(await wrong.page.locator('#sites .card:has(.name:text-is("Gulshan Homes")) .meta.late').textContent(),
    `Follow up: ${short(dayKey(0))} · 2 days late`);
  await wrong.context.close();

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: the focus tabs and his target behave as spec 006 says.');
})().catch((error) => {
  console.error('FAIL:', error.stack || error.message);
  process.exit(1);
});
