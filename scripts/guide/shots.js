'use strict';
// Takes the screenshots for the salesman's user guide (docs/guide/). The real salesman page
// (doGet + server code) runs on FAKE sheets with made-up sites, a made-up salesman ("DEMO") and no
// real link code, in Chromium at a cheap-phone size. Nothing touches Google.
// Also the admin's summary screens, opened with a pretend admin code (pretend teammates AK, BT, FZ,
// HN, QM and made-up targets).
// Usage: node scripts/guide/shots.js <out-folder>

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const { loadSrc } = require('../../tests/helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeHtmlService, makeCacheService,
  makePropertiesService,
} = require('../../tests/helpers/fakes');
const { META_TIME_ZONE } = require('../../tests/fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const CODE = 'd'.repeat(64); // pretend link codes, only ever inside this script
const ADMIN_CODE = 'e'.repeat(64);
const REP = 'DEMO';
const DAY = 24 * 60 * 60 * 1000;

const dayKey = (offset) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() + offset * DAY));
/** Midnight Pakistan time `offset` days away, plus `hours`. */
function dayCell(offset, hours = 0) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}
/** Midnight Pakistan time on the 1st of this month (`back` = 1: last month). */
function monthCell(back = 0) {
  const [y, m] = dayKey(0).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1) - 5 * 60 * 60 * 1000);
}
/** This week's Saturday (spec 009: a week runs Saturday to Friday), as a day offset from today. */
function saturdayOffset() {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'short' }).format(new Date());
  return -['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(weekday);
}

// Everything "done this week" happens between the start of this week AND this month (whichever is
// later) and now, so it shows under both This week and This month on any day the guide is built.
const NOW = Date.now() - 60 * 1000;
const START = Math.max(dayCell(saturdayOffset()).getTime(), monthCell().getTime());
/** The i-th of n moments inside that window, in order. */
const inWeek = (i, n) => new Date(START + ((NOW - START) * (i + 1)) / (n + 1));

// Pretend teammates for the admin's team table (made-up codes, regions and amounts).
const TEAM = [[REP, 'North'], ['AK', 'North'], ['BT', 'North'], ['FZ', 'Center'], ['HN', 'Center'], ['QM', 'South']];
const TARGETS = { DEMO: 3500000, AK: 3000000, BT: 2500000, FZ: 4000000, HN: 3000000, QM: 3500000 };
const REGION_TARGETS = { North: 9000000, Center: 7000000, South: 3500000, UNASSIGNED: 2000000 };

