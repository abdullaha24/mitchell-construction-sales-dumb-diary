// @ts-check
// The web app (specs 002, 003, 008). A visitor's link code decides the page:
//   salesman → his app (App.html) with his own sites; the owner's link → the admin screen
//   (App.html with Admin.html inside, spec 008: people see him as "Admin", owner P7-7);
//   anything else → "This link doesn't work"; Google failing → "Something went wrong", so
//   nobody thinks a good link was cancelled.
// A code is only ever written into its own holder's page (his page needs it to save), never
// into anyone else's page, a log or an error.
// Deployed as "execute as owner", access ANYONE_ANONYMOUS, always at the same address.

/** @typedef {{ heading: string, note: string }} PageText */

/** @type {Object<string, PageText>} */
const PAGE_TEXT = {
  none: { heading: "This link doesn't work.", note: 'Ask the admin for a new one.' },
  error: { heading: 'Something went wrong.', note: 'Try again in a minute.' },
};

/**
 * Serves the page for whoever the link says the visitor is.
 * @param {GoogleAppsScript.Events.DoGet} [e]
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  const code = e && e.parameter ? e.parameter[LINK_PARAM] : undefined;
  try {
    const diary = isWellFormedCode_(code) ? openSalesDiary_() : undefined;
    const visitor = whoIsVisiting_(code, diary);
    if (visitor.kind === 'rep' && diary) return renderApp_(visitor, String(code), diary);
    if (visitor.kind === 'owner' && diary) return renderAdmin_(String(code), diary, visitor.linked);
    return renderPage_(PAGE_TEXT.none);
  } catch (error) {
    // Deliberately not logged: keep it simple and keep codes out of logs.
    return renderPage_(PAGE_TEXT.error);
  }
}

/**
 * The salesman's app, with his page data inside it so it shows at once on a weak connection.
 * The data goes in as escaped text and the page reads it back with JSON.parse.
 * @param {HisSelf} salesman
 * @param {string} code his own link code (his page needs it to save)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary already open (spec 005)
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function renderApp_(salesman, code, diary) {
  const template = servedTemplate_('App');
  template.data = JSON.stringify({ ...loadFor_(salesman, diary), k: code });
  template.adminParts = ''; // a salesman's page never carries the admin's part
  return template.evaluate()
    .setTitle('Sales Diary')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * The admin's screen (spec 008): the same App.html (site screen, Update form, save queue) with
 * the admin's part (Admin.html) inside, and every salesman's data. Only for a working admin link.
 * @param {string} code his own link code (his page needs it to save)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} diary already open
 * @param {string[]} linked salesmen with a working link
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function renderAdmin_(code, diary, linked) {
  const template = servedTemplate_('App');
  template.data = JSON.stringify({ ...adminDataFor_(diary, linked, new Date()), k: code });
  template.adminParts = servedHtml_(HtmlService.createHtmlOutputFromFile('Admin').getContent());
  return template.evaluate()
    .setTitle('Sales Diary · Admin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Builds the page from Page.html. Google's template escapes every value it prints.
 * @param {PageText} text
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function renderPage_(text) {
  const template = HtmlService.createTemplateFromFile('Page');
  template.heading = text.heading;
  template.note = text.note;
  return template.evaluate()
    .setTitle('Sales Diary')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * A page's template as phones get it (spec 010): servedHtml_ of the file, before Google fills in
 * its scriptlets, so the page data is never touched.
 * @param {string} file
 * @returns {GoogleAppsScript.HTML.HtmlTemplate}
 */
function servedTemplate_(file) {
  return HtmlService.createTemplate(servedHtml_(HtmlService.createTemplateFromFile(file).getRawContent()));
}

/**
 * A page without its comments and indentation (spec 010, owner S10-3): what the phone downloads
 * gets smaller, and it does exactly the same thing. No build step: git keeps the commented source
 * (ADR-0003). Removed: HTML comments; inside `<script>` / `<style>`, lines that are only a `//`
 * comment (script) or a `/* … *\/` comment; spaces at the start of lines; empty lines. Never
 * touched: the text of a code line (quotes, regex literals, `//` inside a string), `<pre>` /
 * `<textarea>` content, a comment holding a template scriptlet, and the page data (filled in after
 * this). A script block with a template literal (a backtick) or a line ending in a backslash (a
 * string that goes on to the next line) is left exactly as it is.
 * @param {string} html
 */
function servedHtml_(html) {
  const special = /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  /** @type {string[]} */
  const out = [];
  let at = 0;
  for (const m of html.matchAll(special)) {
    const index = /** @type {number} */ (m.index);
    out.push(servedMarkup_(html.slice(at, index), at === 0));
    const tag = m[1].toLowerCase();
    out.push(tag === 'script' || tag === 'style' ? servedCode_(m[0], tag === 'script') : m[0]);
    at = index + m[0].length;
  }
  out.push(servedMarkup_(html.slice(at), at === 0));
  return out.join('');
}

/**
 * Markup between scripts and styles: HTML comments (unless one holds a scriptlet) and indentation
 * removed. Its first line goes on from the element before it, so it is left as it is. A line break
 * at either end is kept, so elements on either side stay apart as they were (a line break shows as
 * a space between inline elements).
 * @param {string} text
 * @param {boolean} atStart the very start of the page
 */
function servedMarkup_(text, atStart) {
  const bare = text.replace(/<!--[\s\S]*?-->/g, (comment) => (comment.includes('<?') ? comment : ''));
  const lines = bare.split('\n').map((line, i) => (i === 0 && !atStart ? line : line.trimStart()));
  const body = lines.filter((line) => line !== '').join('\n');
  if (lines.length < 2) return body;
  return (lines[0] === '' && !atStart && body ? '\n' : '') + body + (lines[lines.length - 1] === '' ? '\n' : '');
}

/**
 * One `<script>` or `<style>` element (its tags included): comment-only lines and indentation
 * removed (servedHtml_).
 * @param {string} element
 * @param {boolean} script
 */
function servedCode_(element, script) {
  const lines = element.split('\n');
  const comment = (/** @type {string} */ line) => /^\s*(\/\/|\/\*)/.test(line);
  if (script && lines.some((line) => !comment(line) && (line.includes('`') || /\\\s*$/.test(line)))) return element;
  /** A comment-only line from `/*` to its closing star-slash at the end of a line (and nothing after). */
  const closes = (/** @type {string} */ bare) => bare.indexOf('*/') === bare.length - 2 && bare.length >= 2;
  /** @type {string[]} */
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const bare = i === 0 ? lines[i] : lines[i].trimStart();
    if (i > 0 && !bare.includes('<?')) {
      if (script && bare.startsWith('//')) continue;
      if (bare.startsWith('/*')) {
        if (bare.indexOf('*/', 2) >= 0 ? closes(bare) : false) continue;
        let end = i + 1;
        while (bare.indexOf('*/', 2) < 0 && end < lines.length && !lines[end].includes('*/')) end++;
        if (bare.indexOf('*/', 2) < 0 && end < lines.length && closes(lines[end].trim()) &&
            !lines.slice(i, end + 1).some((line) => line.includes('<?'))) {
          i = end;
          continue;
        }
      }
    }
    if (bare !== '') kept.push(bare);
  }
  return kept.join('\n');
}
