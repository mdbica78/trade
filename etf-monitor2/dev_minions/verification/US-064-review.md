# US-064 — Independent review

## Round 1 — 2026-10-13

Verdict: PASS

Reviewer: `story-reviewer` subagent, fresh context, independent of the implementing session. Evidence
below is from files I read myself and commands I ran myself this round; HANDOVER's own narrative is
not cited as proof anywhere below. No git command was run (not even read-only).

### Scope check (nothing outside the claimed "Files changed" list)
Grepped the repo for the story's new symbols (`resolveBuildCronHour`, `buildDailyCron`,
`createVercelConfig`, `requestRedeploy`, `saveCronHourAndApply`, `bucharestWindowOfUtcHour`,
`cronHourResultToState`, `cronSavedApplying`/`cronSavedNotConfigured`/`cronSavedApplyFailed`) and cross
read `dev_minions/.files-touched.log` for the 2026-10-12 15:14–16:05 window: every touched file is on
HANDOVER's "Files changed" list, and every file on that list was touched in that window (plan file,
`cron-build.ts`/`.test.ts`, `boundaries.test.ts`, `cron.ts`/`.test.ts`/`.pglite.test.ts`, `vercel.ts`,
`vercel-config.test.ts`, `cron-apply.ts`/`.test.ts`/`.pglite.test.ts`, the four `app/admin/cron/*`
files + their tests, `CronAdmin.tsx`, `ActionMessage.test.tsx`, `daily-pipeline.pglite.test.ts`,
`README.md`, `.env.example`, `env-example.test.ts`, `data-model.md`, `load-error.boundary.test.ts`).
Confirmed by direct read that `vercel.json`, `.github/workflows/daily-ping.yml` and
`test/e2e/daily-ping-workflow.test.ts` no longer exist (deletions are not recorded by the touch-log
hook, as expected). No stray `effectiveSchedule`/`findDailySchedule`/`parseDailySchedule`/
`safetyNetHour`/`pingHeading`/`pingText`/`pingRule`/`safetyNet` reference remains anywhere in the
source tree outside test assertions that check for their *absence* (`app/admin/cron/page.test.tsx:91-94,127`,
`lib/config/cron.test.ts:35-39`). No scope creep found.

### Acceptance criteria

