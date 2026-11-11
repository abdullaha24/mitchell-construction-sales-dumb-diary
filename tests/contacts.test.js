'use strict';
// Spec 011 → E. New contact person (ADR-0011): the earlier contacts cell (reading, writing, at
// most 20), + New contact person and Make main on an Update (salesman and admin), Edit details'
// "Is this a new person?", repeats and conflicts, the duplicate check and privacy (ADR-0004).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts'];
const ACTIVITY = ['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
  'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup'];
const RIA = 'a'.repeat(64);
const SH = 'b'.repeat(64);
const ADMIN = 'c'.repeat(64);
const D = new Date('2026-10-01T05:00:00Z');

const site = (id, rep, name, extra = {}) => SITES.map((h) => ({
  site_id: id, rep, region: rep === 'SH' ? 'Center' : 'North', site_name: name, buyer_type: 'Dealer', area: 'DHA',
  contact_name: 'Asif', contact_phone: '923331112222', products: 'Tile Adhesives', stage: 'Visited / Lead',
  next_followup: D, last_note: 'first visit', created_at: D, updated_at: D, worked_at: D, ...extra,
})[h] ?? '');

function world(extraSites = []) {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Tile Adhesives'].forEach((v, i) => lists.push(['product_category', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer', 'Consultant'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  ['Price Too High', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  const diary = makeSpreadsheet({
    Sites: [SITES,
      site('S000001', 'RIA', 'F-11 Tower', { earlier_contacts: '923004445555 · Kamran · 2026-09-01' }),
      site('S000002', 'SH', 'Gulberg Mall', { contact_phone: '923007654321', earlier_contacts: '923006667777 · Hidden Person · 2026-08-01' }),
      site('S000003', 'RIA', 'Blue Area', { contact_phone: '', contact_name: 'Nadeem' }),
      ...extraSites],
    Activity: [ACTIVITY, ['A0000003', D, 'RIA', 'S000003', 'created', '', 'Visited / Lead', '', '', '', '', D]],
    Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D], ['rep', 'SH', SH, true, D],
      ['owner', '', ADMIN, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

const rowOf = (w, n) => {
  const values = w.diary.getSheetByName('Sites').getDataRange().getValues()[n];
  return Object.fromEntries(SITES.map((h, i) => [h, values[i]]));
};
const activity = (w) => w.diary.getSheetByName('Activity').getDataRange().getValues().slice(1)
  .map((v) => Object.fromEntries(ACTIVITY.map((h, i) => [h, v[i]])));
const s0 = world().s;
const TODAY = s0.dayKey_(new Date());
const seenOf = (name, phone) => ({ stage: 'Visited / Lead', value: null, terms: '', lostReason: '', followUp: s0.dayKey_(D),
  contact: { name, phone } });
// A contact-only Update, as the page sends it: nothing else touched.
const contactOnly = (contact, extra = {}) => ({ stage: 'Visited / Lead', followUp: s0.dayKey_(D), note: '', contact,
  seen: seenOf('Asif', '923331112222'), touched: [], ...extra });

// ------------------------------------------------------------------------------- The cell

test('reading the cell: newest first; phone or -, a name with " · ", the day; odd lines shown as typed', () => {
  const cell = [
    '923001234567 · Bilal · 2026-11-10',
    '- · Asif (site engineer) · 2026-10-01',
    '923331112222 · Ali · Raza · 2026-09-01', // a name with " · " still parses
    '',
    '  0300 7654321 · Typed by hand · 2026-08-01  ', // a hand-typed number is tidied
    'Asif old number', // no date: as typed
    '923001234567 · Bad day · 2026-02-30',
    'n/a · Junk phone · 2026-01-01',
    ' · No phone part · 2026-01-01',
  ].join('\r\n');
  assert.deepEqual(plain(s0.earlierContacts_(cell)).map(({ name, phone, till }) => ({ name, phone, till })), [
    { name: 'Bilal', phone: '923001234567', till: '2026-11-10' },
    { name: 'Asif (site engineer)', phone: '', till: '2026-10-01' },
    { name: 'Ali · Raza', phone: '923331112222', till: '2026-09-01' },
    { name: 'Typed by hand', phone: '923007654321', till: '2026-08-01' },
    { name: 'Asif old number', phone: '', till: '' },
    { name: '923001234567 · Bad day · 2026-02-30', phone: '', till: '' },
    { name: 'n/a · Junk phone · 2026-01-01', phone: '', till: '' },
    { name: '· No phone part · 2026-01-01', phone: '', till: '' },
  ]);
  assert.deepEqual(plain(s0.earlierContacts_('')), []);
  assert.deepEqual(plain(s0.earlierContacts_(null)), []);
});

test('writing the cell: the old main on top with today, odd lines kept as they are, at most 20', () => {
  const cell = 'Asif old number\n923001234567 · Bilal · 2026-11-10';
  const main = { name: 'Kamran', phone: '923004445555' };
  assert.equal(s0.earlierAfter_(cell, main, { name: 'New', phone: '923008889999' }, '2026-11-11'),
    '923004445555 · Kamran · 2026-11-11\nAsif old number\n923001234567 · Bilal · 2026-11-10');
  // The new main's number is never also kept as an earlier one.
  assert.equal(s0.earlierAfter_(cell, main, { name: 'Bilal', phone: '923001234567' }, '2026-11-11'),
    '923004445555 · Kamran · 2026-11-11\nAsif old number');
  // Make main without a number: the first earlier entry with that name (no number) goes.
  assert.equal(s0.earlierAfter_('- · Asif · 2026-10-01\n- · asif · 2026-09-01', main, { name: 'ASIF', phone: '', again: true },
    '2026-11-11'), '923004445555 · Kamran · 2026-11-11\n- · asif · 2026-09-01');
  // An empty main contact just gets replaced.
  assert.equal(s0.earlierAfter_('', { name: '', phone: '' }, { name: 'New', phone: '' }, '2026-11-11'), '');
  assert.equal(s0.earlierAfter_('', { name: '', phone: '923004445555' }, { name: 'New', phone: '' }, '2026-11-11'),
    '923004445555 ·  · 2026-11-11');
  const twenty = Array.from({ length: 20 }, (_, i) => `92300000${String(i).padStart(4, '0')} · P${i} · 2026-01-01`).join('\n');
  const after = s0.earlierAfter_(twenty, main, { name: 'New', phone: '923008889999' }, '2026-11-11').split('\n');
  assert.equal(after.length, 20);
  assert.equal(after[0], '923004445555 · Kamran · 2026-11-11');
  assert.equal(after[19], '923000000018 · P18 · 2026-01-01', 'the oldest drops off');
});

test('a main number that is not a real number moves, as typed, into the name', () => {
  assert.deepEqual(plain(s0.mainPerson_({ contact_name: 'Asif', contact_phone: 'n/a' })), { name: 'Asif n/a', phone: '' });
  assert.deepEqual(plain(s0.mainPerson_({ contact_name: ' Asif \n Khan ', contact_phone: '0300 1234567' })),
    { name: 'Asif Khan', phone: '923001234567' });
  assert.deepEqual(plain(s0.mainPerson_({ contact_name: '', contact_phone: '' })), { name: '', phone: '' });
});

test('the contact row note says who is the main contact now and who it was', () => {
  const was = { name: 'Asif', phone: '923331112222' };
  assert.equal(s0.contactNote_({ name: 'Bilal', phone: '923001234567' }, was, false),
    'New contact: Bilal · 923001234567 (was Asif · 923331112222)');
  assert.equal(s0.contactNote_(was, { name: 'Bilal', phone: '' }, true), 'Main contact again: Asif · 923331112222 (was Bilal)');
  assert.equal(s0.contactNote_({ name: '', phone: '923001234567' }, { name: '', phone: '' }, false), 'New contact: 923001234567');
});

// ------------------------------------------------------------------------- The Update path

test('a contact-only Update: new main, old to the top of Earlier contacts, one contact row and nothing else', () => {
  const w = world();
  const before = rowOf(w, 1);
  const r = plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: '  Bilal  ', phone: '0300 1234567' })));
  assert.equal(r.ok, true, r.message);
  const row = rowOf(w, 1);
  assert.deepEqual([row.contact_name, row.contact_phone, row.earlier_contacts],
    ['Bilal', '923001234567', `923331112222 · Asif · ${TODAY}\n923004445555 · Kamran · 2026-09-01`]);
  assert.notEqual(row.updated_at.getTime(), before.updated_at.getTime());
  assert.equal(row.worked_at.getTime(), D.getTime(), 'not work: going cold keeps counting');
  assert.equal(row.note_at, '');
  assert.equal(row.last_note, 'first visit');
  const rows = activity(w);
  assert.equal(rows.length, 2, 'one contact row, no update row');
  assert.deepEqual({ ...rows[1], timestamp: 'D' }, {
    activity_id: 'A0000004', timestamp: 'D', rep: 'RIA', site_id: 'S000001', action: 'contact', from_stage: '', to_stage: '',
    value_rs: '', payment_terms: '', lost_reason: '', note: 'New contact: Bilal · 923001234567 (was Asif · 923331112222)',
    next_followup: '',
  });
  assert.deepEqual([r.site.contactName, r.site.phone], ['Bilal', '923001234567']);
  assert.deepEqual(r.site.earlier, [{ name: 'Asif', phone: '923331112222', till: TODAY },
    { name: 'Kamran', phone: '923004445555', till: '2026-09-01' }]);
  assert.equal(r.only, true);
  assert.equal(r.contact, 'New contact: Bilal · 923001234567 (was Asif · 923331112222)');
  assert.equal(w.diary.getSheetByName('Sites')._numberFormat(2, 8), '@', 'phone cell set to text first');
});

