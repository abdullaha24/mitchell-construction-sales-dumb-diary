'use strict';
// Drives src/Links.html in a real browser (Chromium via Playwright), with a stand-in for
// Google's google.script.run. Run: npm run check:browser. Needs Playwright with Chromium; it is
// not part of `npm test` because that must run anywhere with no extra installs.
// Usage: node tests/browser/links-window.check.js [screenshot.png]

const assert = require('node:assert/strict');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.log('SKIPPED: Playwright is not installed here.');
  process.exit(0);
}

const PAGE = `file://${path.join(__dirname, '..', '..', 'src', 'Links.html')}`;
const URL = 'https://script.google.com/macros/s/X/exec';
const row = (who, label, region, code) => ({
  who, label, region, former: false,
  link: code ? `${URL}?k=${code}` : '',
  made: code ? '4 Nov 2026' : '',
  message: code ? `${who}, this is your Sales Diary link. Keep it private: anyone with it can use the diary as you. ${URL}?k=${code}` : '',
});
const LIST = {
  ok: true,
  rows: [
    row('owner', 'You (owner)', '', ''),
    row('RIA', 'RIA', 'North', 'a'.repeat(64)),
    row('AUR', 'AUR', 'North', ''),
    row('<img src=x onerror="window.__xss=1">', '<img src=x onerror="window.__xss=1">', '<b>North</b>', 'b'.repeat(64)),
    { who: 'MUB', label: 'MUB', region: '', former: true, link: '', made: '4 Nov 2026', message: '' },
  ],
};

// Installed before the page's own script runs. Records every server call; answers from
// window.__answer (success) or window.__fail (failure), after a short delay like the network.
function stub(list) {
  window.__calls = [];
  window.__answer = (name) => list;
  window.__fail = null;
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return (fn) => runner(fn, failure);
        if (prop === 'withFailureHandler') return (fn) => runner(success, fn);
        return (...args) => {
          window.__calls.push([prop, ...args]);
          setTimeout(() => {
            if (window.__fail) failure && failure(window.__fail);
            else success && success(window.__answer(prop));
          }, 50);
        };
      },
    });
  }
  window.google = { script: { get run() { return runner(null, null); } } };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 1 });
  await page.addInitScript(stub, LIST);
  await page.goto(PAGE);
  await page.waitForSelector('.person');

  // Rendering: one block per person, in order; links only where there is one.
  const names = await page.$$eval('.person .name', (els) => els.map((e) => e.firstChild.textContent));
  assert.deepEqual(names, LIST.rows.map((r) => r.label));
  const made = await page.$$eval('.person .made', (els) => els.map((e) => e.textContent));
  assert.deepEqual(made.slice(0, 4), ['No link', 'Link made 4 Nov 2026', 'No link', 'Link made 4 Nov 2026']);
  assert.match(made[4], /^Not in the salesmen list any more/);

  // Someone who has left: only Cancel link, no link shown, no New link.
  assert.deepEqual(await page.$$eval('.person:nth-child(5) button, .person:nth-child(5) a',
    (els) => els.map((e) => e.textContent)), ['Cancel link']);
  assert.equal(await page.locator('.person:nth-child(5) input').count(), 0);
  assert.equal(await page.inputValue('.person:nth-child(2) input.link'), LIST.rows[1].link);
  assert.deepEqual(await page.evaluate(() => window.__calls), [['ownerListLinks']]);

  // Injection: names from the sheet are text, never HTML.
  assert.equal(await page.$$eval('#people img, #people b', (els) => els.length), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);

  // WhatsApp: opens wa.me with the message, in a new tab.
  const wa = page.locator('.person:nth-child(2) a.button');
  assert.equal(await wa.getAttribute('href'), `https://wa.me/?text=${encodeURIComponent(LIST.rows[1].message)}`);
  assert.equal(await wa.getAttribute('target'), '_blank');

  // No link yet: one tap makes one.
  await page.click('.person:nth-child(3) button:has-text("New link")');
  assert.deepEqual((await page.evaluate(() => window.__calls)).slice(-1), [['ownerNewLink', 'AUR']]);
  await page.waitForSelector('#status:has-text("Link made.")');

  // Existing link: the first tap only asks; the second does it.
  const cancel = page.locator('.person:nth-child(2) button:has-text("Cancel link")');
  await cancel.click();
  assert.equal(await page.locator('.person:nth-child(2) button.confirm').textContent(), "Tap again to cancel RIA's link");
  assert.equal((await page.evaluate(() => window.__calls)).length, 2, 'first tap must not call the server');
  await page.locator('.person:nth-child(2) button.confirm').click();
  assert.deepEqual((await page.evaluate(() => window.__calls)).slice(-1), [['ownerCancelLink', 'RIA']]);
  await page.waitForSelector('#status:has-text("Link cancelled.")');

  await page.locator('.person:nth-child(2) button:has-text("New link")').click();
  assert.equal(await page.locator('.person:nth-child(2) button.confirm').textContent(),
    "Tap again: RIA's old link will stop working");
  await page.locator('.person:nth-child(2) button.confirm').click();
  assert.deepEqual((await page.evaluate(() => window.__calls)).slice(-1), [['ownerNewLink', 'RIA']]);
  await page.waitForSelector('#status:has-text("New link made.")');

  // The owner's own row says "your".
  await page.evaluate(() => { window.__answer = () => ({ ok: true, rows: [
    { who: 'owner', label: 'You (owner)', region: '', link: 'https://x/exec?k=' + 'e'.repeat(64), made: '4 Nov 2026', message: 'm' },
  ] }); });
  await page.click('.person:nth-child(3) button:has-text("New link")'); // AUR again, re-renders
  await page.waitForSelector('#status:has-text("Link made.")');
  await page.locator('.person:nth-child(1) button:has-text("Cancel link")').click();
  assert.equal(await page.locator('.person:nth-child(1) button.confirm').textContent(), 'Tap again to cancel your link');

  // Server refuses: the message shows in red; buttons work again, and the next tap asks again.
  await page.evaluate(() => { window.__fail = { message: 'Only the owner can manage links, from the Sales Diary menu.' }; });
  await page.locator('.person:nth-child(1) button.confirm').click();
  await page.waitForSelector('#status.error:has-text("Only the owner")');
  assert.equal(await page.locator('button:disabled').count(), 0);
  const callsBefore = (await page.evaluate(() => window.__calls)).length;
  await page.locator('.person:nth-child(1) button:has-text("Cancel link")').click();
  assert.equal((await page.evaluate(() => window.__calls)).length, callsBefore, 'a single tap after a failure must not act');
  assert.equal(await page.locator('.person:nth-child(1) button.confirm').textContent(), 'Tap again to cancel your link');

  // Copy without clipboard access: the link is selected and the owner is told to press Ctrl+C.
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined }); });
  await page.locator('.person:nth-child(1) button:has-text("Copy")').click();
  await page.waitForSelector('#status:has-text("Ctrl+C")');

  if (process.argv[2]) {
    await page.reload();
    await page.waitForSelector('.person');
    await page.screenshot({ path: process.argv[2] });
  }
  await browser.close();
  console.log('PASS: Links window behaves as spec 002 says.');
})().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