- **AC0 (spike S1):** `MANUAL-QA`. HANDOVER explicitly does not claim it passed ("do not claim AC0
  met until the user verifies the deployed build log"); the plan correctly scopes it as user-run. MET
  as a process matter (no agent over-claimed it).

- **AC1:** `MET`. `vercel.ts:7-12` `buildDailyCron(hour)` returns
  `{ path: DAILY_CRON_PATH, schedule: "0 ${hour} * * *" }` and throws `RangeError` via
  `!isHour(hour)` (`vercel.ts:8-10`). `DAILY_CRON_PATH` is imported from `cron-build.ts` and re-exported
  unchanged by `cron.ts:4,6`, so the two `DAILY_CRON_PATH` values are the same reference. Test:
  `lib/cron/vercel-config.test.ts` VC-1 (0/10/23), VC-1b (path identity), VC-2 (RangeError for
  `-1,24,7.5,NaN,Infinity,-Infinity,"7",null,undefined`) — ran and read directly, all present
  (`lib/cron/vercel-config.test.ts:12-29`).

- **AC2:** `MET`. `lib/config/cron-build.ts:62-104` `resolveBuildCronHour`: non-production or
  blank/missing `DATABASE_URL` → default with zero network/query (`:73-76`); NULL/invalid/missing row →
  default (`parseHourFromRows`, `:31-41`); SQLSTATE `42P01` → default at once, no retry (`:85-88`);
  any other error → sanitised log line, retry with injected `sleep`, throws after exactly
  `CRON_HOUR_QUERY_ATTEMPTS = 3` total attempts (`:78-103`) — this matches the plan's PL-1 "3 attempts
  total" reading of DEC-031 §2's "retry 3 times", a plan-level choice, not a criterion deviation.
  Connection string is never read: only `error.name`/`error.code` are touched, sanitised through
  regexes before ever reaching a log or thrown message (`:44-51`, `:89-94`, `:100-103`). Query and
  environment are both injected parameters (`CronHourQuery`, `BuildEnv`). Tests: I read
  `lib/config/cron-build.test.ts` CBH-1..CBH-10 in full and they cover every branch named above,
  including the secret-hygiene CBH-7/CBH-8 (sentinel URL/password/host never appear in the rejection
  message or any log line) and CBH-9 (the real `neon()` driver call shape). I additionally ran the
  whole suite (below) and this file passed.

- **AC3:** `MET`. `vercel.ts` exists at the project root (confirmed `ls`); `vercel.json` does not
  (confirmed `ls` → "No such file or directory"); `vercel.ts` imports only `./lib/config/cron-build`
  (`vercel.ts:1`, confirmed by VC-7's specifier-extraction test, which I also independently re-derived
  by reading the file). `lib/config/cron.ts` no longer defines/exports `effectiveSchedule`,
  `findDailySchedule` or `parseDailySchedule` — confirmed by direct read (no occurrence in the file)
  and by CE-6 (`lib/config/cron.test.ts:35-40`) asserting their absence from the imported module
  object, which is a stronger check than a source grep (it would catch a re-export too).
  `lib/cron/vercel-config.test.ts` is a full rewrite testing `vercel.ts`'s exports (VC-1..VC-8, VC-W1,
  VC-R1/VC-R2, RD-1) rather than the old `vercel.json` file — read in full, matches plan §3.1 exactly.
  No new dependency: VC-7b checks `package.json` for no `@vercel/*` key; I also grepped
  `package.json` myself and found none.

- **AC4:** `MET`. `lib/config/cron-apply.ts:12-40` `requestRedeploy`: blank/undefined URL →
  `not_configured`, fetch never called (`:18-20`); POST with `AbortSignal` and a 10s timeout via
  `AbortController`/`setTimeout`, always cleared in `finally` (`:24-39`); `response.ok` → `applying`;
  any other status → `failed` with one sanitised `console.error` line containing only the numeric
  status (`:31-32`); any throw/abort → `failed` with a sanitised-name-only log line, never the error's
  `message` (`:33-36`). `DEPLOY_HOOK_TIMEOUT_MS = 10_000` (`:4`). I read `lib/config/cron-apply.test.ts`
  RR-1..RR-7 in full: RR-5 uses fake timers and asserts still-pending at 9999ms, settled at 10000ms —
  a real timing proof, not a mock shortcut. RR-3/RR-4 scan the `console.error` spy for the sentinel
  token and find nothing. "Called only when the saved hour changed" is proven at the
  `saveCronHourAndApply` level by SA-2 (`cron-apply.pglite.test.ts:34-40`, real PGlite, `redeploy`
  never called when the hour is resaved unchanged) and at the action level by CA-5/CA-6 (unchanged
  default stub keeps fetch silent; a changed hour triggers it once). All read directly.

- **AC5:** `MET`. `saveCronHourAndApply` (`cron-apply.ts:51-70`): `getCronHour` read first, then
  `setCronHour` write, then `redeploy()` only if the hour actually changed, wrapped in its own
  try/catch that can only ever yield `apply:"failed"`, never propagate (`:63-68`) — so a hook failure
  can never undo or hide a successful save. Confirmed on real PGlite by SA-3 (hook `"failed"` → row
  still holds the new hour) and SA-4 (`redeploy` throws → row still saved, `apply:"failed"`) — both
  read in full (`cron-apply.pglite.test.ts:42-59`). Three new result-message states exist in both
  catalogues (`cronSavedApplying`/`cronSavedNotConfigured`/`cronSavedApplyFailed`, confirmed present
  in both `messages/en.json` and `messages/ro.json` via a direct `python3 json.load` read of this
  session, with sensible EN/RO text, not copy-pasted across locales) and are wired by
  `app/admin/cron/result-messages.ts:4-18` and rendered by `ActionMessage.test.tsx` AM-7
  (`:115-124`, both locales, `role="status"`).

