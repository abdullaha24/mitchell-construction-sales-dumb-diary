'use strict';
// Spec 010 (owner S10-3): pages are served without comments and indentation (servedHtml_), so the
// phone downloads less and runs exactly the same code. No build step: git keeps the source.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSrc, SRC_DIR } = require('./helpers/load-src');
const {
  makeSpreadsheet, makeSpreadsheetApp, makeUtilities, makeLockService, makeHtmlService, makeCacheService,
  makePropertiesService,
} = require('./helpers/fakes');
const { META_TIME_ZONE, metaDataTabs } = require('./fixtures/meta-data');

const META_DATA_ID = '11rcjx1eZA9BqwSTIoK66hrs7M8rYisL12GirSzLyrkc';
const SALES_DIARY_ID = '1tuyVPDB33x1Vw8JQYashM4PRQSjGjQq8MBs7l4cJn5Y';
const SITES = ['site_id', 'rep', 'region', 'site_name', 'buyer_type', 'area', 'contact_name',
  'contact_phone', 'products', 'stage', 'value_rs', 'payment_terms', 'lost_reason',
  'next_followup', 'last_note', 'created_at', 'updated_at', 'worked_at', 'note_at'];
const RIA = 'a'.repeat(64);
const ADMIN = 'c'.repeat(64);
const D = new Date('2026-11-04T05:00:00Z');
/** The served-size pins (bytes of the page as served, before the page data is filled in). */
const SALESMAN_PIN = 84000; // spec 011: the logo, tappable summaries, the wide screen, new contact person
const ADMIN_PIN = 104000; // spec 011: the same, and the Plan tab and region summaries

const { s } = (() => {
  const src = loadSrc({ HtmlService: makeHtmlService(), Utilities: makeUtilities() });
  return { s: src.sandbox };
})();
const served = (html) => s.servedHtml_(html);
const read = (name) => fs.readFileSync(path.join(SRC_DIR, `${name}.html`), 'utf8');

test('removes HTML comments (also over several lines), indentation and empty lines', () => {
  assert.equal(served('<div>\n  <!-- one -->\n    <p>Hi</p>\n\n  <!-- two\n       lines -->\n  <span>x</span>\n</div>'),
    '<div>\n<p>Hi</p>\n<span>x</span>\n</div>');
  assert.equal(served('<p><!-- in line -->text</p>'), '<p>text</p>');
  assert.equal(served('  <div><?= data ?></div>\n<!-- keeps <?!= part ?> -->'), '<div><?= data ?></div>\n<!-- keeps <?!= part ?> -->',
    'scriptlets are never touched, even inside a comment');
});

test('scripts: removes // lines and /* */ comments; never the text of a code line', () => {
  const source = [
    '<script>',
    '      // a comment line',
    '      var url = \'https://wa.me/?text=\'; // a comment after code stays',
    '      var s = "// not a comment";',
    '      /* one line */',
    '      /* several',
    '         // lines',
    '         of comment */',
    '      var r = /\\/\\/x/.test(s) || /^\\s*\\/\\//.test(s);',
    '      if (x) { /* inside */ y(); }',
    '      /* closed */ z();',
    '',
    '    </script>',
  ].join('\n');
  assert.equal(served(source), [
    '<script>',
    'var url = \'https://wa.me/?text=\'; // a comment after code stays',
    'var s = "// not a comment";',
    'var r = /\\/\\/x/.test(s) || /^\\s*\\/\\//.test(s);',
    'if (x) { /* inside */ y(); }',
    '/* closed */ z();',
    '</script>',
  ].join('\n'));
  assert.equal(served('<script>\n  /* opens\n  closes */ code();\n</script>'), '<script>\n/* opens\ncloses */ code();\n</script>',
    'a comment that ends in front of code is kept whole');
});

test('a script with a template literal or a continued string is left exactly as it is', () => {
  for (const body of ['  var t = `a\n  // b\n  c`;', '  var t = "a\\\n  // b";']) {
    const source = `<script>\n  // note\n${body}\n</script>`;
    assert.equal(served(source), source);
  }
});

/** Runs a page's script (source or served) and returns what it left in x, y and z. */
function runScript(html) {
  const body = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const context = vm.createContext({});
  try { vm.runInContext(`${body}\n;globalThis.out = [typeof x === 'undefined' ? null : x, typeof y === 'undefined' ? null : y,
    typeof z === 'undefined' ? null : z];`, context); } catch (e) { return `threw ${e.name}`; }
  return JSON.stringify(context.out);
}

test('adversarial scripts: whatever the comments, the served script does what the source does', () => {
  const cases = [
    // A second comment opened on a line: the lines after it are inside it until its */.
    '<script>\n  /* a */ /* b\n  /* c\n  */\n  var x = 1;\n</script>',
    '<script>\n  var y = 2; /* b\n  // still inside */\n  var z = 3;\n</script>',
    '<script>\n  /* a */ var x = 1; /* b\n  /* c */\n  var y = 2;\n</script>',
    '<script>\n  var x = "/*";\n  // note\n  var y = 2;\n</script>',
    '<script>\n  var x = /a\\/*b/.source;\n  /* note */\n  var y = 2;\n</script>',
    '<script>\n  /* one */ /* two */\n  var x = 1;\n</script>',
  ];
  for (const source of cases) {
    assert.equal(runScript(served(source)), runScript(source), source);
    assert.ok(!runScript(source).startsWith('threw'), `the case itself runs: ${source}`);
  }
});

test('a backtick anywhere in a script (even in a comment) keeps the script exactly as written', () => {
  for (const source of ['<script>\n  // a `note`\n  var x = 1;\n</script>', '<script>\n  var x = `a\n  // b\n  `;\n</script>']) {
    assert.equal(served(source), source);
  }
});

