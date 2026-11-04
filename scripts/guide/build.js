'use strict';
// Builds the salesman's user guide PDF: takes fresh screenshots (scripts/guide/shots.js, fake data
// only), then lays them out with a few plain words and prints an A5 PDF in Chromium.
// Usage: node scripts/guide/build.js [out.pdf]   (default docs/guide/sales-diary-guide.pdf)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'guide', 'sales-diary-guide.pdf'));

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **bold** in the guide's words.
const words = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

/** One picture with its numbered circles. */
function picture(info, dir, name, cls = '') {
  const s = info[name];
  if (!s) throw new Error(`no picture ${name}`);
  // x < 0: the circle sits in the margin left of the picture, level with the item.
  const dots = s.marks.map(([n, x, y]) => `<span class="dot${x < 0 ? ' g' : ''}" style="${x < 0 ? '' : `left:${(x / s.width) * 100}%;`}`
    + `top:${(y / s.height) * 100}%">${n}</span>`).join('');
  if (s.marks.some(([, x]) => x < 0)) cls += ' gut';
  return `<div class="shot ${cls}"><img src="file://${path.join(dir, `${name}.png`)}" alt="">${dots}</div>`;
}
const steps = (list) => `<ol class="steps">${list.map(([n, t]) =>
  `<li><span class="num">${n}</span><span>${words(t)}</span></li>`).join('')}</ol>`;
const lines = (list) => list.map((t) => `<p>${words(t)}</p>`).join('');

