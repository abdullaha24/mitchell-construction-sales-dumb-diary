'use strict';
// Spec 003 → Rules: numbers, areas, saving a site (the plain-logic parts).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const { makeUtilities } = require('./helpers/fakes');

const s = loadSrc({ Utilities: makeUtilities() }).sandbox;
const TODAY = '2026-11-04';
const CHOICES = {
  buyerTypes: ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer'],
  categories: ['Tile Adhesives', 'Waterproofing Job', 'Mortars, Plasters & Putties'],
  areas: ['DHA', 'Bahria Town', 'F-11', 'Gulberg'],
};
const GOOD = {
  name: '  F-11   Commercial Tower ', buyerType: 'Dealer', contactName: ' Asif  (site engineer) ',
  phone: '0300-1234567', products: ['Mortars, Plasters & Putties', 'Tile Adhesives'], area: 'd.h.a', followUp: 'tomorrow',
};
const check = (changes) => plain(s.checkNewSite_({ ...GOOD, ...changes }, CHOICES, TODAY));

// ---------------------------------------------------------------------------------- Numbers

test('numbers: every common way of writing a Pakistani number gives the same tidy form', () => {
  for (const raw of ['0300-1234567', '03001234567', '+92 300 1234567', '+923001234567', '0092 300 1234567',
    '923001234567', '300 1234567', '(0300) 123-4567', ' 0300.1234567 ', 923001234567]) {
    assert.deepEqual(plain(s.tidyPhone_(raw)), { ok: true, phone: '923001234567' }, String(raw));
  }
});

test('numbers: landlines and foreign numbers are kept as digits', () => {
  assert.deepEqual(plain(s.tidyPhone_('042-35761234')), { ok: true, phone: '924235761234' });
  assert.deepEqual(plain(s.tidyPhone_('+44 20 7946 0958')), { ok: true, phone: '442079460958' });
  assert.deepEqual(plain(s.tidyPhone_('0544-123456')), { ok: true, phone: '92544123456' }, 'smaller-city landline');
});

test('numbers: blank is allowed; junk, too short and too long are refused', () => {
  assert.deepEqual(plain(s.tidyPhone_('')), { ok: true, phone: '' });
  assert.deepEqual(plain(s.tidyPhone_('   ')), { ok: true, phone: '' });
  assert.deepEqual(plain(s.tidyPhone_(null)), { ok: true, phone: '' });
  for (const bad of ['0300-12345', '0300-123456', '0300-12345678', '+92 300 123456', '12345', 'call asif',
    '0300 1234567 ext 2', '+92 300 1234567 8901 2345', '----']) {
    assert.deepEqual(plain(s.tidyPhone_(bad)), { ok: false }, bad);
  }
});

// ------------------------------------------------------------------------------------ Areas

test('areas: the same apart from capitals, dots and spaces', () => {
  assert.equal(s.areaKey_('D.H.A.'), 'dha');
  assert.equal(s.areaKey_(' Bahria  Town '), 'bahriatown');
  assert.equal(s.areaKey_('F-11'), 'f11');
  assert.equal(s.areaKey_('ڈی ایچ اے'), 'ڈیایچاے', 'Urdu letters are kept');
  assert.deepEqual(plain(s.areaMatches_('d h a', CHOICES.areas)), { same: 'DHA', close: [] });
  assert.deepEqual(plain(s.areaMatches_('bahria town', CHOICES.areas)), { same: 'Bahria Town', close: [] });
});

test('areas: "Did you mean" offers close names, closest first, at most 3', () => {
  assert.deepEqual(plain(s.areaMatches_('Gulbreg', CHOICES.areas)), { same: null, close: ['Gulberg'] });
  assert.deepEqual(plain(s.areaMatches_('Bahria', CHOICES.areas)), { same: null, close: ['Bahria Town'] });
  assert.deepEqual(plain(s.areaMatches_('DHA Phase 6', CHOICES.areas)), { same: null, close: ['DHA'] });
  assert.deepEqual(plain(s.areaMatches_('Saddar', CHOICES.areas)), { same: null, close: [] });
  const many = ['Gulshan', 'Gulshan 2', 'Gulshan Iqbal', 'Gulshan-e-Hadeed', 'Gulistan'];
  assert.deepEqual(plain(s.areaMatches_('Gulshan', many)).close, []); // exact match: same, not close
  assert.equal(plain(s.areaMatches_('Gulsha', many)).close.length, 3);
});

test('areas: short typing (under 3 letters) suggests nothing', () => {
  assert.deepEqual(plain(s.areaMatches_('DH', CHOICES.areas)), { same: null, close: [] });
  assert.deepEqual(plain(s.areaMatches_('', CHOICES.areas)), { same: null, close: [] });
});

test('edit distance', () => {
  assert.equal(s.editDistance_('gulberg', 'gulbreg'), 2);
  assert.equal(s.editDistance_('dha', 'dha'), 0);
  assert.equal(s.editDistance_('', 'abc'), 3);
  assert.equal(s.editDistance_('saddar', 'sadar'), 1);
});

