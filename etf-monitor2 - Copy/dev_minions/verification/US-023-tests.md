# US-023 test results — round 1

Verdict: PASS

## Test execution summary

All commands executed successfully:

| Command | Exit code | Summary |
|---------|-----------|---------|
| `pnpm install --frozen-lockfile` | 0 | Lockfile passes supply-chain policies; up to date, no install needed |
| `pnpm typecheck` | 0 | Compiled successfully |
| `pnpm lint` | 0 | 0 errors, 3 warnings (in unrelated existing files) |
| `pnpm test` | 0 | 93 test files passed, 1078 tests passed (no failures) |
| `env -u DATABASE_URL pnpm build` | 0 | Production build compiled successfully; Next.js 16.3.6 |

## Test files and test counts

Test files run for this story (all PASS):

- `lib/config/cron.test.ts`: 18 tests ✓
- `lib/config/cron.pglite.test.ts`: 9 tests ✓
- `lib/cron/vercel-config.test.ts`: 6 tests ✓ (modified: removed value-pin, added RD-1)
- `app/admin/cron/page.test.tsx`: 12 tests ✓
- `app/admin/cron/actions.test.ts`: 7 tests ✓
- `app/admin/cron/result-messages.test.ts`: 3 tests ✓
- `lib/config/boundaries.test.ts`: 15 tests ✓ (modified: added BC-7, BC-8)
- `app/admin/layout.test.tsx`: 7 tests ✓ (modified: added AL-4)
- `components/admin/ActionMessage.test.tsx`: 11 tests ✓ (modified: added AM-4)
- `i18n/messages.test.ts`: 4 tests ✓ (existing key-parity test, still passing)

**Total new / modified tests for US-023: 92 tests across 10 files, all passing.**

## Acceptance criteria mapped to tests

Each criterion references the test file, line number, and test name (the `it(...)` block text).

### AC1 — View the effective time

The page shows the daily schedule of the running build as an hour window in UTC. The test proves the value comes from `vercel.json` by reading the file with `fs` and comparing to `effectiveSchedule()`. A schedule that is not once a day shows a translated "unrecognised schedule" message, never a guessed hour.

**Tests:**
- `lib/config/cron.test.ts:16` — CP-1: parses whitespace-tolerant once-a-day schedules
- `lib/config/cron.test.ts:23` — CP-2: rejects anything that is not a plain once-a-day schedule
- `lib/config/cron.test.ts:51` — CP-3 (findDailySchedule): picks the /api/cron/daily entry among several
- `lib/config/cron.test.ts:67` — CP-5 (formatHourWindow): formats HH:00 / HH:59 windows
- `lib/config/cron.test.ts:114` — VJ-1 (effectiveSchedule): matches the repository's own vercel.json
- `app/admin/cron/page.test.tsx:43` — CG-1: effective window shown from the real vercel.json (0 10 * * * -> 10:00-10:59 UTC), match means no notice
- `app/admin/cron/page.test.tsx:69` — CG-4: an unrecognised schedule shows the raw string verbatim, no HH:00-HH:59 window in the effective element
- `app/admin/cron/page.test.tsx:80` — CG-4b: no matching cron entry (null) shows the message with no <code>

### AC2 — Adjust the desired hour

Saving an integer hour 0–23 sets `settings.cron_hour_utc`. Saving "not set" stores NULL. A PGlite test sets `ai_provider`, `ai_model` and `default_locale` first and finds them unchanged. With no `settings` row, saving creates row `id = 1`. Any other input (text, 24, -1, a decimal) returns a validation error and writes nothing.

**Tests:**
- `lib/config/cron.pglite.test.ts:21` — CS-1: saves the hour, leaves the other settings columns untouched
- `lib/config/cron.pglite.test.ts:38` — CS-2: with no existing row, save creates id=1 with the column defaults
- `lib/config/cron.pglite.test.ts:48` — CS-3: clearing the hour nulls only cron_hour_utc
- `lib/config/cron.pglite.test.ts:64` — CS-3b: hour 0 is stored as 0, not NULL (falsy trap)
- `lib/config/cron.pglite.test.ts:71` — CS-4: an invalid save leaves the row (or the empty table) unchanged
- `lib/config/cron.pglite.test.ts:82` — CS-5: getCronHour reflects saves, including 0
- `lib/config/cron.pglite.test.ts:90` — CS-6: an out-of-range stored value (no CHECK) reads as null
- `lib/config/cron.test.ts:134` — CV-1: accepts valid hours in several shapes
- `lib/config/cron.test.ts:152` — CV-2/CV-3: rejects invalid hours, zero runner calls

### AC3 — How the change reaches Vercel is stated

When the desired hour is set and differs from the effective hour, the page shows the exact line `"schedule": "0 <H> * * *"` and says the change takes effect after committing it to `vercel.json` and the next Production deployment. When they are equal, or no hour is set, there is no notice.

**Tests:**
- `lib/config/cron.test.ts:80` — CP-4 (suggestedScheduleLine): is the exact vercel.json line, minute always 0
- `lib/config/cron.test.ts:101` — CP-6 (scheduleChangeNeeded): returns true only when desired differs from effective
- `app/admin/cron/page.test.tsx:43` — CG-1: effective window shown, match means no notice
- `app/admin/cron/page.test.tsx:51` — CG-2: a mismatch shows the notice with the exact escaped vercel.json line and both notice strings
- `app/admin/cron/page.test.tsx:61` — CG-3: no stored hour means no notice
- `app/admin/cron/page.test.tsx:88` — CG-4c: unrecognised effective schedule with a desired hour still shows the notice
- `app/admin/cron/page.test.tsx:95` — CG-5: desired hour 0 produces the exact line with 0

