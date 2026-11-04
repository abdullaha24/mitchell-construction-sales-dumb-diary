'use strict';
// Spec 004 → Rules (the plain-logic parts): checking an Update and Edit details.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, plain } = require('./helpers/load-src');
const { makeUtilities } = require('./helpers/fakes');

const s = loadSrc({ Utilities: makeUtilities() }).sandbox;
const TODAY = '2026-11-04';
const LOST = { lostReasons: ['Price Too High', 'Credit Terms', 'Competitor Approved', 'Site Delayed', 'Other'] };
const CHOICES = {
  buyerTypes: ['Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer'],
  categories: ['Tile Adhesives', 'Waterproofing Job', 'Tile Grouts'],
  areas: ['DHA', 'F-11'],
};
const SITE = {
  stage: 'Visited / Lead', value: null, terms: '', lostReason: '', followUp: '2026-11-05',
  phone: '923001234567', name: 'F-11 Tower', buyerType: 'Dealer', contactName: 'Asif',
  products: ['Tile Adhesives'], area: 'DHA',
};
const update = (input, current = SITE) => plain(s.checkUpdate_(input, current, LOST, TODAY));
const details = (input, current = SITE) => plain(s.checkDetails_({
  name: current.name, buyerType: current.buyerType, contactName: current.contactName, phone: current.phone,
  products: current.products, area: current.area, ...input,
}, current, CHOICES));

// ------------------------------------------------------------------------------------ Stages

test('any stage can be picked, forwards, backwards or reopening (owner P4-4)', () => {
  for (const [from, to] of [['Visited / Lead', 'Sample / Trial'], ['Rate Quoted', 'Visited / Lead'],
    ['Won (Order)', 'Sample / Trial'], ['Lost / Dead', 'Visited / Lead']]) {
    const result = update({ stage: to, followUp: 'tomorrow' }, { ...SITE, stage: from, value: 5, terms: 'Cash' });
    assert.equal(result.ok, true, `${from} → ${to}`);
    assert.equal(result.update.stage, to);
  }
  assert.deepEqual(update({ stage: 'Done' }), { ok: false, message: 'Tap a stage.' });
  assert.deepEqual(update({}), { ok: false, message: 'Tap a stage.' });
  assert.deepEqual(update(null), { ok: false, message: 'Something went wrong. Try again.' });
});

// ---------------------------------------------------------------------------- Value and terms

test('Rate Quoted and Won need a total Rs. value (1 to 1,000,000,000) and Cash / Credit', () => {
  for (const stage of ['Rate Quoted', 'Won (Order)']) {
    assert.deepEqual(update({ stage, terms: 'Cash', followUp: 'tomorrow' }), { ok: false, message: 'Type the total Rs. value.' });
    assert.deepEqual(update({ stage, value: '0', terms: 'Cash', followUp: 'tomorrow' }), { ok: false, message: 'Type the total Rs. value.' });
    assert.deepEqual(update({ stage, value: 'abc', terms: 'Cash', followUp: 'tomorrow' }), { ok: false, message: 'Type the total Rs. value.' });
    assert.deepEqual(update({ stage, value: '1,000,000,001', terms: 'Cash', followUp: 'tomorrow' }),
      { ok: false, message: 'The Rs. value must be at most Rs. 1,000,000,000.' });
    assert.deepEqual(update({ stage, value: '450,000', followUp: 'tomorrow' }), { ok: false, message: 'Tap Cash or Credit.' });
    assert.deepEqual(update({ stage, value: '450,000', terms: 'cash', followUp: 'tomorrow' }), { ok: false, message: 'Tap Cash or Credit.' });
  }
  const quoted = update({ stage: 'Rate Quoted', value: 'Rs. 450,000', terms: 'Credit', followUp: '3days' });
  assert.deepEqual(quoted.update, {
    stage: 'Rate Quoted', value: 450000, terms: 'Credit', lostReason: '', followUp: '2026-11-07', note: '', phone: '',
  });
});

