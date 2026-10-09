# US-047 QA checklist — Home display settings (FR7.3)

## Automated gates

Run from the repository root with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
`GEMINI_API_KEY`, and `GROQ_API_KEY` unset:

1. `pnpm install --frozen-lockfile` — expect exit 0.
2. `pnpm typecheck` — expect exit 0.
3. `pnpm lint` — expect 0 errors; 9 existing warnings are acceptable.
4. `pnpm test` — expect all tests green.
5. `pnpm build` — expect exit 0, migration runner skipped outside production, and all routes
   built dynamically.
6. `pnpm db:generate` with `DATABASE_URL` unset — expect “No schema changes, nothing to migrate”.

PGlite automated coverage is the source for database-backed save/rollback/toggle checks. Do not
point this QA run at a live Neon database or apply the migration manually; DEC-023 makes the
production build apply it.

## MANUAL-QA — AC1 / AC7 / AC10: title row and Customize panel

Use the approved files under `dev_minions/backlog/home-design/`. Capture the comparison pages in
English at the reference sizes. The filled-table render harness is delivered by US-036 per Sprint
9 D-7; use its generated fixture HTML for filled-table captures and the QA-served application for
the live empty/error states.

1. Open `/` in both RO and EN. Confirm the translated “Monitored ETFs”/“ETF-uri monitorizate”
   title and “Customize view”/“Personalizează afișarea” button are present, the title is left and
   the button right, and the closed panel is not visible.
2. Open Customize view. Confirm the panel appears above the table, the three groups are ordered
   ETFs, value columns, Changes, and there is no Save button. Check the fixture's ETF and field
   labels render in the selected locale; group and change labels are translated.
3. At about 1200×560, compare the title row and closed panel state with `mockup-home-light.png`
   and `mockup-home-dark.png`, then compare the open panel and group spacing with
   `mockup-home-dark-customize.png`. Record MATCH or `DEVIATION: <what, why>` for each image.
4. At 390 px wide, open the panel and compare the title row and stacked groups with
   `mockup-home-phone.png`. Record MATCH or `DEVIATION: <what, why>`; the header overlap in that
   reference is outside US-047 and is not a target.
5. Confirm the expanded-state button exposes `aria-expanded="true"` and targets the panel; close
   it and confirm `aria-expanded="false"` and the panel is absent.
6. Confirm the actions remain within the home page and that `/admin` has no home-display settings
   section or navigation item. Do not attempt a live save without the separately controlled
   production DB; save, rollback, error handling, and persistence are exercised by the PGlite
   tests.

If the render harness or a scriptable screenshot browser is unavailable, record the specific
JUDGMENT/AUTO-PARTIAL item instead of claiming a visual MATCH. Report drafted acceptance criteria
for PO confirmation at the demo; do not block the story on a live database or Vercel step.

## Files changed

- new: `lib/config/home-display.ts`, `lib/config/home-display.pglite.test.ts`,
  `lib/monitoring/home-display.pglite.test.ts`, `components/HomeCustomizePanel.tsx`,
  `components/HomeCustomizePanel.test.tsx`, `components/home-display-state.ts`,
  `components/home-display-state.test.ts`, `app/home-display-actions.ts`,
  `app/home-display-actions.pglite.test.ts`, `drizzle/0002_home_display_settings.sql`,
  `drizzle/meta/0002_snapshot.json`
- changed: `lib/db/schema.ts`, `lib/db/schema.test.ts`,
  `test/helpers/pglite.migrations.test.ts`, `drizzle/meta/_journal.json`,
  `lib/config/default-deps.ts`, `lib/config/boundaries.test.ts`,
  `lib/monitoring/home.ts`, `lib/ingestion/boundaries.test.ts`,
  `components/HomeTable.tsx`, `components/HomeTable.test.tsx`, `app/page.tsx`,
  `app/page.test.tsx`, `app/page.wrapper.test.tsx`, `app/actions.boundary.test.ts`,
  `app/globals.css`, `messages/en.json`, `messages/ro.json`,
  `dev_minions/architecture/data-model.md`, `test/data-model-doc.test.ts`,
  `dev_minions/verification/US-047-plan.md`, `dev_minions/verification/US-047-review.md`,
  `dev_minions/verification/US-047-tests.md`, `dev_minions/status.md`,
  `dev_minions/HANDOVER.md`
- no dependency or lockfile changes; no live migration was run.
