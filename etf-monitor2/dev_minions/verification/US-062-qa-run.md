# US-062 — QA run 1

Date: 2026-10-12. Initial board state: Awaiting QA; no prior QA-run file.

## Result

**BLOCKED — no final QA verdict.** The focused US-062 tests and shared gates passed earlier in
this QA attempt. During the attempt, the dev loop started US-064, which explicitly replaces
parts of US-062 and is modifying the same cron configuration surface. The later QA-server build
failed because the current cron page and cron PGlite test still import exports removed from
`lib/config/cron.ts`. Do not treat this transient, concurrent-tree failure as a US-062 defect or
apply the old US-062 route assertions to the replacement story.

## Evidence

- Before this story, `bash scripts/claude/dev-loop-status.sh` reported
  `RUNNING 2026-10-12 15:13:10 — run 1`.
- Focused command:
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/dev-loop-status.sh; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm exec vitest run lib/ingestion/job-runs.claim.pglite.test.ts lib/cron/daily-handler.test.ts lib/cron/daily-job.test.ts test/e2e/daily-pipeline.pglite.test.ts lib/config/cron.test.ts lib/config/cron.pglite.test.ts app/admin/cron/page.test.tsx test/e2e/daily-ping-workflow.test.ts lib/db/schema.test.ts lib/config/boundaries.test.ts app/api/cron/daily/route.test.ts lib/cron/vercel-config.test.ts test/readme-deployment.test.ts'`
  — exit 0; `Test Files 13 passed (13)`, `Tests 186 passed (186)`.
- Shared checks used the exact command prefix
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm`
  followed by the named script and a closing single quote:
  - `typecheck'` — exit 0; `$ tsc --noEmit`.
  - `lint'` — exit 0; `✖ 21 problems (0 errors, 21 warnings)`.
  - `test'` — exit 0; `Test Files 265 passed (265)`, `Tests 2905 passed (2905)`.
  - `build'` — exit 0; printed
    `migrate-on-deploy: skipped (not a production build)` and generated all 12 routes.
- Runtime check:
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh start'`
  — exit 3; build failed with TS2305:
  `app/admin/cron/page.tsx` imports `effectiveSchedule` and `parseDailySchedule` from
  `lib/config/cron.ts`, but neither is exported; `lib/config/cron.pglite.test.ts` also imports
  the removed `effectiveSchedule`.
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh stop'`
  — exit 0; `QA server stopped.`
- No `db:generate`, migration apply, live endpoint, GitHub secret, Vercel setting, or production
  database was accessed.

## Remaining checks

- **AUTO-PARTIAL, blocked:** `/admin/cron` RO/EN UI, hour selection/save, themes, keyboard and
  narrow viewport could not be checked in the local browser.
- **LIVE-ACCOUNT:** production migration, GitHub repository secrets/workflow dispatch, and
  before/after-hour behavior require the user's deployment and account. No production ping
  was sent.

## Exact unblock

Finish US-064's cron refactor and synchronize `app/admin/cron/page.tsx` plus
`lib/config/cron.pglite.test.ts` with the new `lib/config/cron.ts` exports. Then rerun current
typecheck, full tests/build, the US-062 claim/handler/config selectors, and `qa-serve.sh` route
checks. Since US-064 replaces US-062 AC3/AC4, use the updated story/DEC-031 criteria for those
surfaces. No status-board row was changed; no US-062 product failure is claimed.

## QA run 2 — 2026-10-13 11:52
Verdict: PASS
Machine checks: 5/5   Left for the user: 2

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Current daily-claim, handler, schedule, redeploy-apply, Vercel config, cron page, schema and boundary selectors (US-062 AC1/2/5/6; current US-064 replacement tests) | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u VERCEL_DEPLOY_HOOK_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm exec vitest run lib/ingestion/job-runs.claim.pglite.test.ts lib/cron/daily-handler.test.ts lib/cron/daily-job.test.ts test/e2e/daily-pipeline.pglite.test.ts lib/config/cron.test.ts lib/config/cron.pglite.test.ts lib/config/cron-build.test.ts lib/config/cron-apply.test.ts lib/config/cron-apply.pglite.test.ts app/admin/cron/page.test.tsx lib/cron/vercel-config.test.ts lib/db/schema.test.ts lib/config/boundaries.test.ts app/api/cron/daily/route.test.ts'` → 0 → `Test Files 14 passed (14); Tests 235 passed (235)`. |
| 2 | Shared current-tree gates | AUTO | PASS | With the same `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u VERCEL_DEPLOY_HOOK_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm` prefix: `typecheck` → 0; `lint` → 0 (`0 errors, 21 warnings`); `test` → 0 (`267 files / 2967 tests passed`); `build` → 0 (`migrate-on-deploy: skipped`, all 12 routes generated). |
| 3 | Romanian `/admin/cron` current no-database route | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /admin/cron'` → 0 → `STATUS 200`; Romanian cron page shell and safe database-load error. |
| 4 | English `/admin/cron` current no-database route | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /admin/cron NEXT_LOCALE=en'` → 0 → `STATUS 200`; English cron page shell and safe database-load error. |
| 5 | Missing-secret cron route behavior | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /api/cron/daily'` → 0 → `STATUS 500 {"error":"cron not configured"}`; expected with `CRON_SECRET` intentionally unset, matching RT-1a/GT-6. This is the missing-configuration path, not an authenticated-request test. |

### Scope note and remaining user checks
US-064 explicitly replaces US-062 AC3/AC4's external hourly ping/GitHub workflow with Vercel-native scheduling and redeploy-hook behavior. The old workflow assertions are not used as a failure; the current Vercel config and save/apply regression selectors passed, but this is not a QA verdict for US-064.

- [LIVE-ACCOUNT] After the user-owned Deploy Hook is configured and the change is pushed, verify Vercel's build log and Cron Jobs show the saved UTC hour. This is US-064's user-only spike check (AC0); do not share the hook URL.
- [LIVE-ACCOUNT/LIVE-DB] Verify the saved hour, effective Bucharest time, last-run display, post-save redeploy result, and schedule behavior on the deployed app. No production request or setting was changed here.

QA server built and served the current no-database routes, then was stopped. No production database, Vercel setting, Deploy Hook, migration, deployment, secret, or Git command was accessed.
