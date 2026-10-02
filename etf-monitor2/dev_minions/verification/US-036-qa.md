# US-036 QA checklist — Home table and previous-available delta

## Offline gates

From the repository root, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
`GEMINI_API_KEY`, and `GROQ_API_KEY` unset (do not print their values):

1. `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
   `pnpm build` — expect exit 0 for each. The migration runner must skip outside
   production. Do not run a migration or point tests at live Neon.
2. After the build, `pnpm exec tsx scripts/qa/render-home.tsx` — expect four
   files under `.qa-render/home/`: `home-ro-light.html`, `home-ro-dark.html`,
   `home-en-light.html`, `home-en-dark.html`. Open the HTML files in a browser;
   their sibling `build-*.css` files are required. This is a static fixture
   using the shipped home component tree and no database, not a live save path.
3. `pnpm exec vitest run components/HomeTable.test.tsx lib/monitoring/home-delta.pglite.test.ts scripts/qa/render-home.test.tsx scripts/qa/boundaries.test.ts`
   — expect all focused checks green. PGlite tests prove per-field lookback,
   missing days, missing values, zero divisors, and date boundaries.

## MANUAL-QA — filled table, visual references and interactions (AC1, AC8, AC10, AC11)

Compare the generated English light/dark pages at about 1200×560 against
`dev_minions/backlog/home-design/mockup-home-light.png` and
`mockup-home-dark.png`. Compare the dark open-panel page with
`mockup-home-dark-customize.png`, and the 390 px capture with
`mockup-home-phone.png`. Record `MATCH` or `DEVIATION: <what, why>` for **each**
PNG, limited to US-036's table/card (header belongs to US-035; title/panel
belong to US-047). The approved phone reference wraps a date incorrectly:
**do not reproduce that defect**. If the images or browser are unavailable,
record one JUDGMENT item rather than claiming MATCH.

- Verify one link from every symbol/row to the ETF detail page. At a numeric
  cell, clicking the row must open the detail page; keyboard order should put
  the row link before the optional PDF button. Hover should highlight the row.
  The separate PDF button, when present, opens its provided report URL in a
  new tab without activating the detail link; a no-URL row has no PDF button.
  Do not issue a network request to the fixture's PDF URL.
- Verify the ETF name under the symbol, no separate History link, small
  uppercase headers, value followed by arrow/absolute/percent on one change
  line, flat dash, gain/loss colours and localized previous-date tooltip.
  The RO and EN fixture pages should each show their own PDF and arrow
  accessible labels and number/date formatting.
- At 390 px, scroll **inside** the table card. The page must not overflow
  horizontally; dates and numbers must not wrap. Capture the scrolled state
  as well as the initial state.
- With the app served by the separately authorized QA process, check the live
  `/` empty and database-error states in RO and EN: the same card stays visible,
  without a raw exception. Do not require live database contents for this
  check. A populated live Neon/BVB view, if available after the user's push,
  is an additional read-only check, not a prerequisite for offline QA.

Report the drafted acceptance criteria for PO confirmation at the demo.
Do not deploy, run a live migration, alter Vercel, or run git in QA.

## Files changed (US-036)

- Source: `lib/monitoring/home.ts`, `components/HomeTable.tsx`,
  `components/HomePageBody.tsx`, `app/page.tsx`, `app/globals.css`,
  `messages/en.json`, `messages/ro.json`, `.gitignore`,
  `dev_minions/architecture/data-model.md`.
- Tests: `lib/monitoring/home-delta.pglite.test.ts`,
  `lib/monitoring/home-delta.test.ts`, `lib/monitoring/home.pglite.test.ts`,
  `lib/monitoring/home-display.pglite.test.ts`, `components/HomeTable.test.tsx`,
  `app/globals.home-table.test.ts`, `scripts/qa/render-home.test.tsx`,
  `scripts/qa/boundaries.test.ts`.
- QA harness: `scripts/qa/render-home-fixture.ts`,
  `scripts/qa/render-home.tsx`. Generated `.qa-render/` files are ignored.
- Delivery records: `dev_minions/verification/US-036-plan.md`,
  `US-036-review.md`, `US-036-tests.md`, `US-036-qa.md`,
  `dev_minions/status.md`, `dev_minions/HANDOVER.md`.
- No new dependency, lockfile, schema or migration change. Separately from
  this story, the user-requested autopilot repair touched
  `scripts/claude/autopilot.sh` and `dev_minions/automation/AUTOMATION.md`.