function buildWorld() {
  const site = (o) => SITES.map((h) => ({ rep: REP, region: 'North', ...o })[h] ?? '');
  // DEMO's week, in order (k = its slot in the window).
  const N = 10;
  const t = (k) => inWeek(k, N);
  const rows = [
    site({ site_id: 'S000001', site_name: 'F-11 Commercial Tower', buyer_type: 'Contractor / Applicator', area: 'F-11',
      contact_name: 'Asif (site engineer)', contact_phone: '923000000101', products: 'Tile Adhesives, Waterproofing Job',
      stage: 'Rate Quoted', value_rs: 450000, payment_terms: 'Credit', next_followup: dayCell(-1),
      last_note: 'Quoted tile adhesive @ Rs. 1,450 a bag, waiting for consultant',
      created_at: dayCell(-30, 11), updated_at: dayCell(-8, 12), worked_at: dayCell(-8, 12), note_at: dayCell(-8, 12) }),
    site({ site_id: 'S000002', site_name: 'Bahria Villa 23', buyer_type: 'Project Owner', area: 'Bahria',
      contact_name: 'Bilal', contact_phone: '923000000102', products: 'Waterproofing Products',
      stage: 'Sample / Trial', next_followup: dayCell(0), last_note: 'Gave 2 bags for a roof trial',
      created_at: dayCell(-12, 10), updated_at: t(2), worked_at: t(2), note_at: t(2) }),
    site({ site_id: 'S000003', site_name: 'Al-Noor Hardware', buyer_type: 'Dealer', area: 'G-13',
      contact_name: 'Haji Naveed', contact_phone: '923000000103', products: 'Tile Adhesives, Tile Grouts',
      stage: 'Visited / Lead', next_followup: dayCell(0), last_note: 'Wants our price list',
      created_at: t(0), updated_at: t(0), worked_at: t(0), note_at: t(0) }),
    site({ site_id: 'S000004', site_name: 'Askari Heights', buyer_type: 'Contractor / Applicator', area: 'DHA',
      contact_name: 'Tariq (thekedar)', products: 'Floor Hardeners',
      stage: 'Visited / Lead', next_followup: dayCell(-2),
      created_at: dayCell(-9, 10), updated_at: dayCell(-9, 10), worked_at: dayCell(-9, 10) }),
    site({ site_id: 'S000005', site_name: 'Blue Area Plaza', buyer_type: 'Consultant', area: 'Blue Area',
      contact_name: 'Engr. Imran', contact_phone: '923000000105', products: 'Waterproofing Job',
      stage: 'Rate Quoted', value_rs: 1200000, payment_terms: 'Cash', next_followup: dayCell(3),
      last_note: 'Sent rates for basement waterproofing',
      created_at: dayCell(-20, 10), updated_at: t(3), worked_at: t(3), note_at: t(3) }),
    site({ site_id: 'S000006', site_name: 'G-13 School Building', buyer_type: 'Contractor / Applicator', area: 'G-13',
      contact_name: 'Kamran', contact_phone: '923000000106', products: 'Structural Grouts',
      stage: 'Sample / Trial', next_followup: dayCell(5), last_note: 'Trial patch done, looks good',
      created_at: dayCell(-15, 10), updated_at: t(8), worked_at: t(8), note_at: t(8) }),
    site({ site_id: 'S000007', site_name: 'DHA Phase 2 House', buyer_type: 'Project Owner', area: 'DHA',
      contact_name: 'Mr. Shahid', contact_phone: '923000000107', products: 'Tile Adhesives',
      stage: 'Won (Order)', value_rs: 300000, payment_terms: 'Cash', last_note: 'Order confirmed, 200 bags',
      created_at: dayCell(-25, 10), updated_at: t(5), worked_at: t(5), note_at: t(5) }),
    site({ site_id: 'S000008', site_name: 'Faisal Hills Block C', buyer_type: 'Contractor / Applicator', area: 'Bahria',
      contact_name: 'Usman', contact_phone: '923000000108', products: 'Admixtures',
      stage: 'Visited / Lead', next_followup: dayCell(7),
      created_at: t(1), updated_at: t(1), worked_at: t(1) }),
    site({ site_id: 'S000009', site_name: 'Ghauri Town Mosque', buyer_type: 'Project Owner', area: 'F-11',
      contact_name: 'Qari Sahab', contact_phone: '923000000109', products: 'Waterproofing Products',
      stage: 'Lost / Dead', lost_reason: 'Price Too High', last_note: 'Went with a cheaper local brand',
      created_at: dayCell(-35, 10), updated_at: t(7), worked_at: t(7), note_at: t(7) }),
    site({ site_id: 'S000010', site_name: 'Margalla View Apartments', buyer_type: 'Contractor / Applicator', area: 'F-11',
      contact_name: 'Waqas', contact_phone: '923000000110', products: 'Tile Adhesives',
      stage: 'Rate Quoted', value_rs: 650000, payment_terms: 'Credit', next_followup: dayCell(2),
      last_note: 'Rates sent for 3 floors', created_at: t(4), updated_at: t(4), worked_at: t(4), note_at: t(4) }),
    site({ site_id: 'S000011', site_name: 'Bahria Mall Food Court', buyer_type: 'Contractor / Applicator', area: 'Bahria',
      contact_name: 'Sohail', contact_phone: '923000000111', products: 'Floor Hardeners',
      stage: 'Won (Order)', value_rs: 850000, payment_terms: 'Credit', last_note: 'Order for the whole floor',
      created_at: dayCell(-18, 10), updated_at: t(6), worked_at: t(6), note_at: t(6) }),
  ];
  const act = (when, rep, siteId, action, o = {}) => ACTIVITY.map((h) => ({ timestamp: when, rep, site_id: siteId, action, ...o })[h] ?? '');
  const activity = [
    act(dayCell(-30, 11), REP, 'S000001', 'created', { to_stage: 'Visited / Lead', note: 'Met Asif on site' }),
    act(dayCell(-8, 12), REP, 'S000001', 'stage_change', { from_stage: 'Visited / Lead', to_stage: 'Rate Quoted', value_rs: 450000,
      payment_terms: 'Credit', note: 'Quoted tile adhesive @ Rs. 1,450 a bag, waiting for consultant', next_followup: dayCell(-1) }),
    act(t(0), REP, 'S000003', 'created', { to_stage: 'Visited / Lead', note: 'Wants our price list' }),
    act(t(1), REP, 'S000008', 'created', { to_stage: 'Visited / Lead' }),
    act(t(2), REP, 'S000002', 'stage_change', { from_stage: 'Visited / Lead', to_stage: 'Sample / Trial', note: 'Gave 2 bags for a roof trial' }),
    act(t(3), REP, 'S000005', 'stage_change', { from_stage: 'Sample / Trial', to_stage: 'Rate Quoted', value_rs: 1200000,
      payment_terms: 'Cash', note: 'Sent rates for basement waterproofing' }),
    act(t(4), REP, 'S000010', 'created', { to_stage: 'Rate Quoted', value_rs: 650000, payment_terms: 'Credit', note: 'Rates sent for 3 floors' }),
    act(t(5), REP, 'S000007', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 300000,
      payment_terms: 'Cash', note: 'Order confirmed, 200 bags' }),
    act(t(6), REP, 'S000011', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 850000,
      payment_terms: 'Credit', note: 'Order for the whole floor' }),
    act(t(7), REP, 'S000009', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Lost / Dead', lost_reason: 'Price Too High',
      note: 'Went with a cheaper local brand' }),
    act(t(8), REP, 'S000006', 'update', { note: 'Trial patch done, looks good' }),
  ];

  // The pretend teammates: a few sites each, made up from one small recipe per person.
  const plan = {
    AK: [['Visited / Lead'], ['Rate Quoted', 900000], ['Won (Order)', 1250000], ['Lost / Dead', 0, 'Competitor Approved']],
    BT: [['Visited / Lead'], ['Sample / Trial'], ['Rate Quoted', 400000]],
    FZ: [['Rate Quoted', 1800000], ['Won (Order)', 2100000], ['Won (Order)', 600000], ['Lost / Dead', 0, 'Price Too High']],
    HN: [['Visited / Lead'], ['Rate Quoted', 750000], ['Lost / Dead', 0, 'Credit Terms']],
    QM: [['Visited / Lead'], ['Sample / Trial'], ['Won (Order)', 950000]],
  };
  let n = 100;
  Object.entries(plan).forEach(([rep, list], r) => {
    const region = TEAM.find((x) => x[0] === rep)[1];
    list.forEach(([stage, rs = 0, reason = ''], i) => {
      const id = `S000${++n}`;
      const when = new Date(inWeek(i, list.length).getTime() + (r + 1) * 60 * 1000);
      rows.push(site({ site_id: id, rep, region, site_name: `${rep} Site ${i + 1}`, buyer_type: 'Contractor / Applicator',
        contact_phone: `9230000${n}00`, products: 'Tile Adhesives', stage, value_rs: rs || '', payment_terms: rs ? 'Cash' : '',
        lost_reason: reason, next_followup: /Won|Lost/.test(stage) ? '' : dayCell(3),
        created_at: when, updated_at: when, worked_at: when }));
      activity.push(act(when, rep, id, 'created', { to_stage: stage, value_rs: rs || '', payment_terms: rs ? 'Cash' : '', lost_reason: reason }));
    });
  });
  activity.sort((x, y) => x[1] - y[1]).forEach((r, i) => { r[0] = `A${String(i + 1).padStart(7, '0')}`; });

  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives', 'Waterproofing Job', 'Floor Hardeners', 'Bonding Agents & Sealants', 'Waterproofing Products',
    'Tile Grouts', 'Structural Grouts', 'Restoration & Repair Products', 'Admixtures', 'Surface Protection',
    'Mortars, Plasters & Putties'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer']
    .forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Credit Terms', 'Competitor Approved', 'Site Delayed', 'Other']
    .forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  ['DHA', 'Bahria', 'F-11', 'G-13', 'Blue Area']
    .forEach((v, i) => lists.push(['area', v, 'North', REP, true, (i + 1) * 10]));

  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', REP, CODE, true, dayCell(-40)],
      ['owner', '', ADMIN_CODE, true, dayCell(-40)]],
  }, { name: 'Sales Diary' });
  const both = (key, amount) => [[key, monthCell(), amount], [key, monthCell(1), amount - 500000]];
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ...TEAM],
    'Rep-Targets': [['Rep', 'Month', 'Target'], ...Object.entries(TARGETS).flatMap(([k, v]) => both(k, v))],
    Targets: [['Region', 'Month', 'Target'], ...Object.entries(REGION_TARGETS).flatMap(([k, v]) => both(k, v))],
  }, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(), CacheService: makeCacheService(),
  });
  return src.sandbox;
}

