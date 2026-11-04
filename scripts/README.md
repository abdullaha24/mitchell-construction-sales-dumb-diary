# scripts/

Helper scripts for developers and the owner. Each script says at the top what it does and whether
it touches the live Sheet.

| Script | Does | Touches Google? |
| --- | --- | --- |
| `guide/build.js` (`npm run guide`) | Builds the salesman's user guide, `docs/guide/sales-diary-guide.pdf` (A5, 12 pages): takes fresh screenshots with `guide/shots.js`, then lays them out with a few plain words and numbered circles. Needs Playwright. The words are in `pages()` in `build.js`. | No |
| `guide/shots.js` | The guide's screenshots: the real salesman page (`doGet` + server code) on **fake** sheets with a pretend salesman `DEMO`, pretend sites and a pretend link code, in Chromium at 360 px. Also writes where each numbered circle goes (`shots.json`). | No |

Rebuild the guide whenever the salesman's page changes how it looks, and check the PDF by eye
(the build fails if anything spills off a page).