// ------------------------------------------------------------------------------------ Dates

test('follow-up: Tomorrow / 3 days / 1 week from today in Pakistan', () => {
  assert.equal(s.followUpKey_('tomorrow', TODAY), '2026-11-05');
  assert.equal(s.followUpKey_('3days', TODAY), '2026-11-07');
  assert.equal(s.followUpKey_('1week', TODAY), '2026-11-11');
  assert.equal(s.followUpKey_('1week', '2026-12-28'), '2027-01-04');
  assert.equal(s.followUpKey_('tomorrow', '2028-02-28'), '2028-02-29');
});

test('follow-up: a picked date must be real, from today to a year ahead', () => {
  assert.equal(s.followUpKey_('2026-11-04', TODAY), '2026-11-04');
  assert.equal(s.followUpKey_('2027-11-04', TODAY), '2027-11-04');
  for (const bad of ['2026-11-03', '2027-11-05', '2026-02-30', '2026-13-01', '05/11/2026', '', null, 3, 'later', '__proto__', 'toString']) {
    assert.equal(s.followUpKey_(bad, TODAY), null, String(bad));
  }
});

test('days: today in Pakistan, and its start as stored in the sheet', () => {
  assert.equal(s.dayKey_(new Date('2026-11-04T19:30:00Z')), '2026-11-05');
  assert.equal(s.dayStart_('2026-11-05').toISOString(), '2026-11-04T19:00:00.000Z');
  assert.equal(s.addDays_('2026-11-30', 1), '2026-12-01');
});

// ------------------------------------------------------------------------------ A new site

test('a good site is tidied: spaces, number, products in list order, existing area reused', () => {
  assert.deepEqual(check({}), {
    ok: true,
    site: {
      name: 'F-11 Commercial Tower', buyerType: 'Dealer', contactName: 'Asif (site engineer)',
      phone: '923001234567', products: ['Tile Adhesives', 'Mortars, Plasters & Putties'],
      area: 'DHA', newArea: false, followUp: '2026-11-05',
    },
  });
});

test('only name, buyer type and follow-up are required', () => {
  const result = check({ contactName: '', phone: '', products: [], area: '' });
  assert.equal(result.ok, true);
  assert.deepEqual([result.site.contactName, result.site.phone, result.site.area, result.site.newArea], ['', '', '', false]);
  assert.equal(check({ products: undefined }).ok, true);
});

test('a new area is kept as typed (tidied) and marked new', () => {
  const result = check({ area: '  Saddar  Bazaar ' });
  assert.deepEqual([result.site.area, result.site.newArea], ['Saddar Bazaar', true]);
});

test('each problem gets a plain message', () => {
  const cases = [
    [{ name: '' }, 'Type the site name.'],
    [{ name: '   ' }, 'Type the site name.'],
    [{ name: 'x'.repeat(81) }, 'Site name is too long (80 letters at most).'],
    [{ buyerType: 'Builder' }, 'Tap a buyer type.'],
    [{ buyerType: undefined }, 'Tap a buyer type.'],
    [{ contactName: 'x'.repeat(61) }, 'Contact name is too long (60 letters at most).'],
    [{ phone: '12345' }, 'Check the number.'],
    [{ products: ['Paint'] }, 'A product is not in the list. Reload and try again.'],
    [{ products: [42] }, 'A product is not in the list. Reload and try again.'],
    [{ products: 'Tile Adhesives' }, 'Something went wrong. Try again.'],
    [{ area: 'x'.repeat(41) }, 'Area is too long (40 letters at most).'],
    [{ area: '...' }, 'Type an area name with letters or numbers.'],
    [{ followUp: 'someday' }, 'Pick a follow-up date from today to a year ahead.'],
  ];
  for (const [changes, message] of cases) {
    assert.deepEqual(check(changes), { ok: false, message }, JSON.stringify(changes));
  }
  for (const junk of [null, undefined, 'site', 42]) {
    assert.deepEqual(plain(s.checkNewSite_(junk, CHOICES, TODAY)), { ok: false, message: 'Something went wrong. Try again.' });
  }
});

test('the page cannot choose who or where: unknown keys are ignored', () => {
  const result = check({ rep: 'SH', region: 'South', site_id: 'S999999', stage: 'Won (Order)' });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.site).sort(),
    ['area', 'buyerType', 'contactName', 'followUp', 'name', 'newArea', 'phone', 'products']);
});

// -------------------------------------------------------------------------------------- IDs

test('IDs: one more than the highest ever seen, padded; junk ignored', () => {
  assert.equal(s.nextId_([], 'S', 6), 'S000001');
  assert.equal(s.nextId_(['S000001', 'S000009', ' S000003 ', 'X12', '', 'S12a'], 'S', 6), 'S000010');
  assert.equal(s.nextId_(['A0000041'], 'A', 7), 'A0000042');
  assert.equal(s.nextId_(['S999999'], 'S', 6), 'S1000000');
});