test('other stages keep the last value and terms ("latest quoted or won value")', () => {
  const was = { ...SITE, stage: 'Rate Quoted', value: 450000, terms: 'Credit' };
  const result = update({ stage: 'Sample / Trial', value: '999', terms: 'Cash', followUp: 'tomorrow' }, was);
  assert.deepEqual([result.update.value, result.update.terms], [450000, 'Credit']);
});

// ------------------------------------------------------------------------------------- Lost

test('Lost needs a reason from the list; Other needs a note', () => {
  assert.deepEqual(update({ stage: 'Lost / Dead' }), { ok: false, message: 'Tap a lost reason.' });
  assert.deepEqual(update({ stage: 'Lost / Dead', lostReason: 'Bad luck' }), { ok: false, message: 'Tap a lost reason.' });
  assert.deepEqual(update({ stage: 'Lost / Dead', lostReason: 'Other' }), { ok: false, message: 'Write a short note for Other.' });
  assert.deepEqual(update({ stage: 'Lost / Dead', lostReason: 'Other', note: '   ' }), { ok: false, message: 'Write a short note for Other.' });
  const lost = update({ stage: 'Lost / Dead', lostReason: 'Other', note: ' went with local brand ' });
  assert.deepEqual(lost.update, {
    stage: 'Lost / Dead', value: null, terms: '', lostReason: 'Other', followUp: '', note: 'went with local brand', phone: '',
  });
});

test('moving away from Lost clears the reason', () => {
  const was = { ...SITE, stage: 'Lost / Dead', lostReason: 'Price Too High', followUp: '' };
  assert.equal(update({ stage: 'Visited / Lead', followUp: 'tomorrow' }, was).update.lostReason, '');
});

// --------------------------------------------------------------------------------- Follow-up

test('open stages need a follow-up; Won and Lost have none (owner P4-3)', () => {
  for (const stage of ['Visited / Lead', 'Sample / Trial']) {
    assert.deepEqual(update({ stage, note: 'x' }), { ok: false, message: 'Pick a follow-up date from today to a year ahead.' });
  }
  assert.equal(update({ stage: 'Won (Order)', value: '5', terms: 'Cash', followUp: 'tomorrow' }).update.followUp, '');
  assert.equal(update({ stage: 'Lost / Dead', lostReason: 'Site Delayed', followUp: '1week' }).update.followUp, '');
  assert.equal(update({ stage: 'Visited / Lead', followUp: '2026-12-01', note: 'x' }).update.followUp, '2026-12-01');
});

// ------------------------------------------------------------------------------------- Notes

test('notes are tidied and up to 200 letters', () => {
  assert.equal(update({ stage: 'Visited / Lead', followUp: 'tomorrow', note: ' met  Asif ' }).update.note, 'met Asif');
  assert.deepEqual(update({ stage: 'Visited / Lead', followUp: 'tomorrow', note: 'x'.repeat(201) }),
    { ok: false, message: 'The note is too long (200 letters at most).' });
});

// ------------------------------------------------------------------------------ Number gate

test('no number: Sample / Trial, Rate Quoted and Won need one, added on the spot (owner P3-4)', () => {
  const noNumber = { ...SITE, phone: '' };
  assert.deepEqual(update({ stage: 'Sample / Trial', followUp: 'tomorrow' }, noNumber),
    { ok: false, message: "Add the contact's number to move this site to Sample / Trial." });
  assert.deepEqual(update({ stage: 'Won (Order)', value: '5', terms: 'Cash', phone: '0300-12' }, noNumber),
    { ok: false, message: 'Check the number.' });
  const added = update({ stage: 'Rate Quoted', value: '5', terms: 'Cash', followUp: 'tomorrow', phone: '0321 5556666' }, noNumber);
  assert.equal(added.update.phone, '923215556666');
  // Visited / Lead and Lost / Dead don't need one.
  assert.equal(update({ stage: 'Visited / Lead', followUp: '3days' }, noNumber).ok, true);
  assert.equal(update({ stage: 'Lost / Dead', lostReason: 'Site Delayed' }, noNumber).ok, true);
  // A site that has a number ignores the box.
  assert.equal(update({ stage: 'Sample / Trial', followUp: 'tomorrow', phone: '0333 0000000' }).update.phone, '');
});

