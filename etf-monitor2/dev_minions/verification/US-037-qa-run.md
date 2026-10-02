## QA run 1 — 2026-10-02 12:31

Verdict: PASS

Machine checks: 5/5   Left for the user: 1

This run used the user's explicit manual override of the stopped dev-loop gate because development is active in another agent.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen dependency install (QA #1, AC10) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 697ms using pnpm v12.5.1`. |
| 2 | TypeScript gate (QA #2, AC10) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 0 → `=== pnpm typecheck`; `$ tsc --noEmit`; final `PREDEPLOY: PASS — typecheck, lint, build and tests are green.` |
| 3 | Lint gate (QA #3, AC10) | AUTO | PASS | Same pre-deploy command → 0 → `✖ 9 problems (0 errors, 9 warnings)`; warnings are the checklist's accepted pre-existing warnings. |
| 4 | Offline production build (QA #5, AC10) | AUTO | PASS | Same pre-deploy command with database, cron, Vercel and provider variables unset → 0 → `migrate-on-deploy: skipped (not a production build)`; `✓ Compiled successfully`; 12 dynamic routes listed. |
| 5 | Full offline regression, including multi-report ingestion, every-field storage, idempotency, guards, display filtering and request bounds (QA #4, AC1–AC10) | AUTO | PASS | Same pre-deploy command → 0 → `Test Files 195 passed (195)`; `Tests 1941 passed (1941)`; `Duration 260.84s`. |

### For the user (only what a machine couldn't settle)

- [LIVE-DB] After the first Monday production cron (or one authorized manual cron trigger), check `/admin/operations` for each BRD ETF's `stored N, already stored M, failed K, not attempted J`; check each ETF detail page has every weekend report date. Trigger the same filing again and confirm `already_ingested` with no new report rows. The QA loop did not access Neon, Vercel, `CRON_SECRET`, or any other secret.

Denied or attempted commands: none.