### AC4 — Nothing else changes at runtime

Saving makes no network request (no Vercel API, no deploy hook), writes no file, and does not change the running job's schedule. The cron route (`/api/cron/daily`) does not read `cron_hour_utc`. A boundary test checks that `lib/config/cron.ts` imports no network or `fs` module.

**Tests:**
- `lib/config/boundaries.test.ts:103` — BC-7: cron.ts imports only the allowed specifiers (no fs, no network, no @vercel/*)
- `lib/config/boundaries.test.ts:116` — BC-8: app/api/cron/, lib/cron/ and lib/ingestion/ never reference cron_hour_utc or import config/cron
- `lib/config/cron.pglite.test.ts:103` — CS-8: no network call, effectiveSchedule() unaffected by a save
- `app/admin/cron/actions.test.ts:85` — CA-5: no network call during the action
- `app/admin/cron/page.test.tsx:144` — CG-10: no network call while rendering

### AC5 — Still one daily job

`vercel.json` still has exactly one cron entry for `/api/cron/daily`, with no other top-level key except the optional `$schema`. Its schedule is `M H * * *` with M in 0–59 and H in 0–23 (the existing shape test). The value pin `0 10 * * *` is removed and that shape test stays, because FR12 makes the hour adjustable.

**Tests:**
- `lib/cron/vercel-config.test.ts:15` — has exactly one cron entry for /api/cron/daily
- `lib/cron/vercel-config.test.ts:20` — the schedule is a once-a-day schedule: minute and hour are single numbers, the rest are *
- `lib/cron/vercel-config.test.ts:35` — has no other top-level key except the optional $schema

(The value-pin test "schedule is the Decided default (SPRINT-03-review #3)" was removed as planned, to reflect that FR12 makes the hour adjustable.)

### AC6 — README

README "Daily ingestion (cron)" describes the admin procedure (set the hour, copy the line into `vercel.json`, commit, push, Production only) and no longer says "Until US-023 ships…". The existing README checks in `vercel-config.test.ts` still pass.

**Tests:**
- `lib/cron/vercel-config.test.ts:57` — RD-1: README documents the US-023 admin procedure
- `lib/cron/vercel-config.test.ts:44` — no longer calls CRON_SECRET Reserved (existing, still passing)
- `lib/cron/vercel-config.test.ts:49` — documents the route, the schedule source, the auth header and Production-only cron (existing, still passing)

### AC7 — Bilingual

Every string (window, notices, notes, select labels, errors) goes through next-intl with keys in both catalogues, and the key-parity test passes. Render tests in `ro` and `en` show the locale's text and not the other's. The `vercel.json` line is shown verbatim in both.

**Tests:**
- `i18n/messages.test.ts` (line not specified in output) — existing key-parity test, still passing (4 tests total in file)
- `app/admin/cron/page.test.tsx:116` — CG-7: the hour select has exactly 25 options, none, then 0..23 in order
- `app/admin/cron/page.test.tsx:126` — CG-8: ro/en render translated notes, never leak the other locale's differing text
- `app/admin/layout.test.tsx` (AL-4 test line from grep: after test AL-3) — AL-4: renders the cron nav link (ro/en)
- `app/admin/cron/result-messages.test.ts:5` — CR-1: ok with a number -> cronSaved
- `app/admin/cron/result-messages.test.ts:9` — CR-1: ok with null -> cronCleared
- `app/admin/cron/result-messages.test.ts:13` — CR-1: invalid_hour
- `components/admin/ActionMessage.test.tsx` (AM-4 test from grep) — AM-4: renders the translated cronSaved / invalidHour messages (ro/en)

### AC8 — Failure states

A database read error still shows the effective schedule (it needs no database) and a translated message in place of the desired hour. A failing save returns a translated error. Neither contains exception text or an environment value.

**Tests:**
- `app/admin/cron/page.test.tsx:102` — CG-6: getCronHour throwing gives the translated load error, keeps the effective window, no secret text
- `app/admin/cron/page.test.tsx:88` — CG-4c is a secondary test (unrecognised + desired hour shows notice, no side effect)
- `app/admin/cron/actions.test.ts:65` — CA-4: a thrown secret-shaped error returns the generic error, never the message, never revalidates
- `app/admin/cron/actions.test.ts:78` — CA-4b: the deps factory throwing gives the same generic error state

### AC9 — Gates

No test connects to Neon or Vercel. `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` (with `DATABASE_URL` unset) pass, and the build embeds `vercel.json` without a runtime file read.

**Tests (commands run successfully, as shown in summary above):**
- `pnpm typecheck`: passed (0 errors)
- `pnpm lint`: passed (0 errors, 3 warnings in unrelated files)
- `pnpm test`: passed (93 files, 1078 tests)
- `env -u DATABASE_URL pnpm build`: passed (build embeds vercel.json at build time, no runtime `fs` read)
- `app/admin/cron/page.test.tsx:139` — CG-9: exports force-dynamic

All mocked tests confirm no connection to Neon or Vercel. The boundary test BC-7 confirms no fs or network imports in `lib/config/cron.ts`.

## Manual QA checklist (for Codex)

The plan specifies two MANUAL-QA items (not tested by unit/integration tests):

- **MQ-1 (user, deployed app + Neon + Vercel)**: sprint-05.md step 5 — change the cron hour in `/admin/cron`, verify the notice appears, edit `vercel.json` with the shown line, commit, push, verify Vercel cron jobs and the next run falls in the new hour. Not re-run.

- **MQ-2 (Codex QA, local serve)**: `/admin/cron` returns HTTP 200 in ro/en with effective window, load error in place of form when `DATABASE_URL` unset, no stack trace. Not re-run.

---

Denied or attempted commands: none