test('an Update with other changes: the update row, then the contact row (ID one more), in one write', () => {
  const w = world();
  const writes = w.diary._writes().length;
  const r = plain(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: 'tomorrow', note: 'met Bilal',
    contact: { name: 'Bilal', phone: '923001234567' }, seen: seenOf('Asif', '923331112222'), touched: ['followUp'] }));
  assert.equal(r.ok, true, r.message);
  const rows = activity(w);
  assert.deepEqual(rows.slice(1).map((a) => [a.activity_id, a.action, a.note]), [
    ['A0000004', 'update', 'met Bilal'],
    ['A0000005', 'contact', 'New contact: Bilal · 923001234567 (was Asif · 923331112222)'],
  ]);
  assert.equal(rows[1].timestamp.getTime(), rows[2].timestamp.getTime());
  const activityWrites = w.diary._writes().slice(writes).filter((x) => x === 'setValues on Activity');
  assert.equal(activityWrites.length, 1, 'both rows in one write');
  const row = rowOf(w, 1);
  assert.notEqual(row.worked_at.getTime(), D.getTime(), 'the Update itself is work');
  assert.equal(row.contact_name, 'Bilal');
  assert.equal(r.only, undefined);
});

test('the stage rule is judged on the stage the Update saves (P3-4)', () => {
  const w = world();
  const quote = { stage: 'Rate Quoted', value: '450000', terms: 'Cash', followUp: 'tomorrow' };
  for (const stage of ['Sample / Trial', 'Rate Quoted', 'Won (Order)']) {
    const r = plain(w.s.repUpdateSite(RIA, 'S000001', { ...quote, stage, contact: { name: 'Bilal', phone: '' } }));
    assert.deepEqual(r, { ok: false, message: `Type the new contact's number: a site at ${stage} needs one.` });
  }
  // A site already at Rate Quoted: a contact-only Update saves the stage it has.
  const hot = world([site('S000004', 'RIA', 'Hot', { stage: 'Rate Quoted', value_rs: 100, payment_terms: 'Cash' })]);
  const seen = { stage: 'Rate Quoted', value: 100, terms: 'Cash', lostReason: '', followUp: s0.dayKey_(D), contact: { name: 'Asif', phone: '923331112222' } };
  assert.deepEqual(plain(hot.s.repUpdateSite(RIA, 'S000004', { stage: 'Lost / Dead', lostReason: 'Price Too High', value: '100', terms: 'Cash',
    followUp: s0.dayKey_(D), contact: { name: 'Bilal' }, seen, touched: [] })),
  { ok: false, message: "Type the new contact's number: a site at Rate Quoted needs one." }, 'untouched stage: the one it has');
  // At Visited / Lead a new contact without a number is fine (the page asks twice).
  assert.equal(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Bilal' })).ok, true);
  assert.equal(rowOf(w, 1).contact_phone, '');
  // The new contact's number does the "add the number" gate's job on a site without one.
  const r = plain(w.s.repUpdateSite(RIA, 'S000003', { ...quote, contact: { name: 'Bilal', phone: '0300 1234567' } }));
  assert.equal(r.ok, true, r.message);
  assert.deepEqual([rowOf(w, 3).contact_phone, rowOf(w, 3).earlier_contacts], ['923001234567', `- · Nadeem · ${TODAY}`]);
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: '', phone: '' }))),
    { ok: false, message: "Type the new contact's name or number." });
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'X', phone: '12' }))),
    { ok: false, message: 'Check the number.' });
  assert.deepEqual(plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly('Bilal'))), { ok: false, message: 'Something went wrong. Try again.' });
});

