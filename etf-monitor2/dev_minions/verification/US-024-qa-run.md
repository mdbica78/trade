## QA run 1 - 2026-09-26 21:07
Verdict: PASS
Machine checks: 4/4 AUTO+AUTO-PARTIAL passed. Left for the user: 2

This run was explicitly requested by the user as an exception to the normal development-loop status gate. No real Neon, Vercel, or external service was accessed.

| # | Check (source) | Type | Result | Evidence (command -> exit code -> output tail) |
|---|---|---|---|---|
| 1 | Truthful outcome codes, log parsing, operations read models, datetime formatting, dashboard rendering, boundaries and bilingual behavior (AC1-AC10) | AUTO | PASS | `env -u DATABASE_URL pnpm exec vitest run lib/ingestion/outcome.test.ts lib/ingestion/ingest-etf.test.ts lib/ingestion/ingest-etf.failures.test.ts lib/ingestion/job-run-summary.test.ts lib/ingestion/run-daily.test.ts lib/admin/run-log.test.ts lib/admin/operations.pglite.test.ts lib/admin/operations-messages.test.ts lib/admin/boundaries.test.ts lib/format/datetime.test.ts components/admin/OperationsDashboard.test.tsx app/admin/operations/page.test.tsx app/admin/operations/page.pglite.test.tsx app/admin/layout.test.tsx i18n/messages.test.ts --reporter=dot --silent` -> exit 0 -> `Test Files 15 passed (15); Tests 172 passed (172)`. |
| 2 | Project typecheck and complete regression suite (AC11) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck && env -u DATABASE_URL pnpm test -- --silent` -> exit 0 -> `Test Files 106 passed (106); Tests 1187 passed (1187)`. Existing parser and next-intl test-render notices occurred but no test failed. |
| 3 | Lint and offline production build (AC11) | AUTO | PASS | `env -u DATABASE_URL pnpm lint && env -u DATABASE_URL pnpm build` -> exit 0 -> lint reported `0 errors, 3 warnings` in existing unrelated test files; build compiled successfully and listed `/admin/operations`. |
| 4 | Local Operations dashboard, Romanian and English, with no database | AUTO-PARTIAL | PASS | `env -u DATABASE_URL bash scripts/claude/qa-serve.sh start`; `get /admin/operations`; `get /admin/operations NEXT_LOCALE=en`; `stop` -> exit 0 -> both requests returned `STATUS 200` and a translated safe load-error state with no stack trace; `QA server stopped.` |

### For the user (only what a machine couldn't settle)

- [LIVE-DB] On deployed `/admin/operations`, compare the three sections with Neon: all job runs, each ETF's newest `ok` report, and every non-`ok` report. Confirm RO/EN translations, error details, stored values, and PDF links are useful and accurate.
- [JUDGMENT] Confirm the shipped dashboard defaults: all history/no pagination; technical details and parsing error text remain verbatim while headings/statuses/codes are translated; timestamps display in Europe/Bucharest time.

No US-024 failure was found. The no-database response is expected in this offline QA environment.
