'use strict';
// Spec 008 → "Two people, one site", tried at random. A salesman (RIA) and the admin save Updates
// to the same site in seeded random orders: each save touches random things (stage, Rs. value +
// Cash / Credit, lost reason, follow-up, note) and has a random fate (lands; fails before
// landing; lands but the reply is lost, then is retried unchanged or edited; refused, then retried),
// with random refreshes and forms left open while the other one saves. The server is the real
// code; each phone is a small model of App.html's save queue, using App.html's own update rules
// (the "update rules" block: intendedOf, touchedOf), loaded from the page as they are.
//
// After every save, and at the end, these must hold:
//  1. A save writes only what its sender touched (no stale value ever written back), and never
//     over a change someone else made to that same thing after the sender's form opened.
//  2. A save Google answers "saved" really wrote everything its sender touched; anything else is
//     visibly not saved (orange) or refused with a message.
//  3. One Activity row per landed save, never two for one save ID.
//  4. No save stays orange after a later save that carried its changes landed.
//  5. A save is never refused unless someone else changed something it touched (to another value)
//     since its form opened, or moved the stage so that a touched thing is no longer used.
// (An edited retry gets a new save ID on the real page: any change to an Update form does.)
// A failure prints the seed: SEED=<n> node --test tests/interleave.test.js runs just that one.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSrc, plain, SRC_DIR } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeCacheService,
  makePropertiesService, makeHtmlService,
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
const ADMIN = 'c'.repeat(64);
const SITE = 'S000001';
const SEEDS = process.env.SEED ? [Number(process.env.SEED)] : Array.from({ length: Number(process.env.SEEDS || 1500) }, (_, i) => i + 1);

// ---- The page's own update rules, loaded from App.html ----
const APP = fs.readFileSync(path.join(SRC_DIR, 'App.html'), 'utf8');
function pageFunction(name) {
  const start = APP.indexOf(`      function ${name}(`);
  assert.ok(start >= 0, name);
  const firstLine = APP.slice(start, APP.indexOf('\n', start));
  if (firstLine.trimEnd().endsWith('}')) return firstLine;
  const end = APP.indexOf('\n      }\n', start);
  return APP.slice(start, end + 8);
}
const block = APP.slice(APP.indexOf('// ---- BEGIN update rules'), APP.indexOf('// ---- END update rules'));

// ---- A seeded random source ----
function random(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { chance: (p) => next() < p, pick: (list) => list[Math.floor(next() * list.length)], int: (n) => Math.floor(next() * n) };
}

// ---- One sandbox for every seed; each seed gets a fresh Sales Diary ----
const byId = {};
const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
byId[META_DATA_ID] = metaData;
const src = loadSrc({
  PropertiesService: makePropertiesService(), SpreadsheetApp: makeSpreadsheetApp({ byId }),
  Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(), HtmlService: makeHtmlService(),
});
const s = src.sandbox;
const RULES = plain(s.pageRules_());
const LOST = RULES.lostStage;
const page = new Function('rules', `${pageFunction('has')}\n${pageFunction('digitsOf')}\n${pageFunction('addDays')}\n${block}\n` +
  'return { snap: snap, sameSnap: sameSnap, intendedOf: intendedOf, touchedOf: touchedOf, choseFollowUp: choseFollowUp, addDays: addDays };')(() => RULES);
const TODAY = s.dayKey_(new Date());
const D = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

function freshDiary() {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Price Too High', 'Credit Terms', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  const row = SITES.map((h) => ({
    site_id: SITE, rep: 'RIA', region: 'North', site_name: 'F-11 Tower', buyer_type: 'Dealer', contact_phone: '923001234567',
    stage: 'Rate Quoted', value_rs: 300000, payment_terms: 'Credit', next_followup: s.dayStart_(page.addDays(TODAY, 2)),
    last_note: 'start', created_at: D, updated_at: D, worked_at: D,
  })[h] ?? '');
  byId[SALES_DIARY_ID] = makeSpreadsheet({
    Sites: [SITES, row], Activity: [ACTIVITY], Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D], ['owner', '', ADMIN, true, D]],
  }, { name: 'Sales Diary' });
  return byId[SALES_DIARY_ID];
}

