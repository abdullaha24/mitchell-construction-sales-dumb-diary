// @ts-check
// The web app (spec 002). A visitor's link code decides the page:
//   salesman → "Hello, RIA"; owner → "Hello, owner"; anything else → "This link doesn't work";
//   Google failing → "Something went wrong", so nobody thinks a good link was cancelled.
// The code is never written into a page, a log or an error. No server calls from the page yet.
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
  /** @type {PageText} */
  let text;
  try {
    text = pageTextFor_(whoIsVisiting_(code));
  } catch (error) {
    // Deliberately not logged: keep it simple and keep codes out of logs.
    text = PAGE_TEXT.error;
  }
  return renderPage_(text);
}

/**
 * The words on the page for a visitor.
 * @param {Visitor} visitor
 * @returns {PageText}
 */
function pageTextFor_(visitor) {
  if (visitor.kind === 'rep') return { heading: `Hello, ${visitor.rep}`, note: '' };
  if (visitor.kind === 'owner') return PAGE_TEXT.owner;
  return PAGE_TEXT.none;
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
