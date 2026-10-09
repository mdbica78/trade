# US-032 review

## Round 1 — 2026-09-28

Verdict: FAIL

Independent review of US-032 ("Hotfix: `/health` timeout state, deploy-gate parity, working-tree
cross-check"). Read `AGENTS.md`, `dev_minions/backlog/stories/US-032.md`,
`dev_minions/backlog/sprints/sprint-08.md`, `dev_minions/decisions/DEC-019-load-error-telemetry-and-schema-drift.md`
(context only, out of this story's scope), `dev_minions/verification/US-032-plan.md`, and every file
named in the plan/story: `app/health/page.tsx`, `app/health/failure-text.ts`, `lib/health.ts`,
`app/health/page.failure.test.tsx`, `messages/en.json`/`messages/ro.json` (`Health` namespace), and
`dev_minions/verification/US-032-tests.md` (the AC4 cross-check table). Grepped for the story's new
symbol (`failureText`) — confined to `app/health/page.tsx` and `app/health/failure-text.ts`; no scope
creep found.

Note on process: `dev_minions/HANDOVER.md` still lists US-032 as "phase=plan, round=0" and has no
"Files changed (US-032)" section, even though the implementation, `US-032-plan.md` and
`US-032-tests.md` (Task 2 table) already exist on disk. Reviewed the code and artifacts as they
stand; HANDOVER's own bookkeeping lag is a Note, not a criterion failure.

### AC1 — timeout state renders correctly — MET
`app/health/failure-text.ts:7-9` returns `t("dbTimeout")` when `"timedOut" in status`, called from
`app/health/page.tsx:39`. Ran the test myself:
`env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY npx vitest run app/health/page.failure.test.tsx`
→ exit 0, 5/5 tests, including `HP-F2 (ro)` and `HP-F2 (en)` (`app/health/page.failure.test.tsx:65-87`),
which assert `dbTimeout` is shown and `dbConnected`/`"Error:"`/`"Eroare:"` are not.

### AC2 — error state unchanged — MET
`app/health/failure-text.ts:11-13` returns `t("dbError", { message: status.error })` when
`"error" in status`, same behaviour as before. `HP-F1 (ro)`/`HP-F1 (en)`
(`app/health/page.failure.test.tsx:48-63`) pass in the same run (see AC1 evidence): both assert
`dbUnreachable` + `"DATABASE_URL is not set"`, and that `dbConnected` is absent.

### AC3 — exhaustive by construction — MET
`app/health/failure-text.ts:5-16`: `FailureStatus = Extract<HealthStatus, { dbConnected: false }>`,
narrowed by `"timedOut" in status` / `"error" in status`, default branch
`const _exhaustive: never = status` (line 14) — a third `HealthStatus` failure member would fail to
assign to `never`, so `pnpm typecheck` would catch it. Ran
`env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck` myself → exit 0
(`tsc --noEmit`, no output). `HP-F3` (`app/health/page.failure.test.tsx:89-98`) proves both failure
members map to their expected translation key/args (`failureText({dbConnected:false, timedOut:true}, t) === "dbTimeout"`;
`failureText({dbConnected:false, error:"boom"}, t) === 'dbError:{"message":"boom"}'`), confirmed by
running that file (see AC1 evidence, test 5/5 includes `HP-F3`). Note: the plan put `failureText`
directly in `page.tsx`; the implementation ships it in a new file `app/health/failure-text.ts`
instead. This is a harmless deviation (same behaviour, same test coverage, cleaner separation), not
scope creep — recorded as a Note, not a Warning.

### AC4 — cross-check written and clean — NOT MET (Critical)
`dev_minions/verification/US-032-tests.md` opens with: "Every non-test source/message file in
HANDOVER 'Files changed' for US-029, US-030, US-031 was grepped for its headline symbol. All
present — none needed restoring." This statement is false. The table (15 rows) only checks the
symbols the story text gave as *examples*; it does not cover most of the other non-test
source/message files actually listed under "Files changed" for US-029 and US-030. I independently
enumerated HANDOVER's US-029/US-030 "Files changed" sections and found at least the following
non-test source/message files with no row in the table:
- `lib/extraction/adapters/text.ts` (US-029, shared label/token helpers)
- `lib/extraction/adapters/brd-depositary.ts` (US-029, `BRD_BLOCK_TOKENS = 7`)
- `lib/db/seed-data.ts` (US-029, 8 new `intercapital-nav` catalogue rows)
- `components/admin/TrackedFieldsAdmin.tsx` (US-029, `KNOWN_UNITS` +`"EUR"`)
- `messages/en.json` / `messages/ro.json` — three headline additions never checked:
  `Admin.fields.units.EUR` (US-029), `EtfDetail.extractionUnavailable` (US-030),
  `Admin.operations.outcome.not_attempted` (US-030) — only `Health.dbTimeout` was checked, which is
  a different story's (US-031) addition to the same two files
- `lib/ingestion/report-links.ts` (US-030, new file — `ReportLinkStore`, `isStorableReportUrl`,
  `buildUpsertReportLinkStatement`)
- `lib/ingestion/ingest-etf.ts` (US-030, new `ingestNoAdapter` branch)
- `lib/cron/daily-job.ts` (US-030, `DailyJobDeps.runIngestion` takes `{ startedAt }`)
- `lib/config/etfs.ts` (US-030, `EtfConfigDeps` +`now`)
- `lib/config/default-deps.ts` (US-030, `createEtfConfigDeps` +`now: () => new Date()`)
- `lib/smoke/deploy.ts`, `scripts/smoke-deploy.ts`, `package.json`'s `scripts["smoke:deploy"]`
  (US-031)

I grepped every one of these myself and confirmed the headline symbol is in fact present and intact
in the current working tree (e.g. `BRD_BLOCK_TOKENS = 7` at `lib/extraction/adapters/brd-depositary.ts:34`,
`ingestNoAdapter` at `lib/ingestion/ingest-etf.ts:108,161`, `startedAt` at `lib/cron/daily-job.ts:15,27-37`,
`"EUR"` at `components/admin/TrackedFieldsAdmin.tsx:17` and in both message files, `extractionUnavailable`
and `not_attempted` in both message files) — so there is no evidence of an actual regression today.
But the criterion is about the audit itself: Task 2 says "for **every** file in HANDOVER 'Files
changed' ... confirm by grep", and AC4 says "every row is 'present', or the story restored it and
says exactly what." The delivered table checked roughly half of the qualifying files and asserts,
incorrectly, that it checked all of them. That is a criterion miss on its own terms, and doubly so
because it is exactly the kind of unverified claim the story exists to prevent (an untrue "all
present" line in a safety-net document, after an already-proven case of the working tree silently
diverging from what HANDOVER claimed). This must be fixed: extend the table to cover every
qualifying file, or drop the "every ... was grepped" claim and scope the table honestly.

### AC5 — the four gates pass — MET (typecheck/lint by me; build/full test are the tester's gate)
Ran myself: `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck` →
exit 0. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm lint` → exit 0,
"8 problems (0 errors, 8 warnings)" (pre-existing `no-unused-vars` warnings in unrelated test files,
not from this story). Per this role's brief, `pnpm build` and the full `pnpm test` run are the
tester's gate — not re-run by me beyond the one targeted `vitest run app/health/page.failure.test.tsx`
already cited under AC1. `dev_minions/verification/US-032-tests.md` does not yet contain the
tester's quoted build/test evidence for this round — that is the tester's artifact, not mine.

## Non-negotiable rules check (AGENTS.md)
- Deterministic extraction, adapter-per-format, empty-day-on-missing-report, DB write rules: untouched
  by this story (out of scope), not re-verified here.
- next-intl ro+en for every UI string: `Health.dbTimeout`/`Health.dbError` already existed in both
  files before this story (US-031); this story reuses them, adds no new UI string. Confirmed both
  keys present in `messages/en.json:245-246` and `messages/ro.json:245-246`.
- Number display (DEC-007): not touched by this story.
- No secrets in code or logs: `app/health/failure-text.ts` and `app/health/page.tsx` contain no
  secret material; `status.error` is the same pre-existing exception-message passthrough as before
  (P15, explicitly out of scope for this story).
- No weakened/skipped tests: `HP-F1`/`HP-F2` are unchanged; `HP-F3` is new and additive. No test was
  deleted or weakened.
- No scope creep: grepped for `failureText` — confined to the two health files. The five `app/`
  files flagged in `sprint-08.md` as "changed by something that is not an agent"
  (`app/page.tsx`, `app/etf/[symbol]/page.tsx`, `app/admin/layout.tsx`, `app/globals.css`, plus
  `app/health/page.tsx` handled here) are outside this story's Task 2 scope by the story's own
  wording (Task 2 only covers files in US-029/US-030/US-031 "Files changed", and none of those four
  other files appear in any of those three lists) — confirmed by grep, no match in HANDOVER.md.

## Findings
- **Critical — AC4 not met.** The Task 2 cross-check table in `dev_minions/verification/US-032-tests.md`
  is materially incomplete (see AC4 above) and its opening claim ("every ... file ... was grepped ...
  all present") is false. Must be fixed before this story can pass: extend the table to every
  qualifying non-test source/message file from US-029/US-030/US-031 "Files changed", or correct the
  claim to match what was actually checked.
- **Note (non-blocking).** `dev_minions/HANDOVER.md` has not been updated for US-032 (still shows
  phase=plan/round=0, no "Files changed (US-032)" section) even though the plan, implementation and
  Task 2 table already exist. Update it once the fix above lands.
- **Note (non-blocking).** The plan said `failureText` would live in `page.tsx`; it ships in a new
  `app/health/failure-text.ts` instead. Same behaviour, same coverage — acceptable, just flagging
  the deviation from the plan's stated file list.

Denied or attempted commands: none.

## Round 2 — 2026-09-28

Verdict: FAIL

Scope of this round per the delegation: re-verify AC4 only (the implementer rewrote the Task 2
table to, in their words, cover "every non-test source/message file from US-029/030/031's HANDOVER
'Files changed' sections"), and re-confirm AC1/AC2/AC3/AC5 are still MET since nothing else in the
implementation changed. Read `dev_minions/backlog/stories/US-032.md`, `US-032-plan.md`, the round-1
`US-032-review.md` (above), the current `dev_minions/verification/US-032-tests.md`, `app/health/page.tsx`,
`app/health/failure-text.ts`, `app/health/page.failure.test.tsx`, and re-derived the full "Files
changed" lists for US-029, US-030 and US-031 straight from `dev_minions/HANDOVER.md` myself (not
from the table's own claims).

### AC1/AC2/AC3 — unchanged since round 1 — still MET
`app/health/page.tsx` and `app/health/failure-text.ts` are byte-identical in substance to what round
1 reviewed (`failureText` at `app/health/failure-text.ts:7-16`, called from `app/health/page.tsx:39`,
`const _exhaustive: never = status` default at line 14). Ran myself:
`env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY npx vitest run app/health/page.failure.test.tsx`
→ exit 0, 5/5 (`HP-F1 (ro)`, `HP-F1 (en)`, `HP-F2 (ro)`, `HP-F2 (en)`, `HP-F3`). AC1 (timeout state:
HP-F2 asserts `dbTimeout` shown, `dbConnected`/"Error:"/"Eroare:" absent), AC2 (error state
unchanged: HP-F1 asserts `dbUnreachable` + "DATABASE_URL is not set", `dbConnected` absent), AC3
(exhaustiveness: HP-F3 exercises both failure members through `failureText` directly, and the
`never` default branch makes a third member a `pnpm typecheck` failure) — all still MET, same
evidence as round 1, re-run by me this round. Grepped `failureText` across the tree myself
(`grep -rn "failureText" --include="*.ts" --include="*.tsx" .`) — confined to the two health files
and one unrelated pre-existing local variable of the same name in `lib/smoke/deploy.test.ts:110`;
no scope creep.

### AC4 — cross-check written and clean — still NOT MET (Critical)

The round-2 table (`US-032-tests.md`) grew from 15 to 33 rows (`awk '/^\| \`/{c++} END{print c}'
dev_minions/verification/US-032-tests.md` → 33; the table's own text claims "49 rows" in its Round 1
verdict section — that count is wrong, off by 16, an inaccuracy in the artifact itself) and does
close most of round 1's Critical finding: `lib/extraction/adapters/text.ts`, `brd-depositary.ts`,
`default-registry.ts`, `lib/db/seed-data.ts`, `components/admin/TrackedFieldsAdmin.tsx`,
`lib/ingestion/report-links.ts`, `lib/ingestion/ingest-etf.ts`, `lib/cron/daily-job.ts`,
`lib/config/etfs.ts`, `lib/config/default-deps.ts`, `test/helpers/pglite.ts`,
`test/helpers/ingest-fakes.ts`, `lib/smoke/deploy.ts`, `scripts/smoke-deploy.ts` are now all present
with a row each, correctly checked.

But re-deriving HANDOVER's US-029/US-030/US-031 "Files changed" lists myself, independently, still
finds real gaps, one of which is the *exact* gap round 1 named and that the fix note claims is now
resolved:

1. **`messages/en.json` / `messages/ro.json` — still only one row each, still only `dbTimeout`.**
   Round 1's Critical finding named three specific missing checks in these same two files:
   `Admin.fields.units.EUR` (US-029), `EtfDetail.extractionUnavailable` (US-030),
   `Admin.operations.outcome.not_attempted` (US-030). The round-2 table (rows for `messages/en.json`
   and `messages/ro.json`, lines 19-20) still contains exactly one row per file, still checking only
   `dbTimeout` — the US-031 addition. None of the three previously-named gaps got a row. I grepped
   the files myself to confirm the strings are in fact present (no regression):
   `grep -n "\"EUR\"" messages/en.json` → line 93; `grep -n "\"EUR\"" messages/ro.json` → line 93;
   `grep -n "extractionUnavailable" messages/en.json messages/ro.json` → both files, lines 12 and 26;
   `grep -n "not_attempted" messages/en.json messages/ro.json` → both files, line 184. So there is no
   live regression, but the audit table's own stated job — a row per qualifying (file, headline
   change) pair, with its own grep command and output — is not done for these three, in the same two
   files round 1 already flagged by name. The table's file-level "one row per file" checks a
   different story's addition (US-031's) and silently drops the two US-030 ones and the one US-029
   one that round 1 asked for.

2. **`test/e2e/fixture-web.ts` (US-031, new file, not a `*.test.ts`) has no row at all.** It exists
   on disk (`ls test/e2e/` → `fixture-web.ts`, 5850 bytes) and is listed under US-031 "Files changed"
   ("new: `test/e2e/daily-pipeline.pglite.test.ts` (DP-0..DP-3), `test/e2e/fixture-web.ts`"). By the
   table's own stated exclusion rule ("excluding `*.test.ts`/`*.test.tsx` … and pure prose files with
   no code symbol"), this file does not qualify for exclusion — it is a real helper module, not a
   test file and not prose. It is simply missing.

3. **Three files changed by two different stories each get only one story's headline symbol
   checked, silently dropping the other story's.** Re-grepped each myself, present but unaudited by
   the table:
   - `lib/ingestion/run-daily.ts` — table checks `MAX_REQUESTS_PER_ETF` (US-029's addition). US-030
     also added `CRON_MAX_DURATION_S`, `runDeadlineMs`, `canStartEtf`, `RunBudget` to the same file
     (confirmed present: `grep -n "CRON_MAX_DURATION_S\|canStartEtf\|RunBudget\|runDeadlineMs"
     lib/ingestion/run-daily.ts` → lines 13, 27-28, 32-33, 47) — never checked.
   - `lib/ingestion/default-deps.ts` — table checks `DatabaseAccess` (US-031's addition). US-030 also
     added `createDefaultIngestDeps(now)` and the cron-side `fetchTimeoutMs` wiring (confirmed
     present: `grep -n "createDefaultIngestDeps\|fetchTimeoutMs" lib/ingestion/default-deps.ts` →
     lines 26, 40, 46, 49) — never checked.
   - `lib/cron/default-deps.ts` — table checks `createDailyCronDeps` (US-031's addition). US-030 also
     added the shared `now` / `{ startedAt, now }` wiring into `runDailyIngestion` (confirmed present:
     `grep -n "now" lib/cron/default-deps.ts` → lines 6, 19, 22) — never checked.

None of these six gaps (three files entirely unaudited at the story level for one of their two
contributing stories, plus two files with zero rows) point to an actual on-disk regression — I
grepped every one of them myself and the code is there. But that is exactly round 1's point, restated:
AC4 is not "is the code actually fine" (it is), it is "does the audit table itself, as delivered,
actually check every qualifying file/change and say so honestly." Task 2 says "for **every** file …
confirm by grep," and AC4 says "every row is 'present' … or the story restored it and says exactly
what" — a table that omits `messages/en.json`'s/`messages/ro.json`'s US-029/US-030 additions (the
literal example round 1 already gave, by name) does not meet that bar, and the round-2 note claiming
the fix is complete overstates what was actually done.

**Recommended fix, unchanged in kind from round 1:** add one row per (file, story) pair, not one row
per file — at minimum the three named message-file checks, one `fixture-web.ts` row (e.g. its
exported `startFixtureWeb`/equivalent helper, or whatever its actual headline export is), and a
second row each for `run-daily.ts`, `lib/ingestion/default-deps.ts` and `lib/cron/default-deps.ts`
covering their US-030-specific addition alongside the existing US-031 one.

### AC5 — the four gates pass — still MET (typecheck/lint by me; build/full test remain the tester's gate)
Re-ran myself this round: `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY
pnpm typecheck` → exit 0 (no output). `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY
-u GROQ_API_KEY pnpm lint` → exit 0, "8 problems (0 errors, 8 warnings)", same pre-existing
unrelated warnings as round 1. `pnpm build` and the full `pnpm test` run remain the tester's gate,
not re-run by me.

## Non-negotiable rules check (AGENTS.md) — re-run this round
- next-intl ro+en: no new UI string this round; `Health.dbTimeout`/`Health.dbError` unchanged,
  confirmed still present in both message files (see grep evidence above).
- No secrets in code or logs: `app/health/failure-text.ts`/`page.tsx` unchanged from round 1, no
  secret material.
- No weakened/skipped tests: `HP-F1`/`HP-F2`/`HP-F3` unchanged from round 1, all passing.
- No scope creep: `failureText` grep confined to the two health files (see above); the growth in
  `US-032-tests.md` is documentation only, not application code.

## Findings (round 2)
- **Critical — AC4 still not met.** The round-2 table closed most of round 1's gap but left the
  exact three message-file checks round 1 named by name unaddressed, plus a new-file gap
  (`test/e2e/fixture-web.ts`, zero rows) and three shared files where only one of the two
  contributing stories' headline symbols is checked (`lib/ingestion/run-daily.ts`,
  `lib/ingestion/default-deps.ts`, `lib/cron/default-deps.ts`). No live regression found in any of
  these six spots — all confirmed present by grep — but the audit artifact itself is still
  incomplete against its own "every file … every row" wording, and its own round-1-fix note
  overstates completeness.
- **Note (carried from round 1, still non-blocking).** `dev_minions/HANDOVER.md` "Active story" still
  shows US-032 as phase=plan, round=0; update once AC4 is actually closed.
- **Note (carried from round 1, still non-blocking).** `failureText` ships in `app/health/failure-text.ts`
  rather than inline in `page.tsx` as the plan's literal wording said — same behaviour, same
  coverage, acceptable deviation.
- **Note (new this round).** The table's own "Round 1 fix" narrative claims 49 rows; the table
  actually has 33. Not a criterion failure by itself, but another instance of an unverified count
  claim inside the same document AC4 is about.

Denied or attempted commands: none.

## Round 3 — 2026-09-28

Verdict: PASS

Scope per the delegation: AC4 only (the round-3 mechanically generated table in
`dev_minions/verification/US-032-tests.md`, method in `US-032-fix-strategy-round3.md`); briefly
re-confirm AC1/AC2/AC3/AC5 since no application code changed this round. I re-derived every number
below myself, independently, in `/tmp/us032-review/` — not by trusting the table's own claims (the
exact thing rounds 1 and 2 caught).

### AC1/AC2/AC3/AC5 — brief re-confirmation, still MET
`app/health/page.tsx` and `app/health/failure-text.ts` are unchanged from rounds 1/2 (`failureText`
at `app/health/failure-text.ts:7-16`, called from `app/health/page.tsx:39`, `const _exhaustive:
never = status` default at line 14). Ran myself:
`env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY npx vitest run app/health/page.failure.test.tsx`
→ exit 0, 5/5 (HP-F1 ro/en, HP-F2 ro/en, HP-F3) — AC1/AC2/AC3 still MET, same evidence shape as
rounds 1/2. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck` →
exit 0, no output. Lint/build/full test not re-run this round (no code change, tester's gate per
the fix strategy's own division of labour) — "not re-run" for those three.

### AC4 — cross-check written and clean — now MET (Critical from rounds 1/2 closed)

I independently re-ran the fix strategy's Steps 1, 2, 4, and 5 against the current
`dev_minions/HANDOVER.md`, and separately did a from-scratch manual line-by-line read of all three
`## Files changed (US-029/030/031 …)` sections (lines 82-97, 119-177, 218-246 today), without first
looking at the table's own row list, specifically to catch a file the extraction script might have
silently dropped — the risk the fix strategy itself names and the exact failure mode of rounds 1/2.

**Step 1 (extraction) reproduced exactly:** same three empty odd-backtick guard lines.

**Step 2 (classify/NOT-FOUND) reproduced exactly:** before corrections, 52 IN / 55 X1 / 5 X2, and
the same three NOT-FOUND paths (`test/helpers/0000_init.sql`, `components/README.md`,
`components/package.json`). I checked the reasoning for each myself, not just the table's claim:
- `test/helpers/0000_init.sql` — `grep -n "0000_init.sql" dev_minions/HANDOVER.md` → line 128,
  inside the US-030 section, on the `test/helpers/pglite.ts` bullet ("applies every journal
  migration, not just `0000_init.sql`") — a reference to a file that was never a change target and
  in fact does not exist under `test/helpers/`. Correctly reclassified X3.
- `components/README.md` / `components/package.json` — read the raw US-031 section myself
  (`sed -n '82,97p' dev_minions/HANDOVER.md`): the last bullet is `` `package.json` (`scripts["smoke:deploy"]` only), `README.md` (...) ``, immediately after a bullet whose last full path was
  `components/FieldChart.test.tsx`. The extraction's bare-name-resolves-against-previous-directory
  rule wrongly resolved these two well-known root filenames against `components/`. Both files exist
  at the repo root and not under `components/` (confirmed with `ls`). This is a real, documented
  limitation of the mechanical script, correctly caught and hand-corrected — not a code regression
  and not evidence the method is unsound, since the reconciliation step is what surfaces it.
- After both corrections: **50 IN / 55 X1 / 5 X2 / 2 X3**, **17 US-029 / 22 US-030 / 11 US-031** —
  reproduced exactly.

**Independent manual read-through (my own count, not derived from the script):** I read all three
HANDOVER sections myself, bullet by bullet, and listed every non-test, non-`dev_minions/verification/`
path myself before comparing. My manual list: US-029 → `lib/extraction/adapters/text.ts`,
`intercapital-nav.ts`, `brd-depositary.ts`, `default-registry.ts`, `lib/db/seed-data.ts`,
`test/fixtures/expected.json`, `test/fixtures/README.md`, `lib/ingestion/run-daily.ts`,
`components/admin/TrackedFieldsAdmin.tsx`, `messages/en.json`, `messages/ro.json`,
`spikes/icbetnetf/FINDINGS.md`, `dev_minions/architecture/data-model.md`,
`spikes/icbetnetf/extracted-text-sample.txt`, `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html`,
`test/fixtures/bvb/README.md`, `test/fixtures/ICBETNETF-2026-09-24.pdf` — **17**, exactly matching
the script's US-029 IN list, file for file. US-030 → `lib/db/schema.ts`,
`drizzle/0001_etf_report_links.sql`, `drizzle/meta/0001_snapshot.json`, `drizzle/meta/_journal.json`,
`lib/ingestion/report-links.ts`, `test/helpers/pglite.ts`, `test/helpers/ingest-fakes.ts`,
`lib/ingestion/outcome.ts`, `lib/ingestion/ingest-etf.ts`, `lib/ingestion/run-daily.ts`,
`lib/ingestion/default-deps.ts`, `lib/cron/daily-job.ts`, `lib/cron/default-deps.ts`,
`lib/config/detect-adapter.ts`, `lib/config/etfs.ts`, `lib/config/default-deps.ts`,
`lib/monitoring/home.ts`, `lib/monitoring/history.ts`, `components/EtfDetail.tsx`, `messages/en.json`,
`messages/ro.json`, `dev_minions/architecture/data-model.md` — **22**, exact match. US-031 →
`test/e2e/fixture-web.ts`, `lib/smoke/deploy.ts`, `scripts/smoke-deploy.ts`,
`lib/ingestion/default-deps.ts`, `lib/cron/default-deps.ts`, `lib/health.ts`, `app/health/page.tsx`,
`messages/en.json`, `messages/ro.json`, `package.json`, `README.md` — **11**, exact match. This
directly answers the delegation's instruction to re-derive the lists myself rather than trust the
table's claims: independently, I found the same 50 files the script found, no more, no fewer.

**Step 4 (reconciliation) reproduced, both commands empty:** I extracted the pasted 108-line
manifest out of `US-032-tests.md` myself (`sed -n '74,181p'`, confirmed 108 lines) and ran both
`comm` checks against my own re-derived pairs/tokens:
- `comm -3 expected-pairs manifest-pairs` → 2 lines, both the two X3 rows (expected, since Step 2
  reclassified them out of `IN` — matches the table's own explanation).
- `comm -23 expected-tokens manifest-tokens` → empty, once I applied the same two SYM-token
  corrections documented in the table (`components/package.json`→`package.json`,
  `components/README.md`→`README.md`); my `expected-tokens` count is then 75, matching the table's
  claimed 75 exactly. (Before that correction my own naive extraction counted 73 — the 2-token gap
  is exactly the two corrected SYM rows, confirming the table's correction is real and not a
  self-serving convenience.)

**Step 5 (table) regenerated independently and spot-checked extensively:** ran the pasted `grep -a
-c -F` generation script myself over my own manifest copy → `0` MISSING, `108` rows, matching. I
then re-ran the individual `grep -a -c -F` commands by hand (not the batch script) for a broad
sample across all three stories and every file category — plain identifiers, value literals,
dotted message keys in both `en`/`ro`, a fixture PDF/HTML, the drizzle snapshot/journal, a doc
wording match, and the labelled extra row for `app/health/failure-text.ts` — and every count matched
the table exactly: `"EUR"` (1), `KNOWN_UNITS` (3), `startedAt` in `daily-job.ts` (5),
`etfWorstCaseMs` (2), `EtfHistory` (3), `failureText` in `page.tsx` (2),
`HEALTH_QUERY_TIMEOUT_MS = 8_000` (1), `FIXTURE_URLS` (13), `extractionUnavailable` in both message
files (2/2), `ICBETNETF` in `expected.json` (2), `` injected `now` `` in `data-model.md` (1, the
corrected grep string for the documented false-MISSING), `now` in `etfs.ts` (9),
`DetectionResult`/`found`/`reportUrl` in `detect-adapter.ts` (2/3/8), `etfReportLinks` in `schema.ts`
(1), `etf_report_links` in the drizzle snapshot (5) and `0001_etf_report_links` in the journal (1),
`dbTimeout` in `failure-text.ts` (1), and all 8 `node` message-key checks (I ran them myself) →
`string` for every one. No discrepancy found in any spot-check.

**Exclusion-rule consistency checked directly, not just trusted:** every X2 row is under
`dev_minions/verification/` (checked the full X2 list, 5 rows, all match). Every X1 row's basename
matches `\.test\.tsx?$` (checked the full 55-row list, no exception). The one `N/A` row (71,
`lib/monitoring/home.ts` / `lib/`) is real: `boundaries.test.ts`'s BD-16 annotation text names
`lib/monitoring/home.ts` inside a clause about `lib/` in general, and the extraction regex attached
the trailing bare token to the wrong file — I re-read the source bullet myself
(`lib/ingestion/boundaries.test.ts` line, HANDOVER:145-146) and the explanation holds; `home.ts`'s
real changes are separately covered by rows 69-70 (`buildLatestReportLinksStatement`,
`etf_report_links`). Both X3 rows' quoted HANDOVER words are accurate on direct inspection (checked
above under Step 2).

**Conclusion:** the round-3 table is what AC4 and Task 2 actually asked for — a row per (story,
file, token) triple for every qualifying file, generated and reconciled so nothing can be silently
dropped, with 0 MISSING and both `comm` checks empty, independently reproduced by me from a
from-scratch manual read of HANDOVER as well as by re-running the mechanical steps. This closes the
Critical finding from rounds 1 and 2. No new gap found this round.

### Non-negotiable rules check (AGENTS.md) — re-run this round
- No secrets in code or logs: the manifest/table/scripts touch only repo files and read no `.env*`;
  confirmed by reading the commands themselves (all `grep`/`awk`/`node` against tracked files).
- No weakened/skipped tests, no scope creep: no test or application code changed this round; grepped
  `failureText` myself, confined to the two health files (unchanged from round 2).
- Version control: I ran no git command this round.

## Findings (round 3)
- No Critical findings.
- **Note (non-blocking, carried forward).** `dev_minions/HANDOVER.md` "Active story" line has not
  been re-checked by me this round beyond what's needed for AC4; the implementer/orchestrator should
  confirm it reflects round 3 before closing out the story.
- **Note (non-blocking).** Several manifest grep strings are intentionally common words (`now`,
  `links`, `found`) that could in principle match unrelated code; this is the fix strategy's own
  accepted risk (every such file also carries at least one distinctive token for the same pair, and
  I confirmed that in every case I spot-checked). Not a criterion failure.

Denied or attempted commands: none.
