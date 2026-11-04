'use strict';
// Spec 002 → "Making and sending a link" and Safety.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeHtmlService, makeSession,
  makePropertiesService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const WEB_APP_URL = 'https://script.google.com/macros/s/' +
  'AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec';
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];
const OWNER = 'owner@example.com';
const MADE = new Date('2026-11-03T20:30:00Z'); // 4 Nov 2026, 01:30 in Karachi
const RIA_CODE = 'a'.repeat(64);
const SH_OLD = 'b'.repeat(64);
const SH_NEW = 'c'.repeat(64);
const OWNER_CODE = 'e'.repeat(64);
const ORDER = ['owner', 'RIA', 'AUR', 'WAK', 'SH', 'SJ', 'SM', 'IB'];

function world({ activeEmail = OWNER, effectiveEmail = OWNER, links, metaTabs = metaDataTabs() } = {}) {
  const diary = makeSpreadsheet({
    Links: links || [
      LINKS,
      ['rep', 'RIA', RIA_CODE, true, MADE],
      ['rep', 'SH', SH_OLD, true, MADE],
      ['rep', 'SH', SH_NEW, true, MADE], // two working rows by hand-editing: newest shown
      ['owner', '', OWNER_CODE, false, MADE],
    ],
  }, { name: 'Sales Diary' });
  const byId = { [SALES_DIARY_ID]: diary };
  const metaData = metaTabs && makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  if (metaData) byId[META_DATA_ID] = metaData;
  const app = makeSpreadsheetApp({ byId, active: diary });
  const calls = { openById: 0 };
  const lockService = makeLockService();
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: { ...app, openById(id) { calls.openById++; return app.openById(id); } },
    Utilities: makeUtilities(),
    LockService: lockService,
    HtmlService: makeHtmlService(),
    Session: makeSession({ activeEmail, effectiveEmail }),
  });
  return { s: src.sandbox, diary, metaData, ui: app._ui, calls, lockService };
}

/** True if a value (deeply) holds a Date: Google drops those on the way to a page. */
function holdsDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return true;
  if (value && typeof value === 'object') return Object.values(value).some(holdsDate);
  return false;
}

// ----------------------------------------------------------------------------------- Safety

const REFUSALS = [
  ['a salesman on a link page (not signed in)', '', OWNER],
  ['someone else signed in', 'salesman@example.com', OWNER],
];
const OWNER_ONLY = [
  ['menuLinks', []], ['ownerListLinks', []], ['ownerNewLink', ['RIA']], ['ownerCancelLink', ['RIA']],
];
for (const [why, activeEmail, effectiveEmail] of REFUSALS) {
  for (const [name, args] of OWNER_ONLY) {
    test(`${name} refuses ${why}, and touches nothing`, () => {
      const w = world({ activeEmail, effectiveEmail });
      const before = JSON.stringify(w.diary._snapshot());
      assert.throws(() => w.s[name](...args), /Only the owner can manage links/);
      assert.equal(JSON.stringify(w.diary._snapshot()), before);
      assert.deepEqual(w.diary._writes(), []);
      assert.deepEqual(w.calls, { openById: 0 });
      assert.deepEqual(w.lockService._events, []);
      assert.deepEqual(w.ui.dialogs, []);
    });
  }
}