test('a typed name or an old junk number can never become a formula', () => {
  const w = world([site('S000004', 'RIA', 'Junk', { contact_name: '=IMPORTRANGE("x")', contact_phone: 'n/a' })]);
  const seen = seenOf('=IMPORTRANGE("x")', '');
  assert.equal(w.s.repUpdateSite(RIA, 'S000004', { ...contactOnly({ name: '=HYPERLINK("y")', phone: '' }), seen }).ok, true);
  const row = rowOf(w, 4);
  assert.equal(row.contact_name, '=HYPERLINK("y")');
  assert.equal(row.earlier_contacts, `- · =IMPORTRANGE("x") n/a · ${TODAY}`);
  assert.ok(!JSON.stringify(w.diary.getSheetByName('Sites').getDataRange().getValues()).includes('FORMULA('));
  assert.ok(!activity(w).some((a) => String(a.note).startsWith('FORMULA(')));
});

test('repeats: the same save twice moves nothing twice; the new contact already main writes nothing', () => {
  const w = world();
  const input = { ...contactOnly({ name: 'Bilal', phone: '923001234567' }), saveId: 'contact00001' };
  assert.equal(w.s.repUpdateSite(RIA, 'S000001', input).ok, true);
  const cell = rowOf(w, 1).earlier_contacts;
  assert.equal(w.s.repUpdateSite(RIA, 'S000001', input).ok, true, 'the reply was lost: sent again');
  // ...or sent again under a new save ID (an edited retry): the main contact is already his.
  const again = plain(w.s.repUpdateSite(RIA, 'S000001', { ...input, saveId: 'contact00002' }));
  assert.equal(again.ok, true, again.message);
  assert.equal(again.contact, undefined);
  assert.equal(rowOf(w, 1).earlier_contacts, cell);
  assert.equal(activity(w).filter((a) => a.action === 'contact').length, 1);
  // The same person (same number, or no number and the same name ignoring case and spaces).
  assert.equal(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Someone', phone: '0300 1234567' },
    { seen: seenOf('Bilal', '923001234567') })).ok, true);
  assert.equal(rowOf(w, 1).contact_name, 'Bilal', 'nothing moves');
  const noNumber = world();
  assert.equal(noNumber.s.repUpdateSite(RIA, 'S000003', contactOnly({ name: ' nadeem ' }, { seen: seenOf('Nadeem', '') })).ok, true);
  assert.equal(activity(noNumber).length, 1, 'no row');
  assert.equal(rowOf(noNumber, 3).earlier_contacts, '');
});

