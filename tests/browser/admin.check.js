'use strict';
// End to end for spec 008: the admin's (owner's) screen on the real doGet + server code against
// fake sheets, in Chromium at a cheap-phone size: the five tabs (Plan: spec 011), tap-through lists,
// an admin Update through the save queue, a failed save, "two people, one site", and Refresh. Dates are
// built around the real "today" in Pakistan time. Amounts are made up.
// Usage: node tests/browser/admin.check.js [screenshot-folder]

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
const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
const TODAY = dayKey(0);
const MONTH = MONTH_NAMES[Number(TODAY.slice(5, 7)) - 1];
const monthCell = () => {
  const [y, m] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000);
};

function buildWorld() {
  const site = (o) => SITES.map((h) => ({
    region: 'North', buyer_type: 'Dealer', products: 'Tile Adhesives', contact_name: 'Asif', contact_phone: '923001234567',
    created_at: dayCell(-40), updated_at: dayCell(-40), ...o,
  })[h] ?? '');
  const rows = [
    site({ site_id: 'S000001', rep: 'RIA', site_name: 'Late Quote', stage: 'Rate Quoted', value_rs: 300000, payment_terms: 'Credit',
      next_followup: dayCell(-3), worked_at: dayCell(-10), last_note: 'waiting for consultant', note_at: dayCell(-10) }),
    site({ site_id: 'S000002', rep: 'RIA', site_name: 'Fresh Lead', stage: 'Visited / Lead', contact_phone: '', next_followup: dayCell(2),
      created_at: dayCell(0, 8), worked_at: dayCell(0, 8) }),
    site({ site_id: 'S000003', rep: 'SH', region: 'Center', site_name: 'Big Cold', stage: 'Rate Quoted', value_rs: 900000,
      payment_terms: 'Cash', next_followup: dayCell(1), worked_at: dayCell(-8) }),
    site({ site_id: 'S000004', rep: 'SH', region: 'Center', site_name: 'Won Mall', stage: 'Won (Order)', value_rs: 500000,
      payment_terms: 'Cash', worked_at: dayCell(0, 9) }),
    site({ site_id: 'S000005', rep: 'RIA', site_name: 'Lost Plaza', stage: 'Lost / Dead', value_rs: 200000, payment_terms: 'Cash',
      lost_reason: 'Price Too High', worked_at: dayCell(0, 9) }),
    site({ site_id: 'S000006', rep: 'MUB', region: 'Center', site_name: 'Old Lead', stage: 'Visited / Lead', next_followup: dayCell(-1),
      worked_at: dayCell(-5) }),
    site({ site_id: 'S000007', rep: 'RIA', site_name: 'No Date', stage: 'Visited / Lead', worked_at: dayCell(-2) }),
  ];
  let id = 0;
  const act = (when, rep, siteId, action, o = {}) => ACTIVITY.map((h) => ({
    activity_id: `A${String(++id).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...o,
  })[h] ?? '');
  const activity = [
    act(dayCell(-40), 'SH', 'S000003', 'created', { to_stage: 'Visited / Lead' }),
    act(dayCell(0, 8), 'RIA', 'S000002', 'created', { to_stage: 'Visited / Lead' }),
    act(dayCell(0, 8.5), 'RIA', 'S000001', 'snooze', { next_followup: dayCell(1) }),
    act(dayCell(0, 8.6), 'RIA', 'S000001', 'snooze', { next_followup: dayCell(-3) }),
    act(dayCell(0, 9), 'SH', 'S000004', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Won (Order)', value_rs: 500000, payment_terms: 'Cash' }),
    act(dayCell(0, 9.5), 'RIA', 'S000005', 'stage_change', { from_stage: 'Rate Quoted', to_stage: 'Lost / Dead', lost_reason: 'Price Too High', note: 'too dear' }),
    act(dayCell(0, 10), 'admin', 'S000003', 'update', { note: 'Admin: push him', next_followup: dayCell(1) }),
  ];
  // AUR's last save, two days ago (spec 011, Plan): only counts when that is still this month.
  activity.unshift(act(dayCell(-2, 10), 'AUR', 'S000006', 'details', { note: 'Area' }));
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY, ...activity],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, dayCell(-40)], ['owner', '', ADMIN, true, dayCell(-40)]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ['RIA', 'North'], ['AUR', 'North'], ['SH', 'Center']],
    'Rep-Targets': [['Rep', 'Month', 'Target'], ['RIA', monthCell(), 1000000]],
    Targets: [['Region', 'Month', 'Target'], ['North', monthCell(), 2000000], ['Center', monthCell(), 1500000],
      ['UNASSIGNED', monthCell(), 500000]],
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
  const html = world.s.doGet({ parameter: { k: ADMIN } }).getContent();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  const file = path.join(dir, 'admin.html');
  fs.writeFileSync(file, html);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  await page.exposeFunction('__server', (name, argsJson) => {
    if (!['adminPageLoad', 'adminPageUpdateSite', 'adminPageSaveStatus'].includes(name)) throw new Error(`page called ${name}`);
    return JSON.stringify(world.s[name](...JSON.parse(argsJson)));
  });
  await page.addInitScript(stub);
  await page.goto(`file://${file}`);
  await page.waitForSelector('#adminTabs');

  const calls = () => page.evaluate(() => window.__calls.slice());
  const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent));
  const names = () => texts('#sites .card .name');
  const card = (name) => page.locator(`#sites .card:has(.name:text-is("${name}"))`);
  const noSideways = async (what) =>
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360, `no sideways scrolling: ${what}`);
  const sitesRow = (siteId) => {
    const values = world.diary.getSheetByName('Sites').getDataRange().getValues();
    const row = values.find((r) => r[0] === siteId);
    return Object.fromEntries(SITES.map((h, i) => [h, row[i]]));
  };
  const lastActivity = () => {
    const values = world.diary.getSheetByName('Activity').getDataRange().getValues();
    return Object.fromEntries(ACTIVITY.map((h, i) => [h, values[values.length - 1][i]]));
  };
  const settled = () => page.waitForFunction(() => !document.querySelector('.tag.saving'));
  const tab = (name) => page.click(`#atab-${name}`);

  // ---- The top: Admin (never "owner", P7-7), Updated, Refresh, this month's Won. ----
  assert.equal(await page.textContent('#who'), 'Admin');
  assert.match(await page.textContent('#target .upd'), /^Updated \d\d:\d\d$/);
  assert.equal(await page.textContent('#target div:nth-child(2)'), `${MONTH}: Won Rs. 500,000 logged, not invoiced`);
  assert.equal(await page.isHidden('#newSite'), true);
  assert.equal(await page.isHidden('#tabs'), true, "the salesman's tabs are not shown");
  assert.deepEqual(await texts('#adminTabs .tab'), ['Today', 'Plan', 'Team', 'Late & cold4', 'This month']);
  const tabBoxes = await page.$$eval('#adminTabs .tab', (els) => els.map((e) => e.getBoundingClientRect().right));
  assert.ok(tabBoxes.every((r) => r <= 360), `five tabs fit at 360 px: ${tabBoxes}`);
  assert.equal(await page.getAttribute('#atab-late .count', 'class'), 'count late');
  assert.ok(!/owner/i.test(await page.evaluate(() => document.body.innerText)), 'the word on screen is Admin');

  // ---- Today: who worked, who logged nothing, the saves (any save counts, P7-2). ----
  assert.equal(await page.getAttribute('#atab-today', 'aria-selected'), 'true', 'opens on Today');
  const p = TODAY.split('-').map(Number);
  assert.equal(await page.textContent('#sites .a-h'), `Today, ${DAYS[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]} ${short(TODAY)}`);
  assert.equal(await page.textContent('#sites .banner'), 'Nothing logged today: AUR (no link)');
  assert.deepEqual(await texts('#sites .rep-row'), ['RIA4 saves: 1 new site, 1 update, 2 snoozes', 'AURnothing yet', 'SH1 save: 1 update']);
  assert.deepEqual(await texts('#sites .feed .when'), ['10:00 · You · Big Cold', '09:30 · RIA · Lost Plaza', '09:00 · SH · Won Mall',
    '08:36 · RIA · Late Quote', '08:30 · RIA · Late Quote', '08:00 · RIA · Fresh Lead']);
  assert.deepEqual(await texts('#sites .feed .what'), ['Update · follow up ' + short(dayKey(1)), 'Rate Quoted → Lost / Dead · Price Too High',
    'Rate Quoted → Won (Order) · Rs. 500,000 Cash', 'Snoozed to ' + short(dayKey(-3)), 'Snoozed to ' + short(dayKey(1)), 'New site · Visited / Lead']);
  await page.click('.rep-row:has-text("SH")');
  assert.deepEqual(await texts('#sites .feed .when'), ['09:00 · SH · Won Mall'], 'one salesman\'s saves');
  await page.click('#everyone');
  assert.equal((await texts('#sites .feed')).length, 6);
  await noSideways('Today');
  if (shots) await page.screenshot({ path: path.join(shots, 'admin-today.png'), fullPage: true });

  // ---- Plan (spec 011): Today / Tomorrow per salesman, from the page's data (no trip). ----
  const before = (await calls()).length;
  await tab('plan');
  assert.equal(await page.getAttribute('#plan-today', 'aria-pressed'), 'true');
  const auSaved = TODAY.slice(0, 7) === dayKey(-2).slice(0, 7) ? 'last saved 2 days ago' : 'no saves yet this month';
  assert.deepEqual(await texts('#sites .rep-row'), ['RIADue 0 · late 2 · done 2', `AURnothing planned · ${auSaved}`, 'SHDue 0 · late 0 · done 1'],
    'done: his own new site / Update saves today (snoozes and the admin\'s never); late: open, before today or no date');
  await noSideways('Plan');
  if (shots) await page.screenshot({ path: path.join(shots, 'admin-plan.png'), fullPage: true });
  await page.click('#sites .rep-row[data-rep="RIA"]');
  assert.equal(await page.textContent('#sites .a-h'), 'RIA · Plan · Today · 4 sites');
  assert.deepEqual(await names(), ['Lost Plaza', 'Fresh Lead', 'No Date', 'Late Quote'], 'done first, then due, then late (oldest first)');
  assert.deepEqual(await texts('#sites .card .tag.won:has-text("Done")'), ['✓ Done today', '✓ Done today']);
  assert.equal(await card('No Date').locator('.tag:has-text("Done")').count(), 0);
  await page.click('#drillBack');
  assert.equal(await page.getAttribute('#atab-plan', 'aria-selected'), 'true', 'Back: the Plan tab');
  await page.click('#plan-tomorrow');
  assert.deepEqual(await texts('#sites .rep-row'), ['RIAnothing planned', 'AURnothing planned', 'SHDue 1']);
  await page.click('#sites .rep-row[data-rep="SH"]');
  assert.deepEqual(await names(), ['Big Cold']);
  await page.click('#drillBack');
  await page.click('#plan-today');
  // After midnight: the same banner as Today.
  await page.evaluate(() => { window.__realToday = data.today; data.today = addDays(data.today, -1); renderList(); });
  assert.match(await page.textContent('#sites .banner'), /^This is \d+ \w+\. Tap Refresh\.$/);
  await page.evaluate(() => { data.today = window.__realToday; renderList(); });
  assert.equal((await calls()).length, before, 'Plan makes no trip to Google');

  // ---- Team: targets next to Won Rs. (A7), regions, house / office sales (A6), tap-through. ----
  await tab('team');
  assert.equal(await page.textContent('#teamAll .a-line'), `${MONTH} target Rs. 3,500,000 · Won Rs. 500,000 (14%) logged, not invoiced`);
  assert.equal(await page.textContent('#teamHouse .a-line'), `${MONTH} target Rs. 500,000 · Not logged in the diary.`);
  assert.equal(await page.textContent('[data-region="North"] .a-line'), `${MONTH} target Rs. 2,000,000 · Won Rs. 0 (0%) logged, not invoiced`);
  assert.equal(await page.textContent('[data-region="South"] .a-line'), `No target for ${MONTH} · Won Rs. 0 logged, not invoiced`);
  const ria = page.locator('.card.team[data-rep="RIA"]');
  assert.deepEqual(await ria.locator('.a-line').allTextContents(), [`${MONTH} target Rs. 1,000,000`, 'Won Rs. 0 · 0% · logged, not invoiced',
    'This month:', 'Snoozed 2 times this month']);
  assert.deepEqual(await ria.locator('.chip').allTextContents(), ['Visited / Lead 2', 'Sample / Trial 0', 'Rate Quoted 1 · Rs. 300,000',
    'Won 0', 'Lost 1', 'No number 1']);
  const sh = page.locator('.card.team[data-rep="SH"]');
  assert.deepEqual((await sh.locator('.a-line').allTextContents()).slice(0, 2), [`No target for ${MONTH}`, 'Won Rs. 500,000 · logged, not invoiced']);
  assert.deepEqual(await texts('.card.team .big-name'), ['RIA', 'AUR', 'SH', 'MUB'], 'MUB has left: shown under "Not in the salesmen list"');
  await ria.locator('.chip:has-text("Rate Quoted")').click();
  assert.equal(await page.textContent('#sites .a-h'), 'RIA · Rate Quoted · 1 site');
  assert.deepEqual(await names(), ['Late Quote']);
  assert.equal(await card('Late Quote').locator('.who-line').textContent(), 'RIA · North');
  assert.equal(await card('Late Quote').locator('button.snooze').count(), 0, 'no Snooze on the admin screen');
  await page.click('#drillBack');
  assert.equal(await page.isVisible('#teamAll'), true, 'Back returns to Team');
  await ria.locator('.chip:has-text("No number")').click();
  assert.deepEqual(await names(), ['Fresh Lead']);
  await page.click('#drillBack');
  await noSideways('Team');
  if (shots) await page.screenshot({ path: path.join(shots, 'admin-team.png'), fullPage: true });

  // ---- Late & cold across the team. ----
  await tab('late');
  assert.deepEqual(await texts('#sites .pills .pill'), ['Late 3', 'Going cold 2']);
  assert.deepEqual(await names(), ['No Date', 'Late Quote', 'Old Lead'], 'no date first, then most days late');
  assert.equal(await card('Late Quote').locator('.meta.late').textContent(), `Follow up: ${short(dayKey(-3))} · 3 days late`);
  assert.equal(await card('Late Quote').locator('.tag:has-text("Snoozed")').textContent(), 'Snoozed 2 times this month');
  assert.deepEqual(await texts('#repRow .pill'), ['Everyone', 'RIA 2', 'MUB 1']);
  await page.click('#repRow [data-rep="RIA"]');
  assert.deepEqual(await names(), ['No Date', 'Late Quote']);
  await page.click('#kind-cold');
  assert.deepEqual(await names(), ['Big Cold', 'Late Quote'], 'going cold: biggest Rs. first');
  assert.equal(await card('Big Cold').locator('.tag.cold').textContent(), 'Going cold · no update for 8 days');
  await noSideways('Late & cold');
  if (shots) await page.screenshot({ path: path.join(shots, 'admin-late.png'), fullPage: true });

  // ---- This month: won / lost in Rs., lost reasons. ----
  await tab('month');
  assert.deepEqual(await texts('#sites .a-h'), [`${MONTH}: 1 won · Rs. 500,000 · logged, not invoiced`, `${MONTH}: 1 lost · Rs. 200,000 quoted`]);
  assert.deepEqual(await names(), ['Won Mall', 'Lost Plaza']);
  assert.deepEqual(await texts('#reasons .pill'), ['Price Too High 1']);
  assert.equal(await card('Lost Plaza').locator('.meta:has-text("Lost ")').textContent(), `Lost ${short(TODAY)} · Price Too High`);
  await noSideways('This month');

  // ---- An admin Update (P7-3): the same form; Saving…, then saved as admin; never worked_at. ----
  await tab('late');
  await page.click('#kind-cold');
  await card('Big Cold').click();
  await page.waitForSelector('#siteView:not([hidden])');
  assert.equal(await page.textContent('#siteHead .who-line'), 'Salesman: SH (Center)');
  assert.equal(await page.isHidden('#editDetails'), true, 'no Edit details for the admin');
  assert.equal(await page.isHidden('#adminTabs'), true);
  const workedBefore = sitesRow('S000003').worked_at.getTime();
  await page.click('#u-stage .pill:has-text("Won (Order)")');
  await page.fill('#u-note', 'confirmed with the owner of the site');
  await page.evaluate(() => { window.__delay = 600; });
  await page.click('#save');
  await page.waitForSelector('#listView:not([hidden])');
  await tab('month');
  assert.equal(await card('Big Cold').locator('.tag.saving').textContent(), 'Saving…');
  await settled();
  await page.evaluate(() => { window.__delay = 0; });
  assert.deepEqual(await texts('#sites .a-h'), [`${MONTH}: 2 won · Rs. 1,400,000 · logged, not invoiced`, `${MONTH}: 1 lost · Rs. 200,000 quoted`]);
  const saved = sitesRow('S000003');
  assert.deepEqual([saved.stage, saved.last_note, saved.rep], ['Won (Order)', 'Admin: confirmed with the owner of the site', 'SH']);
  assert.equal(saved.worked_at.getTime(), workedBefore, 'the admin never resets going cold (P7-5)');
  assert.deepEqual([lastActivity().rep, lastActivity().action], ['admin', 'stage_change']);
  await tab('today');
  assert.equal((await texts('#sites .feed .when'))[0].replace(/^\d\d:\d\d/, 'hh:mm'), 'hh:mm · You · Big Cold');
  assert.equal((await texts('#sites .feed .what'))[0], 'Rate Quoted → Won (Order) · Rs. 900,000 Cash');
  assert.equal(await page.textContent('#sites .banner'), 'Nothing logged today: AUR (no link)', 'his save is not a salesman\'s work');

  // ---- A save that doesn't go through: orange, on every tab; tap reopens it. ----
  await tab('team');
  await page.locator('.card.team[data-rep="RIA"] .chip:has-text("Visited / Lead")').click();
  await card('Fresh Lead').click();
  await page.fill('#u-note', 'call after Friday');
  await page.evaluate(() => { window.__offline = true; });
  await page.click('#save');
  await page.waitForSelector('.card.failed:has-text("Fresh Lead")');
  for (const name of ['today', 'team', 'late', 'month']) {
    await tab(name);
    assert.equal(await page.locator('#sites .card.failed .name').first().textContent(), 'Fresh Lead', `failed save on top of ${name}`);
  }
  await page.evaluate(() => { window.__offline = false; });
  await page.click('.card.failed');
  assert.equal(await page.inputValue('#u-note'), 'call after Friday');
  await page.click('#save');
  await settled();
  assert.equal(await page.locator('.card.failed').count(), 0);
  assert.equal(sitesRow('S000002').last_note, 'Admin: call after Friday');

  // ---- Two people, one site (a): RIA changed it after this screen loaded. The admin types a new
  // value on his old screen: refused, nothing written; reopened, his value stays and the rest shows
  // RIA's change; saved, RIA's follow-up is kept (never the old screen's "Tomorrow"). ----
  const followDay = (row) => (row.next_followup instanceof Date ? row.next_followup.getTime() : row.next_followup);
  const riaSave = world.s.repUpdateSite(RIA, 'S000001', { stage: 'Rate Quoted', value: '350000', terms: 'Credit', followUp: '1week', note: 'new rate' });
  assert.equal(riaSave.ok, true);
  const rias = sitesRow('S000001');
  await tab('late');
  await page.click('#kind-late');
  await card('Late Quote').click();
  assert.equal(await page.inputValue('#u-value'), '300000', 'his screen still shows the morning');
  await page.fill('#u-value', '320,000');
  await page.fill('#u-note', 'chase him today');
  await page.click('#save');
  await page.waitForSelector('.card.failed:has-text("Late Quote")');
  assert.equal(await page.locator('.card.failed .meta').last().textContent(),
    'This site was changed a moment ago. Here it is now: check it and save again.');
  assert.equal(await card('Late Quote').locator('.value').textContent(), 'Rs. 350,000 · Credit', 'shown as it is now');
  assert.deepEqual([sitesRow('S000001').value_rs, followDay(sitesRow('S000001')), sitesRow('S000001').last_note],
    [350000, followDay(rias), 'new rate'], 'nothing written over his change');
  await page.click('.card.failed:has-text("Late Quote")');
  assert.equal(await page.textContent('#u-problem'), 'This site was changed a moment ago. Here it is now: check it and save again.');
  assert.equal(await page.inputValue('#u-value'), '320,000', 'what the admin typed stays');
  assert.equal(await page.inputValue('#u-note'), 'chase him today');
  assert.match(await page.textContent('#u-follow .pill[aria-pressed=true]'), /^Keep /, "RIA's follow-up, not the old Tomorrow");
  await page.click('#save');
  await settled();
  assert.deepEqual([sitesRow('S000001').value_rs, followDay(sitesRow('S000001')), sitesRow('S000001').last_note],
    [320000, followDay(rias), 'Admin: chase him today'], 'saved once he had seen it: his value, RIA\'s follow-up');

  // ---- Two people, one site (b): his Update form is open; RIA updates the site; the page refreshes
  // by itself when he comes back; the form shows RIA's change and says so; his note saves without
  // undoing RIA's follow-up. ----
  await tab('team');
  await page.locator('.card.team[data-rep="RIA"] .chip:has-text("Visited / Lead")').click();
  await card('Fresh Lead').click();
  const riaAgain = world.s.repUpdateSite(RIA, 'S000002', { stage: 'Visited / Lead', followUp: '1week', note: 'rang him' });
  assert.equal(riaAgain.ok, true);
  const rias2 = sitesRow('S000002');
  await page.evaluate(() => { A.loadedAt = 0; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForSelector('#u-problem:has-text("This site was changed a moment ago. Check and tap Save again.")');
  assert.equal(await page.textContent('#u-follow .pill[aria-pressed=true]'), `Keep ${short(dayKey(7))}`);
  await page.fill('#u-note', 'good, keep at it');
  await page.click('#save');
  await settled();
  assert.deepEqual([followDay(sitesRow('S000002')), sitesRow('S000002').last_note], [followDay(rias2), 'Admin: good, keep at it'],
    "RIA's follow-up stays");

  // ---- Two people, one site (c): after a Refresh, the form's `seen` is what that Refresh brought
  // (never an older state), so RIA changing the date again while his form is open is kept. ----
  assert.equal(world.s.repUpdateSite(RIA, 'S000002', { stage: 'Visited / Lead', followUp: '3days', note: 'x' }).ok, true);
  await page.click('#refresh');
  await page.waitForFunction(() => document.querySelector('#refresh').textContent === 'Refresh' && !document.querySelector('#refresh').disabled);
  await tab('team');
  await page.locator('.card.team[data-rep="RIA"] .chip:has-text("Visited / Lead")').click();
  await card('Fresh Lead').click();
  assert.equal(await page.textContent('#u-follow .pill[aria-pressed=true]'), `Keep ${short(dayKey(3))}`);
  assert.equal(world.s.repUpdateSite(RIA, 'S000002', { stage: 'Visited / Lead', followUp: '1week', note: 'y' }).ok, true);
  const rias3 = sitesRow('S000002');
  await page.fill('#u-note', 'third');
  await page.click('#save');
  await settled();
  assert.equal(await page.locator('.card.failed').count(), 0);
  assert.deepEqual([followDay(sitesRow('S000002')), sitesRow('S000002').last_note], [followDay(rias3), 'Admin: third'],
    "RIA's latest follow-up stays");

  // ---- Spec 009 (S9-13): his own instant Today line shows Rs. on an Update only when he changed
  // it, as the history row does. ----
  const quoteUpdate = async (value, note) => {
    await tab('team');
    await page.locator('.card.team[data-rep="RIA"] .chip:has-text("Rate Quoted")').click();
    await card('Late Quote').click();
    if (value) await page.fill('#u-value', value);
    await page.fill('#u-note', note);
    await page.click('#save');
    await settled();
    await tab('today');
    return (await texts('#sites .feed .what'))[0];
  };
  assert.match(await quoteUpdate('', 'same price'), /^Update( · follow up \d+ \w+)?$/, 'unchanged Rs.: not shown');
  assert.deepEqual([lastActivity().action, lastActivity().value_rs], ['update', '']);
  assert.match(await quoteUpdate('330,000', 'new price'), /^Update · Rs\. 330,000 Credit/, 'changed Rs.: shown');
  assert.deepEqual([lastActivity().action, lastActivity().value_rs], ['update', 330000]);

  // ---- Refresh: no signal keeps what he has; with signal it reloads. ----
  await page.evaluate(() => { window.__offline = true; });
  await page.click('#refresh');
  await page.waitForSelector('#toast:has-text("Couldn\'t refresh: no signal.")');
  await page.evaluate(() => { window.__offline = false; });
  await page.click('#refresh');
  await page.waitForFunction(() => document.querySelector('#refresh').textContent === 'Refresh');
  assert.ok((await calls()).filter((c) => c === 'adminPageLoad').length >= 2);
  await noSideways('after saves');

  assert.deepEqual([...new Set(await calls())].sort(), ['adminPageLoad', 'adminPageUpdateSite'], 'only the admin functions');
  await browser.close();
  console.log("PASS: the admin's screen behaves as spec 008 says.");
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