test('only "owner" or a salesman in Rep_Mapping right now is accepted', () => {
  for (const bad of ['MUB', 'UAK', 'nobody', '', '   ', null, undefined, 42, {}, ['RIA'], 'Owner ']) {
    const w = world();
    assert.throws(() => w.s.ownerNewLink(bad), /isn't one of your salesmen/, String(bad));
    assert.throws(() => w.s.ownerCancelLink(bad), /isn't one of your salesmen/, String(bad));
    assert.deepEqual(w.diary._writes(), [], String(bad));
  }
});

test("Meta-Data can't be opened: no salesman link is made, and the list says why", () => {
  const w = world({ metaTabs: null });
  assert.throws(() => w.s.ownerNewLink('RIA'), /Can't open the Meta-Data sheet/);
  assert.deepEqual(w.diary._writes(), []);
  assert.deepEqual(plain(w.s.ownerListLinks()), {
    ok: false, message: "Can't open the Meta-Data sheet. Check it still exists and your Google account can open it.",
  });
});

test("Meta-Data can't be opened: the owner's own link is still made, then the list says why", () => {
  const w = world({ metaTabs: null });
  const before = w.diary.getSheetByName('Links').getLastRow();
  assert.equal(w.s.ownerNewLink('owner').ok, false);
  const rows = plain(w.diary.getSheetByName('Links').getDataRange().getValues());
  assert.equal(rows.length, before + 1);
  assert.deepEqual(rows[rows.length - 1].slice(0, 2), ['owner', '']);
  assert.equal(rows[rows.length - 1][3], true);
});

test('no link code ever appears in an error or a refusal from the owner functions', () => {
  const codes = [RIA_CODE, SH_OLD, SH_NEW, OWNER_CODE];
  const failures = [
    () => world({ metaTabs: null }).s.ownerNewLink('RIA'),
    () => world({ links: [['role', 'rep']] }).s.ownerNewLink('RIA'),
    () => world({ links: [['role', 'rep']] }).s.ownerCancelLink('RIA'),
    () => world().s.ownerNewLink('MUB'),
    () => world().s.ownerCancelLink('nobody'),
    () => world({ activeEmail: '' }).s.ownerListLinks(),
  ];
  for (const fail of failures) {
    assert.throws(fail, (error) => codes.every((c) => !error.message.includes(c)));
  }
  const listed = JSON.stringify(plain(world({ metaTabs: null }).s.ownerListLinks()));
  assert.ok(codes.every((c) => !listed.includes(c)));
});

// ------------------------------------------------------------------------------- The window

test('Sales Diary → Links opens the Links window', () => {
  const w = world();
  w.s.menuLinks();
  assert.equal(w.ui.dialogs.length, 1);
  assert.equal(w.ui.dialogs[0].title, 'Links');
  assert.match(w.ui.dialogs[0].output.getContent(), /ownerListLinks/);
  assert.ok(w.ui.dialogs[0].output._width >= 600);
});

test('the list: you first, then salesmen North, Center, South, with working links only', () => {
  const list = plain(world().s.ownerListLinks());
  assert.equal(list.ok, true);
  assert.deepEqual(list.rows.map((r) => r.who), ORDER);
  assert.deepEqual(list.rows.map((r) => r.region), ['', 'North', 'North', 'North', 'Center', 'Center', 'Center', 'South']);
  const byWho = Object.fromEntries(list.rows.map((r) => [r.who, r]));
  assert.equal(byWho.owner.label, 'You (owner)');
  assert.equal(byWho.owner.link, '', 'a cancelled owner link is not shown');
  assert.equal(byWho.RIA.link, `${WEB_APP_URL}?k=${RIA_CODE}`);
  assert.equal(byWho.RIA.made, '4 Nov 2026');
  assert.equal(byWho.SH.link, `${WEB_APP_URL}?k=${SH_NEW}`, 'the newest working row is shown');
  assert.equal(byWho.AUR.link, '');
  assert.equal(byWho.AUR.made, '');
  assert.equal(byWho.AUR.message, '');
  assert.equal(byWho.RIA.message,
    `RIA, this is your Sales Diary link. Keep it private: anyone with it can use the diary as you. ${WEB_APP_URL}?k=${RIA_CODE}`);
});

test('the list holds only plain values (Google drops Dates sent to a page)', () => {
  const list = world().s.ownerListLinks();
  assert.equal(holdsDate(list), false);
  assert.deepEqual(plain(list), JSON.parse(JSON.stringify(list)));
});

test('New link: a working link for him, his old one cancelled, the list updated', () => {
  const w = world();
  const list = plain(w.s.ownerNewLink('ria'));
  const ria = list.rows.find((r) => r.who === 'RIA');
  assert.match(ria.link, new RegExp(`^${WEB_APP_URL.replace(/[.?/]/g, '\\$&')}\\?k=[0-9a-f]{64}$`));
  assert.notEqual(ria.link, `${WEB_APP_URL}?k=${RIA_CODE}`);
  const code = ria.link.split('?k=')[1];
  assert.deepEqual(plain(w.s.whoIsVisiting_(code)), { kind: 'rep', rep: 'RIA', region: 'North' });
  assert.deepEqual(plain(w.s.whoIsVisiting_(RIA_CODE)), { kind: 'none' });
});

test("New link for the owner gives him a working owner link", () => {
  const w = world();
  const owner = plain(w.s.ownerNewLink('owner')).rows[0];
  assert.equal(owner.who, 'owner');
  assert.ok(owner.link);
  assert.match(owner.message, /^My Sales Diary owner link\. Keep it private/);
  assert.deepEqual(plain(w.s.whoIsVisiting_(owner.link.split('?k=')[1])), { kind: 'owner' });
});

test('Cancel link: it stops working at once; the list shows No link', () => {
  const w = world();
  const list = plain(w.s.ownerCancelLink('SH'));
  assert.equal(list.rows.find((r) => r.who === 'SH').link, '');
  for (const old of [SH_OLD, SH_NEW]) assert.deepEqual(plain(w.s.whoIsVisiting_(old)), { kind: 'none' });
  assert.deepEqual(plain(w.s.whoIsVisiting_(RIA_CODE)), { kind: 'rep', rep: 'RIA', region: 'North' });
});

test('someone no longer in Rep_Mapping who still has a working link is listed last, to cancel', () => {
  const w = world({ links: [LINKS, ['rep', 'RIA', RIA_CODE, true, MADE], ['rep', 'MUB', SH_OLD, true, MADE]] });
  const list = plain(w.s.ownerListLinks());
  assert.deepEqual(list.rows.map((r) => r.who), [...ORDER, 'MUB']);
  const mub = list.rows[list.rows.length - 1];
  assert.deepEqual(mub, { who: 'MUB', label: 'MUB', region: '', former: true, link: '', made: '4 Nov 2026', message: '' });
  assert.ok(list.rows.slice(0, -1).every((r) => r.former === false));
  assert.throws(() => w.s.ownerNewLink('MUB'), /isn't one of your salesmen/);
  const after = plain(w.s.ownerCancelLink('MUB'));
  assert.deepEqual(after.rows.map((r) => r.who), ORDER, 'gone once cancelled');
  assert.throws(() => w.s.ownerCancelLink('MUB'), /isn't one of your salesmen/, 'nothing left to cancel');
});

test('once cancelled, a leaver\'s old link stays dead even if his code is given to someone new', () => {
  const tabs = metaDataTabs();
  const w = world({ links: [LINKS, ['rep', 'MUB', SH_OLD, true, MADE]], metaTabs: tabs });
  w.s.ownerCancelLink('MUB');
  const rejoined = metaDataTabs();
  rejoined.Rep_Mapping.push(['MUB', 'Center']);
  const later = world({ links: plain(w.diary.getSheetByName('Links').getDataRange().getValues()), metaTabs: rejoined });
  assert.deepEqual(plain(later.s.whoIsVisiting_(SH_OLD)), { kind: 'none' });
});

test('a broken Links tab: the list says what is wrong, without crashing', () => {
  const list = plain(world({ links: [['role', 'rep']] }).s.ownerListLinks());
  assert.deepEqual(list, { ok: false, message: "Links has no 'token' column in row 1." });
});
