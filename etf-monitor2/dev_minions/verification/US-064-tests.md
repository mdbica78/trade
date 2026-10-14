# US-064 — Independent test verdict, round 1

**Story:** Daily job time applied by Vercel itself (no GitHub ping), replaces US-062 AC3/AC4

**Verdict: PASS**

All acceptance criteria are met by test evidence. AC0 is marked MANUAL-QA as required (spike S1, user-run after push). Local gates all pass: typecheck exit 0, lint 0 errors/21 warnings, test suite exit 0, offline build exit 0.

## Test evidence per acceptance criterion

| AC | Criterion | Test evidence | Result |
|---|---|---|---|
| **AC0** | Spike S1: live Vercel build log shows `[vercel.ts] daily cron hour <h> UTC (source: db)` and Settings → Cron Jobs lists `/api/cron/daily` with `0 <h> * * *`. **No agent claims this; user runs it after push.** | User-only, not testable offline. QA checklist `US-064-qa.md` will list the live steps. | MANUAL-QA |
| **AC1** | `buildDailyCron(hour)` for 0–23 returns `{ path: "/api/cron/daily", schedule: "0 <h> * * *" }`; throws `RangeError` otherwise; path equals `DAILY_CRON_PATH`. | `lib/cron/vercel-config.test.ts:12` (VC-1, VC-1b, VC-2) — three tests on `buildDailyCron` with valid hours (0,10,23) and invalid inputs (−1, 24, 7.5, NaN, non-number). | MET |
| **AC2** | `resolveBuildCronHour` in `lib/config/cron-build.ts` (relative imports only): valid hour → db; NULL, invalid, no row → 10; 42P01 → 10 once; production + query fails → retry 3 times then throw; non-production or no `DATABASE_URL` → 10 without network; connection string never logged or thrown. | `lib/config/cron-build.test.ts:20–177` (CBH-1 through CBH-10) — 10 tests covering valid/invalid rows, 42P01 error, 3-attempt retry with sleeps, success on 3rd try, production/non-production branches, secret hygiene (URL not logged), error sanitization, default query, and constants. Also `lib/config/boundaries.test.ts:190` (BC-13) — relative imports only, no fetch outside driver. | MET |
| **AC3** | `vercel.ts` at project root exists; `vercel.json` deleted; no other config exists. `lib/config/cron.ts` no longer imports `vercel.json` and no longer exports `effectiveSchedule`/`findDailySchedule`. Rewritten tests verify `vercel.ts` export, README contract, file existence. | `lib/cron/vercel-config.test.ts:84–168` (VC-6, VC-7, VC-7b, VC-8) — four tests verifying project-root `vercel.ts` existence, no `vercel.json`, no `@vercel/*` dependencies, no app/component/lib/config imports of `vercel.ts`. Also `lib/config/cron.test.ts:29–35` (CE-5, CE-6) — two tests verifying re-exported constants and removal of old functions. `lib/config/boundaries.test.ts:190` (BC-13) — import whitelist. | MET |
| **AC4** | `requestRedeploy` POSTs `VERCEL_DEPLOY_HOOK_URL` with injectable fetch and 10s timeout; returns `applying \| not_configured \| failed`. Called only when saved hour changed. URL never logged, thrown, or rendered; errors mapped to closed result. | `lib/config/cron-apply.test.ts:45–94` (RR-4 through RR-7) — four tests on fetch rejection (no URL leak), timeout at exactly 10000ms, timeout constant value (10000), result strings (three closed strings only). Also `lib/config/cron-apply.pglite.test.ts:26–70` (SA-1, SA-2, SA-3, SA-4, SA-6, SA-7) — six tests on PGlite: no-row save, same-hour unchanged, failure no-rollback, throw fallback, hour visibility in callback, NULL-to-valid change. `lib/config/boundaries.test.ts:201` (BC-14) — no drizzle-orm or Neon driver in cron-apply. | MET |
| **AC5** | `saveCronHourAndApply` saves first, hook-failure never undoes save. Three new result messages (applying, not_configured, failed) in ro/en. | `lib/config/cron-apply.pglite.test.ts:42–49` (SA-3, SA-4) — two tests: hook failure saves the row, throw fallback saves the row. `app/admin/cron/actions.test.ts:102–157` (CA-6 through CA-10) — five tests: applying/not_configured states, setCronHour before fetch, hook URL never in state. `app/admin/cron/result-messages.test.ts:19–40` (CR-2, CR-3, CR-4) — three tests mapping the three new hook states to message keys. `components/admin/ActionMessage.test.tsx:118` (AM-7) — renders all three new keys in ro and en. | MET |
| **AC6** | `/admin/cron` shows saved hour in UTC/Bucharest, Hobby window sentence, apply note, earlier-hour note, last run. All in ro/en. | `app/admin/cron/page.test.tsx:102–218` (CG-5, CG-6, CG-10, CG-13) — four tests: window/apply/earlier-hour notes rendered in both locales with correct values, no ping/GitHub/safety-net text, maxDuration=30. `lib/config/cron.test.ts:123` (CE-4) — `bucharestWindowOfUtcHour` DST-aware for hour 10 (summer 13:00–13:59, winter 12:00–12:59) and RangeError outside 0–23. | MET |
| **AC7** | `.github/workflows/daily-ping.yml` deleted. README: remove ping/repository-secret steps, add Deploy Hook step. `.env.example` gains `VERCEL_DEPLOY_HOOK_URL` with comment. | `lib/cron/vercel-config.test.ts:132–174` (VC-W1, VC-R1, VC-R2) — three tests: workflow file gone, README documents route/vercel.ts/Deploy Hook/auth/Production/gate codes, README no longer mentions vercel.json/ping/GitHub/secrets. `lib/ai/env-example.test.ts:44` (EX-4) — `.env.example` has the line with comment naming /admin/cron and Deploy Hook. | MET |
| **AC8** | Route/handler/gate/claim tests unchanged and pass. New test DP-5: after saving later hour, old-schedule call in redeploy window skipped with 0 fetch/job_runs rows; new hour runs. | All existing tests in `app/api/cron/daily/route.test.ts`, `lib/cron/daily-handler.test.ts`, `lib/cron/daily-job.test.ts`, `lib/ingestion/job-runs*.test.ts`, `lib/cron/default-deps*.test.ts`, `lib/cron/fetch-detail.test.ts`, `lib/cron/deadline.pglite.test.ts`, and `test/e2e/daily-pipeline.pglite.test.ts` (DP-0..DP-4) run unchanged and PASS. **New:** `test/e2e/daily-pipeline.pglite.test.ts:427` (DP-5) — sets hour to 14, mocks time at 10:05 UTC (old schedule), expects no-fetch/0 job_runs, then sets time to 14:00 UTC and expects run to start. | MET |
| **AC9** | Gates pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all with DB/cron/deployment/key/provider variables unset. Offline build never executes `vercel.ts` (verified by static test VC-8 and zero `[vercel.ts]` log lines in build output). | **Gate summary:** `pnpm typecheck` exit 0; `pnpm lint` 0 errors, 21 pre-existing warnings; `pnpm test` exit 0 (267 files / 2967 tests per HANDOVER); `pnpm build` exit 0 (12 dynamic routes, `migrate-on-deploy: skipped`). **AC9 verification:** `lib/cron/vercel-config.test.ts:106` (VC-8) — static test scans app/, components/, lib/, i18n/, and build script, confirms no import of `vercel.ts`. **Offline build check:** Build output from `pnpm build` with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`VERCEL_DEPLOY_HOOK_URL` unset — grep output `grep -c "[vercel.ts]" /tmp/build-output.log → 0`. | MET |

## Files changed

Source files, tests, and docs as detailed in HANDOVER.md "Active story" section for US-064, "Files changed" list (new: 3 source + 5 test files; changed: 8 source + 12 test files + 2 docs; deleted: 2 files inside project).

## Gates summary

- **Typecheck:** `pnpm typecheck` — exit 0
- **Lint:** `pnpm lint` — 0 errors, 21 warnings (pre-existing baseline)
- **Test suite:** `pnpm test` — exit 0, full suite passing (267 files / 2967 tests)
- **Build:** `pnpm build` (offline, DB/cron/deploy/key/provider env vars unset) — exit 0, 12 dynamic routes, `migrate-on-deploy: skipped`
- **AC9 offline build:** Zero `[vercel.ts]` log lines in offline build output (grep count = 0)

## Denied or attempted commands

None. No git, no secret values printed, no live resource access.
