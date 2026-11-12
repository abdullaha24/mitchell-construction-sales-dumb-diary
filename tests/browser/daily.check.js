'use strict';
// End to end for spec 012: the Daily message on the admin's page, on the real doGet + server code
// against fake sheets, in Chromium at a cheap-phone size (360 px) and on a laptop (1280 px): the
// button beside "Today, …", the screen opening on the last working day, ‹ / › naming and stepping the
// days (31 back, up to today "(so far)"), the pills switching with no trip (the last one remembered),
// the text exactly as the server built it, the WhatsApp link, Copy and its fallbacks, no signal and
// Try again, Refresh clearing the kept days, Back to Today where he was, and no sideways scroll.
// Dates are built around the real "today" in Pakistan time. Names and amounts are made up.
// Usage: node tests/browser/daily.check.js [screenshot-folder]

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
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const ADMIN = 'c'.repeat(64);
const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SERVER = ['adminPageDaily', 'adminPageLoad', 'adminPageSaveStatus', 'adminPageSummary'];

/** Today in Pakistan, as yyyy-MM-dd, `offset` days away. */
function dayKey(offset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() + offset * DAY));
}
/** Midnight Pakistan time of a day `offset` days away, plus `hours`. */
function dayCell(offset, hours = 0) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}
const weekday = (key) => DAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
const named = (key) => `${weekday(key)} ${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
const TODAY = dayKey(0);
// The last working day: yesterday, or Saturday when yesterday was Sunday.
const LAST = weekday(dayKey(-1)) === 'Sun' ? -2 : -1;
const monthCell = () => {
  const [y, m] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000);
};

function buildWorld() {
  const site = (o) => SITES.map((h) => ({
    region: 'North', buyer_type: 'Dealer', products: 'Tile Adhesives', contact_name: 'Asif', contact_phone: '923001234567',
    stage: 'Visited / Lead', next_followup: dayCell(3), created_at: dayCell(-40), updated_at: dayCell(-40), worked_at: dayCell(-1), ...o,
  })[h] ?? '');
  const rows = [
    site({ site_id: 'S000001', rep: 'AUR', site_name: 'Al Noor Builders' }),
    site({ site_id: 'S000002', rep: 'AUR', site_name: 'Gulberg Heights', stage: 'Rate Quoted', value_rs: 36000, payment_terms: 'Cash' }),
    site({ site_id: 'S000003', rep: 'RIA', site_name: 'Askari Homes', stage: 'Won (Order)', value_rs: 42250, payment_terms: 'Cash',
      next_followup: '' }),
    site({ site_id: 'S000004', rep: 'SH', region: 'Center', site_name: 'SH *Mall*', stage: 'Lost / Dead', lost_reason: 'Price Too High',
      next_followup: '' }),
    site({ site_id: 'S000005', rep: 'RIA', site_name: 'A very long site name that goes on and on past the edge of a small phone screen' }),
  ];
  // Enough of today's saves for the Today tab to scroll.
  for (let i = 10; i < 40; i++) rows.push(site({ site_id: `S0000${i}`, rep: 'RIA', site_name: `Today Lead ${i}` }));
  let id = 0;
  const act = (when, rep, siteId, action, o = {}) => ACTIVITY.map((h) => ({
    activity_id: `A${String(++id).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...o,
  })[h] ?? '');
  const activity = [
    act(dayCell(LAST - 1, 10), 'RIA', 'S000005', 'update', { note: 'the day before' }),
    act(dayCell(LAST, 9), 'AUR', 'S000001', 'created', { to_stage: 'Visited / Lead' }),
    act(dayCell(LAST, 10), 'AUR', 'S000002', 'created', { to_stage: 'Rate Quoted', value_rs: 36000, payment_terms: 'Cash' }),
    act(dayCell(LAST, 11), 'RIA', 'S000003', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 42250,
      payment_terms: 'Cash' }),
    act(dayCell(LAST, 12), 'RIA', 'S000005', 'update', { note: 'called' }),
    act(dayCell(LAST, 13), 'SH', 'S000004', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Lost / Dead',
      lost_reason: 'Price Too High' }),
  ];
  for (let i = 10; i < 40; i++) activity.push(act(dayCell(0, 0.01 * i), 'RIA', `S0000${i}`, 'update', { note: `today ${i}` }));
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['owner', '', ADMIN, true, dayCell(-40)]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ['RIA', 'North'], ['AUR', 'North'], ['SH', 'Center'], ['IB', 'South']],
    'Rep-Targets': [['Rep', 'Month', 'Target'], ['RIA', monthCell(), 12345000]],
    Targets: [['Region', 'Month', 'Target'], ['North', monthCell(), 20000000], ['UNASSIGNED', monthCell(), 3500000]],
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
          window.__calls.push([prop, ...args.slice(1)]);
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

