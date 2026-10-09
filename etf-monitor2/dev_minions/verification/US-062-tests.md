# US-062 — independent test verdict

## Round 1

Tester: independent context (did not write the code). Environment: PowerShell, from `etf-monitor2`; `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` removed from the process environment before every command (values never printed). No git, no `db:migrate`/`db:generate`, no `.env*` read, no source/test edit.

### Commands run (my own evidence)
| Command | `$LASTEXITCODE` | Key output |
|---|---|---|
| `corepack pnpm typecheck` | 0 | `$ tsc --noEmit`, no errors |
| `corepack pnpm lint` | 0 | `✖ 21 problems (0 errors, 21 warnings)` |
| `corepack pnpm test` (output to a scratch file, parsed by regex, file deleted) | 0 | `Test Files  263 passed (263)`, `Tests  2883 passed (2883)`, `Duration 168.15s` |
| `corepack pnpm build` | 0 | `migrate-on-deploy: skipped (not a production build)`, `✓ Compiled successfully`, `Generating static pages (6/6)`, routes `ƒ /admin/cron`, `ƒ /api/cron/daily`; one expected `[load-error] home name=MissingDatabaseUrlError` line (no DB offline) |
| `corepack pnpm exec vitest run <11 US-062 files> --reporter=verbose` (job-runs.claim.pglite, daily-handler, daily-job, daily-pipeline.pglite, config/cron + cron.pglite, app/admin/cron/page, daily-ping-workflow, db/schema, config/boundaries, api/cron/daily/route) | 0 | `Test Files  11 passed (11)`, `Tests  176 passed (176)` |

Scratch output files were deleted afterwards.

### Direct verification of the named guarantees
- **Unauthorized: no DB access.** `daily-handler.test.ts` GT-5 (no header, wrong secret) → 401 and asserts `readCronHour`, `now` and `run` were never called; GT-6 (no secret configured) → 500 before the schedule read; route tests RT-1a/RT-1b/RT-1c pass. All passed in my verbose run.
- **Before-hour: no row.** GT-1 (09:59:59Z, hour 10) → 200 `{skipped:"not_scheduled_hour"}`, `cache-control: no-store`, `run` not called. E2E DP-4 (real PGlite, real handler) asserts at 09:59:59Z the response is that skip, the fetch guard has zero calls and `select id from job_runs` has 0 rows. Passed.
- **Already-ran: no row.** GT-4 → 200 `{skipped:"already_ran"}`. DP-4 repeat at 15:30Z asserts `{skipped:"already_ran"}`, zero fetch calls, and `job_runs` still holds exactly one row (`scheduled_date_utc` = `2026-09-23`); next UTC day runs again (2 rows). CL-2 (second same-day claim returns null, writes nothing). DJ-K1 (claimed day → no ingestion, no `finishRun`, result skipped/already_ran). Passed.
- **Concurrent claim.** `job-runs.claim.pglite.test.ts` CL-6: six concurrent `claimScheduledRun` calls for one day → exactly one non-null winner, exactly one row. Passed. CL-7 proves the unique index itself rejects a second marked row while many NULL legacy rows are allowed.

### Acceptance criteria
| AC | Verdict | Evidence (tests I saw pass) |
|---|---|---|
| AC1 gate, skipped reasons, no row, atomic claim | **MET** | GT-1..GT-4 (before/at/after hour, hour 0, hour 23, UTC not process TZ, lost claim), DP-4, CL-1..CL-8 (first claim marks the day; any prior status running/success/partial/failed with no marker consumes the day; UTC midnight boundaries CL-4/CL-5; claimed row is the run row CL-8; `startRun` unchanged CL-9), DJ-K1/DJ-K2 |
| AC2 nullable legacy, NULL→10, 0–23 integer only, no clear, Bucharest equivalent | **MET** | CE-1/CE-2 (empty, NULL, 0, 7, 23 → value; 24, -3, "x" → 10), CE-3 (Bucharest UTC+3 summer/UTC+2 winter), CS-1..CS-8 incl. CS-3 (clearing rejected, unchanged), CS-3b (0 stored as 0), CS-4 (invalid save leaves row unchanged), CS-6; CG-3 (exactly 24 options, no empty/clear option, single `hour` field); MG-7 expand-only SQL (nullable column) |
| AC3 `/admin/cron` content | **MET** (rendering at test level) | CG-1 (saved hour in UTC + Bucharest), CG-2 (default 10 note), CG-4 (no `vercel.json` edit instructions, both pages/catalogues), CG-5 (hourly ping + once-per-UTC-day, both locales), CG-6 (Vercel safety-net hour), CG-7 (latest run, localized status), CG-8..CG-12. Saved hour visible on the deployed site = MANUAL-QA |
| AC4 workflow, README, safety-net cron | **MET** (file-level) / **MANUAL-QA** (live) | WF-1..WF-8 (hourly + manual dispatch only, read-only permissions, secrets only via repository secrets, no secret echo, fails unless HTTP 200, repo-root copy identical, `vercel.json` keeps daily call, README names both secrets without values). Real hourly GitHub Actions run and repository secrets being set = MANUAL-QA (user-only) |
| AC5 test coverage list | **MET** | UTC boundaries CL-4/CL-5; before/at/after/catch-up GT-1/GT-2; all prior statuses CL-3 (×4 statuses); empty/invalid fallback CE-2; skipped no-write GT-1/GT-4/DP-4/CL-2; concurrent collision CL-6/CL-7; unauthorized no DB GT-5/GT-6; route result shape GT-1/GT-4/DP-4 + route RT-*; BC-8 deliberately replaced (config/boundaries: "only lib/cron/default-deps.ts reads the saved hour") passed |
| AC6 i18n, expand-only offline migration, gates | **MET** / **MANUAL-QA** (production apply) | CG-10 (ro/en render translated text); MG-1 (journal has exactly 8 entries, each with an existing `.sql`), MG-7 (0007 SQL expand-only: nullable day marker, unique index, `started_at` index), CL-10 (both indexes exist on PGlite); typecheck/lint/full suite/offline build all green (table above). Real production migration application by the deploy = MANUAL-QA |

### MANUAL-QA items (not claimed met)
1. A real hourly GitHub Actions run succeeds against the deployed site (needs the root workflow pushed).
2. Repository secrets `CRON_SECRET` and `ETF_MONITOR_BASE_URL` set by the user.
3. Saved hour persists and is shown on the deployed `/admin/cron`.
4. Production build applies migration `0007_cron_daily_claim` to Neon (DEC-023).
5. `scripts/claude/predeploy-check.sh` (bash) not run by me.

### Notes
- Lint reports 21 warnings, 0 errors (unused-arg style, same tolerated pattern as earlier stories).
- I did not inspect the migration SQL file directly; MG-7 and CL-10 passed and prove its expand-only content and indexes.

Verdict: PASS

Denied or attempted commands: none