function pages(info, dir) {
  const pic = (name, cls) => picture(info, dir, name, cls);
  return [
    // Cover
    `<section class="page cover">
      <div class="logo">📒</div>
      <h1>Sales Diary</h1>
      <p class="sub">Your work diary on your phone.</p>
      <ul class="ticks">
        <li>See <b>who to call today</b></li>
        <li>Save a visit in <b>a few taps</b></li>
        <li><b>Never forget</b> a follow-up</li>
      </ul>
      <p class="easy">It is easy. This guide takes 5 minutes.</p>
      <p class="small">The pictures use a pretend salesman (DEMO) and pretend sites.</p>
    </section>`,

    `<section class="page">
      <h2><span class="badge">1</span>Open your diary</h2>
      ${steps([[1, 'Admin sends you **your own link**.'], [2, '**Tap the link.** Your diary opens.'],
        [3, 'It takes a few seconds to open.'], [4, 'Use the **same link every day.**']])}
      <div class="warn">🔒 This link is <b>only for you</b>.<br>Do <b>not</b> send it to anyone.</div>
      <div class="tip">💡 <b>Tip:</b> in Chrome, tap <b>⋮</b> (top right), then <b>Add to Home screen</b>.
        Now your diary is an icon on your phone.</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">2</span>Your home screen</h2>
      <div class="row">${pic('01-home')}
        ${steps([[1, 'Your name and **this month\'s target**.'], [2, '**+ New Site**: add a new site.'],
          [3, 'Your **3 lists** (next page).'], [4, 'Your sites. **Tap one** to open it.']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">3</span>Your 3 lists</h2>
      <div class="lists">
        <div><b>Today's Chase</b> = call or visit these <b>today</b>.</div>
        <div><b>Hot Pipeline</b> = sample or rate given. Your <b>best chances</b>.</div>
        <div><b>All My Parties</b> = <b>all</b> your sites.</div>
      </div>
      <div class="row">${pic('06-search', 'narrow')}
        ${steps([[1, '**Search**: type a name, phone or area.'], [2, 'Tap an **area** to see only that area.']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">4</span>A site card</h2>
      ${pic('02-card', 'wide')}
      ${steps([[1, '**Red = late.** The follow-up day has passed.'], [2, '**Yellow = going cold.** No update for 7 days. Call them!'],
        [3, '**Call** them.'], [4, '**WhatsApp** them.'], [5, '**Snooze** = not today (next page).']])}
    </section>`,

    `<section class="page">
      <h2><span class="badge">5</span>Snooze: not today</h2>
      <div class="row">${pic('03-snooze')}
        <div>${lines(['Can\'t do it today?', 'Tap **Snooze**. Pick a day:'])}
        ${steps([[1, 'Tomorrow'], [2, 'In 3 days'], [3, 'In 1 week']])}
        ${lines(['The site comes back in **Today\'s Chase** on that day.'])}</div></div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">6</span>Add a new site</h2>
      <p class="lead">Tap <b>+ New Site</b>. Then:</p>
      <div class="row">${pic('11-new-top')}
        ${steps([[1, 'Type the **site or party name**.'], [2, 'Tap **who the buyer is**.'],
          [3, 'Contact name (if you want).'], [4, '**Phone number.** No number yet? Add it later.']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">6</span>Add a new site <span class="more">(more)</span></h2>
      <div class="pair">${pic('12-new-middle')}${pic('12-new-bottom')}</div>
      ${steps([[5, 'Tap the **products**. More than one is OK.'], [6, 'Tap the **area**. Not there? Tap **+ New area**.'],
        [7, 'Tap the **stage**.'], [8, 'When to **follow up**?'], [9, 'Tap **Save**. Done!']])}
    </section>`,

    `<section class="page">
      <h2><span class="badge">7</span>After every call or visit</h2>
      <p class="lead">Tap the site. Then:</p>
      <div class="row">${pic('08-update')}
        ${steps([[1, 'Tap the **new stage** (or leave it).'], [2, 'Pick the **next follow-up** day.'],
          [3, 'Write a **short note** (if you want).'], [4, 'Tap **Save**.']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">8</span>Rate, order or lost?</h2>
      <div class="pair">
        <div>${pic('09-update-won')}<p class="cap"><b>Rate Quoted</b> or <b>Won</b>:<br>
          <span class="n">1</span> tap it, <span class="n">2</span> type the <b>total Rs.</b>,
          <span class="n">3</span> tap <b>Cash</b> or <b>Credit</b>.</p></div>
        <div>${pic('10-update-lost')}<p class="cap"><b>Lost</b>:<br>
          <span class="n">1</span> tap it, <span class="n">2</span> tap <b>why</b>.</p></div>
      </div>
      ${lines(['Then tap **Save**.'])}
    </section>`,

    `<section class="page">
      <h2><span class="badge">9</span>Saving… and orange</h2>
      <div class="pair">
        <div>${pic('13-saving')}<p class="cap"><span class="n">1</span> <b>Saving…</b><br>It is sending.
          <b>Keep working.</b> It is fine.</p></div>
        <div>${pic('14-failed')}<p class="cap"><span class="n">1</span> <b>Orange = not saved</b> (no signal).<br>
          <b>Tap the card</b>, then tap <b>Save</b> again.</p></div>
      </div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">✔</span>Every day</h2>
      ${steps([[1, 'Open your diary. Look at **Today\'s Chase**.'], [2, '**Call, WhatsApp or visit.**'],
        [3, 'Tap the site. Update. **Save.**'], [4, 'New site? Tap **+ New Site**.'], [5, 'Can\'t do one today? **Snooze** it.']])}
      <div class="tip">A note with <b>Admin:</b> in it is a message from Admin.</div>
      <div class="done">That's all. You are ready! 👍</div>
      <div class="help">Stuck? <b>Ask Admin.</b></div>
    </section>`,
  ].join('\n');
}

