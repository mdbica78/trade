## QA run 1 — 2026-09-26 12:12
Verdict: PASS
Machine checks: 7/7 AUTO+AUTO-PARTIAL   Left for the user: 3

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Chart series, gaps, formatting, client boundary, bilingual render, and package assertions (AC1–AC7) | AUTO | PASS | `env -u DATABASE_URL pnpm exec vitest run lib/monitoring/chart-series.test.ts lib/monitoring/chart-series.pglite.test.ts lib/format/chart.test.ts components/FieldChart.test.tsx components/FieldChart.smoke.test.tsx components/FieldChart.boundary.test.ts components/EtfDetail.test.tsx app/etf/[symbol]/page.test.tsx test/package-config.test.ts i18n/messages.test.ts --reporter=dot --silent` → exit 0 → `Test Files 10 passed (10); Tests 66 passed (66)`. |
| 2 | Frozen dependency install (AC6) | AUTO | PASS | `env -u DATABASE_URL pnpm install --frozen-lockfile` → exit 0 → `Lockfile is up to date, resolution step is skipped; Done in 856ms using pnpm v12.5.1`. |
| 3 | TypeScript (AC8) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck` ran before the full suite in the same shell; the next command (`vitest`) started, proving exit 0: `$ tsc --noEmit` then `$ vitest run -- --silent`. |
| 4 | Full regression suite (AC8) | AUTO | PASS | Initial `env -u DATABASE_URL pnpm test -- --silent` → exit 1: one unrelated `app/page.test.tsx` timeout at 5000ms while the dev loop was active (900 passed, 1 failed). Isolated retry `env -u DATABASE_URL pnpm exec vitest run app/page.test.tsx --reporter=dot --silent` → exit 0 → `Test Files 1 passed (1); Tests 5 passed (5)`. No reproducible product failure. |
| 5 | Lint (AC8) | AUTO | PASS | `env -u DATABASE_URL pnpm lint` → exit 0 → `0 errors, 3 warnings`; warnings are existing unused `_deps`, `_text`, `_statements` parameters. |
| 6 | Offline production build (AC7, AC8) | AUTO | PASS | First build met a concurrent Next lock; retry `env -u DATABASE_URL pnpm build` → exit 0 → route table includes `ƒ /etf/[symbol]` and `ƒ (Dynamic) server-rendered on demand`. |
| 7 | Detail page safe no-database states in RO and EN (manual QA item 7) | AUTO-PARTIAL | PASS | `env -u DATABASE_URL bash scripts/claude/qa-serve.sh start; ... get /etf/BTBETRETF; ... get /etf/BTBETRETF NEXT_LOCALE=en; ... stop` → exit 0 → both `STATUS 200`; RO: `Datele nu au putut fi încărcate...`; EN: `Could not load the data...`; `QA server stopped.` |

### For the user (only what a machine couldn't settle)

- [LIVE-DB] After deployment and real report data, open an ETF detail page: confirm one chart per tracked field, chart gaps on missing calendar days, and a single dot for a one-day history.
- [AUTO-PARTIAL/JUDGMENT] Hover a live chart point and switch RO/EN once. Confirm the tooltip, axis date/number formats, and that the chart look is close enough to bvb.ro; check the browser console has no persistent Recharts or hydration error.
- [JUDGMENT] Confirm the shipped chart choices: whole-history range, gaps not connected, auto-scaled Y axis, one line colour/dashed grid, and the drafted Romanian copy `Grafice` / `Nu există date pentru acest câmp.`

### Not automatable in this run

- [NOT-AUTOMATABLE] AC6's empty-`node_modules` clean-install proof was not run: deleting the shared dependency tree would disrupt the concurrently running development loop. The non-destructive frozen install passed above.