// ---------------------------------------------------------------------------- Nothing to save

test('nothing changed → "Nothing to save."', () => {
  assert.deepEqual(update({ stage: 'Visited / Lead', followUp: '2026-11-05' }), { ok: false, message: 'Nothing to save.' });
  const won = { ...SITE, stage: 'Won (Order)', value: 450000, terms: 'Cash', followUp: '' };
  assert.deepEqual(update({ stage: 'Won (Order)', value: '450,000', terms: 'Cash' }, won), { ok: false, message: 'Nothing to save.' });
  // Any real change saves.
  assert.equal(update({ stage: 'Visited / Lead', followUp: 'tomorrow' }).ok, false, 'tomorrow = the same date');
  assert.equal(update({ stage: 'Visited / Lead', followUp: '3days' }).ok, true);
  assert.equal(update({ stage: 'Visited / Lead', followUp: '2026-11-05', note: 'called' }).ok, true);
  assert.equal(update({ stage: 'Won (Order)', value: '460000', terms: 'Cash' }, won).ok, true);
  assert.equal(update({ stage: 'Won (Order)', value: '450000', terms: 'Credit' }, won).ok, true);
});

// ------------------------------------------------------------------------------- Edit details

test('Edit details: changes are listed, with the old and new number', () => {
  const result = details({ name: 'F-11 Tower B', phone: '0300 9876543', products: ['Tile Grouts', 'Tile Adhesives'] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, ['Site name', 'Phone 923001234567 → 923009876543', 'Products']);
  assert.deepEqual(result.fields.products, ['Tile Adhesives', 'Tile Grouts']);
});

test('Edit details: a number can be added, or changed, but not removed', () => {
  assert.deepEqual(details({ phone: '' }), { ok: false, message: "A site's number can be changed, not removed." });
  assert.deepEqual(details({ phone: '   ' }), { ok: false, message: "A site's number can be changed, not removed." });
  const added = details({ phone: '0300 1112223' }, { ...SITE, phone: '' });
  assert.deepEqual(added.changes, ['Phone added 923001112223']);
  assert.deepEqual(details({ phone: '' }, { ...SITE, phone: '' }), { ok: false, message: 'Nothing to save.' });
});

test('Edit details: same field rules as a new site; nothing changed → "Nothing to save."', () => {
  assert.deepEqual(details({}), { ok: false, message: 'Nothing to save.' });
  assert.deepEqual(details({ phone: '+92 300 1234567', area: 'd.h.a' }), { ok: false, message: 'Nothing to save.' });
  assert.deepEqual(details({ name: '' }), { ok: false, message: 'Type the site name.' });
  assert.deepEqual(details({ buyerType: 'Builder' }), { ok: false, message: 'Tap a buyer type.' });
  assert.deepEqual(details({ phone: '0300-12' }), { ok: false, message: 'Check the number.' });
  const newArea = details({ area: 'Saddar' });
  assert.deepEqual([newArea.fields.area, newArea.fields.newArea, newArea.changes], ['Saddar', true, ['Area']]);
});

test('the new-site check is unchanged by sharing its field rules', () => {
  const result = plain(s.checkNewSite_({ name: 'X', buyerType: 'Dealer', followUp: 'tomorrow' }, CHOICES, TODAY));
  assert.deepEqual(result, {
    ok: true,
    site: { name: 'X', buyerType: 'Dealer', contactName: '', phone: '', products: [], area: '', newArea: false, followUp: '2026-11-05' },
  });
});
