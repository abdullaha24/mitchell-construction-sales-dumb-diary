'use strict';
// Spec 012 → the Daily message screen, tried at random. Each seed drives the real Admin.html (served by
// the real doGet) in Chromium against a fake server whose replies the test controls: random taps (the
// Daily message button, Back, ‹, ›, the pills, Copy, Share, Try again, Refresh, the automatic
// 10-minute refresh, the page hidden and shown again), random reply fates (ok, no signal, held and
// landing later, out of order) and random midnights (the page's clock and the server's move a day on
// together). The server's texts are the real server code's (dailyFor_) on fake sheets.
// After every step:
//   1. no script error;
//   2. the day line names the same day as the text on screen (heading and "(so far)" alike), and the
//      pill pressed is the text's region;
//   3. the text on screen is one region of a reply the server sent for that day, and the pills show
//      that same reply's regions;
//   4. Copy and Share only ever give the text on screen, and never a "(so far)" text from before
//      midnight;
// and whenever every reply still on its way has landed OK:
//   5. the screen shows the day of the latest ask (or the kept day shown after it), with no
//      "Getting…" line; if the latest ask failed, its failure line and Try again show;
//   6. after the page is shown again, no "(so far)" text from before midnight is on screen.
// A failure prints the seed: SEED=<n> node tests/browser/daily-random.check.js runs just that one;
// SEEDS=<n> runs more (default 300).

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
const DAY = 24 * 60 * 60 * 1000;
const STEPS = 30;
const SEEDS = process.env.SEED ? [Number(process.env.SEED)] : Array.from({ length: Number(process.env.SEEDS || 300) }, (_, i) => i + 1);

function dayKey(offset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() + offset * DAY));
}
function dayCell(offset, hours = 0) {
  const [y, m, d] = dayKey(offset).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 5 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}

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

/** Work on every day from 34 days back to 4 days ahead (the server's clock moves up to 3 days). */
function buildWorld() {
  const site = (o) => SITES.map((h) => ({
    region: 'North', buyer_type: 'Dealer', products: 'Tile Adhesives', contact_phone: '923001234567', stage: 'Visited / Lead',
    next_followup: dayCell(3), created_at: dayCell(-60), updated_at: dayCell(-60), worked_at: dayCell(-1), ...o,
  })[h] ?? '');
  const reps = [['RIA', 'North'], ['AUR', 'North'], ['SH', 'Center'], ['IB', 'South']];
  const rows = [];
  const activity = [];
  let id = 0;
  const act = (when, rep, siteId, action, o = {}) => ACTIVITY.map((h) => ({
    activity_id: `A${String(++id).padStart(7, '0')}`, timestamp: when, rep, site_id: siteId, action, ...o,
  })[h] ?? '');
  for (let d = -34; d <= 4; d++) {
    reps.forEach(([rep, region], i) => {
      if ((d + i) % 3 === 0) return;
      const siteId = `S${String(rows.length + 1).padStart(6, '0')}`;
      rows.push(site({ site_id: siteId, rep, region, site_name: `${rep} site ${d}` }));
      activity.push(act(dayCell(d, 6 + i), rep, siteId, (d + i) % 2 ? 'created' : 'update', { to_stage: 'Visited / Lead' }));
    });
  }
  activity.sort((a, b) => a[1] - b[1]);
  const diary = makeSpreadsheet({
    Sites: [SITES, ...rows],
    Activity: [ACTIVITY, ...activity],
    Lists: [['list', 'value', 'region', 'added_by', 'active', 'sort'], ['buyer_type', 'Dealer', '', 'owner', true, 10]],
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['owner', '', ADMIN, true, dayCell(-60)]],
  }, { name: 'Sales Diary' });
  const month = (() => { const [y, m] = dayKey(0).split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000); })();
  const metaData = makeSpreadsheet({
    Rep_Mapping: [['Rep', 'Region'], ...reps],
    'Rep-Targets': [['Rep', 'Month', 'Target'], ['RIA', month, 1000000]],
    Targets: [['Region', 'Month', 'Target'], ['North', month, 2000000]],
  }, { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), HtmlService: makeHtmlService(), CacheService: makeCacheService(),
  });
  return { s: src.sandbox, diary };
}

