'use strict';
// Builds the user guides: takes fresh screenshots (scripts/guide/shots.js, fake data only), then
// lays them out with a few plain words and prints A5 PDFs in Chromium:
//   sales-diary-guide.pdf    for the salesmen
//   admin-summary-guide.pdf  for the Admin (his Summary screen)
// Nothing touches Google. The build fails if anything spills off a page.
// Usage: node scripts/guide/build.js [out-folder]   (default docs/guide)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'guide'));

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
        ${steps([[1, 'Your name. Under it: **this month\'s target**.'], [2, '**Summary**: your week and your month.'],
          [3, '**+ New Site**: add a new site.'], [4, 'Your **3 lists** (next page).'], [5, 'Your sites. **Tap one** to open it.']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">3</span>Your 3 lists</h2>
      <div class="lists">
        <div><b>Today's Chase</b> = call or visit these <b>today</b>.</div>
        <div><b>Hot Pipeline</b> = sample or rate given. Your <b>best chances</b>.</div>
        <div><b>All My Parties</b> = <b>all</b> your sites.</div>
      </div>
      <div class="row">${pic('06-search', 'narrow')}
        ${steps([[1, 'In **All My Parties**: type a name, phone or area.'], [2, 'Tap an **area** to see only that area.']])}</div>
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
        ${steps([[1, '**Tomorrow**'], [2, '**3 days**'], [3, '**1 week**']])}
        ${lines(['The site comes back in **Today\'s Chase** on that day.'])}</div></div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">6</span>Add a new site</h2>
      <p class="lead">Tap <b>+ New Site</b>. Then:</p>
      <div class="row">${pic('11-new-top')}
        ${steps([[1, 'Type the **site or party name**.'], [2, 'Tap **who the buyer is**.'],
          [3, 'Contact name (if you want).'], [4, '**Phone number.** No number yet? Leave it, then tap **Save** 2 times.']])}</div>
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
          <b>Keep working.</b><br>Don't close the diary until it goes.</p></div>
        <div>${pic('14-failed')}<p class="cap"><span class="n">1</span> <b>Orange = not saved.</b><br>
          The reason is under it.<br><b>Tap the card</b> and save again.</p></div>
      </div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">10</span>Your Summary</h2>
      <p class="lead">Your <b>Friday report</b> and your <b>monthly review</b>. <b>One tap.</b></p>
      ${pic('15-sum-button', 'bar')}
      <div class="row">${pic('16-sum-week')}
        ${steps([[1, 'Tap **This week**, **Last week**, **This month** or **Last month**.'],
          [2, 'The days it covers. A week is **Saturday to Friday**.'], [3, 'Your numbers (next page).']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">11</span>Your numbers</h2>
      ${pic('17-sum-month', 'mid')}
      <div class="cols2">${steps([[1, '**New sites**: sites you added.'],
        [2, '**Sites worked**: sites you added or updated. Snooze and Edit details don\'t count.'],
        [3, '**Samples**: sites moved to Sample / Trial.'], [4, '**Quotes**: sites moved to Rate Quoted, and the total Rs.'],
        [5, '**Won**: orders won, and the Rs.'], [6, '**Lost**: sites lost.'],
        [7, '**Target** (months only): how much of your target you have won.']])}</div>
      <div class="tip"><b>Rs. logged, not invoiced</b> = the Rs. you saved in the diary, not the bills.</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">12</span>Your lists</h2>
      <div class="pair">
        <div>${pic('18-sum-tables')}<p class="cap"><span class="n">1</span> <b>Won</b>,
          <span class="n">2</span> <b>Quotes given</b>, <span class="n">3</span> <b>Lost</b> and why.<br>Biggest Rs. first.</p></div>
        <div>${pic('19-sum-now')}<p class="cap"><span class="n">1</span> <b>NOW</b> = today:
          hot sites, follow-ups in the next 7 days, late, going cold.<br>
          <span class="n">2</span> Your top <b>hot sites</b>.<br><span class="n">3</span> Your <b>late</b> and <b>going cold</b> sites.<br>
          <span class="n">4</span> <span class="n">5</span> Next page.</p></div>
      </div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">13</span>Share it</h2>
      ${steps([[1, 'Tap **Share on WhatsApp**. Pick the chat. Send.'],
        [2, 'WhatsApp didn\'t open? Tap **Copy**, then paste it in the chat.']])}
      <p class="lead">The message starts like this. The numbers line up in a block:</p>
      ${bubble(info._texts.week)}
    </section>`,

    `<section class="page">
      <h2><span class="badge">14</span>Good to know</h2>
      ${pic('20-sum-unsent', 'bar')}
      ${steps([[1, 'Saves still sending (or orange) are **not in the summary yet**. Wait until they are sent, then tap the button again.']])}
      <div class="tip">A finished week or month <b>never changes</b>. What you share on Friday still says the same on Monday.</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">✔</span>Every day</h2>
      ${steps([[1, 'Open your diary. Look at **Today\'s Chase**.'], [2, '**Call, WhatsApp or visit.**'],
        [3, 'Tap the site. Update. **Save.**'], [4, 'New site? Tap **+ New Site**.'], [5, 'Can\'t do one today? **Snooze** it.'],
        [6, '**Friday:** tap **Summary**, share **This week**.']])}
      <div class="tip">A note with <b>Admin:</b> in it is a message from Admin.</div>
      <div class="done">That's all. You are ready! 👍</div>
      <div class="help">Stuck? <b>Ask Admin.</b></div>
    </section>`,
  ].join('\n');
}

/** A WhatsApp message as the phone shows it: *bold*, _italic_, ``` blocks in monospace. Only the
 * start (up to the second list) is shown, then "…", so it fits on a page. */
function bubble(text) {
  const lines = text.split('\n');
  const cut = lines.findIndex((l, i) => i > 0 && /^\*Quotes given\*$/.test(l));
  const shown = cut > 0 ? lines.slice(0, cut) : lines;
  let mono = false;
  const out = [];
  shown.forEach((l) => {
    if (l === '```') { mono = !mono; return; }
    if (mono) { out.push(`<div class="mono">${esc(l) || '&nbsp;'}</div>`); return; }
    let h = esc(l).replace(/^\*(.+)\*$/, '<b>$1</b>').replace(/^_(.+)_$/, '<i>$1</i>');
    out.push(`<div>${h || '&nbsp;'}</div>`);
  });
  if (cut > 0) out.push('<div class="more">…</div>');
  return `<div class="chat"><div class="bubble">${out.join('')}</div></div>`;
}

/** The Admin's own short guide: his Summary screen. */
function adminPages(info, dir) {
  const pic = (name, cls) => picture(info, dir, name, cls);
  return [
    `<section class="page">
      <h2><span class="badge">1</span>Admin: your Summary</h2>
      <p class="lead">The whole team's week or month. <b>One tap.</b></p>
      ${pic('21-admin-button', 'bar')}
      ${lines(['Tap **Summary**. The same 4 buttons as the salesmen. A week is **Saturday to Friday**.'])}
      <div class="row">${pic('22-admin-month', 'narrow')}
        ${steps([[1, 'The same **6 numbers**, for all salesmen together.'],
          [2, '**Team target** (months). Under it: the **house / office** target.']])}</div>
    </section>`,

    `<section class="page">
      <h2><span class="badge">2</span>The team table</h2>
      <div class="pair slim">${pic('23-admin-team')}${pic('24-admin-his')}</div>
      ${steps([[1, '**Region** rows (bold): region totals.'],
        [2, '**Tap a name**: his summary, plus **Logged on N days**.'],
        [3, '**Team**: everyone together.'], [4, '**Lost reasons**: lost sites per reason.']])}
      <div class="tip"><b>2.45M</b> = Rs. 2,450,000. <b>%</b> = Won Rs. of the target (months); in a week that column is
        <b>Lost</b>. <b>Share on WhatsApp</b> and <b>Copy</b> work as for salesmen.</div>
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
.pair.slim { width: 112mm; margin-left: auto; margin-right: auto; }
.shot { position: relative; border: 1.5px solid #c9d2e0; border-radius: 3mm; overflow: visible; background: #f4f6fa; }
.shot img { display: block; width: 100%; border-radius: 3mm; }
.shot.wide { width: 100mm; margin: 0 auto 5mm; }
.shot.gut { margin-left: 5mm; }
.shot.bar { width: 100mm; margin: 0 auto 5mm; }
.shot.mid { width: 76mm; margin: 0 auto 5mm; }
.cols2 .steps { columns: 2; column-gap: 5mm; font-size: 12.5pt; }
.cols2 .steps li { break-inside: avoid; }
.chat { background: #efeae2; border-radius: 3mm; padding: 4mm; }
.bubble { background: #d9fdd3; border-radius: 2.5mm; padding: 3mm 3.5mm; font-size: 10pt; line-height: 1.35;
  max-width: 100mm; box-shadow: 0 0.3mm 0.6mm rgba(0,0,0,.15); }
.bubble .mono { font-family: "DejaVu Sans Mono", "Liberation Mono", monospace; font-size: 9pt; white-space: pre; }
.bubble .more { color: #6b7280; }
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salesdiary-guide-shots-'));
(async () => {
  execFileSync(process.execPath, [path.join(__dirname, 'shots.js'), dir], { stdio: 'inherit' });
  const info = JSON.parse(fs.readFileSync(path.join(dir, 'shots.json'), 'utf8'));
  const browser = await chromium.launch();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const make = async (name, title, body) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>${CSS}</style></head><body>${body}</body></html>`;
    const file = path.join(dir, `${name}.html`);
    fs.writeFileSync(file, html);
    const page = await browser.newPage();
    await page.goto(`file://${file}`);
    await page.waitForLoadState('load');
    // Nothing may spill off a page.
    const spill = await page.$$eval('.page', (els) => els.map((e, i) => (e.scrollHeight > e.clientHeight + 1 ? i + 1 : 0)).filter(Boolean));
    if (spill.length) throw new Error(`${name}: too much on page(s) ${spill.join(', ')}`);
    const out = path.join(OUT_DIR, `${name}.pdf`);
    await page.pdf({ path: out, format: 'A5', printBackground: true, preferCSSPageSize: true });
    const count = await page.$$eval('.page', (els) => els.length);
    console.log('written', path.relative(process.cwd(), out), `(${count} pages, ${Math.round(fs.statSync(out).size / 1024)} KB)`);
  };
  try {
    await make('sales-diary-guide', 'Sales Diary: how to use it', pages(info, dir));
    await make('admin-summary-guide', 'Sales Diary: the Admin\'s Summary', adminPages(info, dir));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  if (process.env.KEEP_GUIDE_SHOTS) console.log('pictures kept in', dir); else fs.rmSync(dir, { recursive: true, force: true });
});