test('conflicts: refused when the main contact changed since his form opened, unless it is his own', () => {
  const w = world();
  // The admin changed the main contact a moment ago.
  assert.equal(w.s.adminPageUpdateSite(ADMIN, 'S000001', contactOnly({ name: 'Zafar', phone: '923008889999' })).ok, true);
  const r = plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Bilal', phone: '923001234567' })));
  assert.equal(r.ok, false);
  assert.equal(r.changed, true);
  assert.equal(r.message, 'This site was changed a moment ago. Here it is now: check it and save again.');
  assert.deepEqual([r.site.contactName, r.site.phone], ['Zafar', '923008889999']);
  assert.equal(rowOf(w, 1).contact_name, 'Zafar');
  // With what he now sees, it saves; Zafar is kept.
  const ok = plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Bilal', phone: '923001234567' },
    { seen: seenOf('Zafar', '923008889999') })));
  assert.equal(ok.ok, true, ok.message);
  assert.deepEqual(ok.site.earlier.map((e) => e.name), ['Zafar', 'Asif', 'Kamran']);
  // An Update without a contact change never clashes over the contact.
  assert.equal(w.s.repUpdateSite(RIA, 'S000001', { stage: 'Visited / Lead', followUp: 'tomorrow', note: 'x',
    seen: seenOf('Asif', '923331112222'), touched: ['followUp'] }).ok, true);
});

