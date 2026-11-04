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
  const template = HtmlService.createTemplateFromFile('App');
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
  const template = HtmlService.createTemplateFromFile('App');
  template.data = JSON.stringify({ ...adminDataFor_(diary, linked, new Date()), k: code });
  template.adminParts = HtmlService.createHtmlOutputFromFile('Admin').getContent();
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
