'use strict';
// Spec 008 → "Two people, one site", tried at random. A salesman (RIA) and the admin save Updates
// to the same site in seeded random orders: each save touches random things (stage, Rs. value +
// Cash / Credit, lost reason, follow-up, note; since spec 011 a new contact person or Make main,
// carried by a later form opened over it) and has a random fate (lands; fails before
// landing; lands but the reply is lost, then is retried unchanged or edited; refused, then retried),
// with random refreshes and forms left open while the other one saves. The server is the real
// code; each phone is a small model of App.html's save queue, using App.html's own update rules
// (the "update rules" block: intendedOf, touchedOf; and moveMain), loaded from the page as they are.
//
// After every save, and at the end, these must hold:
//  1. A save writes only what its sender touched (no stale value ever written back), and never
//     over a change someone else made to that same thing after the sender's form opened.
//  2. A save Google answers "saved" really wrote everything its sender touched; anything else is
//     visibly not saved (orange) or refused with a message.
//  3. One update / stage_change row per landed save, never two for one save ID, plus at most one
//     `contact` row (spec 011); a save whose new contact is already the main one writes no contact row.
//  4. No save stays orange after a later save that carried its changes landed.
//  5. A save is never refused unless someone else changed something it touched (to another value)
//     since its form opened, or moved the stage so that a touched thing is no longer used.
//  6. Contacts (spec 011): a "saved" new contact is the main one; nobody who was ever the main
//     contact is lost (each is the main or an earlier contact) or kept twice; the main contact
//     changes only through a save that carried a contact. (Promise 5 for contacts: refused only
//     when someone ELSE changed the main contact after his form's knowledge of the site.)
//  7. A save sends only the new contact its form shows: a carried one is in the box, × drops it.
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
const TODAY = s.dayKey_(new Date());
const page = new Function('rules', 'todayKey', [has, digitsOf, addDays, tidyPhone, clone, loose, moveMain, carryContact]
  .map((f) => pageFunction(f.name)).join('\n') +
  `\n${block}\n` + 'return { snap: snap, sameSnap: sameSnap, intendedOf: intendedOf, touchedOf: touchedOf, choseFollowUp: choseFollowUp, ' +
  'addDays: addDays, moveMain: moveMain, carryContact: carryContact };')(() => RULES, () => TODAY);
// Names for pageFunction only (the page's own functions are what runs).
function has() {} function digitsOf() {} function addDays() {} function tidyPhone() {} function clone() {} function loose() {}
function moveMain() {} function carryContact() {}
// Every change of the main contact in this run, and who made it (promise 5 for contacts: a refusal
// needs a change by someone else after his form's knowledge of the site).
let changeLog = [];
const D = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

function freshDiary() {
  const lists = [['list', 'value', 'region', 'added_by', 'active', 'sort']];
  ['Price Too High', 'Credit Terms', 'Other'].forEach((v, i) => lists.push(['lost_reason', v, '', 'owner', true, (i + 1) * 10]));
  ['Dealer'].forEach((v, i) => lists.push(['buyer_type', v, '', 'owner', true, (i + 1) * 10]));
  const row = SITES.map((h) => ({
    site_id: SITE, rep: 'RIA', region: 'North', site_name: 'F-11 Tower', buyer_type: 'Dealer', contact_phone: '923001234567',
    contact_name: 'Start', earlier_contacts: '923001110009 · Old · 2026-01-01',
    stage: 'Rate Quoted', value_rs: 300000, payment_terms: 'Credit', next_followup: s.dayStart_(page.addDays(TODAY, 2)),
    last_note: 'start', created_at: D, updated_at: D, worked_at: D,
  })[h] ?? '');
  byId[SALES_DIARY_ID] = makeSpreadsheet({
    Sites: [SITES, row], Activity: [ACTIVITY], Lists: lists,
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D], ['owner', '', ADMIN, true, D]],
  }, { name: 'Sales Diary' });
  return byId[SALES_DIARY_ID];
}