/** google.script.run on the page: adminPageDaily calls wait in __pending for the test to land them. */
function stub() {
  window.__calls = [];
  window.__pending = [];
  window.__copied = [];
  window.__shared = [];
  let id = 0;
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
          const call = { id: ++id, fn: prop, day: args[1] };
          window.__calls.push(call);
          const land = (ok) => (ok ? window.__server(prop, JSON.stringify(args)) : Promise.reject(new Error('NetworkError: HTTP 0'))).then(
            (json) => success && success(JSON.parse(json)),
            (error) => failure && failure({ message: String(error.message || error).replace(/^Error: /, '') }));
          if (prop === 'adminPageDaily') window.__pending.push({ id: call.id, land });
          else land(true);
        };
      },
    });
  }
  window.google = { script: { get run() { return runner(null, null); } } };
  window.__land = (id, ok) => {
    const i = window.__pending.findIndex((p) => p.id === id);
    const p = window.__pending.splice(i, 1)[0];
    return p.land(ok);
  };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('#sumWa');
    if (!a) return;
    window.__shared.push(a.href);
    e.preventDefault(); // never really open WhatsApp
  });
}

/** Everything the invariants look at, in one trip. */
function look() {
  const $ = (id) => document.getElementById(id);
  const text = $('dailyText');
  const pressed = [...document.querySelectorAll('#dailyRegions .pill')].filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);
  return {
    screen, today: todayKey(), line: $('dailyDay').textContent, textShown: !text.hidden, text: text.textContent, pressed,
    shown: DM.shown && JSON.stringify(DM.shown), msg: $('dailyMsg').hidden ? '' : $('dailyMsg').textContent, retry: !$('dailyRetry').hidden,
    share: !$('sumShare').hidden, prev: getComputedStyle($('dailyPrev')).visibility !== 'hidden' && DM.shown && DM.shown.prev,
    next: getComputedStyle($('dailyNext')).visibility !== 'hidden' && DM.shown && DM.shown.next,
    refresh: !$('refresh').hidden, pending: window.__pending.map((p) => p.id),
    calls: window.__calls.filter((c) => c.fn === 'adminPageDaily').map((c) => ({ id: c.id, day: c.day })),
    copied: window.__copied.length, shared: window.__shared.length,
  };
}

