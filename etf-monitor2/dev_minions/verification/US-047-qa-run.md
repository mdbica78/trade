## QA run 1 — 2026-10-02 12:36

Verdict: PASS

Machine checks: 8/8   Left for the user: 1

This run used the user's explicit manual override of the stopped dev-loop gate because development is active in another agent.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen dependency install (QA #1, AC11) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 697ms using pnpm v12.5.1`. |
| 2 | TypeScript and lint gates (QA #2–3, AC11) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 0 → `$ tsc --noEmit`; lint `✖ 9 problems (0 errors, 9 warnings)`; final `PREDEPLOY: PASS — typecheck, lint, build and tests are green.` |
| 3 | Offline production build (QA #5, AC11) | AUTO | PASS | Same pre-deploy command → 0 → `migrate-on-deploy: skipped (not a production build)`; `✓ Compiled successfully`; 12 dynamic routes listed. |
| 4 | Full current regression (QA #4, AC1–AC11) | AUTO | PASS | Same pre-deploy command → 0 → `Test Files 195 passed (195)`; `Tests 1941 passed (1941)`; `Duration 260.84s`. |
| 5 | Focused home-display schema, migration, atomic save/rollback, fallback, toggle, table, action-boundary, page and i18n suite (AC1–AC9, AC11) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run --reporter=dot lib/config/home-display.pglite.test.ts lib/monitoring/home-display.pglite.test.ts lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts components/HomeCustomizePanel.test.tsx components/home-display-state.test.ts components/HomeTable.test.tsx app/home-display-actions.pglite.test.ts app/page.test.tsx app/page.wrapper.test.tsx lib/config/boundaries.test.ts app/actions.boundary.test.ts i18n/messages.test.ts` → 0 → `Test Files 13 passed (13)`; `Tests 120 passed (120)`. |
| 6 | Generated migration remains stable (QA #6, AC8) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm db:generate` → 0 → `11 tables`; `No schema changes, nothing to migrate`. No live database was contacted or migrated. |
| 7 | Local RO/EN home title/button and safe no-database state (manual QA #1, AC1/AC7) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh get /` and `bash scripts/claude/qa-serve.sh get / "NEXT_LOCALE=en"` → 0 → both `STATUS 200`; RO contains `ETF-uri monitorizate Personalizează afișarea`; EN contains `Monitored ETFs Customize view`. The no-database error state is expected. |
| 8 | No home-display settings entry on the admin index (manual QA #6, AC1) | AUTO | PASS | `bash scripts/claude/qa-serve.sh get /admin` and `bash scripts/claude/qa-serve.sh get /admin "NEXT_LOCALE=en"` → 0 → both `STATUS 200`; only ETFs, AI, daily job and operations sections are rendered. The QA server then stopped cleanly: `QA server stopped.` |

### For the user (only what a machine couldn't settle)

- [JUDGMENT] Compare the deployed filled home page with `mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`, and `mockup-home-phone.png`: desktop title left/button right; open panel above the table with ETF/value/change groups; mobile groups stacked. Also click the button once and confirm its expanded/collapsed state and no Save button. QA inspected all four approved PNGs, but the available computer-use inventory had no browser, and the local no-database page cannot open the data-backed panel; therefore no runtime screenshot is falsely labelled MATCH.

Denied or attempted commands: none.