test('Make main: the earlier person is main again, the old main joins Earlier contacts', () => {
  const w = world();
  const r = plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Kamran', phone: '923004445555', again: true })));
  assert.equal(r.ok, true, r.message);
  assert.deepEqual([rowOf(w, 1).contact_name, rowOf(w, 1).contact_phone, rowOf(w, 1).earlier_contacts],
    ['Kamran', '923004445555', `923331112222 · Asif · ${TODAY}`]);
  assert.equal(activity(w)[1].note, 'Main contact again: Kamran · 923004445555 (was Asif · 923331112222)');
});

test("the admin's Update can change the contact too: history `admin`, never work", () => {
  const w = world();
  const r = plain(w.s.adminPageUpdateSite(ADMIN, 'S000002', { stage: 'Visited / Lead', followUp: 'tomorrow', note: 'call him',
    contact: { name: 'Bilal', phone: '923001234567' }, seen: seenOf('Asif', '923007654321'), touched: ['followUp'] }));
  assert.equal(r.ok, true, r.message);
  assert.equal(r.site.rep, 'SH');
  assert.deepEqual(activity(w).slice(1).map((a) => [a.rep, a.action]), [['admin', 'update'], ['admin', 'contact']]);
  assert.equal(rowOf(w, 2).worked_at.getTime(), D.getTime());
  assert.equal(rowOf(w, 2).earlier_contacts, `923007654321 · Asif · ${TODAY}\n923006667777 · Hidden Person · 2026-08-01`);
  // His own contact-only Update writes the contact row only.
  assert.equal(w.s.adminPageUpdateSite(ADMIN, 'S000002', contactOnly({ name: 'Asif', phone: '923007654321', again: true },
    { seen: seenOf('Bilal', '923001234567') })).ok, true);
  assert.deepEqual(activity(w).slice(3).map((a) => [a.rep, a.action, a.note]),
    [['admin', 'contact', 'Main contact again: Asif · 923007654321 (was Bilal · 923001234567)']]);
  const feed = plain(w.s.adminPageLoad(ADMIN)).feed;
  assert.equal(feed[0].action, 'contact');
  assert.equal(feed[0].note, 'Main contact again: Asif · 923007654321 (was Bilal · 923001234567)');
});

test('at most 20 earlier contacts: the oldest drops off the list (the history keeps it)', () => {
  const w = world();
  for (let i = 0; i < 22; i++) {
    const now = rowOf(w, 1);
    const r = w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: `P${i}`, phone: `92300000${String(i).padStart(4, '0')}` },
      { seen: seenOf(now.contact_name, String(now.contact_phone)) }));
    assert.equal(r.ok, true, r.message);
  }
  const lines = rowOf(w, 1).earlier_contacts.split('\n');
  assert.equal(lines.length, 20);
  assert.equal(lines[0], `923000000020 · P20 · ${TODAY}`);
  assert.ok(!lines.some((l) => l.includes('Kamran')), 'the oldest went');
  assert.equal(activity(w).filter((a) => a.action === 'contact').length, 22);
});

// --------------------------------------------------------------------------- Edit details