- **AC6:** `MET`. `components/admin/CronAdmin.tsx` no longer renders a ping/rule/safety-net section
  (read in full, confirmed); it renders, in this order: heading, saved-hour line with Bucharest
  equivalent (`:46`), optional default note, the hour form (unchanged), the Hobby window sentence
  (`data-cron-window`, `:76-83`, using the new `bucharestWindowOfUtcHour`), `applyNote` (`:84`),
  `earlierHourNote` (`:85`), and the unchanged last-run section. All strings exist in both
  `messages/ro.json`/`en.json` (confirmed directly). `app/admin/cron/page.test.tsx` CG-4/CG-5/CG-6/
  CG-10/CG-13 (read in full) independently prove the old wording/keys are gone, the new sentences
  render in both locales, and `maxDuration === 30` (`page.tsx:10`, confirmed by direct read and by
  CG-13).

- **AC7:** `MET`. `.github/workflows/` is empty (confirmed `ls`, only `copilot-instructions.md` and
  `prompts/` remain under `.github/`); `test/e2e/` contains only `daily-pipeline.pglite.test.ts` and
  `fixture-web.ts` (confirmed `ls`, `daily-ping-workflow.test.ts` is gone). README's "Daily ingestion
  (cron)" section (read directly, `README.md:178-213`) documents the Vercel-native schedule, the
  Deploy Hook one-time step and the Hobby-window honesty note, with no remaining mention of
  `vercel.json`, "Setting up the hourly ping", `ETF_MONITOR_BASE_URL`, `daily-ping` or "GitHub
  Actions" (grepped myself). `.env.example` has the `VERCEL_DEPLOY_HOOK_URL=` line preceded by a
  comment block naming "Deploy Hook" and `/admin/cron` (confirmed by direct `grep -n -B4`).
  `lib/ai/env-example.test.ts` EX-4 (`:44-54`) asserts exactly this. The repo-root copy
  `../.github/workflows/etf-monitor2-daily-ping.yml` is outside the project folder and untouched by
  this story (not checked by me — out of scope by the story's own wording, and not readable from
  inside this project's sandbox-relevant path in any case); HANDOVER correctly lists it as a user
  step, not an agent action.

- **AC8:** `MET`. I ran the full suite myself (see Gates below): every pre-existing route/handler/
  gate/claim/e2e test passed unchanged in the same run as the new US-064 tests. I additionally read
  `test/e2e/daily-pipeline.pglite.test.ts`'s new **DP-5** (`:427-446`) in full: it saves hour 14 via
  the real `setCronHour`, then drives the real `handleDailyCron`/`createDailyCronDeps` through the
  unmocked gate at 10:05 UTC (old schedule's firing window) and gets
  `{skipped:"not_scheduled_hour"}` with zero fetch calls and zero `job_runs` rows, then at 14:00 UTC
  gets a real run (`jobRunId` a number, one `job_runs` row). This is exactly the DEC-031 §4
  "redeploy-window gap" scenario named in the story, proven end-to-end rather than mocked. DP-0..DP-4
  were read for edit markers (only DP-5 was inserted; the other tests are textually unchanged) and all
  ran green in the same full-suite pass.

- **AC9:** `MET`, independently reproduced in this review round:
  - `pnpm typecheck` (DB/CRON_SECRET/VERCEL_ENV/AI_KEY_MASTER_KEY/VERCEL_DEPLOY_HOOK_URL unset): **0
    errors**.
  - `pnpm lint` (same env): **0 errors, 21 warnings** — I read the full warning list myself; none is
    new or related to this story (same pre-existing `_name`-prefixed unused-arg style, same file set
    as the last several stories' baseline).
  - `pnpm test` (same env, full run, no `--tail`/truncation this time): **267 files / 2967 tests, all
    green**, `Start at 16:39:01`, `Duration 542.30s` — matches HANDOVER's claimed count exactly. I
    watched it run to completion rather than trusting a partial/background excerpt.
  - `pnpm build` (same env, offline): **exit 0**; `migrate-on-deploy: skipped (not a production
    build)`; all 12 dynamic routes listed including `/admin/cron` and `/api/cron/daily`; and
    `grep -c "\[vercel.ts\]" build.log` → **0**, confirming the offline build never executes
    `vercel.ts` (it is only type-checked, per the static VC-8 test which I also read in full —
    it scans `app/`, `components/`, `lib/`, `i18n/`, `next.config.ts`, `drizzle.config.ts` and the
    `build` script for any specifier reaching the root `vercel` module, and found none).

### Boundaries / non-negotiables (AGENTS.md)
- `lib/config/cron-build.ts` imports only `@neondatabase/serverless` — confirmed by direct read and
  by `BC-13` (`lib/config/boundaries.test.ts:190-199`), which I also read and ran.
- `lib/config/cron-apply.ts` imports only `./cron` — confirmed by direct read and `BC-14`
  (`:201-210`).
- The existing `BC-8` guard (only `lib/cron/default-deps.ts` may read `cron_hour_utc`/import
  `config/cron` from `app/api/cron`, `lib/cron`, `lib/ingestion`) is untouched and still passes — I
  read it (`:212-236`) and it is unmodified from what the plan calls "unchanged" (AC8).
- Every UI string goes through next-intl in both `ro` and `en` — confirmed directly for all new keys
  (`Admin.cron.window/applyNote/earlierHourNote`, `Admin.messages.cronSaved*`).
- No secret in code or logs: the Deploy Hook URL is read only in `app/admin/cron/actions.ts`
  (`process.env.VERCEL_DEPLOY_HOOK_URL`, `actions.ts:19`) and passed as a parameter; `cron-build.ts`
  never reads `process.env` itself (env is injected; only `vercel.ts:22` reads
  `process.env.VERCEL_ENV`/`DATABASE_URL`, exactly where DEC-031 says it should). No test was
  weakened: the deleted `test/e2e/daily-ping-workflow.test.ts` guarded an artefact (the GitHub
  workflow + `vercel.json`) that AC3/AC7 themselves delete — its replacement guards (VC-W1/VC-R1/
  VC-R2) are present and I read them. The `LB-E5` allowlist change
  (`app/load-error.boundary.test.ts:148-156`) is a correct, narrow widening (one new legitimate
  `console.error` call site in `cron-apply.ts`, per DEC-031 §3's own log-line wording) — not a
  loosening of the rule that `app/**` stays console-free, which the same test still checks and which
  I confirmed by reading `cron-apply.ts` (its two `console.error` lines are in `lib/`, not `app/`).

### Findings

No Critical, no Warning.

**Note (non-blocking):** `vercel.ts` and a few other story files show `rwxrwxrwx` permissions in this
WSL/Windows-mount checkout; this is a pre-existing filesystem quirk of this environment (every file on
this mount shows the same permissions) and not something introduced by this story or a security
concern for a server-side-only secret path.

**Note (non-blocking):** `bucharestWindowOfUtcHour`'s `start`/`end` are plain `"HH:MM"` strings with
no date component; at the rare DST-transition hour the "end" wall-clock label could nominally read
earlier than "start" (e.g. the one hour a year the clocks fall back). The function is only used for a
cosmetic, non-authoritative UI sentence (the actual gate logic is untouched, UTC-only, AC8), and the
existing `CE-4`/`CE-3` tests already exercise both DST sides at the normal (non-transition) hour, so
this is a cosmetic edge case worth a future test, not a functional defect.

### Files changed — scope confirmed
Matches HANDOVER's "Files changed (US-064)" list exactly, cross-checked against
`dev_minions/.files-touched.log` and direct existence/content checks for every new, changed and
deleted file named there. No file outside that list was found to carry a US-064 symbol.

Denied or attempted commands: none.
