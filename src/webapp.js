// @ts-check
// The web app (specs 002, 003). A visitor's link code decides the page:
//   salesman → his app (App.html) with his own sites; owner → "Hello, owner";
//   anything else → "This link doesn't work"; Google failing → "Something went wrong", so
//   nobody thinks a good link was cancelled.
// A code is only ever written into its own holder's page (his page needs it to save), never
// into anyone else's page, a log or an error.
// Deployed as "execute as owner", access ANYONE_ANONYMOUS, always at the same address.

/** @typedef {{ heading: string, note: string }} PageText */

/** @type {Object<string, PageText>} */
const PAGE_TEXT = {
  owner: { heading: 'Hello, owner', note: 'Your screen comes in a later phase.' },
  none: { heading: "This link doesn't work.", note: 'Ask the owner for a new one.' },
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
    const visitor = whoIsVisiting_(code);
    if (visitor.kind === 'rep') return renderApp_(visitor, String(code));
    return renderPage_(pageTextFor_(visitor));
  } catch (error) {
    // Deliberately not logged: keep it simple and keep codes out of logs.
    return renderPage_(PAGE_TEXT.error);
  }
}

/**
 * The salesman's app, with his page data inside it so it shows at once on a weak connection.
 * The data goes in as escaped text and the page reads it back with JSON.parse.
 * @param {{ rep: string, region: string }} salesman
 * @param {string} code his own link code (his page needs it to save)
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function renderApp_(salesman, code) {
  const template = HtmlService.createTemplateFromFile('App');
  template.data = JSON.stringify({ ...loadFor_(salesman), k: code });
  return template.evaluate()
    .setTitle('Sales Diary')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * The words on the simple page for the owner or a refused visitor.
 * @param {Visitor} visitor
 * @returns {PageText}
 */
function pageTextFor_(visitor) {
  return visitor.kind === 'owner' ? PAGE_TEXT.owner : PAGE_TEXT.none;
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
