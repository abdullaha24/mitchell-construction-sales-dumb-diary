'use strict';
// Spec 002 → Rules → Links.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const WEB_APP_URL = 'https://script.google.com/macros/s/' +
  'AKfycbwmWhxLQfpkQRfFIfdv9tZD4CvZfeWEB__YiXnGTSk7-6mlZVZUvLEp2aJDwey0HXaF/exec';
const LINKS = ['role', 'rep', 'token', 'active', 'issued_at'];
const NOW = new Date('2026-11-04T09:00:00Z');

/** A made-up, well-formed code. Real codes come from the fake getUuid. */
const code = (ch) => ch.repeat(64);
const RIA_CODE = code('a');
const OWNER_CODE = code('b');
const OLD_RIA_CODE = code('c');
const MUB_CODE = code('d');

/**
 * A Sales Diary with a Links tab, a read-only Meta-Data, and counters on openById.
 * @param {{ links?: any[][] | null, metaTabs?: object | null, busyLock?: boolean }} [options]
 */
function world(options = {}) {
  const { links = [LINKS], metaTabs = metaDataTabs(), busyLock = false } = options;
  const diary = makeSpreadsheet(links ? { Links: links } : { Sites: [['site_id']] }, { name: 'Sales Diary' });
  const metaData = metaTabs && makeSpreadsheet(metaTabs, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const byId = { [SALES_DIARY_ID]: diary };
  if (metaData) byId[META_DATA_ID] = metaData;
  const app = makeSpreadsheetApp({ byId });
  const opened = [];
  const utilities = makeUtilities();
  const lockService = makeLockService({ busy: busyLock });
  const src = loadSrc({
    SpreadsheetApp: { ...app, openById(id) { opened.push(id); return app.openById(id); } },
    Utilities: utilities,
    LockService: lockService,
  });
  return { src, s: src.sandbox, diary, metaData, opened, utilities, lockService };
}

const linksValues = (diary) => diary.getSheetByName('Links').getDataRange().getValues();

// ----------------------------------------------------------------------------------- Codes

test('codes: 64 lowercase letters/digits made from two random IDs, never repeated', () => {
  const { s, utilities } = world();
  const first = s.makeCode_();
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, (utilities._uuids[0] + utilities._uuids[1]).replace(/-/g, ''));
  const seen = new Set([first]);
  for (let i = 0; i < 500; i++) seen.add(s.makeCode_());
  assert.equal(seen.size, 501);
});

test('codes: only something shaped like our codes is accepted', () => {
  const { s } = world();
  assert.equal(s.isWellFormedCode_(RIA_CODE), true);
  for (const bad of [code('a').slice(1), code('a') + 'a', code('A'), code('g'), ` ${code('a').slice(1)}`,
    '', null, undefined, 123, [RIA_CODE], `${RIA_CODE.slice(0, 63)}-`]) {
    assert.equal(s.isWellFormedCode_(bad), false, String(bad));
  }
});

test('links are the web app address plus ?k=code', () => {
  assert.equal(world().s.linkFor_(RIA_CODE), `${WEB_APP_URL}?k=${RIA_CODE}`);
});

// ------------------------------------------------------------------------------- Reading

test('active means the TRUE checkbox or TRUE typed by hand; anything else is cancelled', () => {
  const { s } = world();
  for (const yes of [true, 'TRUE', ' true ']) assert.equal(s.isActiveCell_(yes), true, String(yes));
  for (const no of [false, 'FALSE', '', 'yes', 1, null]) assert.equal(s.isActiveCell_(no), false, String(no));
});

test('the Links tab is read by header name, in any column order', () => {
  const { s, diary } = world({
    links: [['Token', 'notes', 'ACTIVE', 'role', 'Rep', 'issued_at'], [RIA_CODE, 'x', true, 'Rep', ' ria ', NOW]],
  });
  const read = s.readLinks_(diary.getSheetByName('Links'));
  assert.equal(read.ok, true);
  assert.deepEqual(plain(read.rows), [
    { row: 2, role: 'rep', rep: 'RIA', token: RIA_CODE, active: true, issuedAt: NOW.toISOString() },
  ]);
});

test('a Links tab missing a column is reported by name', () => {
  const { s, diary } = world({ links: [['role', 'rep', 'active', 'issued_at']] });
  assert.deepEqual(plain(s.readLinks_(diary.getSheetByName('Links'))), {
    ok: false, message: "Links has no 'token' column in row 1.",
  });
});

// ------------------------------------------------------------------------------- Visiting