/** The site's row as it is, plus the Activity rows' actions. */
function sheetState(diary) {
  const values = diary.getSheetByName('Sites').getDataRange().getValues()[1];
  const r = Object.fromEntries(SITES.map((h, i) => [h, values[i]]));
  const card = plain(s.cardOf_(r));
  const actions = diary.getSheetByName('Activity').getDataRange().getValues().slice(1).map((a) => a[ACTIVITY.indexOf('action')]);
  return { snap: page.snap(card), note: card.note, rows: actions.length, actions, main: { name: card.contactName, phone: card.phone },
    earlier: card.earlier || [] };
}
const PEOPLE = [['Bilal', '923001110001'], ['Kamran', '923001110002'], ['Asif', '923001110003'], ['Nadeem', ''], ['Zafar', '']];
const samePerson = (a, b) => (a.phone || b.phone ? a.phone === b.phone : a.name.toLowerCase().replace(/\s+/g, '') === b.name.toLowerCase().replace(/\s+/g, ''));

// ---- A phone: a small model of App.html's save queue (spec 005) with spec 008's rules ----
let idCounter = 0;
const newSaveId = () => `save${String(++idCounter).padStart(8, '0')}`;

function makePhone(who) {
  const isAdmin = who === 'admin';
  const call = (input) => plain(isAdmin ? s.adminPageUpdateSite(ADMIN, SITE, input) : s.repUpdateSite(RIA, SITE, input));
  const load = () => plain(isAdmin ? s.adminPageLoad(ADMIN) : s.repLoad(RIA)).sites.find((c) => c.id === SITE);
  const p = { who, queue: [], superseded: {}, form: null, card: null, confirmed: null, notes: 0, late: [], synced: 0 };
  p.refresh = () => {
    const card = load();
    p.confirmed = page.snap(card);
    p.synced = changeLog.length;
    p.card = card;
    p.queue.forEach((e) => { p.card = JSON.parse(JSON.stringify(e.card)); });
    // A form left open: brought up to date if the site it shows changed (rebaseOpenForm).
    if (p.form && !page.sameSnap(p.form.shown, page.snap(p.card))) p.form = { ...rebased(p.form, p.card), openLog: p.synced };
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
  // Opening a form: App.html's showSite carries the contact of his queued saves into the box.
  p.openForm = () => {
    p.form = emptyUpdate(p.card);
    page.carryContact(p.form, SITE, p.queue, p.confirmed.contact);
    p.form.openLog = p.synced;
  };
  // Spec 011: × on the new contact person box (a carried one too), or an empty box left open.
  const dropContact = (u, rnd) => {
    if (u.contact && rnd.chance(0.3)) u.contact = null;
    else if (u.contact === undefined && rnd.chance(0.05)) u.contact = { name: '', phone: '' };
  };
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
    // Spec 011: + New contact person, or Make main on an earlier contact, or × / an empty box.
    const earlier = (p.card.earlier || []).filter((e) => e.till);
    if (rnd.chance(0.3)) {
      dropContact(u, rnd);
    } else if (earlier.length && rnd.chance(0.15)) {
      const e = rnd.pick(earlier);
      u.contact = { name: e.name, phone: e.phone, again: true };
    } else if (rnd.chance(0.3)) {
      const [name, phone] = rnd.pick(PEOPLE);
      u.contact = { name, phone };
    }
    // The page's own check: no new contact without a number at a stage that needs one.
    if (u.contact && u.contact.name && !u.contact.phone && RULES.numberStages.includes(u.stage)) {
      u.contact = { name: 'Bilal', phone: '923001110001' };
    }
    u.saveId = newSaveId();
  };
  // Save: what App.html's saveUpdate sends, shown at once, queued (carries = his earlier saves).
  p.save = (replaces) => {
    const u = p.form;
    p.form = null;
    // An empty box is no new contact (App.html's saveUpdate).
    if (u.contact && !u.contact.name.trim() && !u.contact.phone.trim()) u.contact = null;
    const want = page.intendedOf(u, TODAY);
    const input = {
      stage: u.stage, value: u.value, terms: u.terms, lostReason: u.lostReason,
      followUp: u.followUp === 'keep' ? u.shown.followUp : u.followUp, note: u.note, phone: '', saveId: u.saveId,
      seen: { ...JSON.parse(JSON.stringify(u.seen)), via: u.via }, touched: page.touchedOf(u, TODAY),
    };
    const card = { ...JSON.parse(JSON.stringify(p.card)), stage: want.stage, lostReason: want.lostReason, followUp: want.followUp };
    if (RULES.valueStages.includes(want.stage)) { card.value = want.value; card.terms = want.terms; }
    if (u.note.trim()) card.note = (isAdmin ? 'Admin: ' : '') + u.note.trim();
    const carries = replaces ? replaces.carries.concat([replaces.id]) : p.queue.flatMap((e) => e.carries.concat([e.id])); // a retry: what it first carried, and itself
    // Only the new contact the form shows goes (spec 011), as App.html's saveUpdate does.
    const c = u.contact;
    if (c) {
      input.contact = { name: c.name.trim(), phone: c.phone.trim(), again: !!c.again };
      page.moveMain(card, c);
    }
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
    p.synced = r.log;
    p.queue = p.queue.filter((q) => !(q.status === 'failed' && e.carries.includes(q.id)));
    if (!p.queue.some((q) => q.status !== 'failed')) p.card = r.site;
  };
  p.refused = (e, r) => {
    e.status = 'failed';
    e.message = r.message;
    if (r.changed && r.site) {
      p.card = r.site;
      p.confirmed = page.snap(r.site);
      p.synced = r.log;
      e.card = r.site;
      if (e.state.seen) e.state = { ...rebased(e.state, r.site), openLog: r.log };
    }
  };
  // Retry a not-saved card: unchanged (same save ID) or edited (a new note, a new save ID).
  // Edited: he may also × the new contact the reopened form shows (spec 011).
  p.retry = (e, edited, rnd) => {
    p.form = JSON.parse(JSON.stringify(e.state));
    // Reopened: App.html's showSite brings 'via' up to what the page knows now; it keeps its own contact.
    page.carryContact(p.form, SITE, p.queue, p.confirmed.contact, e);
    p.form.openLog = p.synced;
    if (edited) {
      p.form.note = `${who} retry ${++p.notes}`; p.form.saveId = newSaveId();
      if (rnd && p.form.contact && rnd.chance(0.3)) p.form.contact = null;
    }
    p.save(e);
  };
  p.call = call;
  return p;
}