const details = (extra = {}) => ({ name: 'F-11 Tower', buyerType: 'Dealer', contactName: 'Asif', phone: '923331112222',
  products: ['Tile Adhesives'], area: 'DHA', seen: { contact: { name: 'Asif', phone: '923331112222' } }, ...extra });

test('Edit details "Yes, keep the old one": the old main to Earlier contacts and a contact row only', () => {
  const w = world();
  const r = plain(w.s.repEditSite(RIA, 'S000001', details({ contactName: 'Bilal', phone: '0300 1234567', newPerson: true })));
  assert.equal(r.ok, true, r.message);
  assert.deepEqual([rowOf(w, 1).contact_name, rowOf(w, 1).contact_phone, rowOf(w, 1).earlier_contacts],
    ['Bilal', '923001234567', `923331112222 · Asif · ${TODAY}\n923004445555 · Kamran · 2026-09-01`]);
  assert.deepEqual(activity(w).slice(1).map((a) => [a.activity_id, a.action, a.note]),
    [['A0000004', 'contact', 'New contact: Bilal · 923001234567 (was Asif · 923331112222)']]);
  assert.equal(r.site.earlier.length, 2);
});

test('Edit details "Yes" with other fields changed: a details row (the other fields), then the contact row', () => {
  const w = world();
  assert.equal(w.s.repEditSite(RIA, 'S000001', details({ name: 'F-11 Tower B', buyerType: 'Consultant', contactName: 'Bilal',
    phone: '923001234567', newPerson: true })).ok, true);
  assert.deepEqual(activity(w).slice(1).map((a) => [a.activity_id, a.action, a.note]), [
    ['A0000004', 'details', 'Site name; Buyer type'],
    ['A0000005', 'contact', 'New contact: Bilal · 923001234567 (was Asif · 923331112222)'],
  ]);
});

test('Edit details "No, fix the number": as before spec 011 (no earlier contact, one details row)', () => {
  const w = world();
  assert.equal(w.s.repEditSite(RIA, 'S000001', details({ phone: '923331112223', newPerson: false })).ok, true);
  assert.equal(rowOf(w, 1).earlier_contacts, '923004445555 · Kamran · 2026-09-01');
  assert.deepEqual(activity(w).slice(1).map((a) => [a.action, a.note]), [['details', 'Phone 923331112222 → 923331112223']]);
  // A page from before spec 011 (no seen, no newPerson) saves as it always did.
  const old = world();
  assert.equal(old.s.repEditSite(RIA, 'S000001', { ...details({ contactName: 'Bilal' }), seen: undefined }).ok, true);
  assert.equal(activity(old)[1].action, 'details');
});

test('Edit details is refused when the main contact changed since it opened (unless it already is his)', () => {
  const w = world();
  assert.equal(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Bilal', phone: '923001234567' })).ok, true);
  const r = plain(w.s.repEditSite(RIA, 'S000001', details({ name: 'F-11 B' })));
  assert.deepEqual([r.ok, r.changed, r.site.contactName], [false, true, 'Bilal']);
  assert.equal(rowOf(w, 1).site_name, 'F-11 Tower');
  // His own earlier Edit (reply lost), sent again with a change: the contact is already his.
  const mine = world();
  assert.equal(mine.s.repEditSite(RIA, 'S000001', details({ contactName: 'Asif Khan', saveId: 'edit00000001' })).ok, true);
  assert.equal(mine.s.repEditSite(RIA, 'S000001', details({ contactName: 'Asif Khan', name: 'F-11 B', saveId: 'edit00000002' })).ok, true);
  assert.equal(rowOf(mine, 1).site_name, 'F-11 B');
});

// ------------------------------------------------------------ Duplicate check and privacy

test('the duplicate check covers earlier contacts: others yes/no only, his own named "(earlier contact)"', () => {
  const w = world();
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0300 6667777')), { ok: true, valid: true, team: true, mine: [] },
    "SH's earlier contact: yes/no only");
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0300 4445555')),
    { ok: true, valid: true, team: false, mine: ['F-11 Tower (earlier contact)'] });
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0333 1112222')), { ok: true, valid: true, team: false, mine: ['F-11 Tower'] });
  // The site he is changing is never matched; another salesman's site can't be skipped.
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0300 4445555', 'S000001')), { ok: true, valid: true, team: false, mine: [] });
  assert.deepEqual(plain(w.s.repCheckPhone(RIA, '0300 6667777', 'S000002')), { ok: true, valid: true, team: true, mine: [] });
  // The saved reply's warning too, never matching the site itself.
  const r = plain(w.s.repUpdateSite(RIA, 'S000003', contactOnly({ name: 'X', phone: '0300 6667777' }, { seen: seenOf('Nadeem', '') })));
  assert.deepEqual(r.warning, { team: true, mine: [] });
  const own = plain(w.s.repUpdateSite(RIA, 'S000001', contactOnly({ name: 'Kamran', phone: '923004445555', again: true })));
  assert.deepEqual(own.warning, { team: false, mine: [] }, 'his own site is not a duplicate of itself');
  const added = plain(w.s.repAddSite(RIA, { name: 'New', buyerType: 'Dealer', phone: '0333 1112222', followUp: 'tomorrow' }));
  assert.deepEqual(added.warning, { team: false, mine: ['F-11 Tower (earlier contact)'] });
});