let browser;
(async () => {
  const world = buildWorld();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-'));
  const file = path.join(dir, 'admin.html');
  fs.writeFileSync(file, world.s.doGet({ parameter: { k: ADMIN } }).getContent());
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true });

  // The server, `shift` days ahead; every daily reply it sends is recorded (JSON → its day).
  let shift = 0;
  let sent = new Map();
  /** Which call each landed reply answered: id → { ok, day }. */
  let landed = new Map();
  let landing = 0;
  const server = (fn, args) => {
    const now = new Date(Date.now() + shift * DAY);
    if (fn === 'adminPageDaily') {
      const r = JSON.parse(JSON.stringify(world.s.forAdminPage_(() => world.s.dailyFor_(world.diary, args[1], now))));
      sent.set(JSON.stringify(r), r.day);
      return r;
    }
    const r = world.s[fn](...args);
    return fn === 'adminPageLoad' ? { ...r, now: now.getTime(), today: dayKey(shift) } : r;
  };

  let page = null;
  /** A tap (the DOM's own click: the same handlers, without Playwright's waiting). */
  const tap = (selector) => page.evaluate((sel) => document.querySelector(sel).click(), selector);
  let failures = 0;
  for (const seed of SEEDS) {
    const rnd = random(seed);
    shift = 0;
    sent = new Map();
    landed = new Map();
    if (page) await page.close();
    page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.exposeFunction('__server', (fn, argsJson) => {
      const args = JSON.parse(argsJson);
      try {
        const r = server(fn, args);
        if (fn === 'adminPageDaily') landed.set(landing, { ok: true, day: r.day });
        return JSON.stringify(r);
      } catch (e) {
        if (fn === 'adminPageDaily') landed.set(landing, { ok: false });
        throw e;
      }
    });
    await page.addInitScript(stub);
    await page.goto(`file://${file}`);
    await page.waitForSelector('#dailyOpen');

    /** The latest ask: { call: id } or { kept: day } (a kept day shown with no trip). */
    let latest = null;
    const steps = [];
    const land = async (id, ok) => {
      landing = id;
      if (!ok) landed.set(id, { ok: false });
      await page.evaluate(([i, o]) => window.__land(i, o), [id, ok]);
      landing = 0;
    };
    const check = async (where) => {
      const s = await page.evaluate(look);
      const why = (what) => `seed ${seed}, ${where}: ${what}\n  steps: ${steps.join(' · ')}\n  screen: ${JSON.stringify({ ...s, text: s.text.split('\n')[0], shown: !!s.shown })}`;
      assert.deepEqual(errors, [], why('1. a script error'));
      if (s.screen !== 'daily' || !s.textShown) return s;
      const head = /^\*(\w+) · (.+)\*$/.exec(s.text.split('\n')[0]);
      assert.ok(head, why('the text starts with its heading'));
      assert.equal(s.line, head[2], why('2. the day line names the text\'s day'));
      assert.deepEqual(s.pressed, [head[1]], why('2. the pill pressed is the text\'s region'));
      assert.ok(s.shown && sent.has(s.shown), why('3. the reply on screen is one the server sent'));
      const shown = JSON.parse(s.shown);
      assert.equal(shown.regions.find((r) => r.region === head[1]).text, s.text, why('3. the text is that reply\'s, for the pill pressed'));
      return s;
    };
    const settle = async () => {
      let s = await page.evaluate(look);
      while (s.pending.length) {
        await land(rnd.pick(s.pending), true);
        s = await page.evaluate(look);
      }
      s = await check('settled');
      const why = (what) => `seed ${seed}, settled: ${what}\n  steps: ${steps.join(' · ')}\n  latest: ${JSON.stringify(latest)} landed: ${
        JSON.stringify(latest && latest.call ? landed.get(latest.call) : null)}\n  screen: ${JSON.stringify({ ...s, text: s.text.split('\n')[0] })}`;
      if (s.screen !== 'daily' || !latest) return;
      assert.notEqual(s.msg, 'Getting the message…', why('5. nothing on its way'));
      const fate = latest.call ? landed.get(latest.call) : { ok: true, day: latest.kept };
      if (fate.ok) {
        assert.equal(s.shown && JSON.parse(s.shown).day, fate.day, why('5. the latest ask\'s day is on screen'));
        assert.equal(s.msg, '', why('5. no failure line'));
      } else {
        assert.ok(s.msg && s.retry, why('5. the latest ask failed: its line and Try again'));
      }
    };

    try {
      let midnights = 0;
      for (let step = 0; step < STEPS; step++) {
        const s = await page.evaluate(look);
        const onDaily = s.screen === 'daily';
        const acts = ['land', 'land', 'auto', 'visible', 'midnight', 'settle'];
        if (onDaily) acts.push('back', 'pill', 'pill');
        else acts.push('open', 'open', 'open');
        if (onDaily && s.prev) acts.push('prev', 'prev');
        if (onDaily && s.next) acts.push('next', 'next', 'today');
        if (onDaily && s.share) acts.push('copy', 'copy', 'share');
        if (onDaily && s.retry) acts.push('retry');
        if (s.refresh) acts.push('refresh');
        let act = rnd.pick(acts);
        if (act === 'land' && !s.pending.length) act = 'visible';
        if (act === 'midnight' && midnights >= 3) act = 'auto';
        const before = s.calls.length;
        let target = null;
        let label = act;
        if (act === 'open') {
          await tap('#dailyOpen');
        } else if (act === 'back') {
          await tap('#dailyBack');
        } else if (act === 'prev' || act === 'next') {
          target = s[act];
          await tap(act === 'prev' ? '#dailyPrev' : '#dailyNext');
          label = `${act}→${target}`;
        } else if (act === 'today') {
          // › until today "(so far)", each reply landing OK.
          for (let v = s; v.next; v = await page.evaluate(look)) {
            target = v.next;
            await tap('#dailyNext');
            for (const id of (await page.evaluate(look)).pending) await land(id, true);
          }
          label = `today→${target}`;
        } else if (act === 'pill') {
          const reg = rnd.pick(['North', 'Center', 'South']);
          await tap(`#daily-${reg}`);
          label = `pill ${reg}`;
        } else if (act === 'copy' || act === 'share') {
          const was = s.text;
          const n = act === 'copy' ? s.copied : s.shared;
          if (act === 'copy') await tap('#sumCopyBtn');
          else await page.evaluate(() => document.getElementById('sumWa').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
          await page.waitForTimeout(0);
          const got = await page.evaluate(([a, i]) => (a === 'copy' ? window.__copied : window.__shared).slice(i), [act, n]);
          for (const g of got) {
            const out = act === 'copy' ? g : decodeURIComponent(g.replace('https://wa.me/?text=', ''));
            const why = `seed ${seed}: 4. ${act} gave something other than the text on screen\n  steps: ${steps.join(' · ')}`;
            assert.equal(out, was, why);
            const head = out.split('\n')[0];
            if (head.includes('(so far)')) {
              assert.ok(head.includes(s.line.replace(' (so far)', '')) && JSON.parse(s.shown).day === s.today,
                `seed ${seed}: 4. ${act} of a "(so far)" text from before midnight\n  steps: ${steps.join(' · ')}`);
            }
          }
          label = `${act}${got.length ? '' : '(held)'}`;
        } else if (act === 'retry') {
          await tap('#dailyRetry');
        } else if (act === 'refresh') {
          await tap('#refresh');
        } else if (act === 'auto') {
          await page.evaluate(() => { A.loadedAt -= 11 * 60 * 1000; document.dispatchEvent(new Event('visibilitychange')); });
        } else if (act === 'visible') {
          await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        } else if (act === 'midnight') {
          midnights++;
          shift++;
          await page.evaluate(() => { clockGap += 24 * 3600 * 1000; });
        } else if (act === 'land') {
          const id = rnd.pick(s.pending);
          const ok = rnd.chance(0.7);
          await land(id, ok);
          label = `land #${id} ${ok ? 'ok' : 'fail'}`;
        }
        const after = await page.evaluate(look);
        const asked = after.calls.slice(before);
        if (asked.length) {
          latest = { call: asked[asked.length - 1].id };
          label += ` (asks ${asked.map((c) => `#${c.id} ${c.day || "''"}`).join(', ')})`;
        } else if (target && after.screen === 'daily') {
          latest = { kept: target };
        } else if (act === 'open') {
          latest = { kept: after.shown && JSON.parse(after.shown).day };
          assert.equal(latest.kept, world.s.dailyDay_('', after.today), `seed ${seed}: the button with no trip shows the day it opens on`);
        }
        steps.push(label);
        if (act === 'settle') {
          await settle();
          // 6. Shown again after midnight: no "(so far)" text from before it stays.
          await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
          const v = await page.evaluate(look);
          if (v.calls.length > after.calls.length) latest = { call: v.calls[v.calls.length - 1].id };
          await settle();
          const t = await page.evaluate(look);
          if (t.screen === 'daily' && t.shown && !JSON.parse(t.shown).next && !t.msg) {
            assert.equal(JSON.parse(t.shown).day, t.today, `seed ${seed}: 6. a "(so far)" text from before midnight\n  steps: ${steps.join(' · ')}`);
          }
        } else {
          await check(`step ${step} (${label})`);
        }
      }
      await settle();
    } catch (error) {
      failures++;
      console.error(`FAIL: ${error.message}`);
      if (failures >= 3 || SEEDS.length === 1) break;
    }
  }
  await browser.close();
  if (failures) process.exit(1);
  console.log(`PASS: the Daily message screen kept its rules in ${SEEDS.length} random sequences.`);
})().catch(async (error) => {
  console.error('FAIL:', error.message);
  if (browser) await browser.close();
  process.exit(1);
});
