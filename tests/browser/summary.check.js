'use strict';
// End to end for spec 009: the Summary screen on the salesman's page and the admin's, on the real
// doGet + server code against fake sheets, in Chromium at a cheap-phone size: no trip at open,
// the button in the top line, the four buttons, loading, no signal, "As of", "not sent yet", the
// WhatsApp link, Copy and its fallbacks, Back to the list where he was, and the admin tapping a
// salesman. Spec 011: the logo strip, tapping a count (tile, NOW row, region row) to see its sites,
// a card to open its site and back, named rows, ‹ Prev / Next ›, the admin's cards of sites closed in
// an earlier month, and the wide screen (1280 px). Dates are built around the real "today" in
// Pakistan time. Amounts are made up.
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
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
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
  // Late and going cold: named under NOW (owner S9-7).
  rows.push(site({ site_id: 'S000034', rep: 'RIA', site_name: 'Late Plaza', stage: 'Rate Quoted', value_rs: 650000,
    payment_terms: 'Cash', next_followup: dayCell(-3), worked_at: dayCell(-10) }));
  // Won last month (spec 011): not on the admin's page, so his summary brings its card.
  rows.push(site({ site_id: 'S000060', rep: 'RIA', site_name: 'Old Win', stage: 'Won (Order)', value_rs: 333000, payment_terms: 'Cash',
    next_followup: '' }));
  // Eleven more quotes today (one with a long name), so the Quotes table shows "+ 2 more" (spec 010).
  for (let i = 40; i <= 50; i++) {
    rows.push(site({ site_id: `S0000${i}`, rep: 'RIA', site_name: i === 40 ? 'Defence Housing Authority Phase Eight Commercial Plaza Block C'
      : `Quote ${i}`, stage: 'Rate Quoted', value_rs: i * 100000, payment_terms: 'Cash', next_followup: dayCell(3) }));
  }
  let id = 0;
  const act = (when, rep, siteId, action, o = {}) => ACTIVITY.map((h) => ({
    activity_id: `A${String(++id).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...o,
  })[h] ?? '');
  const activity = [
    act(dayCell(0), 'RIA', 'S000031', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 450000, payment_terms: 'Cash' }),
    act(dayCell(0), 'RIA', 'S000032', 'stage_change', { from_stage: 'Visited / Lead', to_stage: 'Rate Quoted', value_rs: 800000, payment_terms: 'Credit' }),
    act(dayCell(0), 'AUR', 'S000033', 'created', { to_stage: 'Rate Quoted', value_rs: 777000, payment_terms: 'Cash' }),
    ...Array.from({ length: 11 }, (_, i) => act(dayCell(0), 'RIA', `S0000${40 + i}`, 'created',
      { to_stage: 'Rate Quoted', value_rs: (40 + i) * 100000, payment_terms: 'Cash' })),
    // RIA worked AUR's site today (handed over since): on his list only as "+ 1 no longer in your list".
    act(dayCell(0), 'RIA', 'S000033', 'update', { note: 'before the handover' }),
  ];
  activity.unshift(act(new Date(monthCell().getTime() - 10 * DAY), 'RIA', 'S000060', 'stage_change',
    { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 333000, payment_terms: 'Cash' }));
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

  async function open(code, name, allowed, width = 360) {
    const file = path.join(dir, `${name}.html`);
    fs.writeFileSync(file, world.s.doGet({ parameter: { k: code } }).getContent());
    const context = await browser.newContext({ viewport: { width, height: 740 }, deviceScaleFactor: 1, hasTouch: width < 900 });
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
    /** The summary on screen, part by part, as text (spec 010: tiles, target bar, tables, NOW). */
    screenLines: () => page.$$eval('#sumBody > *', (els) => els.flatMap((e) => {
      const kids = (x) => [...x.children].map((c) => c.textContent).join(' / ');
      if (e.classList.contains('tiles')) return [...e.children].map((t) => `tile ${kids(t)}`);
      if (e.classList.contains('sumt')) {
        return [...e.querySelectorAll('h3, tr')].map((r) => (r.tagName === 'H3'
          ? `table ${[...r.childNodes].map((n) => n.textContent).join(' / ')}` : [...r.cells].map((c) => c.textContent).join(' | ')));
      }
      if (e.classList.contains('goal')) {
        const bar = e.querySelector('.meter i');
        return [`goal ${[...e.querySelectorAll('.two > *, :scope > div:not(.two):not(.meter)')].map((x) => x.textContent).join(' / ')}${
          bar ? ` / bar ${bar.style.width}` : ''}`];
      }
      return [e.textContent];
    })),
    /** Every number cell: right-aligned, on one line; Share and Copy the same height. */
    numbersNeat: async () => {
      const left = await page.$$eval('#sumBody .num', (els) => els.filter((e) => getComputedStyle(e).textAlign !== 'right')
        .map((e) => e.textContent));
      assert.deepEqual(left, [], 'numbers on the right');
      const wrapped = await page.$$eval('#sumBody tr:not(.w) .num, #sumBody .tile .rs', (els) => els.filter((e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1;
      }).map((e) => e.textContent));
      assert.deepEqual(wrapped, [], 'no number cell runs onto a second line');
      const [wa, copy] = await Promise.all([page.locator('#sumWa').boundingBox(), page.locator('#sumCopyBtn').boundingBox()]);
      assert.equal(Math.round(wa.height), Math.round(copy.height), 'Share on WhatsApp and Copy the same height');
    },
    /** Both buttons sit in the top line, inside the screen. */
    fitsTopLine: async (other) => {
      const a = await page.locator('#summary').boundingBox();
      const b = await page.locator(other).boundingBox();
      assert.ok(a && b, 'both shown');
      assert.ok(a.x >= 0 && a.x + a.width <= 360 && b.x + b.width <= 360, `inside 360 px: ${JSON.stringify([a, b])}`);
      assert.ok(Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < 4, `one line: ${JSON.stringify([a, b])}`);
      assert.ok(a.x + a.width <= b.x, 'side by side');
      const who = await page.locator('#who').boundingBox();
      assert.ok(Math.abs((a.y + a.height / 2) - (who.y + who.height / 2)) < 6, `in the top row, beside the name: ${JSON.stringify([a, who])}`);
    },
    /** Each line under the name (his target; the admin's Updated and month lines) is one line at 360 px. */
    oneLineUnderName: async () => {
      const boxes = await page.$$eval('#target', ([t]) => (t.querySelector('div') ? [...t.querySelectorAll(':scope > div')] : [t]).map((e) => ({
        text: e.textContent, height: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) })));
      assert.ok(boxes.length >= 1);
      for (const b of boxes) assert.ok(b.height <= 1.5 * b.line, `one line: ${JSON.stringify(b)}`);
    },
    /** "Rs." and its amount are never split across two lines on the summary screen. */
    rsTogether: async () => {
      const splits = await page.evaluate(() => {
        const out = [];
        const walk = document.createTreeWalker(document.querySelector('#sumBody'), NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          for (const m of n.data.matchAll(/Rs\.\s\d/g)) {
            const r = document.createRange();
            r.setStart(n, m.index);
            r.setEnd(n, m.index + m[0].length);
            const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
            if (tops.size > 1) out.push(n.data);
          }
        }
        return out;
      });
      assert.deepEqual(splits, [], 'Rs. and its amount stay together');
    },
  });
  const nbsp = (line) => line.replace(/Rs\. /g, 'Rs.\u00a0'); // the page keeps "Rs. 400,000" together
  const tableLines = (t) => (t.h ? [`table ${t.h} / ${t.n}`] : []).concat(t.cols ? [t.cols.join(' | ')] : [],
    t.rows.map((r) => r.c.map((x, i) => (i ? nbsp(x) : x + (r.s ? ` ${r.s}` : ''))).join(' | ')), t.more ? [t.more] : []);
  /** Spec 011: a list's heading, as the page writes it. */
  const listHead = (part) => {
    const n = part.ids.length + (part.x || 0);
    return `${part.lh} · ${n} ${n === 1 ? 'site' : 'sites'}`;
  };
  /** Scrolls an element into view (so a tap on it doesn't scroll), then gives the scroll place. */
  const placeOf = async (page, sel) => {
    await page.locator(sel).first().scrollIntoViewIfNeeded();
    return page.evaluate(() => window.scrollY);
  };
  /** The server's summary, part by part, as the page should show it. */
  const expectedLines = (view, asOf) => {
    const g = view.target;
    const goal = !g ? [] : [`goal ${(g.none ? [g.none] : [g.h, `${g.pct}%`, g.won, g.of]).concat(g.note ? [nbsp(g.note)] : []).join(' / ')}${
      g.none ? '' : ` / bar ${Math.min(g.pct, 100)}%`}`];
    return [view.title, view.sub, view.logged, asOf].filter(Boolean)
      .concat(view.tiles.map((t) => `tile ${[t.n, t.l].concat(t.rs ? [t.rs] : []).join(' / ')}`), goal,
        ...view.tables.map(tableLines), [view.now.cap], tableLines(view.now), ...(view.now.tables || []).map(tableLines));
  };

  // ================================================================ The salesman's page (RIA)
  {
    const page = await open(RIA, 'ria', ['repSummary', 'repUpdateSite', 'repSaveStatus']);
    const h = helpers(page);
    await page.waitForSelector('#who');
    assert.deepEqual(await h.calls(), [], 'opening the app makes no trip to Google (its data comes with the page)');
    await h.fitsTopLine('#newSite');
    await h.oneLineUnderName();
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
    await h.rsTogether();
    let mine = world.s.repSummary(RIA, 'this-week');
    assert.deepEqual(await h.screenLines(), expectedLines(mine), 'the server\'s summary, line by line');
    assert.ok((await h.screenLines()).includes('Won <b>Tower</b> · Cash | Rs.\u00a0450,000'), 'a site name shows as text');
    assert.equal(await page.locator('#sumBody .tile').count(), 6, 'six tiles');
    assert.equal(await page.locator('#sumBody .goal').count(), 0, 'a week has no target bar');
    assert.ok((await h.screenLines()).includes('+ 2 more'), 'the Quotes table: 10 rows, then "+ 2 more"');
    // NOW names his hot sites and the late / going cold ones (owner S9-7), after the NOW table.
    const heads = await h.texts('#sumBody .sumt h3');
    assert.deepEqual(heads.slice(-2), [`Hot sites${mine.now.tables[0].n}`, 'Late & going coldLate 1 · Cold 1'], 'the two NOW tables last');
    assert.equal(await page.locator('#sumBody .sumt tr.late').count(), 2, 'the NOW Late row and the late site');
    const lateRow = page.locator('#sumBody .sumt tr.late.w');
    assert.equal(await lateRow.locator('td').first().textContent(), 'Late Plaza');
    assert.equal(await lateRow.locator('td.num').textContent(), '3 days late · no update for 10 days');
    assert.equal(await lateRow.locator('td.num').evaluate((c) => getComputedStyle(c).color), 'rgb(180, 35, 24)', 'the reason in red');
    assert.equal(await lateRow.locator('td').first().evaluate((c) => getComputedStyle(c).color), 'rgb(0, 115, 142)',
      'the name in Mitchell teal: it can be tapped (spec 011)');
    assert.equal(await page.locator('#sumBody .sumt tr.late:not(.w) td').first().evaluate((c) => getComputedStyle(c).color),
      'rgb(180, 35, 24)', 'the NOW Late row: label and number red, as in the mockup');
    assert.ok(mine.text.includes('\n*Late & going cold*\n- Late Plaza · 3 days late · no update for 10 days'), 'and in the WhatsApp text');
    assert.ok(await page.$eval('#sumBody td.extra', (td) => td.getBoundingClientRect().width > td.closest('table').getBoundingClientRect().width - 1),
      '"+ 2 more" spans the table');
    await h.numbersNeat();
    await h.rsTogether();
    assert.equal(await page.locator('#sumBody b:text-is("Tower")').count(), 0, '...never as HTML');
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

    // ---- Spec 011: the logo strip at 360 px scrolls away; the tabs and header stay as they were. ----
    const logo = await page.$eval('.logo img', (img) => ({ alt: img.alt, h: img.getBoundingClientRect().height, src: img.src.slice(0, 22),
      line: getComputedStyle(img.parentNode).borderBottom, text: img.parentNode.textContent }));
    assert.deepEqual(logo, { alt: 'Mitchell Construction Chemicals', h: 30, src: 'data:image/png;base64,', line: '2px solid rgb(243, 144, 41)',
      text: 'Sales Diary' });
    assert.equal(await page.$eval('#sumWa', (a) => getComputedStyle(a).backgroundColor), 'rgb(31, 168, 85)', 'WhatsApp stays green');
    assert.deepEqual(await page.$$eval('#sumBody .tiles .tile', (ts) => [...new Set(ts.map((t) => Math.round(t.getBoundingClientRect().top)))].length), 2,
      '360 px: tiles 3 per row, as before');

    // ---- Spec 011: a tile opens its sites; a card opens the site; Back returns to the list, then the summary. ----
    assert.deepEqual(await page.$$eval('#sumBody .tile', (ts) => ts.map((t) => t.classList.contains('tap'))),
      [...mine.tiles.map((t) => Number(t.n) > 0)], 'only a count above 0 can be tapped');
    const quotes = mine.tiles[3];
    const sumY = await placeOf(page, '#sumBody .tile:nth-child(4)');
    await page.click('#sumBody .tile:nth-child(4)');
    assert.equal(await page.textContent('#sumBody h2'), listHead(quotes));
    assert.ok(listHead(quotes).endsWith('Quotes · 12 sites'));
    assert.equal(await page.isHidden('#sumTabs'), true, 'the list hides the four buttons');
    assert.equal(await page.isHidden('#sumShare'), true);
    const cardNames = await h.texts('#sumBody .card .name');
    assert.deepEqual(cardNames, [...quotes.ids].map((id) => world.s.repLoad(RIA).sites.find((c) => c.id === id).name), "the summary's sites, its order");
    assert.equal(cardNames[0], 'Quote 50', 'biggest quote first');
    assert.deepEqual(await h.texts('#sumBody .card .pl'), [...quotes.p], 'each card: what was quoted in the period');
    assert.equal(await page.locator('#sumBody .card button.snooze').count(), 0, 'no Snooze on a summary list');
    await h.noSideways('a summary list');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-ria-list.png'), fullPage: true });
    const listY = await placeOf(page, '#sumBody .card:has(.name:text-is("Quote 48"))');
    assert.ok(listY > 0, 'the list scrolls');
    await page.click('#sumBody .card:has(.name:text-is("Quote 48"))');
    await page.waitForSelector('#siteView:not([hidden])');
    assert.equal(await page.textContent('#siteHead h2'), 'Quote 48');
    await page.click('#cancel');
    assert.equal(await page.isVisible('#sumView'), true, 'Back: the list again');
    assert.equal(await page.textContent('#sumBody h2'), listHead(quotes));
    assert.equal(await page.evaluate(() => window.scrollY), listY, 'where he was in the list');
    await page.click('#sumBody .card:has(.name:text-is("Quote 48"))');
    await page.fill('#u-note', 'sent the rate list');
    await page.click('#save');
    await page.waitForSelector('#sumView:not([hidden])');
    assert.equal(await page.textContent('#sumBody h2'), listHead(quotes), 'Save: the list again');
    assert.equal(await page.evaluate(() => window.scrollY), listY);
    await page.waitForFunction(() => !document.querySelector('#sumBody .tag.saving'));
    assert.ok((await page.textContent('#sumBody .card:has(.name:text-is("Quote 48")) .said')).endsWith('sent the rate list'),
      'the card as it is now');
    await page.click('#sumBack');
    assert.deepEqual(await h.screenLines(), expectedLines(mine), 'Back: the summary as it was (not fetched again)');
    assert.equal(await page.evaluate(() => window.scrollY), sumY, 'where he was');
    assert.equal(await page.isVisible('#sumTabs'), true);
    // Sites worked: the site he worked that is now AUR's is never sent (ADR-0004): "+ 1 no longer in your list".
    const worked = mine.tiles[1];
    assert.deepEqual([worked.ids.length, worked.x], [13, 1]);
    await page.click('#sumBody .tile:nth-child(2)');
    assert.equal(await page.textContent('#sumBody h2'), listHead(worked));
    assert.equal(await page.locator('#sumBody .card').count(), 13);
    assert.equal(await page.textContent('#sumBody > .note'), '+ 1 no longer in your list');
    assert.ok(!(await h.texts('#sumBody .card .name')).includes('AUR Hidden'));
    await page.click('#sumBack');
    // A NOW row: Late.
    await page.click('#sumBody tr.tap:has(td:text-is("Late"))');
    assert.equal(await page.textContent('#sumBody h2'), listHead(mine.now.rows[2]));
    assert.deepEqual(await h.texts('#sumBody .card .name'), ['Late Plaza']);
    await page.click('#sumBack');
    assert.equal(await page.locator('#sumBody tr.tap:has(td:text-is("Going cold"))').count(), 1);
    // A named row opens that site; Back returns to the summary where he was.
    const rowY = await placeOf(page, '#sumBody tr.late.w');
    await page.click('#sumBody tr.late.w');
    await page.waitForSelector('#siteView:not([hidden])');
    assert.equal(await page.textContent('#siteHead h2'), 'Late Plaza');
    await page.click('#cancel');
    assert.deepEqual(await h.screenLines(), expectedLines(mine));
    assert.equal(await page.evaluate(() => window.scrollY), rowY);
    // Keyboard: Enter on a tile opens it too.
    await page.locator('#sumBody .tile:nth-child(5)').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.textContent('#sumBody h2'), listHead(mine.tiles[4]));
    await page.click('#sumBack');

    // ---- Each button fetches its own; tapping again fetches it fresh. ----
    const count = async () => (await h.calls()).filter((c) => c === 'repSummary').length;
    assert.equal(await count(), 1);
    for (const [i, period] of PERIODS.entries()) {
      await page.click(`#sumTabs .tab:nth-child(${i + 1})`);
      await h.shown();
      assert.equal(await page.getAttribute(`#sumTabs .tab:nth-child(${i + 1})`, 'aria-selected'), 'true');
      assert.deepEqual(await h.screenLines(), expectedLines(world.s.repSummary(RIA, period)), period);
      assert.equal(await page.locator('#sumBody .goal').count(), period.endsWith('month') ? 1 : 0, `target card: ${period}`);
      assert.equal(await page.locator('#sumBody .goal .meter').count(), period === 'this-month' ? 1 : 0, `target bar: ${period}`);
      if (shots) await page.screenshot({ path: path.join(shots, `summary-ria-${period}.png`), fullPage: true });
      if (period === 'last-month') assert.match(await page.textContent('#sumBody .goal'), /^No target for \w+$/, 'no target: one line, no bar');
      await h.numbersNeat();
      await h.noSideways(period);
    }
    assert.equal(await count(), 5, 'one trip per tap');

    // ---- No signal: the message and Try again; a summary already shown stays, "As of". ----
    await page.evaluate(() => { window.__offline = true; });
    await page.click('#sumTabs .tab:nth-child(1)');
    await page.waitForSelector('#sumMsg:has-text("no signal")');
    assert.equal(await page.textContent('#sumMsg'), "Couldn't get the summary: no signal. Try again.");
    assert.equal(await page.isVisible('#sumRetry'), true);
    mine = world.s.repSummary(RIA, 'this-week');
    assert.deepEqual(await h.screenLines(), expectedLines(mine, `As of ${await page.evaluate(() => sum.got['this-week'].at)}`), 'kept, with As of');
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
    await h.oneLineUnderName();
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
    assert.deepEqual(await h.texts('#sumBody table.cols tr.tap td:first-child'), ['North', 'RIA', 'AUR', 'Center', 'SH', 'South'],
      'each salesman\'s and region\'s row can be tapped');
    assert.equal(await page.locator('#sumBody .sumt h3:has-text("Hot sites")').count(), 0, 'the team\'s NOW: counts only');
    await h.numbersNeat();
    // The team table: five columns that fit at 360 px, numbers lined up on the right.
    const fit = await page.$eval('#sumBody table.cols', (t) => {
      const card = t.closest('.sumt').getBoundingClientRect();
      const box = t.getBoundingClientRect();
      const edges = [1, 2, 3, 4].map((i) => new Set([...t.rows].filter((r) => r.cells.length === 5)
        .map((r) => Math.round(r.cells[i].getBoundingClientRect().right))).size);
      return { inside: box.right <= card.right + 0.5 && box.left >= card.left - 0.5, edges, width: box.width };
    });
    assert.deepEqual(fit.edges, [1, 1, 1, 1], `columns line up: ${JSON.stringify(fit)}`);
    assert.ok(fit.inside, `the team table fits its card: ${JSON.stringify(fit)}`);
    await h.rsTogether();
    await h.noSideways('team summary');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-team.png'), fullPage: true });

    // ---- Tapping a salesman: exactly his summary plus "Logged on", instantly, even with no signal. ----
    await page.evaluate(() => { window.__offline = true; window.scrollTo(0, 300); });
    const calls = (await h.calls()).length;
    assert.deepEqual(await page.$$eval('#sumBody table.cols tr.tap', (rows) => rows.map((r) => r.tabIndex)), [0, 0, 0, 0, 0, 0], 'focusable');
    await page.locator('#sumBody table.cols tr.tap:not(.reg)').first().focus();
    await page.keyboard.press('Enter');
    const his = all.salesmen.find((x) => x.rep === 'RIA');
    assert.deepEqual(await h.screenLines(), expectedLines(his));
    assert.equal(his.title, `RIA · ${world.s.repSummary(RIA, 'this-week').title}`);
    assert.ok((await h.screenLines()).some((l) => /^Logged on \d+ days?$/.test(l)), 'his days logged (admin only)');
    assert.equal(his.text.split('\n').filter((l) => !/^Days logged /.test(l)).join('\n'), world.s.repSummary(RIA, 'this-week').text,
      'the same text he sees, plus his days logged');
    assert.equal(await page.getAttribute('#sumWa', 'href'), `https://wa.me/?text=${encodeURIComponent(his.text)}`);
    assert.equal((await h.calls()).length, calls, 'no trip to Google');
    // ‹ Prev / Next ›: named after the neighbour, in the team table's order; none at the ends.
    const nav = async () => [await page.locator('#aPrev').count() ? await page.textContent('#aPrev') : null,
      await page.locator('#aNext').count() ? await page.textContent('#aNext') : null];
    assert.deepEqual(await nav(), [null, 'AUR ›']);
    await page.click('#aNext');
    assert.deepEqual(await h.screenLines(), expectedLines(all.salesmen[1]), 'AUR\'s summary');
    assert.deepEqual(await nav(), ['‹ RIA', 'SH ›']);
    await page.click('#aNext');
    assert.deepEqual(await nav(), ['‹ AUR', null]);
    await page.click('#aPrev');
    assert.equal(await page.textContent('#sumBody h2'), all.salesmen[1].title);
    // In his view, a tile lists the sites with their salesman now (the site RIA worked is AUR's now).
    await page.click('#aPrev');
    await page.click('#sumBody .tile:nth-child(2)');
    const riaWorked = all.salesmen[0].tiles[1];
    assert.equal(riaWorked.x, undefined, 'the admin sees every site RIA worked that is still in the sheet');
    assert.equal(await page.textContent('#sumBody h2'), listHead(riaWorked));
    assert.equal(await page.locator('#sumBody .card').count(), riaWorked.ids.length);
    assert.equal(await page.isHidden('#aNav'), true, 'no Prev / Next on a list');
    assert.equal(await page.textContent('#sumBody .card:has(.name:text-is("AUR Hidden")) .who-line'), 'AUR · North');
    await page.click('#sumBack');
    assert.deepEqual(await h.screenLines(), expectedLines(all.salesmen[0]), 'Back: his summary');
    await page.click('#sumBack');
    assert.deepEqual(await h.screenLines(), expectedLines(all), 'Back: the team again');
    assert.equal(await page.evaluate(() => window.scrollY), 300, 'where he was');
    await page.evaluate(() => { window.__offline = false; });

    // ---- Spec 011: a region's row opens its summary (built as a salesman's), North → Center → South. ----
    await page.click('#sumBody tr.reg.tap:has(td:text-is("North"))');
    const north = all.regions[0];
    assert.deepEqual(await h.screenLines(), expectedLines(north));
    assert.equal(north.title, all.title.replace('Team', 'North'));
    const northRow = all.tables[0].rows.find((r) => r.reg === 'North');
    assert.deepEqual([northRow.c[1], northRow.c[2]], [north.tiles[1].n, north.tiles[3].n], 'the same numbers as its row');
    assert.equal(await page.getAttribute('#sumWa', 'href'), `https://wa.me/?text=${encodeURIComponent(north.text)}`, 'its own WhatsApp text');
    assert.ok(north.text.startsWith('*North · '));
    assert.deepEqual(await nav(), [null, 'Center ›']);
    await page.click('#aNext');
    assert.deepEqual(await nav(), ['‹ North', 'South ›']);
    assert.equal(await page.textContent('#sumBody h2'), all.regions[1].title);
    await page.click('#aNext');
    assert.deepEqual(await nav(), ['‹ Center', null]);
    await page.click('#aPrev');
    await page.click('#aPrev');
    await page.click('#sumBody .tile:nth-child(5)');
    assert.equal(await page.textContent('#sumBody h2'), listHead(north.tiles[4]));
    assert.deepEqual(await h.texts('#sumBody .card .pl'), [...north.tiles[4].p]);
    await page.click('#sumBack');
    await page.click('#sumBack');
    assert.deepEqual(await h.screenLines(), expectedLines(all));
    await h.noSideways('region summaries');

    // ---- Spec 011: last month's Won: a site won last month is not on his page; its card came with the
    // summary. It opens, saves, and never counts as won this month. ----
    await page.click('#sumTabs .tab:nth-child(4)');
    await h.shown();
    const lastMonth = world.s.adminPageSummary(ADMIN, 'last-month', Date.now());
    assert.deepEqual([...lastMonth.cards].map((c) => [c.id, c.closed]), [['S000060', new Date(monthCell().getTime() - 10 * DAY + 5 * 3600000)
      .toISOString().slice(0, 10)]]);
    await page.click('#sumBody .tile:nth-child(5)');
    assert.deepEqual(await h.texts('#sumBody .card .name'), ['Old Win']);
    assert.deepEqual(await h.texts('#sumBody .card .pl'), ['Won Rs. 333,000 · Cash']);
    assert.match(await page.textContent('#sumBody .card .meta:has-text("Won ")'), /^Won \d+ \w+$/, 'the day it was won');
    assert.equal(await page.evaluate(() => data.sites.some((s) => s.id === 'S000060')), false, 'never in his page\'s sites');
    const wonTop = await page.evaluate(() => document.querySelector('#target div:nth-child(2)').textContent);
    await page.click('#sumBody .card:has(.name:text-is("Old Win"))');
    await page.waitForSelector('#siteView:not([hidden])');
    assert.equal(await page.textContent('#siteHead .who-line'), 'Salesman: RIA (North)');
    await page.fill('#u-note', 'repeat order coming');
    await page.click('#save');
    await page.waitForSelector('#sumView:not([hidden])');
    await page.waitForFunction(() => !document.querySelector('#sumBody .tag.saving'));
    assert.deepEqual(await h.texts('#sumBody .card .name'), ['Old Win'], 'Save: back to the list');
    assert.equal(await page.evaluate(() => data.sites.find((s) => s.id === 'S000060').closed), lastMonth.cards[0].closed,
      'saved at the same stage: its day stays');
    await page.click('#sumBack');
    await page.click('#sumBack');
    assert.equal(await page.evaluate(() => document.querySelector('#target div:nth-child(2)').textContent), wonTop,
      'a site won last month is not this month\'s Won');
    await page.click('#atab-month');
    assert.ok(!(await h.texts('#sites .card .name')).includes('Old Win'), 'nor on This month');
    await page.click('#atab-team');
    await page.click('#summary');
    await h.shown();
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

  // ======================================================== Spec 011: the wide screen (1280 px)
  {
    const page = await open(ADMIN, 'admin-wide', ['adminPageSummary', 'adminPageLoad', 'adminPageSaveStatus'], 1280);
    const h = helpers(page);
    await page.waitForSelector('#adminTabs');
    const box = (sel) => page.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; }));
    await page.click('#atab-team');
    const teamCards = await box('#sites .card.team');
    assert.ok(teamCards.every((r) => r.x === teamCards[0].x && r.w > 900), 'Team cards stay one column');
    await page.locator('.card.team[data-rep="RIA"] .chip:has-text("Visited / Lead")').click();
    const cards = await box('#sites .card');
    assert.ok(cards.length >= 2 && cards[0].y === cards[1].y && cards[1].x > cards[0].x, `cards in two columns: ${JSON.stringify(cards.slice(0, 2))}`);
    await page.click('#atab-today');
    const rows = await box('#sites .rep-row');
    assert.ok(rows.every((r) => r.x === rows[0].x && r.w > 900), 'salesman rows stay one column');
    await page.click('#summary');
    await h.shown();
    const main = (await box('#sumView'))[0];
    assert.ok(main.w <= 1100 && main.x > 0, `at most 1,100 px, centred: ${JSON.stringify(main)}`);
    const tiles = await box('#sumBody .tile');
    assert.equal(new Set(tiles.map((t) => t.y)).size, 1, 'six tiles in one row');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-wide.png'), fullPage: true });
    await page.click('#sumBody tr.tap:has(td:text-is("RIA"))');
    const tables = await box('#sumBody .sumt');
    assert.ok(tables[0].y === tables[1].y && tables[1].x > tables[0].x, `tables two per row: ${JSON.stringify(tables)}`);
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-wide-ria.png'), fullPage: true });
    await page.click('#sumBody .tile:nth-child(4)');
    const listCards = await box('#sumBody .card');
    assert.ok(listCards[0].y === listCards[1].y && listCards[1].x > listCards[0].x, 'a summary list: two columns');
    if (shots) await page.screenshot({ path: path.join(shots, 'summary-wide-list.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280, 'no sideways scrolling');
    await page.context().close();
  }

  await browser.close();
  console.log('PASS: the summaries behave as specs 009 and 010 say.');
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