test("privacy (ADR-0004): a salesman never receives another salesman's earlier contacts", () => {
  const w = world();
  const load = JSON.stringify(plain(w.s.repLoad(RIA)));
  assert.ok(!load.includes('Hidden Person') && !load.includes('923006667777'));
  assert.ok(load.includes('Kamran'), 'his own are there');
  const sites = plain(w.s.repLoad(RIA)).sites;
  assert.deepEqual(sites.find((x) => x.id === 'S000001').earlier, [{ name: 'Kamran', phone: '923004445555', till: '2026-09-01' }]);
  assert.equal(sites.find((x) => x.id === 'S000003').earlier, undefined, 'none: no earlier list');
  for (const reply of [
    () => w.s.repUpdateSite(RIA, 'S000002', contactOnly({ name: 'X', phone: '923001234567' })),
    () => w.s.repCheckPhone(RIA, '0300 6667777'),
    () => w.s.repEditSite(RIA, 'S000002', details()),
    ...['this-week', 'last-week', 'this-month', 'last-month'].map((p) => () => w.s.repSummary(RIA, p)),
  ].map((call) => { try { return JSON.stringify(plain(call())); } catch (e) { return e.message; } })) {
    assert.ok(!reply.includes('Hidden Person') && !reply.includes('923006667777'), reply);
    assert.ok(reply.startsWith('{') || reply === "That site isn't in your list.", reply);
  }
  const admin = plain(w.s.adminPageLoad(ADMIN)).sites.find((x) => x.id === 'S000002');
  assert.deepEqual(admin.earlier, [{ name: 'Hidden Person', phone: '923006667777', till: '2026-08-01' }], 'the admin sees them');
});

// ------------------------------------------------------------------ Summaries and the feed

test('a contact row is a save (days logged) but never work (sites worked)', () => {
  const st = s0.summaryStages_();
  assert.ok(st);
  const at = new Date('2026-11-10T06:00:00Z');
  const rows = [Object.fromEntries(SITES.map((h) => [h, { site_id: 'S000001', rep: 'RIA', stage: 'Visited / Lead', created_at: D }[h] ?? '']))];
  const period = { start: new Date('2026-11-08T00:00:00+05:00').getTime(), end: new Date('2026-11-15T00:00:00+05:00').getTime(), running: true };
  const moves = [{ when: at, by: 'RIA', site: 'S000001', action: 'contact', from: '', to: '', value: null, terms: '', lostReason: '',
    note: 'New contact: X', followUp: '' }];
  const facts = s0.summaryFacts_(rows, moves, period);
  const work = facts.work.get('RIA');
  assert.equal(work.days.size, 1, 'a save: a day logged');
  assert.equal(work.worked.size, 0, 'not a site worked');
  assert.ok(!plain(s0.WORK_ACTIONS || []).includes('contact'));
});