const CSS = `
@page { size: A5; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; }
body { font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; color: #1d2330; font-size: 15pt; line-height: 1.3; }
.page { width: 148mm; height: 210mm; padding: 11mm 10mm 9mm; page-break-after: always; overflow: hidden; position: relative; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 40pt; margin: 6mm 0 2mm; color: #1f5fbf; }
h2 { font-size: 21pt; margin: 0 0 5mm; display: flex; align-items: center; gap: 3mm; }
h2 .more { font-weight: 400; color: #6b7280; font-size: 15pt; }
.badge { display: inline-flex; width: 11mm; height: 11mm; border-radius: 50%; background: #1f5fbf; color: #fff;
  align-items: center; justify-content: center; font-size: 17pt; flex: none; }
p { margin: 0 0 3mm; }
.lead { margin-bottom: 4mm; }
.row { display: flex; gap: 6mm; align-items: flex-start; }
.row > .shot { width: 62mm; flex: none; }
.row > .shot.narrow { width: 54mm; }
.row > .steps, .row > div:not(.shot) { flex: 1; margin-top: 2mm; }
.pair { display: flex; gap: 5mm; align-items: flex-start; margin-bottom: 4mm; }
.pair > * { flex: 1; min-width: 0; }
.shot { position: relative; border: 1.5px solid #c9d2e0; border-radius: 3mm; overflow: visible; background: #f4f6fa; }
.shot img { display: block; width: 100%; border-radius: 3mm; }
.shot.wide { width: 100mm; margin: 0 auto 5mm; }
.shot.gut { margin-left: 5mm; }
.dot.g { left: -5mm; }
.dot { position: absolute; transform: translate(-50%, -50%); width: 7.5mm; height: 7.5mm; border-radius: 50%;
  background: #e4572e; color: #fff; font-weight: 700; font-size: 12pt; display: flex; align-items: center;
  justify-content: center; border: 2px solid #fff; box-shadow: 0 0.5mm 1.5mm rgba(0,0,0,.35); }
.steps { list-style: none; padding: 0; margin: 0 0 3mm; }
.steps li { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 3.2mm; }
.num, .n { display: inline-flex; flex: none; width: 7.5mm; height: 7.5mm; border-radius: 50%; background: #e4572e;
  color: #fff; font-weight: 700; font-size: 12pt; align-items: center; justify-content: center; }
.n { width: 6mm; height: 6mm; font-size: 10pt; vertical-align: 0.3mm; }
.cap { font-size: 12.5pt; margin-top: 3mm; line-height: 1.45; }
.lists { margin-bottom: 5mm; }
.lists div { background: #eef3fb; border-radius: 2.5mm; padding: 2.5mm 3.5mm; margin-bottom: 2mm; font-size: 14pt; }
.warn { background: #fdecea; border: 2px solid #c62828; border-radius: 3mm; padding: 4mm; margin: 6mm 0 5mm; font-size: 16pt; }
.tip { background: #fff8e1; border-radius: 3mm; padding: 4mm; font-size: 13.5pt; margin-top: 4mm; }
.done { margin-top: 12mm; font-size: 22pt; font-weight: 700; text-align: center; color: #1b8a4b; }
.help { margin-top: 8mm; font-size: 20pt; text-align: center; color: #1f5fbf; }
.cover { text-align: center; padding-top: 22mm; }
.cover .logo { font-size: 46pt; }
.cover .sub { font-size: 18pt; color: #4b5563; margin-bottom: 10mm; }
.ticks { list-style: none; padding: 0; margin: 0 auto 12mm; text-align: left; display: inline-block; font-size: 17pt; }
.ticks li { margin-bottom: 4mm; }
.ticks li::before { content: "✔"; color: #1b8a4b; font-weight: 700; margin-right: 3mm; }
.easy { font-size: 17pt; font-weight: 700; color: #1b8a4b; }
.small { position: absolute; bottom: 9mm; left: 0; right: 0; font-size: 10pt; color: #6b7280; }
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-guide-shots-'));
  execFileSync(process.execPath, [path.join(__dirname, 'shots.js'), dir], { stdio: 'inherit' });
  const info = JSON.parse(fs.readFileSync(path.join(dir, 'shots.json'), 'utf8'));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sales Diary: how to use it</title>
    <style>${CSS}</style></head><body>${pages(info, dir)}</body></html>`;
  const file = path.join(dir, 'guide.html');
  fs.writeFileSync(file, html);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${file}`);
  await page.waitForLoadState('load');
  // Nothing may spill off a page.
  const spill = await page.$$eval('.page', (els) => els.map((e, i) => (e.scrollHeight > e.clientHeight + 1 ? i + 1 : 0)).filter(Boolean));
  if (spill.length) throw new Error(`too much on page(s) ${spill.join(', ')}`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.pdf({ path: OUT, format: 'A5', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  if (process.env.KEEP_GUIDE_SHOTS) console.log('pictures kept in', dir); else fs.rmSync(dir, { recursive: true, force: true });
  console.log('guide written to', path.relative(process.cwd(), OUT), `(${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
})().catch((e) => { console.error(e); process.exit(1); });