let browser;
(async () => {
  const shots = process.argv[2];
  const world = buildWorld();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  browser = await chromium.launch();
  const file = path.join(dir, 'admin.html');
  fs.writeFileSync(file, world.s.doGet({ parameter: { k: ADMIN } }).getContent());
  /** What the server says for a day (all three regions). */
  const reply = (day) => JSON.parse(JSON.stringify(world.s.adminPageDaily(ADMIN, day)));

  /** Any script error on a page fails the check. */
  const errors = [];
  async function open(context) {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.exposeFunction('__server', (fn, argsJson) => {
      if (!SERVER.includes(fn)) throw new Error(`page called ${fn}`);
      return JSON.stringify(world.s[fn](...JSON.parse(argsJson)));
    });
    await page.addInitScript(stub);
    await page.goto(`file://${file}`);
    return page;
  }
  const helpers = (page, width) => ({
    dailyCalls: () => page.evaluate(() => window.__calls.filter((c) => c[0] === 'adminPageDaily').map((c) => c[1])),
    shown: () => page.waitForFunction(() => !document.querySelector('#dailyText').hidden && document.querySelector('#dailyMsg').hidden),
    noSideways: async (what) =>
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `no sideways scrolling: ${what}`),
    days: () => page.$$eval('#dailyDays > *', (els) => els.map((e) => (getComputedStyle(e).visibility === 'hidden' ? '' : e.textContent))),
    pills: () => page.$$eval('#dailyRegions .pill', (els) => els.map((e) => `${e.textContent}${e.getAttribute('aria-pressed') === 'true' ? ' *' : ''}`)),
    text: () => page.textContent('#dailyText'),
  });

  // ================================================================ The phone (360 px)
  {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await open(context);
    const h = helpers(page, 360);

    // ---- Today: the button beside the heading; nothing else changes. ----
    await page.waitForSelector('#dailyOpen');
    assert.equal(await page.textContent('#sites .a-h'), `Today, ${named(TODAY)}`);
    assert.equal(await page.textContent('#dailyOpen'), 'Daily message');
    const [head, button] = await Promise.all([page.locator('#sites .a-h').boundingBox(), page.locator('#dailyOpen').boundingBox()]);
    assert.ok(Math.abs((head.y + head.height / 2) - (button.y + button.height / 2)) < 4 && button.x > head.x, 'beside the heading');
    assert.ok(button.height >= 44, 'a big enough button');
    assert.deepEqual(await h.dailyCalls(), [], 'no trip until he taps it');
    await h.noSideways('Today');
    if (shots) await page.screenshot({ path: path.join(shots, 'daily-today.png') });

    // ---- Opens on the last working day, North first; "Getting the message…" while it comes. ----
    await page.evaluate(() => { window.__delay = 1500; window.scrollTo(0, 260); });
    const listY = await page.evaluate(() => window.scrollY);
    assert.ok(listY > 200, 'the Today tab scrolls');
    await page.evaluate(() => document.getElementById('dailyOpen').click());
    assert.equal(await page.textContent('#dailyMsg'), 'Getting the message…');
    assert.equal(await page.isVisible('#dailyView'), true);
    assert.equal(await page.isHidden('#listView'), true);
    assert.equal(await page.isHidden('#adminTabs'), true);
    assert.equal(await page.isHidden('#formActions'), true);
    assert.equal(await page.isHidden('#refresh'), true);
    assert.equal(await page.isHidden('#sumShare'), true, 'no Share before the text');
    await h.shown();
    await page.evaluate(() => { window.__delay = 0; });
    const last = dayKey(LAST);
    let r = reply(last);
    assert.equal(r.day, last);
    assert.deepEqual(await h.dailyCalls(), [''], 'one trip; the server picks the day');
    assert.deepEqual(await h.days(), [`‹ ${weekday(dayKey(LAST - 1))} ${Number(dayKey(LAST - 1).slice(8))}`, named(last),
      `${weekday(dayKey(LAST + 1))} ${Number(dayKey(LAST + 1).slice(8))} ›`]);
    assert.deepEqual(await h.pills(), ['North *', 'Center', 'South']);
    assert.equal(await h.text(), r.regions[0].text, 'exactly the server\'s text');
    assert.ok(r.regions[0].text.includes('*AUR* · 2 activities\nQuoted: Gulberg Heights\nNew: Al Noor Builders, Gulberg Heights'));
    assert.equal(await page.getAttribute('#sumWa', 'href'), `https://wa.me/?text=${encodeURIComponent(r.regions[0].text)}`);
    assert.equal(await page.textContent('#sumWa'), 'Share on WhatsApp');
    assert.equal(await page.evaluate(() => document.getElementById('sumShare').parentNode.id), 'dailyView', 'the summary\'s own buttons');
    const [wa, copy] = await Promise.all([page.locator('#sumWa').boundingBox(), page.locator('#sumCopyBtn').boundingBox()]);
    assert.equal(Math.round(wa.height), Math.round(copy.height), 'Share on WhatsApp and Copy side by side, the same height');
    assert.equal(Math.round(wa.y), Math.round(copy.y));
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('dailyText')).whiteSpace), 'pre-wrap', 'shown as it will paste');
    await h.noSideways('North, with a long name');
    if (shots) await page.screenshot({ path: path.join(shots, 'daily-north.png'), fullPage: true });

    // ---- The pills: instant, no trip. ----
    await page.click('#daily-Center');
    assert.deepEqual(await h.pills(), ['North', 'Center *', 'South']);
    assert.equal(await h.text(), r.regions[1].text);
    assert.ok(r.regions[1].text.includes('Lost: SH ∗Mall∗ (Price Too High)'));
    assert.equal(await page.getAttribute('#sumWa', 'href'), `https://wa.me/?text=${encodeURIComponent(r.regions[1].text)}`);
    await page.click('#daily-South');
    assert.equal(await h.text(), r.regions[2].text);
    assert.equal(r.regions[2].text, `*South · ${named(last)}*\nNo activity\n\n*IB* · no activity`);
    await page.click('#daily-Center');
    assert.deepEqual(await h.dailyCalls(), [''], 'switching pills makes no trip');

    // ---- Copy: the clipboard; else select-and-copy; else "Press and hold". ----
    await page.evaluate(() => {
      window.__copied = [];
      window.__clipboard = 'ok';
      window.__exec = false;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => {
        if (window.__clipboard !== 'ok') return Promise.reject(new Error('NotAllowedError'));
        window.__copied.push(t);
        return Promise.resolve();
      } } });
      document.execCommand = (cmd) => { if (cmd === 'copy' && window.__exec) window.__copied.push('exec'); return window.__exec; };
    });
    await page.click('#sumCopyBtn');
    await page.waitForSelector('#toast:has-text("Copied")');
    assert.deepEqual(await page.evaluate(() => window.__copied), [r.regions[1].text], 'the Center text it shows');
    await page.evaluate(() => { window.__clipboard = 'refused'; window.__exec = true; });
    await page.click('#sumCopyBtn');
    await page.waitForFunction(() => window.__copied.length === 2);
    assert.equal(await page.isHidden('#sumCopy'), true, 'copied the older way: nothing to show');
    await page.evaluate(() => { window.__exec = false; });
    await page.click('#sumCopyBtn');
    await page.waitForSelector('#sumHold:not([hidden])');
    assert.equal(await page.textContent('#sumHold'), 'Press and hold the text, then tap Copy.');
    assert.equal(await page.inputValue('#sumCopy'), r.regions[1].text);
    assert.equal(await page.isVisible('#sumCopy'), true, 'on this screen');
    await h.noSideways('copy by hand');
    if (shots) await page.screenshot({ path: path.join(shots, 'daily-copy.png'), fullPage: true });

    // ---- ‹ and ›: a new day is one trip; a day already fetched shows at once. ----
    await page.click('#dailyPrev');
    await h.shown();
    assert.equal(await page.isHidden('#sumCopy'), true, 'the copy box goes with the old text');
    const before = dayKey(LAST - 1);
    r = reply(before);
    assert.equal(await page.textContent('#dailyDay'), named(before));
    assert.deepEqual(await h.pills(), ['North', 'Center *', 'South'], 'the same region');
    assert.equal(await h.text(), r.regions[1].text);
    await page.click('#daily-North');
    assert.equal(await h.text(), r.regions[0].text);
    assert.ok(r.regions[0].text.includes('*RIA* · 1 activity\nFollowed up: A very long site name'));
    await page.click('#dailyNext');
    assert.equal(await h.text(), reply(last).regions[0].text, 'shown at once');
    assert.deepEqual(await h.dailyCalls(), ['', before], 'the arrows go to the reply\'s days');
    // Up to today, "(so far)", no ›.
    for (let d = LAST + 1; d <= 0; d++) {
      await page.click('#dailyNext');
      await h.shown();
      assert.equal(await page.textContent('#dailyDay'), named(dayKey(d)) + (d === 0 ? ' (so far)' : ''));
    }
    assert.deepEqual((await h.days())[2], '', 'no › on today');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('dailyNext')).visibility), 'hidden');
    assert.equal(await h.text(), reply(TODAY).regions[0].text);
    assert.ok((await h.text()).startsWith(`*North · ${named(TODAY)} (so far)*\n30 activities`));
    await h.noSideways('today (so far)');
    // Today is never kept: back and forward again asks again (the day before is kept).
    let n = (await h.dailyCalls()).length;
    await page.click('#dailyPrev');
    assert.equal((await h.dailyCalls()).length, n, 'the day before: kept');
    await page.click('#dailyNext');
    await h.shown();
    assert.deepEqual((await h.dailyCalls()).slice(n), [TODAY], 'today: asked again');
    if (shots) await page.screenshot({ path: path.join(shots, 'daily-today-so-far.png'), fullPage: true });
    // Back 31 days, no further.
    let steps = 0;
    while (await page.evaluate(() => getComputedStyle(document.getElementById('dailyPrev')).visibility !== 'hidden')) {
      await page.click('#dailyPrev');
      await h.shown();
      steps++;
      assert.ok(steps <= 31, 'stops at 31 days back');
    }
    assert.equal(steps, 31);
    assert.equal(await page.textContent('#dailyDay'), named(dayKey(-31)));
    assert.deepEqual(reply(dayKey(-31)).prev, '');

    // ---- No signal: the message and Try again. ----
    await page.evaluate(() => { window.__offline = true; });
    await page.click('#dailyNext'); // already fetched: shown with no trip
    assert.equal(await page.isVisible('#dailyText'), true);
    await page.evaluate(() => { delete DM.got[addDays(todayKey(), -20)]; aDailyGo(addDays(todayKey(), -20)); });
    await page.waitForSelector('#dailyMsg:has-text("no signal")');
    assert.equal(await page.textContent('#dailyMsg'), "Couldn't get the message: no signal. Try again.");
    assert.equal(await page.isVisible('#dailyRetry'), true);
    assert.equal(await page.isHidden('#dailyText'), true);
    assert.equal(await page.isHidden('#sumShare'), true, 'nothing to share');
    await h.noSideways('no signal');
    if (shots) await page.screenshot({ path: path.join(shots, 'daily-no-signal.png'), fullPage: true });
    await page.evaluate(() => { window.__offline = false; });
    await page.click('#dailyRetry');
    await h.shown();
    assert.equal(await page.isHidden('#dailyRetry'), true);
    assert.equal(await h.text(), reply(dayKey(-20)).regions[0].text);

    // ---- Back: Today, where he was. ----
    await page.click('#dailyBack');
    assert.equal(await page.isVisible('#listView'), true);
    assert.equal(await page.isHidden('#dailyView'), true);
    assert.equal(await page.getAttribute('#atab-today', 'aria-selected'), 'true');
    assert.equal(await page.evaluate(() => window.scrollY), listY, 'where he was');
    assert.equal(await page.evaluate(() => document.getElementById('sumShare').parentNode.id), 'sumView', 'the buttons went back');

    // ---- Opening again: the last working day at once (kept); the last region remembered. ----
    let calls = (await h.dailyCalls()).length;
    await page.evaluate(() => document.getElementById('dailyOpen').click());
    assert.equal(await page.textContent('#dailyDay'), named(last));
    assert.equal(await h.text(), reply(last).regions[0].text, 'North: the last one he picked');
    assert.equal((await h.dailyCalls()).length, calls, 'no trip');
    await page.click('#daily-Center');
    await page.click('#dailyBack');

    // ---- Refresh clears the kept days. ----
    await page.click('#refresh');
    await page.waitForFunction(() => document.querySelector('#refresh').textContent === 'Refresh');
    calls = (await h.dailyCalls()).length;
    await page.evaluate(() => document.getElementById('dailyOpen').click());
    await h.shown();
    assert.deepEqual((await h.dailyCalls()).slice(calls), [''], 'fetched again after Refresh');

    // ---- The summary still has its own buttons. ----
    await page.click('#dailyBack');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#summary');
    await page.waitForFunction(() => !document.querySelector('#sumBody').hidden && document.querySelector('#sumMsg').hidden);
    assert.equal(await page.isVisible('#sumShare'), true);
    assert.equal(await page.evaluate(() => document.getElementById('sumShare').parentNode.id), 'sumView');
    await page.click('#sumBack');

    // ---- A reload remembers the region (Center). ----
    await page.reload();
    await page.waitForSelector('#dailyOpen');
    await page.click('#dailyOpen');
    await h.shown();
    assert.deepEqual(await h.pills(), ['North', 'Center *', 'South']);
    assert.equal(await h.text(), reply(last).regions[1].text);
    await context.close();
  }

  // ======================================================= Storage blocked: still works, North first
  {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    });
    const page = await open(context);
    const h = helpers(page, 360);
    await page.click('#dailyOpen');
    await h.shown();
    assert.deepEqual(await h.pills(), ['North *', 'Center', 'South']);
    await page.click('#daily-South');
    assert.equal(await h.text(), reply(dayKey(LAST)).regions[2].text, 'the pill works with no storage');
    await context.close();
  }

  // ============ A summary reply that lands on the Daily message: kept, not drawn (review scenario A)
  {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await open(context);
    const h = helpers(page, 360);
    await page.click('#dailyOpen');
    await h.shown();
    const text = await h.text();
    await page.click('#dailyBack');
    await page.evaluate(() => { window.__delay = 1500; window.scrollTo(0, 0); });
    await page.click('#summary');
    await page.click('#sumBack'); // before the summary comes
    await page.click('#dailyOpen');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('NotAllowedError')) } });
      document.execCommand = () => false;
    });
    await page.click('#sumCopyBtn');
    await page.waitForSelector('#sumHold:not([hidden])');
    await page.waitForFunction(() => window.__calls.some((c) => c[0] === 'adminPageSummary') && sum.got['this-week']);
    await page.waitForTimeout(200);
    assert.deepEqual(errors, [], 'no script error');
    assert.equal(await page.isVisible('#sumCopy'), true, 'the copy box stays');
    assert.equal(await page.isVisible('#sumHold'), true);
    assert.equal(await page.inputValue('#sumCopy'), text);
    assert.equal(await page.evaluate(() => document.getElementById('sumShare').parentNode.id), 'dailyView');
    assert.equal(await h.text(), text);
    // Going to the summary now shows it.
    await page.evaluate(() => { window.__delay = 0; });
    await page.click('#dailyBack');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#summary');
    await page.waitForFunction(() => !document.querySelector('#sumBody').hidden && document.querySelector('#sumMsg').hidden);
    assert.equal(await page.isVisible('#sumShare'), true);
    await context.close();
  }

  // ======= Today "(so far)" is never shown stale: midnight passes, or the page refreshes itself (scenario B)
  {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await open(context);
    const h = helpers(page, 360);
    await page.waitForSelector('#dailyOpen');
    await page.evaluate(() => { showOnly('daily'); aDailyGo(todayKey()); });
    await h.shown();
    const stale = await h.text();
    assert.ok(stale.includes('(so far)'));
    await page.click('#dailyBack');
    await page.evaluate(() => { clockGap += 24 * 3600 * 1000; }); // midnight passes on the page
    let n = (await h.dailyCalls()).length;
    await page.click('#dailyOpen');
    await h.shown();
    assert.deepEqual((await h.dailyCalls()).slice(n), [''], 'asked again');
    assert.equal(await page.textContent('#dailyDay'), named(dayKey(LAST)), 'the server\'s day');
    assert.equal(await h.text(), reply('').regions[0].text);
    assert.notEqual(await h.text(), stale);
    // The 10-minute refresh (coming back to the page) clears the kept days too.
    await page.click('#dailyBack');
    await page.evaluate(() => { A.loadedAt -= 11 * 60 * 1000; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => document.querySelector('#refresh').textContent === 'Refresh' && Date.now() - A.loadedAt < 60000);
    n = (await h.dailyCalls()).length;
    await page.click('#dailyOpen');
    await h.shown();
    assert.deepEqual((await h.dailyCalls()).slice(n), [''], 'asked again after the automatic refresh');
    await context.close();
  }

  // ======================================================================= The laptop (1280 px)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await open(context);
    const h = helpers(page, 1280);
    await page.click('#dailyOpen');
    await h.shown();
    assert.equal(await h.text(), reply(dayKey(LAST)).regions[0].text);
    const main = await page.locator('#dailyView').boundingBox();
    assert.ok(main.width <= 1100 && main.x > 0, `at most 1,100 px, centred: ${JSON.stringify(main)}`);
    await h.noSideways('1280');
    if (shots) await page.screenshot({ path: path.join(shots, 'daily-wide.png'), fullPage: true });
    await page.click('#dailyBack');
    assert.equal(await page.isVisible('#listView'), true);
    await context.close();
  }

  assert.deepEqual(errors, [], 'no script errors');
  await browser.close();
  console.log('PASS: the Daily message behaves as spec 012 says.');
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
