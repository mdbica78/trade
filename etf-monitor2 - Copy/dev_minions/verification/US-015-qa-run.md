## QA run 1 - 2026-09-25 10:42

Verdict: PASS
Machine checks: 6/6 AUTO passed. Left for the user: 6

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | Job-run store, summary, stale-sweep, orchestration, handler, default-deps, route, and boundaries (AC1-AC8; qa.md automated) | AUTO | PASS | Focused offline cron/job-run/PGlite suite completed successfully. |
| 2 | C1 regression: real environment secrets cannot reach stored log or response (AC4, round 2) | AUTO | PASS | Full suite included `daily-handler.test.ts` H-15b with the real `readEnv`; it passed. |
| 3 | TypeScript gate (AC10) | AUTO | PASS | `env -u DATABASE_URL pnpm typecheck` exited 0. |
| 4 | Full regression suite (AC10) | AUTO | PASS | `env -u DATABASE_URL pnpm test -- --silent` completed successfully; fixture PDF diagnostics were expected and non-failing. |
| 5 | Lint and production build (AC10) | AUTO | PASS | Lint exited 0 with only the three known unused test-helper warnings; production build compiled successfully. |
| 6 | Unconfigured cron endpoint fails closed (AC1, AC5, AC7) | AUTO | PASS | `qa-serve.sh` returned `STATUS 500` and `{\"error\":\"cron not configured\"}` with database unset, then stopped cleanly. |

### For the user (live Vercel/Neon checks)

- [LIVE-ACCOUNT] Push and deploy to Production; no migration is required because `job_runs` already exists in the schema.
- [LIVE-DB] Trigger `https://etf-monitor2.vercel.app/api/cron/daily` with the correct bearer. Expect HTTP 200, a numeric `jobRunId`, final `status`, and one ETF outcome per active ETF.
- [LIVE-DB] In Neon, confirm the newest `job_runs` row has that id, a `finished_at`, correct processed/error counts, and the expected summary plus per-ETF log lines.
- [LIVE-DB] Trigger again the same day. Expect `success`, 3 processed, 0 errors, and three `already_ingested` log lines.
- [LIVE-DB] Search recent `job_runs.log` values for the secret prefix and Neon host/password; expect no matches.
- [NOT-AUTOMATABLE] On the following day, verify a job row appears without a manual trigger between 10:00 and 10:59 UTC. The optional stale-sweep SQL check is documented in `US-015-qa.md`.
