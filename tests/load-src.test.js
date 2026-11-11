'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc, srcFiles, plain } = require('./helpers/load-src');

test('the sandbox loads every src file', () => {
  assert.ok(srcFiles().includes('config.js'));
  assert.doesNotThrow(() => loadSrc());
});

test('files load in any order: no top-level value depends on another file', () => {
  assert.doesNotThrow(() => loadSrc({}, { order: srcFiles().reverse() }));
});

test('config values are readable through the sandbox', () => {
  const src = loadSrc();
  assert.equal(src.get('META_DATA_ID'), '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc');
  assert.equal(src.get('APP_TIME_ZONE'), 'Asia/Karachi');
  assert.deepEqual(plain(src.get('META_TABS')), {
    salesmen: 'Rep_Mapping',
    repTargets: 'Rep-Targets',
    regionTargets: 'Targets',
  });
});

test('Sales Diary headers match the data model', () => {
  const headers = plain(loadSrc().get('DIARY_HEADERS'));
  assert.deepEqual(headers.Sites, [
    'site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
    'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
    'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at', 'earlier_contacts',
  ]);
  assert.deepEqual(headers.Activity, [
    'activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage',
    'value_rs', 'payment_terms', 'lost_reason', 'note', 'next_followup',
  ]);
  assert.deepEqual(headers.Lists, ['list', 'value', 'region', 'added_by', 'active', 'sort']);
  assert.deepEqual(headers.Links, ['role', 'rep', 'token', 'active', 'issued_at']);
  const textColumns = plain(loadSrc().get('TEXT_COLUMNS'));
  assert.deepEqual(textColumns, { Sites: ['contact_phone'], Links: ['token'] });
  for (const [tab, names] of Object.entries(textColumns)) {
    for (const name of names) assert.ok(headers[tab].includes(name), `${tab}.${name}`);
  }
});

test('starting Lists: 11 categories in order, 5 lost reasons, 4 buyer types, no areas', () => {
  const lists = plain(loadSrc().get('STARTING_LISTS'));
  assert.deepEqual(Object.keys(lists), ['product_category', 'lost_reason', 'buyer_type']);
  assert.deepEqual(lists.product_category, [
    'Tile Adhesives', 'Waterproofing Job', 'Floor Hardeners', 'Bonding Agents & Sealants',
    'Waterproofing Products', 'Tile Grouts', 'Structural Grouts',
    'Restoration & Repair Products', 'Admixtures', 'Surface Protection',
    'Mortars, Plasters & Putties',
  ]);
  assert.deepEqual(lists.lost_reason, [
    'Price Too High', 'Credit Terms', 'Competitor Approved', 'Site Delayed', 'Other',
  ]);
  assert.deepEqual(lists.buyer_type, [
    'Contractor / Applicator', 'Project Owner', 'Consultant', 'Dealer',
  ]);
});

// tsc does NOT catch this for plain JS files (checked 2026-11-04 with TypeScript 7.0.2), and
// neither does Apps Script: the function from the file loaded last silently wins.
test('no top-level function name is defined in two places', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { SRC_DIR } = require('./helpers/load-src');
  /** @type {Map<string, string[]>} */
  const seen = new Map();
  for (const name of srcFiles()) {
    const source = fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
    for (const match of source.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) {
      seen.set(match[1], [...(seen.get(match[1]) || []), name]);
    }
  }
  const duplicates = [...seen].filter(([, files]) => files.length > 1);
  assert.deepEqual(duplicates, []);
});

test('the manifest: Pakistan time, V8, runs as the owner, open to anyone with a link (no sign-in)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { SRC_DIR } = require('./helpers/load-src');
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'appsscript.json'), 'utf8'));
  assert.deepEqual(manifest, {
    timeZone: 'Asia/Karachi',
    runtimeVersion: 'V8',
    exceptionLogging: 'STACKDRIVER',
    // ANYONE_ANONYMOUS, never ANYONE: ANYONE forces a Google sign-in salesmen don't have (ADR-0002).
    webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' },
  });
});