/** The site's row as it is, plus how many Activity rows there are. */
function sheetState(diary) {
  const values = diary.getSheetByName('Sites').getDataRange().getValues()[1];
  const r = Object.fromEntries(SITES.map((h, i) => [h, values[i]]));
  const card = plain(s.cardOf_(r));
  return { snap: page.snap(card), note: card.note, rows: diary.getSheetByName('Activity').getLastRow() - 1 };
}

// ---- A phone: a small model of App.html's save queue (spec 005) with spec 008's rules ----
let idCounter = 0;
const newSaveId = () => `save${String(++idCounter).padStart(8, '0')}`;

function makePhone(who) {
  const isAdmin = who === 'admin';
  const call = (input) => plain(isAdmin ? s.adminPageUpdateSite(ADMIN, SITE, input) : s.repUpdateSite(RIA, SITE, input));
  const load = () => plain(isAdmin ? s.adminPageLoad(ADMIN) : s.repLoad(RIA)).sites.find((c) => c.id === SITE);
  const p = { who, queue: [], superseded: {}, form: null, card: null, confirmed: null, notes: 0, late: [] };
  p.refresh = () => {
    const card = load();
    p.confirmed = page.snap(card);
    p.card = card;
    p.queue.forEach((e) => { p.card = JSON.parse(JSON.stringify(e.card)); });
    // A form left open: brought up to date if the site it shows changed (rebaseOpenForm).
    if (p.form && !page.sameSnap(p.form.shown, page.snap(p.card))) p.form = rebased(p.form, p.card);
  };
  const emptyUpdate = (card) => ({
    stage: card.stage, value: card.value ? String(card.value) : '', terms: card.terms || '', lostReason: card.lostReason || '',
    followUp: card.followUp && card.followUp >= TODAY ? 'keep' : 'tomorrow', date: '', note: '', phone: '',
    saveId: newSaveId(), seen: JSON.parse(JSON.stringify(p.confirmed)), shown: page.snap(card),
  });
  function rebased(u, card) {
    const d = emptyUpdate(card);
    const t = u.seen ? page.touchedOf(u, TODAY) : [];
    const out = JSON.parse(JSON.stringify(u));
    if (!t.includes('stage')) out.stage = d.stage;
    if (!t.includes('money')) { out.value = d.value; out.terms = d.terms; }
    if (!t.includes('lostReason')) out.lostReason = d.lostReason;
    if (!t.includes('followUp') || !page.choseFollowUp(u, TODAY)) { out.followUp = d.followUp; out.date = ''; }
    out.seen = d.seen;
    out.shown = d.shown;
    out.saveId = newSaveId();
    return out;
  }
  p.openForm = () => { p.form = emptyUpdate(p.card); };
  // He changes some things; the page's own checks (stageProblem) are met before Save.
  p.edit = (rnd) => {
    const u = p.form;
    if (rnd.chance(0.5)) u.stage = rnd.pick(RULES.stages);
    if (rnd.chance(0.4)) u.value = String(rnd.pick([100000, 300000, 350000, 450000]));
    if (rnd.chance(0.3)) u.terms = rnd.pick(RULES.paymentTerms);
    if (rnd.chance(0.4)) u.lostReason = rnd.pick(['Price Too High', 'Credit Terms', 'Other']);
    if (rnd.chance(0.4)) u.followUp = rnd.pick(['tomorrow', '3days', '1week', 'keep']);
    if (rnd.chance(0.5)) u.note = `${who} note ${++p.notes}`;
    if (RULES.valueStages.includes(u.stage) && !Number(u.value)) u.value = '200000';
    if (RULES.valueStages.includes(u.stage) && !u.terms) u.terms = 'Cash';
    if (u.stage === LOST && !u.lostReason) u.lostReason = 'Price Too High';
    if (u.stage === LOST && u.lostReason === 'Other' && !u.note) u.note = `${who} why ${++p.notes}`;
    if (u.followUp === 'keep' && !(u.shown.followUp && u.shown.followUp >= TODAY)) u.followUp = 'tomorrow';
    u.saveId = newSaveId();
  };
  // Save: what App.html's saveUpdate sends, shown at once, queued (carries = his earlier saves).
  p.save = (replaces) => {
    const u = p.form;
    p.form = null;
    const want = page.intendedOf(u, TODAY);
    const input = {
      stage: u.stage, value: u.value, terms: u.terms, lostReason: u.lostReason,
      followUp: u.followUp === 'keep' ? u.shown.followUp : u.followUp, note: u.note, phone: '', saveId: u.saveId,
      seen: JSON.parse(JSON.stringify(u.seen)), touched: page.touchedOf(u, TODAY),
    };
    const card = { ...JSON.parse(JSON.stringify(p.card)), stage: want.stage, lostReason: want.lostReason, followUp: want.followUp };
    if (RULES.valueStages.includes(want.stage)) { card.value = want.value; card.terms = want.terms; }
    if (u.note.trim()) card.note = (isAdmin ? 'Admin: ' : '') + u.note.trim();
    const carries = replaces ? replaces.carries.concat([replaces.id]) : p.queue.map((e) => e.id); // a retry: what it first carried, and itself
    if (replaces) p.queue.splice(p.queue.indexOf(replaces), 1);
    const entry = { id: u.saveId, input, card, state: u, status: 'saving', carries, want };
    p.queue.push(entry);
    p.card = JSON.parse(JSON.stringify(card));
  };
  p.applySuccess = (e, r) => {
    if (p.queue.includes(e)) p.queue.splice(p.queue.indexOf(e), 1);
    if (p.superseded[e.id]) return;
    e.carries.forEach((id) => { p.superseded[id] = true; });
    p.confirmed = page.snap(r.site);
    p.queue = p.queue.filter((q) => !(q.status === 'failed' && e.carries.includes(q.id)));
    if (!p.queue.some((q) => q.status !== 'failed')) p.card = r.site;
  };
  p.refused = (e, r) => {
    e.status = 'failed';
    e.message = r.message;
    if (r.changed && r.site) {
      p.card = r.site;
      p.confirmed = page.snap(r.site);
      e.card = r.site;
      if (e.state.seen) e.state = rebased(e.state, r.site);
    }
  };
  // Retry a not-saved card: unchanged (same save ID) or edited (a new note, a new save ID).
  p.retry = (e, edited) => {
    p.form = JSON.parse(JSON.stringify(e.state));
    if (edited) { p.form.note = `${who} retry ${++p.notes}`; p.form.saveId = newSaveId(); }
    p.save(e);
  };
  p.call = call;
  return p;
}