const STANDARD_LINKS = [
  LINKS,
  ['rep', 'RIA', OLD_RIA_CODE, false, NOW],
  ['rep', 'RIA', RIA_CODE, true, NOW],
  ['owner', '', OWNER_CODE, true, NOW],
  ['rep', 'MUB', MUB_CODE, true, NOW], // MUB has left: not in Rep_Mapping
];

test("a salesman's working link says who he is", () => {
  assert.deepEqual(plain(world({ links: STANDARD_LINKS }).s.whoIsVisiting_(RIA_CODE)),
    { kind: 'rep', rep: 'RIA', region: 'North' });
});

test("the owner's working link opens the owner, without reading Meta-Data", () => {
  const { s, opened } = world({ links: STANDARD_LINKS });
  assert.deepEqual(plain(s.whoIsVisiting_(OWNER_CODE)), { kind: 'owner' });
  assert.deepEqual(opened, [SALES_DIARY_ID]);
});

test("a salesman's code never opens the owner page, whatever the row says beside it", () => {
  // Role decides, not the code: a rep row stays a rep row.
  const { s } = world({ links: [LINKS, ['rep', 'RIA', OWNER_CODE, true, NOW]] });
  assert.deepEqual(plain(s.whoIsVisiting_(OWNER_CODE)), { kind: 'rep', rep: 'RIA', region: 'North' });
});

test('a cancelled link, owner or salesman, opens nothing', () => {
  const { s } = world({ links: [LINKS, ['owner', '', OWNER_CODE, false, NOW], ['rep', 'RIA', RIA_CODE, 'FALSE', NOW]] });
  assert.deepEqual(plain(s.whoIsVisiting_(OWNER_CODE)), { kind: 'none' });
  assert.deepEqual(plain(s.whoIsVisiting_(RIA_CODE)), { kind: 'none' });
  assert.deepEqual(plain(world({ links: STANDARD_LINKS }).s.whoIsVisiting_(OLD_RIA_CODE)), { kind: 'none' });
});

test('a well-formed code nobody has opens nothing, even one character off a real code', () => {
  const { s } = world({ links: STANDARD_LINKS });
  assert.deepEqual(plain(s.whoIsVisiting_(code('e'))), { kind: 'none' });
  for (const nearMiss of [`${RIA_CODE.slice(0, 63)}b`, `b${RIA_CODE.slice(1)}`, `${OWNER_CODE.slice(0, 32)}${'a'.repeat(32)}`]) {
    assert.deepEqual(plain(s.whoIsVisiting_(nearMiss)), { kind: 'none' }, nearMiss);
  }
});

test('a salesman no longer in Rep_Mapping opens nothing, even with an active link', () => {
  assert.deepEqual(plain(world({ links: STANDARD_LINKS }).s.whoIsVisiting_(MUB_CODE)), { kind: 'none' });
  const tabs = metaDataTabs();
  tabs.Rep_Mapping = tabs.Rep_Mapping.filter((row) => row[0] !== 'RIA');
  assert.deepEqual(plain(world({ links: STANDARD_LINKS, metaTabs: tabs }).s.whoIsVisiting_(RIA_CODE)), { kind: 'none' });
});

test('a row with a strange role, or a rep row with no salesman, opens nothing', () => {
  const { s } = world({ links: [LINKS, ['boss', '', RIA_CODE, true, NOW], ['rep', '', OWNER_CODE, true, NOW]] });
  assert.deepEqual(plain(s.whoIsVisiting_(RIA_CODE)), { kind: 'none' });
  assert.deepEqual(plain(s.whoIsVisiting_(OWNER_CODE)), { kind: 'none' });
});

test('a badly shaped code opens nothing and no sheet is opened', () => {
  const { s, opened } = world({ links: STANDARD_LINKS });
  for (const bad of ['', RIA_CODE.slice(1), `${RIA_CODE}a`, RIA_CODE.toUpperCase(), undefined, null]) {
    assert.deepEqual(plain(s.whoIsVisiting_(bad)), { kind: 'none' });
  }
  assert.deepEqual(opened, []);
});

test('Google failures throw (so the page says "try again"), and never with the code in them', () => {
  const failures = [
    world({ links: null }), // no Links tab
    world({ links: [['role', 'rep', 'active']] }), // Links missing a column
    world({ links: STANDARD_LINKS, metaTabs: null }), // Meta-Data can't be opened (salesman link)
  ];
  for (const { s } of failures) {
    assert.throws(() => s.whoIsVisiting_(RIA_CODE), (error) => {
      assert.ok(!error.message.includes(RIA_CODE), error.message);
      return true;
    });
  }
});