// google.script.run, answered by the real server code in Node.
function stub() {
  window.__offline = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a) e.preventDefault();
  }, true);
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
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
  const out = process.argv[2];
  if (!out) throw new Error('usage: node scripts/guide/shots.js <out-folder>');
  fs.mkdirSync(out, { recursive: true });
  const s = buildWorld();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-guide-'));
  const file = path.join(dir, 'app.html');
  fs.writeFileSync(file, s.doGet({ parameter: { k: CODE } }).getContent());

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true });
  let page = await context.newPage();
  await page.exposeFunction('__server', (name, argsJson) => JSON.stringify(s[name](...JSON.parse(argsJson))));
  await page.addInitScript(stub);
  await page.goto(`file://${file}`);
  await page.waitForSelector('#who');
  await page.waitForTimeout(300);

  // Each picture is saved with the spots to put numbered circles on (marks: [number, selector,
  // where]), in picture pixels at 1x, written to shots.json for scripts/guide/build.js.
  const info = {};
  const spot = async (sel, where, clip) => {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) throw new Error(`no ${sel} on screen`);
    const x0 = b.x - clip.x; const y0 = b.y - clip.y;
    const at = {
      r: [x0 + b.width + 20, y0 + b.height / 2], l: [x0 - 20, y0 + b.height / 2],
      tr: [x0 + b.width - 4, y0 + 2], tl: [x0 + 4, y0 + 2], c: [x0 + b.width / 2, y0 + b.height / 2],
      g: [-1, y0 + Math.min(b.height / 2, 22)], // in the margin left of the picture, level with the item
    }[where];
    if (where === 'g') return [-1, Math.max(at[1], 12)];
    return [Math.min(Math.max(at[0], 16), clip.width - 16), Math.max(at[1], 16)];
  };
  const save = async (name, clip, marks = []) => {
    const points = [];
    for (const [n, sel, where] of marks) points.push([n, ...(await spot(sel, where, clip))]);
    await page.screenshot({ path: path.join(out, `${name}.png`), clip });
    info[name] = { width: clip.width, height: clip.height, marks: points };
    console.log('saved', name);
  };
  const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
  const shot = async (name, marks) => {
    await blur();
    await page.waitForTimeout(250);
    await save(name, { x: 0, y: 0, width: 360, height: 740 }, marks);
  };
  // A long screen in one picture: the window as tall as the page, cut from `from` to `to`.
  const tall = async (name, marks, from, to) => {
    await blur();
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 360, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const edge = async (sel) => Math.floor((await page.locator(sel).first().boundingBox()).y) - 12;
    const y = from ? Math.max(0, await edge(from)) : 0;
    const bottom = to ? await edge(to) : full;
    await save(name, { x: 0, y, width: 360, height: bottom - y }, marks);
    await page.setViewportSize({ width: 360, height: 740 });
  };
  const card = (name) => page.locator(`#sites .card:has(.name:text-is("${name}"))`);
  const cardSel = (name) => `#sites .card:has(.name:text-is("${name}"))`;
  const top = () => page.evaluate(() => window.scrollTo(0, 0));

  // 1. Opening screen: Today's Chase.
  await shot('01-home', [[1, '#who', 'g'], [2, '#summary', 'tl'], [3, '#newSite', 'tr'], [4, '#tabs', 'g'],
    [5, '#sites .card', 'g']]);
  // The top bar alone, for the Summary page.
  const bar = await page.locator('#tabs').boundingBox();
  await save('15-sum-button', { x: 0, y: 0, width: 360, height: Math.ceil(bar.y + bar.height) }, [[1, '#summary', 'tr']]);
  // 2. One card, close up.
  const c = cardSel('F-11 Commercial Tower');
  const box = await card('F-11 Commercial Tower').boundingBox();
  await save('02-card', { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 }, [
    [1, `${c} .meta.late`, 'r'], [2, `${c} .tag.cold`, 'r'], [3, `${c} a.call`, 'tl'], [4, `${c} a.wa`, 'tl'],
    [5, `${c} button.snooze`, 'tl']]);
  // 3. Snooze panel.
  await card('Askari Heights').locator('button.snooze').click();
  await shot('03-snooze', [[1, '#snoozeChoices > *:nth-child(1)', 'tr'], [2, '#snoozeChoices > *:nth-child(2)', 'tr'],
    [3, '#snoozeChoices > *:nth-child(3)', 'tr']]);
  await page.click('#snoozeCancel');
  // 4. Hot Pipeline; All My Parties with search.
  await page.click('#tab-hot');
  await top();
  await shot('04-hot');
  await page.click('#tab-all');
  await top();
  await page.fill('#search', 'bahria');
  await shot('06-search', [[1, '#search', 'g'], [2, '#areaRow > *:nth-child(2)', 'tr']]);
  await page.fill('#search', '');
  await page.click('#tab-chase');
  await top();

  // 7. Tap a card: the site screen with Update.
  await card('Bahria Villa 23').click();
  await page.waitForSelector('#siteView:not([hidden])');
  await top();
  await shot('07-site', [[1, '#u-stage', 'g'], [2, '#u-follow', 'g']]);
  await page.click('#u-stage .pill:has-text("Rate Quoted")');
  await page.fill('#u-value', '250,000');
  await page.click('#u-terms .pill:has-text("Cash")');
  await page.click('#u-follow .pill:has-text("3 days")');
  await page.fill('#u-note', 'Trial passed. Sent rates for full roof');
  await tall('08-update', [[1, '#u-stage', 'g'], [2, '#u-follow', 'g'], [3, '#u-note', 'g'], [4, '#save', 'tl']], '#siteView .section');
  await page.click('#u-stage .pill:has-text("Won (Order)")');
  await page.fill('#u-value', '250,000');
  await page.fill('#u-note', 'Order confirmed, 150 bags');
  await tall('09-update-won', [[1, '#u-stage .pill:has-text("Won (Order)")', 'r'], [2, '#u-value', 'g'], [3, '#u-terms', 'g']],
    '#siteView .section');
  await page.click('#u-stage .pill:has-text("Lost / Dead")');
  await page.click('#u-lost .pill:has-text("Price Too High")');
  await page.fill('#u-note', 'Went with a cheaper brand');
  await tall('10-update-lost', [[1, '#u-stage .pill:has-text("Lost / Dead")', 'r'], [2, '#u-lost', 'g']], '#siteView .section');
  await page.click('#cancel');
  await page.waitForTimeout(200);
  if (!(await page.locator('#siteView').isHidden())) await page.click('#cancel');

  // 11-12. New Site form, in two halves.
  await page.click('#tab-chase');
  await page.click('#newSite');
  await page.waitForSelector('#formView:not([hidden])');
  await top();
  await page.fill('#f-name', 'Gulberg Greens Farmhouse');
  await page.click('#f-buyer .pill:has-text("Project Owner")');
  await page.fill('#f-contact', 'Mr. Farooq');
  await page.fill('#f-phone', '0300 0000110');
  await page.click('#f-products .pill:has-text("Tile Adhesives")');
  await page.click('#f-products .pill:has-text("Waterproofing Job")');
  await page.click('#f-areas .pill:has-text("+ New area")');
  await page.fill('#f-newarea', 'Gulberg Greens');
  await page.click('#f-follow .pill:has-text("1 week")');
  await page.fill('#f-note', 'Met owner, wants sample next week');
  await tall('11-new-top', [[1, '#f-name', 'g'], [2, '#f-buyer', 'g'], [3, '#f-contact', 'g'], [4, '#f-phone', 'g']],
    '#formTitle', '#f-products');
  await page.evaluate(() => { document.getElementById('f-products').previousElementSibling.id = 'guide-products'; });
  await tall('12-new-middle', [[5, '#f-products', 'g'], [6, '#f-areas', 'g']], '#guide-products', '#f-stageBox');
  await tall('12-new-bottom', [[7, '#f-stage', 'g'], [8, '#f-follow', 'g'], [9, '#save', 'tl']], '#f-stageBox');

  // 13. After Save: back on the list, the card says Saving… until Google confirms.
  await page.evaluate(() => { window.__delay = 4000; });
  await page.click('#save');
  await page.waitForTimeout(200);
  await page.click('#tab-all');
  await top();
  await shot('13-saving', [[1, '#sites .tag.saving', 'r']]);
  await page.waitForFunction(() => !document.querySelector('.tag.saving'), null, { timeout: 15000 });
  await page.evaluate(() => { window.__delay = 0; });

  // 15-19. The summary (specs 009 + 010): This week, then This month in three parts.
  const shown = () => page.waitForFunction(() => !document.querySelector('#sumBody').hidden
    && document.querySelector('#sumMsg').hidden && !document.querySelector('#sumBody').textContent.includes('Getting'));
  const waText = () => page.$eval('#sumWa', (a) => decodeURIComponent(a.getAttribute('href').replace('https://wa.me/?text=', '')));
  await top();
  await page.click('#summary');
  await shown();
  await top();
  await tall('16-sum-week', [[1, '#sumTabs', 'g'], [2, '#sumBody h2', 'g'], [3, '#sumBody .tiles', 'g']], '#sumTabs', '#sumBody .goal, #sumBody .sumt');
  info._texts = { week: await waText() };
  await page.click('#sumTabs .tab:nth-child(3)');
  await shown();
  const tiles = [1, 2, 3, 4, 5, 6].map((i) => [i, `#sumBody .tiles .tile:nth-child(${i})`, 'tr']);
  await tall('17-sum-month', [...tiles, [7, '#sumBody .goal', 'g']], '#sumTabs', '#sumBody .sumt');
  await page.evaluate(() => {
    document.querySelectorAll('#sumBody .sumt h3').forEach((h, i) => { h.closest('.sumt').id = `guide-t${i}`; });
    document.querySelector('#sumBody .nowcap').id = 'guide-now';
  });
  const titles = await page.$$eval('#sumBody .sumt h3', (hs) => hs.map((h) => h.firstChild.textContent));
  const at = (title) => `#guide-t${titles.indexOf(title)}`;
  await tall('18-sum-tables', [[1, at('Won'), 'g'], [2, at('Quotes given'), 'g'], [3, at('Lost'), 'g']], at('Won'), '#guide-now');
  await tall('19-sum-now', [[1, '#guide-now', 'g'], [2, at('Hot sites'), 'g'], [3, at('Late & going cold'), 'g'],
    [4, '#sumWa', 'tr'], [5, '#sumCopyBtn', 'tr']], '#guide-now');
  info._texts.month = await waText();
  info._titles = titles;
  await page.click('#sumBack');
  await page.waitForSelector('#listView:not([hidden])');

  // 14. A save that failed (no signal): the card turns orange.
  await page.evaluate(() => { window.__offline = true; });
  await card('Faisal Hills Block C').click();
  await page.waitForSelector('#siteView:not([hidden])');
  await page.fill('#u-note', 'Called, will visit Monday');
  await page.click('#save');
  await page.waitForTimeout(1500);
  await page.click('#tab-all');
  await top();
  await shot('14-failed', [[1, '#sites .tag.failed', 'r']]);

  // 20. Summary with a save not sent yet.
  await page.evaluate(() => { window.__offline = false; });
  await top();
  await page.click('#summary');
  await shown();
  await top();
  await tall('20-sum-unsent', [[1, '#sumUnsent', 'g']], '#sumTabs', '#sumBody .tiles');
  await context.close();

  // 21-24. The admin's summary: the same server code, opened with the pretend admin code.
  const afile = path.join(dir, 'admin.html');
  fs.writeFileSync(afile, s.doGet({ parameter: { k: ADMIN_CODE } }).getContent());
  const actx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true });
  page = await actx.newPage();
  await page.exposeFunction('__server', (name, argsJson) => JSON.stringify(s[name](...JSON.parse(argsJson))));
  await page.addInitScript(stub);
  await page.goto(`file://${afile}`);
  await page.waitForSelector('#adminTabs');
  await page.waitForTimeout(300);
  const abar = await page.locator('#adminTabs').boundingBox();
  await save('21-admin-button', { x: 0, y: 0, width: 360, height: Math.ceil(abar.y + abar.height) });
  await page.click('#summary');
  await shown();
  await page.click('#sumTabs .tab:nth-child(3)');
  await shown();
  await tall('22-admin-month', [[1, '#sumBody .tiles', 'g'], [2, '#sumBody .goal', 'g']], '#sumTabs', '#sumBody .sumt');
  await page.evaluate(() => {
    document.querySelector('#sumBody table.cols').closest('.sumt').id = 'guide-team';
    const h = [...document.querySelectorAll('#sumBody .sumt h3')].find((x) => x.firstChild.textContent === 'Lost reasons');
    h.closest('.sumt').id = 'guide-lost';
    document.querySelector('#sumBody .nowcap').id = 'guide-now';
    document.querySelectorAll('#guide-team tr.reg')[1].id = 'guide-reg';
  });
  await tall('23-admin-team', [[1, '#guide-reg', 'g'], [2, '#guide-team tr.tap', 'g'], [3, '#guide-team tr.tot', 'g'],
    [4, '#guide-lost tr', 'g']], '#guide-team', '#guide-now');
  info._texts.team = await waText();
  await page.click(`#guide-team tr.tap:has(td:text-is("${REP}"))`);
  await page.waitForSelector('#sumBody .note:has-text("Logged on")');
  await tall('24-admin-his', [[2, '#sumBody .note:has-text("Logged on")', 'g']], '#sumBack', '#sumBody .goal');

  fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(info, null, 1));
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