// ---- One random sequence ----
function run(seed) {
  const rnd = random(seed);
  const diary = freshDiary();
  const phones = [makePhone('RIA'), makePhone('admin')];
  phones.forEach((ph) => ph.refresh());
  const rowsBySave = {};
  const log = [];
  const fail = (what) => { throw new Error(`seed ${seed}: ${what}\n  ${log.join('\n  ')}`); };

  // Sends a phone's next save with a random fate, and checks invariants 1-3 on what Google did.
  function deliver(ph, only) {
    const e = ph.queue.find((q) => q.status === 'saving');
    if (!e) return;
    const fate = only || rnd.pick(['land', 'land', 'land', 'fail', 'lost', 'late']);
    log.push(`${ph.who} ${e.id} ${fate} touched=${e.input.touched.join(',')} want=${JSON.stringify(e.want)}${e.input.note ? ' note' : ''}`);
    // A carried save that fails anyway is dropped, not shown orange (dropIfCarried).
    const failIt = (message) => { e.status = 'failed'; e.message = message; if (ph.superseded[e.id]) ph.queue.splice(ph.queue.indexOf(e), 1); };
    if (fate === 'fail') { failIt('Not saved: no signal.'); return; }
    const before = sheetState(diary);
    const repeat = rowsBySave[e.id] === 1; // Google already has this save: it answers as it did then
    const r = ph.call(e.input);
    const after = sheetState(diary);
    const added = after.rows - before.rows;
    rowsBySave[e.id] = (rowsBySave[e.id] || 0) + added;
    if (rowsBySave[e.id] > 1) fail(`3: two Activity rows for save ${e.id}`);
    if (r.ok && added === 0 && !repeat) fail(`3: "saved" but no Activity row (${e.id})`);
    if (!r.ok && added !== 0) fail(`2: refused (${r.message}) but something was written`);
    // 5. Refused only for a real clash.
    if (r.changed) {
      const t = e.input.touched;
      const key = (x, f) => (f === 'money' ? `${x.value}|${x.terms}` : x[f]);
      const usedBy = (stage, f) => ({ stage: true, money: RULES.valueStages.includes(stage), lostReason: stage === LOST,
        followUp: !RULES.closedStages.includes(stage) })[f];
      const clash = t.some((f) => {
        const now = key(before.snap, f);
        const saw = f === 'money' ? `${e.input.seen.value}|${e.input.seen.terms}` : e.input.seen[f];
        if (!t.includes('stage') && before.snap.stage !== e.input.seen.stage && !usedBy(before.snap.stage, f)) return true;
        return now !== saw && now !== key(e.want, f);
      });
      if (!clash) fail('5: refused though nobody else changed what he touched');
    }
    if (r.ok && !repeat) {
      const t = e.input.touched;
      const seen = e.input.seen;
      const want = e.want;
      const changed = (f) => (f === 'money' ? before.snap.value !== after.snap.value || before.snap.terms !== after.snap.terms
        : before.snap[f] !== after.snap[f]);
      // 1. Only what he touched is written (a stage change may clear the lost reason / follow-up).
      if (added === 1) {
        for (const f of ['stage', 'money', 'lostReason', 'followUp']) {
          if (changed(f) && !t.includes(f) && !(t.includes('stage') && (f === 'lostReason' || f === 'followUp'))) {
            fail(`1: ${f} written but not touched (${JSON.stringify(before.snap)} → ${JSON.stringify(after.snap)})`);
          }
        }
        // ...and never over someone else's newer change to that same thing.
        for (const f of t) {
          const now = f === 'money' ? `${before.snap.value}|${before.snap.terms}` : before.snap[f];
          const saw = f === 'money' ? `${seen.value}|${seen.terms}` : seen[f];
          const his = f === 'money' ? `${want.value}|${want.terms}` : want[f];
          if (changed(f) && now !== saw && now !== his) fail(`1: ${f} overwrote someone else's change (${now})`);
        }
      }
      // 2. "Saved" means what he touched is there, and not dropped because someone else's stage
      // doesn't use it.
      const usedBy = (stage, f) => ({ stage: true, money: RULES.valueStages.includes(stage), lostReason: stage === LOST,
        followUp: !RULES.closedStages.includes(stage) })[f];
      for (const f of t) {
        if (!t.includes('stage') && !usedBy(after.snap.stage, f)) fail(`2: "saved" but his ${f} was dropped (now ${after.snap.stage})`);
      }
      for (const f of t) {
        if (f === 'money' && RULES.valueStages.includes(after.snap.stage) &&
          (after.snap.value !== want.value || after.snap.terms !== want.terms)) fail('2: "saved" but his Rs. value is not there');
        if (f === 'stage' && after.snap.stage !== want.stage) fail('2: "saved" but his stage is not there');
        if (f === 'followUp' && !RULES.closedStages.includes(after.snap.stage) && after.snap.followUp !== want.followUp) {
          fail('2: "saved" but his follow-up is not there');
        }
        if (f === 'lostReason' && after.snap.stage === LOST && after.snap.lostReason !== want.lostReason) {
          fail('2: "saved" but his lost reason is not there');
        }
      }
      if (added === 1 && e.input.note.trim() && after.note !== (ph.who === 'admin' ? 'Admin: ' : '') + e.input.note.trim()) {
        fail('2: "saved" but his note is not there');
      }
    }
    if (fate === 'lost') { failIt('Not saved: no signal.'); return; }
    if (fate === 'late') {
      // The phone gave up waiting ("not saved"); Google's "saved" arrives later (still honoured).
      failIt('Not saved: no signal.');
      if (r.ok) ph.late.push({ e, r });
      return;
    }
    if (r.ok) ph.applySuccess(e, r); else { ph.refused(e, r); if (ph.superseded[e.id]) ph.queue.splice(ph.queue.indexOf(e), 1); }
  }
  const lateReply = (ph) => { const x = ph.late.shift(); if (x) ph.applySuccess(x.e, x.r); };

  const steps = 2 + rnd.int(3);
  for (let i = 0; i < steps; i++) {
    const ph = rnd.pick(phones);
    const other = phones.find((x) => x !== ph);
    const failed = ph.queue.filter((q) => q.status === 'failed');
    if (failed.length && rnd.chance(0.5)) {
      ph.retry(rnd.pick(failed), rnd.chance(0.5));
    } else {
      ph.openForm();
      ph.edit(rnd);
      // Sometimes his form stays open while the other one saves, and maybe the page refreshes.
      if (rnd.chance(0.4)) {
        other.openForm(); other.edit(rnd); other.save(); deliver(other);
        if (rnd.chance(0.5)) ph.refresh();
      }
      ph.save();
    }
    deliver(ph);
    if (rnd.chance(0.3)) deliver(other);
    if (rnd.chance(0.25)) rnd.pick(phones).refresh();
    if (rnd.chance(0.4)) lateReply(rnd.pick(phones));
    // 4. No save stays orange after a later save that carried it landed.
    for (const p of phones) {
      for (const q of p.queue) if (q.status === 'failed' && p.superseded[q.id]) fail(`4: ${q.id} still orange though carried`);
    }
  }
  // Every retry and send finishes: each phone retries its orange saves once more, unchanged, and they land.
  for (const ph of phones) {
    for (const e of ph.queue.filter((q) => q.status === 'failed')) {
      if (!ph.queue.includes(e)) continue;
      ph.retry(e, false);
    }
    while (ph.queue.some((q) => q.status === 'saving')) deliver(ph, 'land');
    while (ph.late.length) lateReply(ph);
    for (const q of ph.queue) if (q.status === "failed" && ph.superseded[q.id]) fail(`4: ${q.id} still orange though carried (${q.message}) queue=${JSON.stringify(ph.queue.map((x) => [x.id, x.status, x.carries]))}`);
  }
  for (const ph of phones) {
    ph.refresh();
    if (!page.sameSnap(ph.confirmed, sheetState(diary).snap)) fail(`${ph.who}'s page disagrees with Google after a refresh`);
  }
}