const sameMain = (a, b) => a.phone === b.phone && a.name.toLowerCase().replace(/\s+/g, '') === b.name.toLowerCase().replace(/\s+/g, '');
/** Nothing on the site changed (a contact-only save whose person is already the main one). */
const sameStateBut = (a, b) => page.sameSnap(a.snap, b.snap) && a.note === b.note && JSON.stringify(a.earlier) === JSON.stringify(b.earlier);

// ---- One random sequence ----
function run(seed) {
  const rnd = random(seed);
  const diary = freshDiary();
  changeLog = [];
  const phones = [makePhone('RIA'), makePhone('admin')];
  phones.forEach((ph) => ph.refresh());
  const rowsBySave = {};
  const landed = {};
  const everMain = [sheetState(diary).main, { name: 'Old', phone: '923001110009' }];
  const log = [];
  const fail = (what) => { throw new Error(`seed ${seed}: ${what}\n  ${log.join('\n  ')}`); };

  // Sends a phone's next save with a random fate, and checks invariants 1-3 on what Google did.
  function deliver(ph, only) {
    const e = ph.queue.find((q) => q.status === 'saving');
    if (!e) return;
    const fate = only || rnd.pick(['land', 'land', 'land', 'fail', 'lost', 'late']);
    log.push(`${ph.who} ${e.id} ${fate} touched=${e.input.touched.join(',')} want=${JSON.stringify(e.want)}${e.input.note ? ' note' : ''}` +
      `${e.input.contact ? ` contact=${JSON.stringify(e.input.contact)}` : ''}`);
    // A carried save that fails anyway is dropped, not shown orange (dropIfCarried).
    const failIt = (message) => { e.status = 'failed'; e.message = message; if (ph.superseded[e.id]) ph.queue.splice(ph.queue.indexOf(e), 1); };
    if (fate === 'fail') { failIt('Not saved: no signal.'); return; }
    const before = sheetState(diary);
    const repeat = e.id in landed; // Google already has this save: it answers as it did then
    const r = ph.call(e.input);
    const after = sheetState(diary);
    const added = after.rows - before.rows;
    const newRows = after.actions.slice(before.rows);
    const updRows = newRows.filter((a) => a !== 'contact').length;
    const contactRows = newRows.length - updRows;
    const counted = rowsBySave[e.id] || (rowsBySave[e.id] = { upd: 0, contact: 0 });
    counted.upd += updRows;
    counted.contact += contactRows;
    if (counted.upd > 1) fail(`3: two update rows for save ${e.id}`);
    if (counted.contact > 1) fail(`3: two contact rows for save ${e.id}`);
    if (contactRows && newRows[newRows.length - 1] !== 'contact') fail('3: the contact row comes after the update row');
    const contact = e.input.contact;
    const already = contact && samePerson(contact, before.main);
    if (contactRows && already) fail(`3: a contact row though ${contact.name} was already the main contact`);
    if (r.ok && added === 0 && !repeat && !(already && !updRows && sameStateBut(before, after))) {
      fail(`3: "saved" but no Activity row (${e.id})`);
    }
    if (!r.ok && added !== 0) fail(`2: refused (${r.message}) but something was written`);
    // 6. The main contact changes only through a save with a contact; a saved contact is the main one.
    if (!sameMain(before.main, after.main) && !(r.ok && contact)) fail('6: the main contact changed without a contact change');
    if (r.ok && contact && !repeat && !samePerson(after.main, { name: contact.name.trim(), phone: s.phoneText_(contact.phone) })) {
      fail(`6: "saved" but ${contact.name} is not the main contact`);
    }
    if (!already && r.ok && contact && !repeat && !contactRows) fail('6: a moved contact without its contact row');
    everMain.push(after.main);
    if (!sameMain(before.main, after.main)) changeLog.push({ who: ph.who });
    // What the reply shows: a repeat answers with what the save did when it first landed.
    r.log = repeat ? landed[e.id] : changeLog.length;
    if (r.ok && !repeat) landed[e.id] = r.log;
    // 7. A save sends only the new contact its form shows (none after ×).
    const shows = e.state.contact && (e.state.contact.name.trim() || e.state.contact.phone.trim()) ? e.state.contact : null;
    if (JSON.stringify(contact ? [contact.name, contact.phone] : null) !== JSON.stringify(shows ? [shows.name.trim(), shows.phone.trim()] : null)) {
      fail(`7: sent ${JSON.stringify(contact)} but the form shows ${JSON.stringify(e.state.contact)}`);
    }
    for (const person of everMain) {
      if (!person.name && !person.phone) continue;
      if (!samePerson(person, after.main) && !after.earlier.some((x) => samePerson(person, x))) {
        fail(`6: ${JSON.stringify(person)} was lost (${JSON.stringify(after)})`);
      }
    }
    const phones = after.earlier.map((x) => x.phone).filter(Boolean).concat(after.main.phone ? [after.main.phone] : []);
    if (new Set(phones).size !== phones.length) fail(`6: a person kept twice ${JSON.stringify(after)}`);
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
      }) || (!!contact && changeLog.slice(e.state.openLog || 0).some((x) => x.who !== ph.who));
      if (!clash) fail(`5: refused though nobody else changed what he touched (${JSON.stringify({ seen: e.input.seen, main: before.main })})`);
    }
    if (r.ok && !repeat) {
      const t = e.input.touched;
      const seen = e.input.seen;
      const want = e.want;
      const changed = (f) => (f === 'money' ? before.snap.value !== after.snap.value || before.snap.terms !== after.snap.terms
        : before.snap[f] !== after.snap[f]);
      // 1. Only what he touched is written (a stage change may clear the lost reason / follow-up).
      if (updRows === 1) {
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
      if (updRows === 1 && e.input.note.trim() && after.note !== (ph.who === 'admin' ? 'Admin: ' : '') + e.input.note.trim()) {
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
      ph.retry(rnd.pick(failed), rnd.chance(0.5), rnd);
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

test('spec 011 review: seen.via stays small along a chain of 30 queued Updates, newest first, and still works', () => {
  freshDiary();
  const queue = [];
  const known = { name: 'Start', phone: '923001234567' };
  let u;
  for (let i = 0; i < 30; i++) {
    u = {};
    page.carryContact(u, SITE, queue, known);
    assert.ok(u.via.length <= 20, `form ${i}: ${u.via.length}`);
    u.contact = { name: `P${i}`, phone: `0300 00${String(i).padStart(5, '0')}` };
    queue.push({ id: `q${i}`, card: { id: SITE }, state: u });
  }
  u = {};
  page.carryContact(u, SITE, queue, known);
  assert.equal(u.via.length, 20);
  assert.equal(u.via[0].name, 'P29', 'the newest first');
  assert.equal(u.contact.name, 'P29', 'the newest new contact is carried');
  assert.ok(JSON.stringify(queue).length < 60000, 'no growth to fill phone storage');
  // Google has his newest own contact (P29) and an older one's reply never came: no change under him.
  s.repUpdateSite(RIA, SITE, { stage: 'Rate Quoted', value: '300000', terms: 'Credit', followUp: page.addDays(TODAY, 2),
    contact: { name: 'P29', phone: '0300 0000029' } });
  const seen = { stage: 'Rate Quoted', value: 300000, terms: 'Credit', lostReason: '', followUp: page.addDays(TODAY, 2),
    contact: known, via: u.via };
  const r = plain(s.repUpdateSite(RIA, SITE, { stage: 'Rate Quoted', value: '300000', terms: 'Credit', followUp: seen.followUp,
    seen, touched: [], contact: { name: 'Bilal', phone: '0300 1110001' } }));
  assert.equal(r.ok, true, r.message);
});

test("spec 011 review: his own queued Edit details' contact is in via (no false \"changed\" on his next Update)", () => {
  const u = {};
  const queue = [{ id: 'e1', fn: 'repEditSite', card: { id: SITE }, state: { contactName: 'Nadeem Khan', phone: '' } },
    { id: 's1', fn: 'repSnoozeSite', card: { id: SITE }, state: { followUp: '3days' } }];
  page.carryContact(u, SITE, queue, { name: 'Nadeem', phone: '' });
  assert.deepEqual(u.via, [{ name: 'Nadeem Khan', phone: '' }, { name: 'Nadeem', phone: '' }]);
  assert.equal(u.contact, undefined, 'an Edit details is not carried into the new contact box');
});

// The page's queue and card helpers, loaded as they are (spec 011 review: the admin's summary cards).
const APP_QUEUE = ['clone', 'entryFor', 'removeEntry', 'showCard', 'enqueue', 'dropEarlier'].map(pageFunction).join('\n');
const ADMIN_HTML = fs.readFileSync(path.join(SRC_DIR, 'Admin.html'), 'utf8');
const aSumCardsSource = ADMIN_HTML.slice(ADMIN_HTML.indexOf('  function aSumCards('), ADMIN_HTML.indexOf('\n  }\n', ADMIN_HTML.indexOf('  function aSumCards(')) + 4);
function queuePage() {
  const world = { data: { sites: [{ id: 'S000001', name: 'On the page' }] }, sum: { c: {} }, queue: [] };
  const fns = new Function('data', 'sum', 'queue', 'saveQueue', 'sendNext', `${APP_QUEUE}\n${aSumCardsSource}\n` +
    'return { enqueue: enqueue, showCard: showCard, aSumCards: aSumCards, dropEarlier: dropEarlier };')(
    world.data, world.sum, world.queue, () => {}, () => {});
  return { ...world, ...fns };
}

test('spec 011 review: a save of a site only the summary brought stays out of his sites, after a reload too', () => {
  const p = queuePage();
  p.aSumCards({ cards: [{ id: 'S000009', name: 'Old Win', stage: 'Won (Order)' }] });
  p.enqueue({ id: 'x1', card: { id: 'S000009', name: 'Old Win', stage: 'Won (Order)', note: 'mine' }, state: {} });
  assert.equal(p.queue[0].sumOnly, 1);
  assert.deepEqual(p.data.sites.map((x) => x.id), ['S000001']);
  // A reload: the summary's lookup is empty; the stored save puts its card back there, never in his sites.
  const after = queuePage();
  after.queue.push(JSON.parse(JSON.stringify(p.queue[0])));
  after.showCard(after.queue[0].card);
  assert.deepEqual(after.data.sites.map((x) => x.id), ['S000001']);
  assert.equal(after.sum.c.S000009.note, 'mine');
  // The summary fetched again never overwrites the newer card while his save is on its way.
  after.aSumCards({ cards: [{ id: 'S000009', name: 'Old Win', stage: 'Won (Order)', note: 'older' }] });
  assert.equal(after.sum.c.S000009.note, 'mine');
  // A save of a site on his page still goes to his page.
  after.enqueue({ id: 'x2', card: { id: 'S000001', name: 'Changed' }, state: {} });
  assert.deepEqual([after.data.sites[0].name, after.queue[1].sumOnly], ['Changed', undefined]);
});

test('spec 011 review: the waiting card never keeps an earlier line with its new main number', () => {
  const card = { phone: '923007778888', earlier: [{ name: 'Old', phone: '923007778888', till: '2026-09-01' },
    { name: 'Other', phone: '923001112222', till: '2026-08-01' }, { name: 'typed', phone: '', till: '' }] };
  queuePage().dropEarlier(card);
  assert.deepEqual(card.earlier.map((e) => e.name), ['Other', 'typed']);
});

test("spec 011: the page's moveMain gives the waiting card exactly the Earlier contacts Google will write", () => {
  const people = [['Asif', '923331112222'], ['a sif', ''], ['ASIF', ''], ['Bilal', '923001234567'], ['Kamran', ''], ['', '923004445555']];
  const lists = [
    [],
    ['923001234567 · Bilal · 2026-10-01', '- · Asif · 2026-09-01', '- · a sif · 2026-08-01', 'typed by hand'],
    Array.from({ length: 21 }, (_, i) => (i === 3 ? 'note line' : `92300000${String(i).padStart(4, '0')} · P${i} · 2026-01-01`)),
    ['- · Kamran · 2026-09-01', '923004445555 · · 2026-08-01', '- · Kamran · 2026-07-01'],
  ];
  let checked = 0;
  for (const cell of lists) {
    for (const [mainName, mainPhone] of people) {
      for (const [name, phone] of people) {
        for (const again of [false, true]) {
          const card = { contactName: mainName, phone: mainPhone, earlier: plain(s.cardOf_({ earlier_contacts: cell.join('\n') })).earlier };
          page.moveMain(card, { name, phone, again });
          const main = { name: mainName, phone: mainPhone };
          const next = { name, phone, again };
          const server = s.samePerson_(next, main) ? cell.join('\n') : s.earlierAfter_(cell.join('\n'), main, next, TODAY);
          const expected = plain(s.cardOf_({ earlier_contacts: server })).earlier || [];
          assert.deepEqual(card.earlier || [], expected, JSON.stringify({ cell, main, next }));
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 288);
});

test('spec 011: a form opened over a queued contact change carries it, so a later save never drops it', () => {
  freshDiary();
  const seen = { stage: 'Rate Quoted', value: 300000, terms: 'Credit', lostReason: '', followUp: page.addDays(TODAY, 2),
    contact: { name: 'Start', phone: '923001234567' } };
  const first = { stage: 'Rate Quoted', value: '300000', terms: 'Credit', followUp: seen.followUp, note: '', saveId: 'carry0000001',
    seen, touched: [], contact: { name: 'Bilal', phone: '0300 1110001' } };
  // The first never reaches Google; the second (opened over it) carries its contact and lands.
  const second = plain(s.repUpdateSite(RIA, SITE, { ...first, note: 'met him', saveId: 'carry0000002' }));
  assert.equal(second.ok, true, second.message);
  assert.deepEqual([second.site.contactName, second.site.phone], ['Bilal', '923001110001']);
  // The first is retried later: the person is already the main one, so nothing moves twice.
  const retry = plain(s.repUpdateSite(RIA, SITE, first));
  assert.equal(retry.ok, true, retry.message);
  const state = sheetState(byId[SALES_DIARY_ID]);
  assert.deepEqual(state.actions, ['update', 'contact']);
  assert.deepEqual(state.earlier.map((x) => x.name), ['Start', 'Old']);
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
