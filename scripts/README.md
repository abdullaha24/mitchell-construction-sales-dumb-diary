# scripts/

Helper scripts for developers and the owner. Each script says at the top what it does and whether
it touches the live Sheet.

| Script | Does | Touches Google? |
| --- | --- | --- |
| `guide/build.js` (`npm run guide`) | Builds the user guides into `docs/guide/` (A5): **`sales-diary-guide.pdf`** for the salesmen (17 pages: the app, then 5 Summary pages) and **`admin-summary-guide.pdf`** for the Admin (2 pages: his Summary and the team table). Takes fresh screenshots with `guide/shots.js`, then lays them out with a few plain words and numbered circles. Needs Playwright. The words are in `pages()` / `adminPages()` in `build.js`; `bubble()` draws the WhatsApp message as a phone shows it. Optional: `node scripts/guide/build.js <out-folder>`; `KEEP_GUIDE_SHOTS=1` keeps the pictures. | No |
| `guide/shots.js` | The guides' screenshots: the real salesman and admin pages (`doGet` + server code, served as phones get them) on **fake** sheets: a pretend salesman `DEMO` with a realistic week (new sites, a sample, quotes, two wins, a loss, hot, late and going-cold sites), pretend teammates `AK`, `BT`, `FZ`, `HN`, `QM`, made-up targets for this and last month, pretend link codes. "This week's" activity is placed between the later of this Saturday and the 1st, and now, so it shows under both This week and This month on any day. Also writes where each numbered circle goes and the WhatsApp texts (`shots.json`). | No |

Rebuild the guides whenever the salesman's or admin's page changes how it looks, and check both PDFs
by eye (the build fails if anything spills off a page). Dates and numbers in the pictures follow the
day the guide is built.