test('an HTML comment inside a quoted attribute value is not a comment, and stays', () => {
  assert.equal(served('<div data-x="<!-- no -->" title=\'<!-- no -->\'>t</div><!-- yes -->\n<p>x</p>'),
    '<div data-x="<!-- no -->" title=\'<!-- no -->\'>t</div>\n<p>x</p>');
  assert.equal(served('<!DOCTYPE html>\n<!-- c -->\n<html>'), '<!DOCTYPE html>\n<html>');
});

test('styles: /* */ comments and indentation go; a // line in CSS is not a comment, so it stays', () => {
  assert.equal(served('<style>\n  /* note */\n  .a { color: red; }\n  /* two\n     lines */\n  // odd\n</style>'),
    '<style>\n.a { color: red; }\n// odd\n</style>');
});

test('<pre> and <textarea> content is kept exactly', () => {
  const source = '<div>\n  <pre>\n    // kept\n  <!-- kept --></pre>\n  <textarea>\n  // kept\n</textarea>\n</div>';
  assert.equal(served(source), '<div>\n<pre>\n    // kept\n  <!-- kept --></pre>\n<textarea>\n  // kept\n</textarea>\n</div>');
  assert.equal(served('<b>a</b>\n  <textarea>t</textarea>\n  <b>b</b>'), '<b>a</b>\n<textarea>t</textarea>\n<b>b</b>',
    'elements on either side stay apart');
});

function world() {
  const site = (id, rep, name, note) => SITES.map((h) => ({
    site_id: id, rep, region: 'North', site_name: name, buyer_type: 'Dealer', contact_phone: '923001234567',
    stage: 'Visited / Lead', next_followup: D, last_note: note, created_at: D, updated_at: D,
  })[h] ?? '');
  const diary = makeSpreadsheet({
    Sites: [SITES, site('S000001', 'RIA', '  // not a comment', '/* kept */  <!-- kept -->  two  spaces')],
    Activity: [['activity_id', 'timestamp', 'rep', 'site_id', 'action', 'from_stage', 'to_stage', 'value_rs',
      'payment_terms', 'lost_reason', 'note', 'next_followup']],
    Lists: [['list', 'value', 'region', 'added_by', 'active', 'sort'], ['buyer_type', 'Dealer', '', 'owner', true, 10]],
    Links: [['role', 'rep', 'token', 'active', 'issued_at'], ['rep', 'RIA', RIA, true, D], ['owner', '', ADMIN, true, D]],
  }, { name: 'Sales Diary' });
  const metaData = makeSpreadsheet(metaDataTabs(), { readOnly: true, timeZone: META_TIME_ZONE, name: 'Meta-Data' });
  const src = loadSrc({
    PropertiesService: makePropertiesService(),
    SpreadsheetApp: makeSpreadsheetApp({ byId: { [SALES_DIARY_ID]: diary, [META_DATA_ID]: metaData } }),
    Utilities: makeUtilities(), LockService: makeLockService(), CacheService: makeCacheService(), HtmlService: makeHtmlService(),
  });
  return src.sandbox;
}
const page = (sb, k) => sb.doGet({ parameter: { k } }).getContent();
/** The page data as the phone reads it back (the hidden #data div, unescaped). */
const pageData = (html) => JSON.parse(/<div id="data" hidden>([^<]*)<\/div>/.exec(html)[1]
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));

test('the page data is never touched: it is filled in after the page is stripped', () => {
  const sb = world();
  const data = pageData(page(sb, RIA));
  assert.equal(data.sites[0].name, '// not a comment');
  assert.equal(data.sites[0].note, '/* kept */  <!-- kept -->  two  spaces');
  assert.equal(data.k, RIA);
});

test('served pages: no comment lines left, scriptlets filled in, and every script still parses', () => {
  const sb = world();
  for (const [who, k] of [['salesman', RIA], ['admin', ADMIN]]) {
    const html = page(sb, k);
    assert.ok(!html.includes('<!--'), `${who}: no HTML comment`);
    assert.ok(!/<\?/.test(html), `${who}: no scriptlet left`);
    const indented = html.replace(/<div id="data" hidden>[^<]*<\/div>/, '').split('\n').filter((l) => /^\s+\S/.test(l));
    assert.deepEqual(indented, [], `${who}: no indentation left`);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, who === 'admin' ? 2 : 1);
    for (const body of scripts) {
      assert.ok(!/^\s*\/\//m.test(body), `${who}: no // comment line`);
      assert.doesNotThrow(() => new vm.Script(body), `${who}: the script parses`);
    }
  }
});

test('the served script is the source script without its comment lines and indentation', () => {
  // Every code line of the source is in the served script, unchanged apart from its indentation,
  // in the same order; nothing else is.
  for (const name of ['App', 'Admin']) {
    const source = read(name);
    const sourceCode = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].flatMap((m) => m[1].split('\n'))
      .map((l) => l.trimStart()).filter((l) => l && !l.startsWith('//'));
    const servedCode = [...served(source).matchAll(/<script>([\s\S]*?)<\/script>/g)].flatMap((m) => m[1].split('\n'))
      .filter((l) => l);
    assert.deepEqual(servedCode, sourceCode, name);
  }
});

test(`served sizes: the salesman's page at most ${SALESMAN_PIN} bytes, the admin's at most ${ADMIN_PIN}`, () => {
  const app = Buffer.byteLength(served(read('App')));
  const admin = app + Buffer.byteLength(served(read('Admin')));
  assert.ok(app <= SALESMAN_PIN, `salesman's page: ${app} bytes served`);
  assert.ok(admin <= ADMIN_PIN, `admin's page: ${admin} bytes served`);
  assert.ok(app < Buffer.byteLength(read('App')) * 0.85, 'comments and indentation really go');
});