// ------------------------------------------------------------------------------ New / cancel

test('new link: a working row for that person, cancelling only his older ones', () => {
  const { s, diary } = world({ links: STANDARD_LINKS });
  const newCode = s.newLink_(diary, 'RIA', NOW);
  assert.match(newCode, /^[0-9a-f]{64}$/);
  assert.deepEqual(plain(linksValues(diary)), plain([
    LINKS,
    ['rep', 'RIA', OLD_RIA_CODE, false, NOW],
    ['rep', 'RIA', RIA_CODE, false, NOW],
    ['owner', '', OWNER_CODE, true, NOW],
    ['rep', 'MUB', MUB_CODE, true, NOW],
    ['rep', 'RIA', newCode, true, NOW],
  ]));
  assert.deepEqual(plain(s.whoIsVisiting_(newCode)), { kind: 'rep', rep: 'RIA', region: 'North' });
  assert.deepEqual(plain(s.whoIsVisiting_(RIA_CODE)), { kind: 'none' });
  assert.deepEqual(plain(s.whoIsVisiting_(OWNER_CODE)), { kind: 'owner' });
});

test('new owner link: role owner, rep blank, old owner link cancelled', () => {
  const { s, diary } = world({ links: STANDARD_LINKS });
  const newCode = s.newLink_(diary, 'owner', NOW);
  const rows = plain(linksValues(diary));
  assert.deepEqual(rows[rows.length - 1], plain(['owner', '', newCode, true, NOW]));
  assert.equal(rows[3][3], false);
  assert.equal(rows[2][3], true, "RIA's link is untouched");
});

test('new link on an empty Links tab, and columns in another order', () => {
  const { s, diary } = world({ links: [['token', 'issued_at', 'active', 'rep', 'role']] });
  const newCode = s.newLink_(diary, 'SJ', NOW);
  assert.deepEqual(plain(linksValues(diary)), plain([
    ['token', 'issued_at', 'active', 'rep', 'role'],
    [newCode, NOW, true, 'SJ', 'rep'],
  ]));
});

test('new and cancel run inside the script lock; a busy lock writes nothing', () => {
  const { s, diary, lockService } = world({ links: STANDARD_LINKS });
  s.newLink_(diary, 'RIA', NOW);
  s.cancelLinks_(diary, 'RIA');
  assert.deepEqual(lockService._events, ['waitLock 10000', 'releaseLock', 'waitLock 10000', 'releaseLock']);

  const busy = world({ links: STANDARD_LINKS, busyLock: true });
  const before = busy.diary._snapshot();
  assert.throws(() => busy.s.newLink_(busy.diary, 'RIA', NOW), /Lock timeout/);
  assert.throws(() => busy.s.cancelLinks_(busy.diary, 'RIA'), /Lock timeout/);
  assert.deepEqual(busy.diary._snapshot(), before);
});

test('the lock is released even when the work fails', () => {
  const { s, diary, lockService } = world({ links: [['role', 'rep']] });
  assert.throws(() => s.newLink_(diary, 'RIA', NOW), /no 'token' column/);
  assert.deepEqual(lockService._events, ['waitLock 10000', 'releaseLock']);
});

test('cancel: every working link of that person stops; nobody else is touched', () => {
  const { s, diary } = world({
    links: [...STANDARD_LINKS, ['rep', 'ria', code('f'), 'TRUE', NOW]],
  });
  assert.equal(s.cancelLinks_(diary, 'RIA'), 2);
  const rows = plain(linksValues(diary));
  assert.deepEqual(rows.map((r) => r[3]), ['active', false, false, true, true, false]);
  assert.equal(s.cancelLinks_(diary, 'RIA'), 0);
  assert.equal(s.cancelLinks_(diary, 'owner'), 1);
});

// ------------------------------------------------------------------------- Salesmen only

test('readSalesmenOnly_ reads Rep_Mapping only, read-only', () => {
  const { s, metaData } = world();
  const read = s.readSalesmenOnly_();
  assert.equal(read.ok, true);
  assert.equal(read.salesmen.length, 7);
  assert.deepEqual(metaData._writes(), []);
  assert.deepEqual(plain(world({ metaTabs: null }).s.readSalesmenOnly_()).ok, false);
  const tabs = metaDataTabs();
  delete tabs.Rep_Mapping;
  assert.deepEqual(plain(world({ metaTabs: tabs }).s.readSalesmenOnly_()), {
    ok: false, message: "The Meta-Data sheet has no 'Rep_Mapping' tab.",
  });
});
