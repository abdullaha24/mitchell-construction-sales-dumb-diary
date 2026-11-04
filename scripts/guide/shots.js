'use strict';
// Takes the screenshots for the salesman's user guide (docs/guide/). The real salesman page
// (doGet + server code) runs on FAKE sheets with made-up sites, a made-up salesman ("DEMO") and no
// real link code, in Chromium at a cheap-phone size. Nothing touches Google.
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
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const CODE = 'd'.repeat(64); // a pretend link code, only ever inside this script
const REP = 'DEMO';
const DAY = 24 * 60 * 60 * 1000;

const dayKey = (offset) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() + offset * DAY));
/** Midnight Pakistan time `offset` days away, plus `hours`. */
function dayCell(offset, hours = 0) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}
const monthCell = () => {
  const [y, m] = dayKey(0).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000);
};

function buildWorld() {
  const site = (o) => SITES.map((h) => ({ rep: REP, region: 'North', ...o })[h] ?? '');
  const rows = [
    site({ site_id: 'S000001', site_name: 'F-11 Commercial Tower', buyer_type: 'Contractor / Applicator', area: 'F-11',
      contact_name: 'Asif (site engineer)', contact_phone: '923000000101', products: 'Tile Adhesives, Waterproofing Job',
      stage: 'Rate Quoted', value_rs: 450000, payment_terms: 'Credit', next_followup: dayCell(-1),
      last_note: 'Quoted tile adhesive @ Rs. 1,450 a bag, waiting for consultant',
      created_at: dayCell(-30, 11), updated_at: dayCell(-8, 12), worked_at: dayCell(-8, 12), note_at: dayCell(-8, 12) }),
    site({ site_id: 'S000002', site_name: 'Bahria Villa 23', buyer_type: 'Project Owner', area: 'Bahria',
      contact_name: 'Bilal', contact_phone: '923000000102', products: 'Waterproofing Products',
      stage: 'Sample / Trial', next_followup: dayCell(0), last_note: 'Gave 2 bags for a roof trial',
      created_at: dayCell(-12, 10), updated_at: dayCell(-2, 15), worked_at: dayCell(-2, 15), note_at: dayCell(-2, 15) }),
    site({ site_id: 'S000003', site_name: 'Al-Noor Hardware', buyer_type: 'Dealer', area: 'G-13',
      contact_name: 'Haji Naveed', contact_phone: '923000000103', products: 'Tile Adhesives, Tile Grouts',
      stage: 'Visited / Lead', next_followup: dayCell(0), last_note: 'Wants our price list',
      created_at: dayCell(-3, 13), updated_at: dayCell(-3, 13), worked_at: dayCell(-3, 13), note_at: dayCell(-3, 13) }),
    site({ site_id: 'S000004', site_name: 'Askari Heights', buyer_type: 'Contractor / Applicator', area: 'DHA',
      contact_name: 'Tariq (thekedar)', products: 'Floor Hardeners',
      stage: 'Visited / Lead', next_followup: dayCell(-2),
      created_at: dayCell(-9, 10), updated_at: dayCell(-9, 10), worked_at: dayCell(-9, 10) }),
    site({ site_id: 'S000005', site_name: 'Blue Area Plaza', buyer_type: 'Consultant', area: 'Blue Area',
      contact_name: 'Engr. Imran', contact_phone: '923000000105', products: 'Waterproofing Job',
      stage: 'Rate Quoted', value_rs: 1200000, payment_terms: 'Cash', next_followup: dayCell(3),
      last_note: 'Sent rates for basement waterproofing',
      created_at: dayCell(-20, 10), updated_at: dayCell(-1, 16), worked_at: dayCell(-1, 16), note_at: dayCell(-1, 16) }),
    site({ site_id: 'S000006', site_name: 'G-13 School Building', buyer_type: 'Contractor / Applicator', area: 'G-13',
      contact_name: 'Kamran', contact_phone: '923000000106', products: 'Structural Grouts',
      stage: 'Sample / Trial', next_followup: dayCell(5), last_note: 'Trial patch done, looks good',
      created_at: dayCell(-15, 10), updated_at: dayCell(-3, 11), worked_at: dayCell(-3, 11), note_at: dayCell(-3, 11) }),
    site({ site_id: 'S000007', site_name: 'DHA Phase 2 House', buyer_type: 'Project Owner', area: 'DHA',
      contact_name: 'Mr. Shahid', contact_phone: '923000000107', products: 'Tile Adhesives',
      stage: 'Won (Order)', value_rs: 300000, payment_terms: 'Cash', last_note: 'Order confirmed, 200 bags',
      created_at: dayCell(-25, 10), updated_at: dayCell(-2, 12), worked_at: dayCell(-2, 12), note_at: dayCell(-2, 12) }),
    site({ site_id: 'S000008', site_name: 'Faisal Hills Block C', buyer_type: 'Contractor / Applicator', area: 'Bahria',
      contact_name: 'Usman', contact_phone: '923000000108', products: 'Admixtures',
      stage: 'Visited / Lead', next_followup: dayCell(7),
      created_at: dayCell(-1, 14), updated_at: dayCell(-1, 14), worked_at: dayCell(-1, 14) }),
    site({ site_id: 'S000009', site_name: 'Ghauri Town Mosque', buyer_type: 'Project Owner', area: 'F-11',
      contact_name: 'Qari Sahab', contact_phone: '923000000109', products: 'Waterproofing Products',
      stage: 'Lost / Dead', lost_reason: 'Price Too High', last_note: 'Went with a cheaper local brand',
      created_at: dayCell(-35, 10), updated_at: dayCell(-6, 12), worked_at: dayCell(-6, 12), note_at: dayCell(-6, 12) }),
  ];
  const act = (when, siteId, action, o = {}) => ACTIVITY.map((h) => ({ timestamp: when, rep: REP, site_id: siteId, action, ...o })[h] ?? '');
  const activity = [
    act(dayCell(-30, 11), 'S000001', 'created', { to_stage: 'Visited / Lead', note: 'Met Asif on site' }),
    act(dayCell(-8, 12), 'S000001', 'stage_change', { from_stage: 'Visited / Lead', to_stage: 'Rate Quoted', value_rs: 450000,
      payment_terms: 'Credit', note: 'Quoted tile adhesive @ Rs. 1,450 a bag, waiting for consultant', next_followup: dayCell(-1) }),
    act(dayCell(-2, 12), 'S000007', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 300000,
      payment_terms: 'Cash', note: 'Order confirmed, 200 bags' }),
  ].map((r, i) => { r[0] = `A${String(i + 1).padStart(7, '0')}`; return r; });

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
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', REP, CODE, true, dayCell(-40)]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], [REP, 'North']],
    'Rep-Targets': [['Rep', 'Month', 'Target'], [REP, monthCell(), 1000000]],
    Targets: [['Region', 'Month', 'Target'], ['North', monthCell(), 2000000]],
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
  const page = await context.newPage();
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
  await shot('01-home', [[1, '#who', 'g'], [2, '#newSite', 'tr'], [3, '#tabs', 'g'],
    [4, '#sites .card', 'g']]);
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

  fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(info, null, 1));
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
