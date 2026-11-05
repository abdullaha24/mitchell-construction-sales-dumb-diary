'use strict';
// End to end for spec 009: the Summary screen on the salesman's page and the admin's, on the real
// doGet + server code against fake sheets, in Chromium at a cheap-phone size: no trip at open,
// the button in the top line, the four buttons, loading, no signal, "As of", "not sent yet", the
// WhatsApp link, Copy and its fallbacks, Back to the list where he was, and the admin tapping a
// salesman. Dates are built around the real "today" in Pakistan time. Amounts are made up.
// Usage: node tests/browser/summary.check.js [screenshot-folder]

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
const ADMIN = 'c'.repeat(64);
const RIA = 'a'.repeat(64);
const AUR = 'e'.repeat(64);
const DAY = 24 * 60 * 60 * 1000;
const PERIODS = ['this-week', 'last-week', 'this-month', 'last-month'];

/** Today in Pakistan, as yyyy-MM-dd, `offset` days away. */
function dayKey(offset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() + offset * DAY));
}
/** Midnight Pakistan time of a day `offset` days away, plus `hours`. */
function dayCell(offset, hours = 0) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}
const monthCell = () => {
  const [y, m] = dayKey(0).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000);
};

function buildWorld() {
  const site = (o) => SITES.map((h) => ({
    region: 'North', buyer_type: 'Dealer', products: 'Tile Adhesives', contact_name: 'Asif', contact_phone: '923001234567',
    stage: 'Visited / Lead', next_followup: dayCell(0), created_at: dayCell(-40), updated_at: dayCell(-40), worked_at: dayCell(-1), ...o,
  })[h] ?? '');
  const rows = [];
  // Enough of RIA's sites for his list to scroll.
  for (let i = 1; i <= 30; i++) rows.push(site({ site_id: `S${String(i).padStart(6, '0')}`, rep: 'RIA', site_name: `Lead ${i}` }));
  rows.push(site({ site_id: 'S000031', rep: 'RIA', site_name: 'Won <b>Tower</b>', stage: 'Won (Order)', value_rs: 450000,
    payment_terms: 'Cash', next_followup: '' }));
  rows.push(site({ site_id: 'S000032', rep: 'RIA', site_name: 'Big Quote', stage: 'Rate Quoted', value_rs: 800000,
    payment_terms: 'Credit', next_followup: dayCell(2) }));
  rows.push(site({ site_id: 'S000033', rep: 'AUR', site_name: 'AUR Hidden', stage: 'Rate Quoted', value_rs: 777000,
    payment_terms: 'Cash', next_followup: dayCell(1) }));
  let id = 0;
  const act = (when, rep, siteId, action, o = {}) => ACTIVITY.map((h) => ({
    activity_id: `A${String(++id).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...o,
  })[h] ?? '');
  const activity = [
    act(dayCell(0), 'RIA', 'S000031', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 450000, payment_terms: 'Cash' }),
    act(dayCell(0), 'RIA', 'S000032', 'stage_change', { from_stage: 'Visited / Lead', to_stage: 'Rate Quoted', value_rs: 800000, payment_terms: 'Credit' }),
    act(dayCell(0), 'AUR', 'S000033', 'created', { to_stage: 'Rate Quoted', value_rs: 777000, payment_terms: 'Cash' }),
  ];
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, dayCell(-40)], ['rep', 'AUR', AUR, true, dayCell(-40)],
      ['owner', '', ADMIN, true, dayCell(-40)]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ['RIA', 'North'], ['AUR', 'North'], ['SH', 'Center']],
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

let browser;
(async () => {
  const shots = process.argv[2];
  const world = buildWorld();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  browser = await chromium.launch();

  async function open(code, name, allowed) {
    const file = path.join(dir, `${name}.html`);
    fs.writeFileSync(file, world.s.doGet({ parameter: { k: code } }).getContent());
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await context.newPage();
    await page.exposeFunction('__server', (fn, argsJson) => {
      if (!allowed.includes(fn)) throw new Error(`page called ${fn}`);
      return JSON.stringify(world.s[fn](...JSON.parse(argsJson)));
    });
    await page.addInitScript(stub);
    await page.goto(`file://${file}`);
    return page;
  }
  const helpers = (page) => ({
    calls: () => page.evaluate(() => window.__calls.slice()),
    texts: (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent)),
    shown: () => page.waitForFunction(() => !document.querySelector('#sumBody').hidden && document.querySelector('#sumMsg').hidden),
    noSideways: async (what) =>
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360, `no sideways scrolling: ${what}`),
    /** The summary on screen, line by line, as the server built it. */
    screenLines: () => page.$$eval('#sumBody > *', (els) => els.map((e) => e.textContent)),
    /** Both buttons sit in the top line, inside the screen. */
    fitsTopLine: async (other) => {
      const a = await page.locator('#summary').boundingBox();
      const b = await page.locator(other).boundingBox();
      assert.ok(a && b, 'both shown');
      assert.ok(a.x >= 0 && a.x + a.width <= 360 && b.x + b.width <= 360, `inside 360 px: ${JSON.stringify([a, b])}`);
      assert.ok(Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < 4, `one line: ${JSON.stringify([a, b])}`);
      assert.ok(a.x + a.width <= b.x, 'side by side');
    },
  });
  const expectedLines = (view, asOf) => [view.title].concat(asOf ? [asOf] : [],
    ...view.blocks.map((b) => (b.h ? [b.h] : []).concat(b.lines)));

  // ================================================================ The salesman's page (RIA)
  {
    const page = await open(RIA, 'ria', ['repSummary', 'repUpdateSite', 'repSaveStatus']);
    const h = helpers(page);
    await page.waitForSelector('#who');
    assert.deepEqual(await h.calls(), [], 'opening the app makes no trip to Google (its data comes with the page)');
    await h.fitsTopLine('#newSite');
    await h.noSideways('his list');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-top-ria.png') });

    // His list, scrolled down on All My Parties: Back must return him there.
    await page.click('#tab-all');
    await page.evaluate(() => window.scrollTo(0, 600));
    const scrolled = await page.evaluate(() => window.scrollY);
    assert.ok(scrolled > 300, 'the list scrolls');

    // ---- Summary: This week first, fetched only now. ----
    await page.evaluate(() => { window.__delay = 400; });
    await page.click('#summary');
    assert.equal(await page.isVisible('#sumView'), true);
    assert.equal(await page.isHidden('#listView'), true);
    assert.equal(await page.isHidden('#tabs'), true, 'his tabs stay as they are, behind the summary');
    assert.equal(await page.textContent('#sumMsg'), 'Getting your summary…');
    assert.deepEqual(await h.texts('#sumTabs .tab'), ['This week', 'Last week', 'This month', 'Last month']);
    assert.equal(await page.getAttribute('#sumTabs .tab:nth-child(1)', 'aria-selected'), 'true');
    await h.shown();
    await page.evaluate(() => { window.__delay = 0; });
    let mine = world.s.repSummary(RIA, 'this-week');
    assert.deepEqual(await h.screenLines(), expectedLines(mine), 'the server\'s summary, line by line');
    assert.ok((await h.screenLines()).includes('• Won <b>Tower</b> · Rs. 450,000 Cash'), 'a site name shows as text');
    assert.equal(await page.locator('#sumBody b').count(), 0, '...never as HTML');
    assert.ok(!(await h.screenLines()).some((l) => /AUR|777/.test(l)), 'nothing of anyone else');
    // Share on WhatsApp: a plain link with the whole text, in a new tab.
    const wa = page.locator('#sumWa');
    assert.equal(await wa.textContent(), 'Share on WhatsApp');
    assert.equal(await wa.getAttribute('href'), `https://wa.me/?text=${encodeURIComponent(mine.text)}`);
    assert.equal(await wa.getAttribute('target'), '_blank');
    assert.equal(await wa.getAttribute('rel'), 'noopener');
    assert.ok(mine.text.includes('\n'), 'newlines kept (encoded)');
    assert.equal(await page.isVisible('#sumCopyBtn'), true);
    await h.noSideways('summary');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-ria.png'), fullPage: true });

    // ---- Each button fetches its own; tapping again fetches it fresh. ----
    const count = async () => (await h.calls()).filter((c) => c === 'repSummary').length;
    assert.equal(await count(), 1);
    for (const [i, period] of PERIODS.entries()) {
      await page.click(`#sumTabs .tab:nth-child(${i + 1})`);
      await h.shown();
      assert.equal(await page.getAttribute(`#sumTabs .tab:nth-child(${i + 1})`, 'aria-selected'), 'true');
      assert.deepEqual(await h.screenLines(), expectedLines(world.s.repSummary(RIA, period)), period);
    }
    assert.equal(await count(), 5, 'one trip per tap');

    // ---- No signal: the message and Try again; a summary already shown stays, "As of". ----
    await page.evaluate(() => { window.__offline = true; });
    await page.click('#sumTabs .tab:nth-child(1)');
    await page.waitForSelector('#sumMsg:has-text("no signal")');
    assert.equal(await page.textContent('#sumMsg'), "Couldn't get the summary: no signal. Try again.");
    assert.equal(await page.isVisible('#sumRetry'), true);
    mine = world.s.repSummary(RIA, 'this-week');
    assert.deepEqual(await h.screenLines(), expectedLines(mine, `As of ${mine.at}`), 'kept, with As of');
    await page.evaluate(() => { window.__offline = false; });
    await page.click('#sumRetry');
    await h.shown();
    assert.deepEqual(await h.screenLines(), expectedLines(mine), 'fresh: no As of');
    assert.equal(await page.isHidden('#sumRetry'), true);

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
    assert.deepEqual(await page.evaluate(() => window.__copied), [mine.text]);
    await page.evaluate(() => { window.__clipboard = 'refused'; window.__exec = true; });
    await page.click('#sumCopyBtn');
    await page.waitForFunction(() => window.__copied.length === 2);
    assert.equal(await page.isHidden('#sumCopy'), true, 'copied the older way: nothing to show');
    assert.equal(await page.isHidden('#sumHold'), true);
    await page.evaluate(() => { window.__exec = false; });
    await page.click('#sumCopyBtn');
    await page.waitForSelector('#sumHold:not([hidden])');
    assert.equal(await page.textContent('#sumHold'), 'Press and hold the text, then tap Copy.');
    assert.equal(await page.inputValue('#sumCopy'), mine.text);
    assert.deepEqual(await page.evaluate(() => [document.querySelector('#sumCopy').selectionStart, document.querySelector('#sumCopy').selectionEnd]),
      [0, mine.text.length], 'the whole text selected');
    await h.noSideways('copy by hand');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-ria-copy.png'), fullPage: true });

    // ---- Back: his list as he left it. ----
    await page.click('#sumBack');
    assert.equal(await page.isVisible('#listView'), true);
    assert.equal(await page.getAttribute('#tab-all', 'aria-selected'), 'true', 'the same tab');
    assert.equal(await page.evaluate(() => window.scrollY), scrolled, 'the same place');
    assert.equal(await page.isVisible('#summary'), true);

    // ---- A save still on its way: the line shows, and goes once Google confirms it (no tap). ----
    await page.click('#tab-chase');
    await page.click('#sites .card:has(.name:text-is("Lead 2"))');
    await page.fill('#u-note', 'on its way');
    await page.evaluate(() => { window.__delay = 1500; });
    await page.click('#save');
    await page.evaluate(() => { window.__delay = 0; }); // the summary comes back first
    await page.click('#summary');
    await h.shown();
    assert.equal(await page.textContent('#sumUnsent'), '1 save not sent yet is not in this summary.');
    assert.equal(await page.isVisible('#sumUnsent'), true);
    await page.waitForSelector('#sumUnsent', { state: 'hidden', timeout: 5000 });
    await page.click('#sumBack');

    // ---- A save not sent yet: the summary says it isn't in it. ----
    await page.click('#tab-chase');
    await page.click('#sites .card:has(.name:text-is("Lead 1"))');
    await page.fill('#u-note', 'rang him');
    await page.evaluate(() => { window.__offline = true; });
    await page.click('#save');
    await page.waitForSelector('.card.failed');
    await page.evaluate(() => { window.__offline = false; });
    await page.click('#summary');
    await h.shown();
    assert.equal(await page.textContent('#sumUnsent'), '1 save not sent yet is not in this summary.');
    assert.equal(await page.isVisible('#sumUnsent'), true);
    assert.deepEqual([...new Set(await h.calls())].sort(), ['repSummary', 'repUpdateSite']);
    await page.context().close();
  }

  // ======================================================================== The admin's page
  {
    const page = await open(ADMIN, 'admin', ['adminPageSummary', 'adminPageUpdateSite', 'adminPageLoad', 'adminPageSaveStatus']);
    const h = helpers(page);
    await page.waitForSelector('#adminTabs');
    assert.deepEqual(await h.calls(), [], 'opening makes no summary trip');
    await h.fitsTopLine('#refresh');
    await h.noSideways('admin top');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-top-admin.png') });
    await page.click('#atab-team');

    await page.click('#summary');
    await h.shown();
    assert.equal(await page.isHidden('#adminTabs'), true);
    assert.equal(await page.isHidden('#refresh'), true);
    const all = world.s.adminPageSummary(ADMIN, 'this-week');
    assert.deepEqual(await h.screenLines(), expectedLines(all), 'the team summary, line by line');
    assert.ok(all.title.startsWith('Team · This week'));
    assert.equal(await page.getAttribute('#sumWa', 'href'), `https://wa.me/?text=${encodeURIComponent(all.text)}`);
    assert.ok(!/owner/i.test(await page.evaluate(() => document.body.innerText)), 'the word on screen is Admin');
    assert.deepEqual(await h.texts('#sumBody button.sum-l'), [...all.blocks.find((b) => b.h === 'Salesmen').lines], 'each salesman can be tapped');
    await h.noSideways('team summary');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-team.png'), fullPage: true });

    // ---- Tapping a salesman: exactly his summary plus "Logged on", instantly, even with no signal. ----
    await page.evaluate(() => { window.__offline = true; window.scrollTo(0, 300); });
    const calls = (await h.calls()).length;
    await page.click('#sumBody button.sum-l:has-text("RIA ·")');
    const his = all.salesmen.find((x) => x.rep === 'RIA');
    assert.deepEqual(await h.screenLines(), expectedLines(his));
    assert.equal(his.title, `RIA · ${world.s.repSummary(RIA, 'this-week').title}`);
    assert.ok((await h.screenLines()).some((l) => /^Logged on \d+ days?$/.test(l)), 'his days logged (admin only)');
    assert.equal(his.text.split('\n').filter((l) => !/^Logged on /.test(l)).join('\n'), world.s.repSummary(RIA, 'this-week').text,
      'the same text he sees, plus that line');
    assert.equal(await page.getAttribute('#sumWa', 'href'), `https://wa.me/?text=${encodeURIComponent(his.text)}`);
    assert.equal((await h.calls()).length, calls, 'no trip to Google');
    await page.click('#sumBack');
    assert.deepEqual(await h.screenLines(), expectedLines(all), 'Back: the team again');
    assert.equal(await page.evaluate(() => window.scrollY), 300, 'where he was');
    await page.evaluate(() => { window.__offline = false; });
    await page.click('#sumBack');
    assert.equal(await page.isVisible('#adminTabs'), true);
    assert.equal(await page.getAttribute('#atab-team', 'aria-selected'), 'true', 'the tab he was on');

    // ---- His own Update not sent yet. ----
    await page.locator('.card.team[data-rep="RIA"] .chip:has-text("Rate Quoted")').click();
    await page.click('#sites .card:has(.name:text-is("Big Quote"))');
    await page.fill('#u-note', 'push him');
    await page.evaluate(() => { window.__offline = true; });
    await page.click('#save');
    await page.waitForSelector('.card.failed');
    await page.evaluate(() => { window.__offline = false; });
    await page.click('#summary');
    await h.shown();
    assert.equal(await page.textContent('#sumUnsent'), '1 save not sent yet is not in this summary.');
    for (const [i, period] of PERIODS.entries()) {
      await page.click(`#sumTabs .tab:nth-child(${i + 1})`);
      await h.shown();
      assert.deepEqual(await h.screenLines(), expectedLines(world.s.adminPageSummary(ADMIN, period)), period);
    }
    await h.noSideways('admin summaries');
    assert.ok((await h.calls()).every((c) => c.startsWith('adminPage')), 'only the admin functions');
    await page.context().close();
  }

  await browser.close();
  console.log('PASS: the summaries behave as spec 009 says.');
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
