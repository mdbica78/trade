## QA run 1 — 2026-09-28 21:25

Verdict: PASS

Machine checks: 4/4 AUTO/AUTO-PARTIAL passed. Left for the user: 4 live checks.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Safe logging, page boundaries, schema probe, stale-schema rendering, restricted fallback, and README instructions (AC1–AC5, AC7) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run lib/log/load-error.test.ts lib/health.test.ts lib/health.pglite.test.ts app/health/page.test.tsx app/health/page.failure.test.tsx app/health/page.schema.pglite.test.tsx lib/monitoring/home-fallback.pglite.test.ts app/load-error.boundary.test.ts test/readme-deployment.test.ts app/chat/page.load-error.test.tsx` → 0 → `Test Files 10 passed (10)`, `Tests 57 passed (57)`; HF-1–HF-7 all passed. |
| 2 | Typecheck, lint, build, and complete offline regression (AC6) | AUTO | PASS | Commands with the four variables unset: `pnpm typecheck && pnpm lint` → 0 (`0 errors, 9 warnings`); `pnpm build` → 0 (includes `ƒ /health`); `pnpm test` → 0, `Test Files 166 passed (166)`, `Tests 1771 passed (1771)`. All commands were run in this QA session before the focused run. |
| 3 | Generic home failure remains safe and bilingual (AC2) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh start --db-unreachable; ... get /; ... get / "NEXT_LOCALE=en"; ... stop` → 0 → both `STATUS 200`; RO: `Datele nu au putut fi încărcate.`, EN: `Could not load the data.`; no connection string or SQLSTATE rendered. |
| 4 | Health failure is observable without changing P15 (AC3/P15 boundary) | AUTO-PARTIAL | PASS | Same QA-server run → 0 → `/health` `STATUS 200`, database-unreachable state rendered. The raw `Failed query...` text is intentionally unchanged P15 behaviour; schema-drift rendering itself is covered by the real-PGlite focused tests in check 1. `QA server stopped.` |

### For the user (only what a machine could not settle)

- [LIVE-DB] On a Neon branch missing `etf_report_links`, confirm deployed `/health` lists the missing table, then disappears after migration and redeploy.
- [LIVE-DB] Before that migration, confirm deployed `/` still shows the home table and report-derived links.
- [LIVE-ACCOUNT] During a genuine production load failure, inspect Vercel logs for exactly one sanitized `[load-error]` line and no connection string, query, stack, or exception message.
- [LIVE-DB] The README query `select to_regclass('public.etf_report_links');` should return a non-null value after migration.

