// @ts-check
// The web app. Phase 1: a placeholder page with no data and no server calls. Deployed for
// "only myself" (src/appsscript.json). From phase 2 it opens to ANYONE_ANONYMOUS, never
// ANYONE, which would force a Google sign-in (ADR-0002).

/**
 * Serves the page.
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sales Diary')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
