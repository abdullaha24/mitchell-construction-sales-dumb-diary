'use strict';
// End to end for spec 011 → E. New contact person: Earlier contacts on the site screen, + New
// contact person and Make main in the Update form, the second tap without a number, the hot-stage
// refusal, Edit details' "Is this a new person?", search, a later form carrying a queued contact
// change, and the admin's Update and Today feed. The real doGet and server code on fake sheets,
// Chromium at 360 px. Run: npm run check:browser.
// Usage: node tests/browser/contacts.check.js [screenshot-folder]

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
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);
const ADMIN = 'c'.repeat(64);
const D = new Date('2026-10-03T05:00:00Z');
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const THIS_YEAR = TODAY.slice(0, 4);

function buildWorld() {
  const site = (o) => SITES.map((h) => ({
    region: 'North', buyer_type: 'Dealer', area: 'DHA', products: 'Tile Adhesives', stage: 'Visited / Lead',
    next_followup: D, created_at: D, updated_at: D, worked_at: D, ...o,
  })[h] ?? '');
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES,
      site({ site_id: 'S000001', rep: 'RIA', site_name: 'F-11 Tower', contact_name: 'Asif', contact_phone: '923001234567',
        earlier_contacts: `923004445555 · Kamran · ${THIS_YEAR}-09-01\n- · Old Nadeem · 2025-12-01\nhand typed line` }),
      site({ site_id: 'S000002', rep: 'SH', region: 'Center', site_name: 'Gulberg Mall', contact_name: 'Sohail',
        contact_phone: '923007654321', earlier_contacts: '923006667777 · Hidden Person · 2026-08-01' }),
      site({ site_id: 'S000003', rep: 'RIA', site_name: 'Blue Area', contact_name: 'Tariq', contact_phone: '923331112222',
        stage: 'Rate Quoted', value_rs: 450000, payment_terms: 'Credit',
        earlier_contacts: `- · NoNum Guy · ${THIS_YEAR}-10-01\n923009998888 · Has Num · ${THIS_YEAR}-10-01` }),
      site({ site_id: 'S000004', rep: 'RIA', site_name: 'Quiet Site', contact_name: 'Nadeem', contact_phone: '' }),
      site({ site_id: 'S000005', rep: 'RIA', site_name: 'Undated Site', contact_name: 'Imtiaz', contact_phone: '923001231230',
        next_followup: '' })],
    Activity: [ACTIVITY],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D], ['owner', '', ADMIN, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

// google.script.run → the real server. __hold keeps calls waiting until __release(); __drop fails
// the next N calls without reaching Google (no signal).
function stub() {
  window.__calls = [];
  window.__drop = 0;
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
          window.__calls.push({ fn: prop, args });
          const gate = window.__hold || Promise.resolve();
          gate.then(() => {
            if (window.__drop > 0) {
              window.__drop--;
              return failure && failure({ message: 'NetworkError: Connection failure due to HTTP 0' });
            }
            return window.__server(prop, JSON.stringify(args)).then(
              (json) => success && success(JSON.parse(json)),
              (error) => failure && failure({ message: String(error.message || error).replace(/^Error: /, '') }));
          });
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
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 });
  await context.exposeFunction('__server', (name, argsJson) => {
    const allowed = ['repLoad', 'repCheckPhone', 'repUpdateSite', 'repEditSite', 'repSaveStatus', 'adminPageLoad', 'adminPageUpdateSite',
      'adminPageSaveStatus'];
    if (!allowed.includes(name)) throw new Error(`page called ${name}`);
    return JSON.stringify(world.s[name](...JSON.parse(argsJson)));
  });
  await context.addInitScript(stub);
  const open = async (k, name) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, world.s.doGet({ parameter: { k } }).getContent());
    const page = await context.newPage();
    await page.goto(`file://${file}`);
    return page;
  };
  const page = await open(RIA, 'app.html');
  const row = (id) => {
    const values = world.diary.getSheetByName('Sites').getDataRange().getValues().find((r) => r[0] === id);
    return Object.fromEntries(SITES.map((h, i) => [h, values[i]]));
  };
  const activity = () => world.diary.getSheetByName('Activity').getDataRange().getValues().slice(1)
    .map((v) => Object.fromEntries(ACTIVITY.map((h, i) => [h, v[i]])));
  const openSite = async (p, name) => { await p.click(`.card:has-text("${name}")`); await p.waitForSelector('#siteView:not([hidden])'); };
  const noSideways = async (p, what) =>
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 360, `no sideways scrolling: ${what}`);
  const saved = async (p) => { await p.waitForSelector('#toast:has-text("Saved")'); await p.waitForSelector('#listView:not([hidden])'); };

  // ---- Search in All My Parties finds a site by an earlier contact's name or number. ----
  await page.waitForSelector('.card');
  await page.click('#tab-all');
  for (const q of ['kamran', '0300 4445555', '923004445555', 'old nadeem']) {
    await page.fill('#search', q);
    await page.waitForFunction((n) => document.querySelectorAll('#sites .card').length === n, 1);
    assert.equal(await page.textContent('#sites .card .name'), 'F-11 Tower', q);
  }
  await page.fill('#search', 'hidden person');
  await page.waitForSelector('#sites .empty');
  await page.click('#clearSearch');

  // ---- Site screen: Earlier contacts (3), collapsed; opened: name · number · till, buttons. ----
  await openSite(page, 'F-11 Tower');
  assert.equal(await page.textContent('#earlier'), 'Earlier contacts (3) ▾');
  assert.ok(!(await page.textContent('#siteHead')).includes('Kamran'), 'collapsed');
  await page.click('#earlier');
  assert.equal(await page.textContent('#earlier'), 'Earlier contacts (3) ▴');
  const lines = await page.$$eval('#siteHead > .ec', (els) => els.map((e) => e.textContent));
  assert.ok(lines.includes('Kamran · 0300 4445555 · till 1 Sep'), lines.join(' | '));
  assert.ok(lines.includes('Old Nadeem · till 1 Dec 2025'), 'the year when it is not this year');
  assert.ok(lines.includes('hand typed line'), 'a line that does not parse is shown as typed');
  assert.equal(await page.locator('#siteHead .btnrow a.call').count(), 2, 'Call: the main contact and Kamran');
  assert.equal(await page.locator('#siteHead button:has-text("Make main")').count(), 2, 'Kamran and Old Nadeem (not the odd line)');
  await noSideways(page, 'earlier contacts');
  if (shots) await page.screenshot({ path: path.join(shots, 'contacts-earlier.png'), fullPage: true });

  // ---- + New contact person: name, phone with the duplicate check; saved alone: one contact row. ----
  assert.equal(await page.isHidden('#u-cBox'), true);
  await page.click('#u-addC');
  assert.equal(await page.isVisible('#u-cBox'), true);
  assert.equal(await page.isHidden('#u-addC'), true);
  await page.fill('#u-cName', 'Bilal');
  await page.fill('#u-cPhone', '0300 6667777');
  await page.waitForSelector('#u-cNote:not([hidden])');
  assert.equal(await page.textContent('#u-cNote'), 'Someone in the team already works with this contact.',
    "another salesman's earlier contact: yes/no only");
  await page.fill('#u-cPhone', '0300 4445555');
  await page.waitForTimeout(900);
  assert.equal(await page.isHidden('#u-cNote'), true, 'this site never matches itself');
  await page.fill('#u-cPhone', '0300 1112233');
  await noSideways(page, 'new contact form');
  if (shots) await page.screenshot({ path: path.join(shots, 'contacts-new.png'), fullPage: true });
  await page.click('#save');
  await saved(page);
  let r = row('S000001');
  assert.deepEqual([r.contact_name, r.contact_phone], ['Bilal', '923001112233']);
  assert.equal(r.earlier_contacts.split('\n')[0], `923001234567 · Asif · ${TODAY}`);
  assert.equal(r.worked_at.getTime(), D.getTime(), 'a contact-only Update is not work');
  assert.deepEqual(activity().map((a) => a.action), ['contact']);
  assert.ok((await page.textContent('.card:has-text("F-11 Tower")')).includes('F-11 Tower'));

  // ---- Make main: opens the Update form with that person filled in; saving swaps them. ----
  await openSite(page, 'F-11 Tower');
  assert.ok((await page.textContent('#siteHead')).includes('Bilal · 0300 1112233'));
  assert.equal(await page.textContent('#earlier'), 'Earlier contacts (4) ▾', 'collapsed again');
  await page.click('#earlier');
  await page.click('#siteHead .btnrow:has(button:has-text("Make main")) >> nth=0 >> button:has-text("Make main")');
  assert.equal(await page.isVisible('#u-cBox'), true);
  assert.deepEqual([await page.inputValue('#u-cName'), await page.inputValue('#u-cPhone')], ['Asif', '0300 1234567']);
  await page.click('#save');
  await saved(page);
  r = row('S000001');
  assert.deepEqual([r.contact_name, r.contact_phone], ['Asif', '923001234567']);
  assert.equal(r.earlier_contacts.split('\n').filter((l) => l.includes('Asif')).length, 0, 'the chosen one leaves Earlier contacts');
  assert.equal(activity().pop().note, 'Main contact again: Asif · 923001234567 (was Bilal · 923001112233)');

  // ---- A new contact without a number at Visited / Lead: the same second tap as + New Site. ----
  await openSite(page, 'F-11 Tower');
  await page.click('#u-addC');
  await page.fill('#u-cName', 'Zafar');
  await page.click('#save');
  assert.equal(await page.textContent('#save'), 'Save without a number?');
  await page.click('#save');
  await saved(page);
  assert.deepEqual([row('S000001').contact_name, row('S000001').contact_phone], ['Zafar', '']);

  // ---- A hot site: no new contact without a number; Make main hidden for a person without one. ----
  await openSite(page, 'Blue Area');
  await page.click('#earlier');
  assert.equal(await page.locator('#siteHead button:has-text("Make main")').count(), 1, 'only Has Num');
  await page.click('#u-addC');
  assert.equal(await page.isHidden('#u-phoneBox'), true);
  await page.fill('#u-cName', 'Nobody');
  await page.click('#save');
  assert.equal(await page.textContent('#u-problem'), "Type the new contact's number: a site at Rate Quoted needs one.");
  await page.click('#u-cX');
  assert.equal(await page.isHidden('#u-cBox'), true, '× drops the new contact');
  assert.equal(await page.isVisible('#u-addC'), true);

  // ---- Edit details: a changed number asks "Is this a new person?"; Yes keeps the old one. ----
  await page.click('#editDetails');
  await page.fill('#f-phone', '0300 5554444');
  await page.click('#save');
  await page.waitForSelector('#snoozeSheet:not([hidden])');
  assert.equal(await page.textContent('#snoozeTitle'), 'Is this a new person?');
  assert.deepEqual(await page.$$eval('#snoozeChoices button', (els) => els.map((e) => e.textContent)),
    ['Yes, keep the old one', 'No, fix the number']);
  if (shots) await page.screenshot({ path: path.join(shots, 'contacts-new-person.png') });
  await page.click('#snoozeChoices button:has-text("Yes, keep the old one")');
  await page.waitForSelector('#toast:has-text("Saved")');
  assert.equal(await page.isVisible('#siteView'), true);
  r = row('S000003');
  assert.equal(r.contact_phone, '923005554444');
  assert.equal(r.earlier_contacts.split('\n')[0], `923331112222 · Tariq · ${TODAY}`);
  assert.deepEqual(activity().slice(-1).map((a) => a.action), ['contact'], 'only the contact changed: no details row');
  assert.equal(await page.textContent('#earlier'), 'Earlier contacts (3) ▾');
  await page.click('#cancel');

  // ---- A form opened over a queued contact change carries it: a later save never drops it. ----
  await page.evaluate(() => { window.__hold = new Promise((resolve) => { window.__release = resolve; }); });
  await openSite(page, 'F-11 Tower');
  await page.click('#u-addC');
  await page.fill('#u-cName', 'Kamal');
  await page.fill('#u-cPhone', '0300 2223344');
  await page.click('#save');
  await page.waitForSelector('.card:has-text("F-11 Tower") .tag.saving');
  await openSite(page, 'F-11 Tower');
  assert.ok((await page.textContent('#siteHead')).includes('Kamal · 0300 2223344'), 'his queued change shows');
  assert.equal(await page.isVisible('#u-cBox'), true, 'the carried new contact shows in the box');
  assert.deepEqual([await page.inputValue('#u-cName'), await page.inputValue('#u-cPhone')], ['Kamal', '0300 2223344']);
  await page.fill('#u-note', 'met Kamal');
  await page.click('#save');
  // The first never reaches Google (no signal); the second carries Kamal and lands.
  await page.evaluate(() => { window.__drop = 1; window.__hold = null; window.__release(); });
  await page.waitForSelector('#toast:has-text("Saved")');
  await page.waitForFunction(() => !document.querySelector('.card .tag.saving'));
  r = row('S000001');
  assert.deepEqual([r.contact_name, r.contact_phone, r.last_note], ['Kamal', '923002223344', 'met Kamal']);
  assert.equal(r.earlier_contacts.split('\n')[0], `- · Zafar · ${TODAY}`);
  assert.deepEqual(activity().slice(-2).map((a) => a.action), ['update', 'contact']);
  assert.equal(await page.locator('.card.failed').count(), 0, 'the carried one is not left "not saved"');
  const sent = await page.evaluate(() => window.__calls.filter((c) => c.fn === 'repUpdateSite').slice(-1)[0].args[2]);
  assert.deepEqual(sent.contact, { name: 'Kamal', phone: '0300 2223344', again: false });
  assert.deepEqual(sent.seen.contact, { name: 'Zafar', phone: '' }, 'what Google had when the form opened');

  // ---- × on a carried new contact: never sent, even though the first save is dropped. ----
  await page.evaluate(() => { window.__hold = new Promise((resolve) => { window.__release = resolve; }); });
  await openSite(page, 'F-11 Tower');
  await page.click('#u-addC');
  await page.fill('#u-cName', 'Pervez');
  await page.fill('#u-cPhone', '0300 3334455');
  await page.click('#save');
  await page.waitForSelector('.card:has-text("F-11 Tower") .tag.saving');
  await openSite(page, 'F-11 Tower');
  assert.equal(await page.inputValue('#u-cName'), 'Pervez');
  await page.click('#u-cX');
  assert.equal(await page.isHidden('#u-cBox'), true);
  await page.fill('#u-note', 'no new person after all');
  await page.click('#save');
  await page.evaluate(() => { window.__drop = 1; window.__hold = null; window.__release(); });
  await page.waitForSelector('#toast:has-text("Saved")');
  await page.waitForFunction(() => !document.querySelector('.card .tag.saving'));
  r = row('S000001');
  assert.deepEqual([r.contact_name, r.last_note], ['Kamal', 'no new person after all'], '× really dropped Pervez');
  assert.deepEqual(activity().slice(-1).map((a) => a.action), ['update']);
  const dropped = await page.evaluate(() => window.__calls.filter((c) => c.fn === 'repUpdateSite').slice(-1)[0].args[2]);
  assert.equal(dropped.contact, undefined);
  assert.equal(await page.locator('.card.failed').count(), 0);

  // ---- Refused (the admin changed the contact meanwhile): the retry shows the contact it sends. ----
  await openSite(page, 'F-11 Tower');
  await page.click('#u-addC');
  await page.fill('#u-cName', 'Rafiq');
  await page.fill('#u-cPhone', '0300 6660000');
  assert.equal(world.s.adminPageUpdateSite(ADMIN, 'S000001', { stage: 'Visited / Lead', followUp: 'tomorrow', note: 'his boss',
    contact: { name: 'Zubair', phone: '0300 5550000' } }).ok, true);
  await page.click('#save');
  await page.waitForSelector('.card.failed');
  assert.equal(row('S000001').contact_name, 'Zubair');
  await page.click('.card.failed');
  await page.waitForSelector('#siteView:not([hidden])');
  assert.ok((await page.textContent('#siteHead')).includes('Zubair · 0300 5550000'), 'the site as it is now');
  assert.deepEqual([await page.isVisible('#u-cBox'), await page.inputValue('#u-cName')], [true, 'Rafiq'], 'his new contact still shows');
  await page.click('#save');
  await saved(page);
  r = row('S000001');
  assert.deepEqual([r.contact_name, r.earlier_contacts.split('\n')[0]], ['Rafiq', `923005550000 · Zubair · ${TODAY}`]);

  // ---- A number typed in the "add the number" box never rides along with a new contact. ----
  await openSite(page, 'Quiet Site');
  await page.click('#u-stage .pill:has-text("Sample / Trial")');
  await page.fill('#u-phone', '0300 7778888');
  await page.click('#u-addC');
  assert.equal(await page.isHidden('#u-phoneBox'), true);
  await page.click('#u-cX');
  assert.equal(await page.inputValue('#u-phone'), '', 'cleared when + New contact person opened');
  // The duplicate note starts hidden on +, ×, Make main.
  await page.click('#u-stage .pill:has-text("Visited / Lead")');
  await page.click('#u-addC');
  await page.fill('#u-cPhone', '0300 6667777');
  await page.waitForSelector('#u-cNote:not([hidden])');
  await page.click('#u-cX');
  await page.click('#u-addC');
  assert.equal(await page.isHidden('#u-cNote'), true);
  await page.fill('#u-cPhone', '');
  // An empty, open box is no new contact: the Update saves as usual.
  await page.fill('#u-note', 'just a note');
  await page.click('#save');
  await saved(page);
  assert.deepEqual([row('S000004').contact_name, row('S000004').last_note], ['Nadeem', 'just a note']);
  assert.deepEqual(activity().slice(-1).map((a) => a.action), ['update']);

  // ---- Only a new contact on a site with no follow-up: no date is made up; contact-only, not work. ----
  await openSite(page, 'Undated Site');
  await page.click('#u-addC');
  await page.fill('#u-cName', 'Imran');
  await page.fill('#u-cPhone', '0300 1231231');
  await page.click('#save');
  await saved(page);
  r = row('S000005');
  assert.deepEqual([r.contact_name, r.next_followup, r.worked_at.getTime()], ['Imran', '', D.getTime()]);
  assert.deepEqual(activity().slice(-1).map((a) => a.action), ['contact']);

  // ---- Review: a new contact's number that isn't one stops the save on the form (nothing queued). ----
  await openSite(page, 'F-11 Tower');
  const queued = await page.evaluate(() => queue.length);
  await page.click('#u-addC');
  await page.fill('#u-cName', 'Shorty');
  await page.fill('#u-cPhone', '0300 12');
  await page.click('#save');
  assert.equal(await page.textContent('#u-problem'), 'Check the number.');
  assert.equal(await page.isVisible('#siteView'), true, 'still on the form');
  assert.equal(await page.evaluate(() => queue.length), queued, 'nothing queued');
  await page.click('#cancel');

  // ---- Review probe: his own Edit details still on its way is no change under his next Update. ----
  await page.evaluate(() => { window.__hold = new Promise((resolve) => { window.__release = resolve; }); });
  await openSite(page, 'Quiet Site');
  await page.click('#editDetails');
  await page.fill('#f-contact', 'Nadeem Khan');
  await page.click('#save');
  await page.waitForSelector('#snoozeSheet:not([hidden])');
  await page.click('#snoozeChoices button:has-text("No, fix the number")');
  await page.waitForSelector('#siteView:not([hidden])');
  await page.click('#u-stage .pill:has-text("Sample / Trial")');
  await page.fill('#u-phone', '0300 7778888');
  await page.click('#save');
  await page.evaluate(() => { window.__hold = null; window.__release(); });
  await page.waitForFunction(() => !document.querySelector('.card .tag.saving'));
  assert.equal(await page.locator('.card.failed').count(), 0, 'not refused as "changed"');
  r = row('S000004');
  assert.deepEqual([r.contact_name, r.contact_phone, r.stage], ['Nadeem Khan', '923007778888', 'Sample / Trial']);

  // ---- The admin: sees Earlier contacts, + New contact person, his feed at once. ----
  const admin = await open(ADMIN, 'admin.html');
  await admin.waitForSelector('#adminTabs');
  const riaLine = await admin.textContent('.rep-row:has(.code:text-is("RIA")) .what');
  // Bilal, Make main Asif, Zafar, Edit details "Yes", Rafiq, Imran: contact changes; Kamal with its Update:
  // one save; the × Update, the note and the Quiet Site Update: three more; the Edit details "No".
  assert.equal(riaLine, '11 saves: 4 updates (1 new contact), 1 details change, 6 contact changes',
    'an Update with its contact row is one save');
  const feed = await admin.$$eval('.card.feed .what', (els) => els.map((e) => e.textContent));
  const kamal = feed.findIndex((f) => f.startsWith('New contact: Kamal · 923002223344 (was Zafar)'));
  assert.ok(kamal >= 0 && feed[kamal + 1].startsWith('Update'), `the update itself is its own feed row: ${feed[kamal + 1]}`);
  await admin.click('.card.feed:has-text("Rafiq")');
  await admin.waitForSelector('#siteView:not([hidden])');
  assert.equal(await admin.textContent('#earlier'), `Earlier contacts (${row('S000001').earlier_contacts.split('\n').length}) ▾`);
  const adminRows = activity().filter((a) => a.rep === 'admin').length;
  await admin.click('#u-addC');
  await admin.fill('#u-cName', 'Admin Pick');
  await admin.fill('#u-cPhone', '0300 9990000');
  const feedBefore = await admin.evaluate(() => data.feed.length);
  await admin.click('#save');
  await admin.waitForSelector('#toast:has-text("Saved")');
  await admin.waitForSelector('.card.feed');
  const first = await admin.textContent('.card.feed .when');
  assert.ok(first.includes('You · F-11 Tower'), first);
  assert.equal(await admin.textContent('.card.feed .what'), 'New contact: Admin Pick · 923009990000 (was Rafiq · 923006660000)');
  assert.equal(activity().slice(-1)[0].rep, 'admin');
  assert.equal(activity().filter((a) => a.rep === 'admin').length, adminRows + 1, 'contact-only: no update row');
  assert.equal(await admin.evaluate(() => data.feed.length), feedBefore + 1, 'one feed row: no made-up Update');
  await noSideways(admin, 'admin feed');
  if (shots) await admin.screenshot({ path: path.join(shots, 'contacts-admin-feed.png') });

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: new contact person and earlier contacts behave as spec 011 says.');
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
