## QA run 1 — 2026-10-04 18:18
Verdict: PASS
Machine checks: 7/7   Left for the user: 3

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` (database/deploy/key variables removed; earlier this QA cycle) → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 1.1s`. |
| 2 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` (same variables removed, earlier this QA cycle) → 0 → `$ tsc --noEmit`. |
| 3 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` (same variables removed, earlier this QA cycle) → 0 → `9 problems (0 errors, 9 warnings)`. |
| 4 | Full regression (qa.md #1) | AUTO | PASS | `pnpm test` (same variables removed, earlier this QA cycle) → 0 → `Test Files 214 passed (214); Tests 2203 passed (2203)`. |
| 5 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build` (same variables removed, earlier this QA cycle) → 0 → `migrate-on-deploy: skipped (not a production build)`; 12 dynamic routes. |
| 6 | Widget engine, exact decimal, PGlite history, component and page suite (qa.md #2–3; AC1–AC7) | AUTO | PASS | `bash -lc 'pnpm exec vitest run lib/monitoring/exact-decimal.test.ts lib/monitoring/delta.test.ts lib/monitoring/widget-engine.test.ts lib/monitoring/history.pglite.test.ts components/CustomValues.test.tsx components/EtfDetail.test.tsx components/EtfDetail.chart-types.test.tsx "app/etf/[symbol]/page.test.tsx" lib/config/boundaries.test.ts'` (eleven variables removed) → 0 → `Test Files 9 passed (9); Tests 130 passed (130)`. The PGlite file includes both optional-table absence and unrelated-query-failure tests. |
| 7 | No-DB detail-route safe state in RO/EN (AC6) | AUTO-PARTIAL | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh start'` (eleven variables removed) → 0 → `QA server ready ... (database: none)`; `bash -lc 'bash scripts/claude/qa-serve.sh get /etf/BTBETRETF'` → 0 → `STATUS 200`, translated RO load error; `bash -lc 'bash scripts/claude/qa-serve.sh get /etf/BTBETRETF NEXT_LOCALE=en'` → 0 → `STATUS 200`, `Could not load the data`; `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped`. |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm drafted AC1–AC7 and the look/wording of Custom values above history in both locales.
- [LIVE-DB] After the ordinary push and creation of widgets via chat, inspect actual basis dates, decimal marks, empty-history messaging, and an untracked but catalogued field in the deployed ETF detail page. The no-DB route cannot render saved widgets.
- [LIVE-DB] Confirm an ETF with no widgets still has unchanged history/chart and no invented or backfilled values.

### Failures (if any)
- None. An initial Windows runner command failed because its `.bin/vitest.cmd` link was missing after a concurrent dependency-tree change; the full focused suite was then run successfully with WSL pnpm. No application/test assertion failed in the final run.

No git, live migration, provider, secret value or real database was accessed; no implementation/tests edited.