test(`two people, one site: ${SEEDS.length} random interleavings keep the five promises`, () => {
  for (const seed of SEEDS) run(seed);
});

test('the lost-reply retry case (third review): an untouched value is never written back', () => {
  freshDiary();
  const seen = { stage: 'Rate Quoted', value: 300000, terms: 'Credit', lostReason: '', followUp: page.addDays(TODAY, 2) };
  assert.equal(s.adminPageUpdateSite(ADMIN, SITE, { stage: 'Rate Quoted', value: '350000', terms: 'Credit', followUp: seen.followUp,
    seen, touched: ['money'] }).ok, true);
  // RIA's older form changes only the note; it lands, the reply is lost; he edits the note and saves again.
  const u0 = { stage: 'Rate Quoted', value: '300000', terms: 'Credit', followUp: seen.followUp, note: 'n1', saveId: 'riaLost0001', seen, touched: [] };
  assert.equal(s.repUpdateSite(RIA, SITE, u0).ok, true);
  const r1 = plain(s.repUpdateSite(RIA, SITE, { ...u0, note: 'n1 and more', saveId: 'riaLost0002' }));
  assert.equal(r1.ok, true, r1.message);
  assert.equal(sheetState(byId[SALES_DIARY_ID]).snap.value, 350000, "the admin's value stays");
  assert.equal(sheetState(byId[SALES_DIARY_ID]).note, 'n1 and more');
});
