## QA run 1 - 2026-09-25 09:44

Verdict: PASS
Machine checks: 7/7 AUTO+AUTO-PARTIAL passed. Left for the user: 6

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | Cron auth, runner isolation, no retries, loader order, route exports, response redaction (AC1-AC7; qa.md automated) | AUTO | PASS | Five focused suites passed 32/32; the route suite rerun in isolation passed 6/6. The initial aggregate run had one WSL startup timeout only; the exact test then passed. |
| 2 | TypeScript gate (AC10) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck` exited 0. |
| 3 | Lint gate (AC10) | AUTO | PASS | `pnpm lint` exited 0; only the known unused `_text` and `_statements` test-helper warnings. |
| 4 | Production build with real route chain (AC7, AC10) | AUTO | PASS | `env -u DATABASE_URL pnpm build` compiled successfully and completed TypeScript, static-page generation, and trace collection. |
| 5 | Unconfigured route fails closed through QA server (AC1, AC6) | AUTO | PASS | `qa-serve.sh start`, `get /api/cron/daily` returned `STATUS 500` and `{\"error\":\"cron not configured\"}`, then server stopped. |
| 6 | Cron manifest shape and Decided schedule (AC5) | AUTO | PASS | `vercel.json` has exactly one `/api/cron/daily` entry with `0 10 * * *`. |
| 7 | Deployment documentation (AC8) | AUTO | PASS | README documents `CRON_SECRET`, bearer trigger, `vercel.json`, Production-only execution, and redeploying after schedule changes. |

### For the user (only live Vercel/Neon checks)

- [LIVE-ACCOUNT] In Vercel Settings > Functions, confirm Fluid compute's limit accepts `maxDuration = 60`; a deployment rejection is a failure.
- [LIVE-ACCOUNT] In Vercel Settings > Cron Jobs, confirm exactly one job: `/api/cron/daily`, schedule `0 10 * * *`.
- [LIVE-ACCOUNT] On the deployed URL, send no bearer header and a wrong bearer header; each must return HTTP 401.
- [LIVE-DB] With the correct `CRON_SECRET`, call the deployed endpoint. Expect HTTP 200 with one outcome per seeded ETF, then confirm the corresponding `reports` and `report_values` rows in Neon and compare each source PDF.
- [LIVE-ACCOUNT] In Vercel Logs, confirm the manual run finishes well below 60 seconds.
- [NOT-AUTOMATABLE] On the following day, confirm Vercel invoked the job between 10:00 and 10:59 UTC and that business-day report rows appeared. This requires time to pass and the deployed scheduler.
