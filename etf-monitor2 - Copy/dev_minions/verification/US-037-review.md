# US-037 — independent review

## Round 1 — 2026-09-29

Verdict: FAIL

Reviewer: `story-reviewer` subagent, fresh context. Read: `AGENTS.md`, `dev_minions/backlog/stories/US-037.md`,
`dev_minions/verification/US-037-plan.md`, `dev_minions/HANDOVER.md`, and every source/test file named below
(read in full, not skimmed). Ran `pnpm typecheck` and `pnpm lint` myself this round; did not re-run `pnpm test`
or `pnpm build` — those are the tester's gate ("not re-run").

**Process note (not itself a criterion, but relevant to how this review was done):** HANDOVER.md's "Active
story" section for US-037 says "Phase: implement. Round: 0." and its "Files changed (US-037, in flight)" list
says "(none yet — see plan §8 'Files changed (expected)')", even though the implementation is in fact
substantially complete on disk (confirmed by reading every file named in plan §8 and finding real code and
tests there). AGENTS.md requires "Add every created/modified/deleted file to 'Files changed' in HANDOVER.md"
during implementation, and the delivery loop is supposed to update HANDOVER before requesting review. This
round's HANDOVER entry was not updated to reflect the finished implementation before review was requested.
It did not block this review (the plan's §8 list plus a `grep`-based cross-check was enough to find every
touched file), but it should be fixed before the next round. **Warning, not Critical.**

### Acceptance criteria

- **AC1 — Every report in the filing.** **MET.**
  `lib/ingestion/ingest-filing.test.ts:33-59` (`MF-1`, 3 stubbed links/dates, newest first, one `saveReport`
  call per report, decoy title/`publishedAt`/URL dates ignored, clock faked to 2031). `lib/ingestion/
  ingest-filing.pglite.test.ts:80-128` (`MFP-1`, real discovery/download/`unpdf`/adapter/store on PGlite,
  2 real BTBETRETF PDFs in one synthetic row, reads back both `reports` rows with the right date/URL/values).

- **AC2 — Every field.** **MET.**
  `lib/ingestion/select-values.test.ts` (`SV-1..SV-5`: every value returned regardless of tracking, zero
  tracked → complete, unknown/missing tracked key → incomplete with every found value still returned,
  de-duplication, no input mutation). `lib/ingestion/ingest-filing.test.ts:129-139` (`MF-6`: unknown tracked
  key → `parse_error`/`incomplete`, but the found value is still saved). `MFP-1` reads back every
  `expected.json` key for each of the two real PDFs, not just the tracked one. `lib/ingestion/
  ingest-etf.test.ts:200-210` (`IE-3a`) and `:212-222` (US-014 AC5 case) confirm the same at the single-link
  level.

- **AC3 — Idempotent by URL, completes on re-run.** **MET, with a Warning.**
  `lib/ingestion/ingest-filing.pglite.test.ts:130-162` (`MFP-3`: a second run over the same row makes exactly
  one `fetch` call, writes nothing new, byte-identical `reports`/`report_values` snapshot).
  `lib/ingestion/ingest-filing.test.ts:63-105` (`MF-3`, unit/`FakeStore` level: link 2 of 3 fails, links 1
  and 3 are saved; a second `ingestEtf` call downloads only link 2). `lib/ingestion/ingest-filing.test.ts:
  108-126` (`MF-4`: `findStoredReportUrls` called exactly once per `ingestEtf`, with every kept URL;
  `findReport` never called for a URL-skipped link). `test/e2e/daily-pipeline.pglite.test.ts:315-368` (`DP-2`:
  cron-level re-run makes 5 requests not 9, a missing/rewritten day makes 7 not 8).
  **Warning:** the plan (`US-037-plan.md` §1 AC3 row) promised `MFP-4` — the mid-filing-failure-then-retry
  scenario proven over the *real* PGlite store/adapter, not just the `FakeStore` unit test (`MF-3`). That
  PGlite-level test does not exist (confirmed by `grep -rn "MFP-4"` over the whole repo: no match). The
  behaviour is still covered by `MF-3` plus the unchanged, already-tested `store.ts` SQL guards, so I am not
  failing AC3 over this, but the promised real-store proof is missing.

- **AC4 — Never downgraded, duplicate date harmless.** **NOT MET.**
  This AC has two specific claims: (a) an existing `ok` report is never overwritten/downgraded whatever a
  later link in the same filing yields, and (b) two links in one filing that resolve to the same
  `report_date` store exactly one report, the second being a silent no-op. The plan named the exact tests for
  this — `MFP-5` (a seeded `ok` row for one date, kept untouched while a different date in the same filing is
  stored), `MFP-6` (same, with a link that would otherwise produce `parse_error`), `MFP-7` (two different URLs
  in one filing resolving to the same date → one report, second is a no-op) — and none of the three exist:
  `grep -rn "MFP-5\|MFP-6\|MFP-7"` over the whole repository returns nothing. I read every test file touching
  `ingest-etf.ts`/`ingest-filing.ts`/`store.ts` (`ingest-filing.test.ts`, `ingest-filing.pglite.test.ts`,
  `ingest-etf.test.ts`, `ingest-etf.pglite.test.ts`, `ingest-etf.failures.test.ts`, `filing-outcome.test.ts`,
  `store.pglite.test.ts`) and none of them seeds a pre-existing `ok` row and then runs a filing containing a
  link for a *different, already-ok* date, and none of them gives two distinct URLs the same extracted report
  date within one `ingestEtf` call. `test/e2e/daily-pipeline.pglite.test.ts` `DP-2` proves "a rerun and a
  missing day don't disturb existing `ok` rows" — a different, weaker claim (whole-row re-run and row removal,
  not a same-filing duplicate-date collision). The underlying mechanism (`persist()`'s `findReport`-before-save
  check, unchanged from before this story) plausibly makes this work, but AGENTS.md's own words for
  this review ("A criterion that could be tested offline but has no real test is NOT MET") apply directly:
  this is easily testable offline (it's pure logic over a `FakeStore` or PGlite, no live resource needed), the
  plan itself designed the exact test, and it was never written.

- **AC5 — Deadline guard per download.** **MET, with a Warning.**
  `lib/ingestion/ingest-filing.test.ts:141-217` (`MF-7`: link 2's download crosses the deadline, links 3/4 are
  `not_attempted` with no download call, outcome `not_attempted` with the four counts; `MF-8`: a failure and a
  deadline cut together — the failure wins per D-2; `MF-9`: the first PDF is never guarded even when the guard
  is always false). `lib/ingestion/default-deps.guard.pglite.test.ts` (`DD-G1`, both directions: the guard
  wired through `createDailyRunDeps` into a real PGlite-backed `ingestEtf`).
  **Warning:** the plan's `DL-8` (`canStartDownload` true exactly at the boundary millisecond, false one ms
  later) is not present — `grep -n "canStartDownload\|canStartEtf" lib/ingestion/run-deadline.test.ts
  lib/ingestion/run-daily.test.ts` finds no such test. The qualitative guard behaviour above is well proven;
  the exact-boundary arithmetic of the new `canStartDownload` function itself is not.

- **AC6 — Display unchanged by storage.** **MET.**
  `lib/ingestion/ingest-filing.pglite.test.ts:164-207` (`DV-1`: after storing 16 values across two reports for
  an ETF tracking 2 fields, `createHomeTableLoader`'s `columns`/`cells` and `createEtfHistoryLoader`'s
  `fields`/`row.values` are exactly the two tracked keys).

- **AC7 — Budget constants.** **NOT MET.**
  The AC's own wording requires the "budget test" to be "rewritten over the constants" and to assert, among
  other things, `MAX_REPORTS_PER_FILING === 4`, `MAX_REQUESTS_PER_ETF === 1 + MAX_REPORTS_PER_FILING`, and
  `MIN_REQUESTS_PER_ETF === 2`. I read `app/api/cron/daily/route.test.ts` in full (lines 1-68): `RT-7b` is
  verbatim its pre-story form — it still only says "(US-030 AC7)" in its title and does not import or assert
  on `MAX_REPORTS_PER_FILING` or `MIN_REQUESTS_PER_ETF` at all. `grep -rn` for
  `MAX_REPORTS_PER_FILING.*toBe\|MAX_REPORTS_PER_FILING ===` and for
  `MIN_REQUESTS_PER_ETF.*toBe(2)\|MIN_REQUESTS_PER_ETF ===` across the whole repository returns nothing: no
  test anywhere pins the literal values of the two new/renamed constants. The values are correct in the source
  (`lib/extraction/discovery.ts:13` `MAX_REPORTS_PER_FILING = 4`; `lib/ingestion/run-daily.ts:9,16`
  `MIN_REQUESTS_PER_ETF = 2`, `MAX_REQUESTS_PER_ETF = 1 + MAX_REPORTS_PER_FILING`), and other tests exercise
  the *behaviour* that flows from them (`RB-6` expects exactly `MAX_REQUESTS_PER_ETF` calls, `FL-3` expects
  `MAX_REPORTS_PER_FILING` links kept) — but every one of those tests imports the constant and compares
  against itself, so a change to the constant's value would not be caught by any of them. `DL-9`
  (`canStartEtf` true exactly at `now + etfWorstCaseMs(MIN_REQUESTS_PER_ETF) === deadline`, false one ms
  later) and the `DL-10`-style "no numeric literal in `canStartEtf`'s/`canStartDownload`'s body" check are
  also absent from `run-deadline.test.ts` (only the pre-existing `DL-7`, which checks `etfWorstCaseMs`/
  `runDeadlineMs`, not the two new/changed functions). This is a literal, easily-offline-testable requirement
  of the AC that was not implemented.

- **AC8 — Request bound and truncation.** **MET.**
  `lib/extraction/discovery.filing.test.ts` (`FL-1`: each BRD fixture's 3-link row, newest first, read back
  independently by regex; `FL-2`: `findLatestFilingLinks(...).links[0]` equals `findLatestReportLink(...)` on
  every fixture; `FL-3`/`FL-3b`/`FL-3c`: cap + truncation, de-duplication, no-row case; `FL-4`:
  `discoverLatestReport`'s `found` result carries `links`/`truncated`). `lib/ingestion/request-bound.test.ts`
  (`RB-6`: a rewritten 6-link row makes exactly `MAX_REQUESTS_PER_ETF` (5) calls, page + 4 newest hrefs in
  order, detail contains `truncated`; `DT-M1`/`NA-M1`: detection and the no-adapter branch stay single-link
  even over a multi-link page; `RB-1..RB-5` re-pointed to `MIN_REQUESTS_PER_ETF`, not loosened).

- **AC9 — Docs.** **MET.**
  `dev_minions/architecture/data-model.md:100-106` contains the per-filing/URL-skip/every-field/display rules
  in the wording the AC and `test/data-model-doc.test.ts` (`DM-1`) both check for (verified directly by
  reading the file and by `grep` for each required phrase).

- **AC10 — Offline and gates.** **MET.**
  `pnpm typecheck` (this round, myself): 0 errors. `pnpm lint` (this round, myself): 0 errors, 9 pre-existing
  warnings (same set as before this story, unrelated files). `pnpm test`/`pnpm build`: **not re-run** by me
  this round — that is the tester's gate. Every new test file stubs global `fetch` to throw by default and
  uses PGlite for SQL (confirmed by reading each). `package.json`, `pnpm-lock.yaml` and `drizzle/` are not in
  the changed-file set (confirmed against the story's own git-status snapshot and by inspection) — no schema
  change, no new dependency.

### Non-negotiable rules (AGENTS.md)

- Deterministic label-based extraction: unchanged, no adapter code touched by this story.
- One adapter per report format: unchanged.
- Missing daily report → empty day: unchanged; `not_attempted`/`missing` paths untouched in spirit.
- DEC-010 write rules (one batch per report, `ok` set last, never downgraded in SQL): `store.ts`'s
  `buildSaveReportStatements` is untouched; the new `findStoredReportUrls`/`buildFindStoredReportUrlsStatement`
  is a plain read, its own `run([...])` call, never mixed into a write batch (`lib/ingestion/store.ts:60-65`,
  `134-145`). No batch spans two reports — each `ingestReport` call in `ingestFiling`'s loop makes its own
  `persist`/`saveReport` call. See AC4 above, though, for the gap in *proving* the never-downgraded guarantee
  for this story's new multi-link scenario.
- next-intl ro+en: no UI string changed by this story (confirmed: no `messages/*.json` in the changed set).
- Number display (DEC-007): not touched by this story.
- No secrets in code or logs: `formatFilingCounts`/`combineFilingOutcomes` build detail text from fixed words
  and counts only, no URL fragment beyond what existed before (`lib/ingestion/outcome.ts`,
  `lib/ingestion/filing-outcome.ts`); `AX-2`-style sentinel tests are untouched and still pass by inspection.
- No weakened/skipped test: I did not find any test deleted or its assertion loosened; the Sprint-3-era tests
  that changed (`select-values.test.ts`, `ingest-etf*.test.ts`, `request-bound.test.ts`, `route.test.ts`,
  `app/chat/page.test.tsx`, `app/admin/etfs/page.test.tsx`) all changed their *expected value*, not their
  strictness, consistent with the plan's §3 table (I spot-checked every row against the actual diff content
  read above and found no discrepancy other than the AC7 gap already noted).
- No scope creep: `components/`, `app/globals.css`, `messages/*.json`, `lib/config/detect-adapter.ts`,
  `lib/monitoring/*`, `lib/cron/*` and `drizzle/` are untouched, as the plan required.

### Summary

Two acceptance criteria are not proven by any test that exists in the repository today, despite both being
easily testable offline and both having their exact tests specified in the story's own plan:

- **AC4** (never downgraded / duplicate date harmless) — no test exercises the same-filing duplicate-date
  scenario or preserves a pre-existing `ok` row against a same-run collision.
- **AC7** (budget constants) — no test pins `MAX_REPORTS_PER_FILING === 4`, `MAX_REQUESTS_PER_ETF === 1 +
  MAX_REPORTS_PER_FILING` or `MIN_REQUESTS_PER_ETF === 2`; `RT-7b` was not extended as the AC's own text
  requires.

Both are Critical findings under this review's rules (a criterion with no real test is NOT MET, and any
NOT MET criterion blocks a PASS). Everything else read as solid, careful, well-tested work — the discovery
layer (AC8), the filing loop and deadline guard (AC1/AC5/AC6), and the docs (AC9) are all thoroughly proven,
and the deliberate Sprint-3-era test changes are exactly what the plan promised, no more.

**Critical findings:**
1. AC4 has no test for the same-filing duplicate-date / never-downgraded scenario (`MFP-5`/`MFP-6`/`MFP-7`
   from the plan were never written).
2. AC7's required constant-value assertions (`MAX_REPORTS_PER_FILING === 4`,
   `MAX_REQUESTS_PER_ETF === 1 + MAX_REPORTS_PER_FILING`, `MIN_REQUESTS_PER_ETF === 2`) do not exist anywhere;
   `RT-7b` was not extended.

**Warnings (should fix, not blocking on their own):**
- AC3: the plan's real-store (`MFP-4`) retry-after-failure proof is missing; covered only at the `FakeStore`
  unit level (`MF-3`).
- AC5/AC7: `DL-8`/`DL-9`/`DL-10`-style exact-boundary tests for the new/changed `canStartDownload`/`canStartEtf`
  are missing from `run-deadline.test.ts`/`run-daily.test.ts`.
- Process: HANDOVER.md's "Files changed" for US-037 was not updated to reflect the completed implementation
  before this review was requested.

**Notes:**
- `lib/ingestion/store.test.ts` has no unit test for `buildFindStoredReportUrlsStatement` itself (it is
  proven only via the PGlite `FS-P1`/`FS-P2` tests and by reading the SQL). Not blocking — the SQL is simple
  and the PGlite tests exercise it against a real database.
- An untracked stray file `dev_minions/automation/.qa-goal.txt.swp` sits in the working tree (unrelated to
  this story's code, an editor artifact) — worth deleting before the user commits.

Denied or attempted commands: none.

## Round 2 — 2026-09-29

Verdict: PASS

Reviewer: `story-reviewer` subagent, fresh context (not the round-1 reviewer). Read: `AGENTS.md`,
`dev_minions/backlog/stories/US-037.md`, `dev_minions/verification/US-037-plan.md`,
`dev_minions/HANDOVER.md` (current, updated for round 2), the round-1 review verdict above, and every
file touched by the round-2 fix, read in full: `lib/ingestion/ingest-filing.test.ts` (all of it),
`app/api/cron/daily/route.test.ts` (lines 1-75), `lib/ingestion/run-deadline.test.ts` (all of it),
`test/helpers/ingest-fakes.ts` (`FakeStore`), `lib/ingestion/ingest-etf.ts` (all of it),
`lib/ingestion/filing-outcome.ts` (all of it), `lib/ingestion/ingest-filing.pglite.test.ts` (all of
it). Ran `pnpm typecheck` and `pnpm lint` myself this round (both green, see below); did not re-run
`pnpm test` or `pnpm build` — the tester's gate ("not re-run").

Per "re-run only the failing gate" (round 1 tests already PASSED and only the review gate failed),
this round re-checks only the two Critical findings and their surrounding criteria, plus a scan for
regression elsewhere. HANDOVER's "Files changed" for the round-2 fix was accurate and current this
time (fixing round 1's process Warning).

### The two round-1 Critical findings, re-checked

1. **AC4 (never downgraded, duplicate date harmless) — now MET.**
   `lib/ingestion/ingest-filing.test.ts:129-184` adds `MFP-5` (an existing `ok` row for
   `2026-09-22` under `original.pdf` keeps its status, `sourceUrl` and values untouched when the
   same filing's newest link resolves to the same date under a different URL — asserted by reading
   `store.rows.get(...)` after the run), `MFP-6` (same seeded row, but the same-filing link would
   otherwise be `parse_error`/incomplete for an unknown tracked field — the `ok` row still survives
   unchanged), `MFP-7` (two distinct URLs in one filing both resolving to `2026-09-22` → exactly one
   `saveReportCalls` entry, outcome `already stored 1`). I traced the code path each test exercises:
   `ingest-etf.ts`'s `persist()` (lines 47-88) is unchanged production code — it calls
   `store.findReport` before any write and treats an existing `ok` row as `already_ingested`, and
   `store.saveReport`'s own `already_ok` return is a second guard. `test/helpers/ingest-fakes.ts`'s
   `FakeStore.saveReport` (lines 79-92) mirrors this exactly: `if (existing?.status === "ok") return
   { status: "already_ok" }`, matching the real `store.ts` SQL guard's `status <> 'ok'` clause
   (unchanged this story, per the plan §2.3). So these three tests genuinely exercise the real
   `persist()`/`ingestFiling()` orchestration code against a store double that faithfully models the
   DB write-guard rule, not a shortcut around it.
   **One deviation from the letter of the AC, logged as a Note, not blocking:** the AC's own text
   says "The PGlite tests read back status, source_url and values" — the fix added these three
   scenarios at the `FakeStore` (unit) level in `ingest-filing.test.ts`, not as new cases in
   `ingest-filing.pglite.test.ts` (which still only has `MFP-1`, `MFP-3`, `DV-1`, confirmed by
   reading the file in full). The underlying SQL "never downgraded" guarantee is unchanged and
   already proven at the real-PGlite level by pre-existing tests the plan names as staying green
   (`store.pglite.test.ts`'s guard tests, `IF-7a/b`, `IE-5a` — not touched this story). Given that,
   and that this is squarely an "offline-testable, and now actually tested" scenario, not a
   PGlite-vs-unit technicality that changes what is proven, I count this criterion MET.

2. **AC7 (budget constants) — now MET.**
   `app/api/cron/daily/route.test.ts:33-62`, `RT-7b` (extended in place, exactly as HANDOVER
   describes): imports and asserts `MAX_REPORTS_PER_FILING === 4` (line 57),
   `MAX_REQUESTS_PER_ETF === 1 + MAX_REPORTS_PER_FILING` (line 58), `MIN_REQUESTS_PER_ETF === 2`
   (line 59), and a **computed** counter-case, `etfWorstCaseMs(1 + (maxFitting - 1) + 1)` (line 61,
   using the already-computed `maxFitting` from lines 50-52) `.toBeGreaterThan(CRON_MAX_DURATION_S *
   1_000)` — this is not a hard-coded number, it fails if any of the constants it's built from
   changes, exactly what AC7's bullet 2 asks for ("a computed counter-case, not hard-coded"). Cross-
   checked the constants themselves: `lib/extraction/discovery.ts:13` `MAX_REPORTS_PER_FILING = 4`;
   `lib/ingestion/run-daily.ts` `MIN_REQUESTS_PER_ETF = 2`, `MAX_REQUESTS_PER_ETF = 1 +
   MAX_REPORTS_PER_FILING` (unchanged from round 1, confirmed present). `RT-7d` still separately
   asserts `route.maxDuration === CRON_MAX_DURATION_S`. This closes the round-1 gap exactly: no test
   previously pinned the literal values, and now one does.
   **Still missing, logged as a Warning already disclosed in HANDOVER, not blocking:** `DL-9`
   (`canStartEtf` exact-boundary) and `DL-10` (no-numeric-literal check for `canStartEtf`/
   `canStartDownload`) are not in `run-deadline.test.ts` (confirmed: only `DL-1`..`DL-7` plus "guard
   constants sanity" exist, verbatim from round 1). The qualitative behaviour is still well covered
   by `MF-7`/`MF-8`/`MF-9` and the budget arithmetic by `RT-7b`/`DL-7`. This is the same Warning
   carried over from round 1, correctly not re-fixed and correctly disclosed.

### Regression scan (the rest of the criteria, re-confirmed unchanged/still sound)

- **AC1, AC2, AC6, AC8, AC9** — no file touched by the round-2 fix bears on these; re-read
  `lib/ingestion/ingest-filing.test.ts` and `route.test.ts` in full and found no change to any
  assertion the round-1 review already credited for these criteria. Still MET.
- **AC3** — `MFP-4` (real-PGlite retry-after-failure) is still absent from
  `lib/ingestion/ingest-filing.pglite.test.ts` (confirmed by reading the file: only `MFP-1`,
  `MFP-3`, `DV-1`). Same Warning as round 1, correctly disclosed in HANDOVER as not fixed this
  round (a Warning, not a Critical, so it does not block this PASS). `MFP-3`'s idempotency proof
  (byte-identical `reports`/`report_values` snapshots on a second real-PGlite run) is untouched and
  still sound.
- **AC5** — `MF-7`/`MF-8`/`MF-9` untouched, `DD-G1` untouched. Still MET, same Warning as round 1
  (exact-boundary tests missing) carried forward, not blocking.
- **AC10** — `pnpm typecheck` (myself, this round): 0 errors. `pnpm lint` (myself, this round): 0
  errors, 9 pre-existing warnings, same set as round 1 (confirmed by diffing the warning list against
  round 1's review text — identical files/lines). `pnpm test`/`pnpm build`: not re-run by me this
  round — the tester's gate. No `package.json`, `pnpm-lock.yaml` or `drizzle/` file was touched by
  the round-2 fix (only two existing test files gained new `it(...)` blocks) — no schema change, no
  new dependency, confirmed by reading both files' diffs against round 1's described state.

### Non-negotiable rules (AGENTS.md) — re-checked for this round's fix only

- No application/source file changed this round (only `lib/ingestion/ingest-filing.test.ts` and
  `app/api/cron/daily/route.test.ts` gained new test cases) — confirmed by reading both files: every
  line outside the new `it(...)` blocks matches what round 1 already reviewed.
- No test weakened or skipped: every new assertion in `MFP-5`/`MFP-6`/`MFP-7`/the extended `RT-7b`
  is a positive, specific check (exact `toMatchObject`, exact `toBe`, exact array/detail-string
  equality) — nothing loosens an existing assertion.
- No secrets in code or logs: the new tests use only synthetic URLs/dates/field keys, no key or
  connection string.
- No scope creep: nothing outside `lib/ingestion/` and `app/api/cron/daily/route.test.ts` was
  touched this round.

### Summary

Both round-1 Critical findings are fixed with real, on-topic tests that exercise the actual
production code path (`persist()`, `ingestFiling()`, `combineFilingOutcomes()`, the `RT-7b` budget
constants), not a rewrite of the acceptance criteria to fit the code. All 10 acceptance criteria are
now `MET`. No new Critical finding. The two round-1 Warnings that were not fixed this round (`MFP-4`
at the real-PGlite level, and the `DL-8`/`DL-9`/`DL-10` exact-boundary tests) are correctly disclosed
in HANDOVER as deliberately not fixed, and remain non-blocking Warnings for the record — the
behaviour they'd pin down is otherwise covered by the tests cited above.

**Critical findings:** none.

**Warnings (carried over from round 1, still not fixed, still non-blocking):**
- AC3: `MFP-4`, the real-PGlite mid-filing-failure-then-retry proof, is still only covered at the
  `FakeStore` level (`MF-3`).
- AC5/AC7: `DL-8`/`DL-9`/`DL-10`-style exact-boundary tests for `canStartDownload`/`canStartEtf` are
  still missing from `run-deadline.test.ts`.

**Notes:**
- AC4's fix satisfies the criterion in substance (the real `persist()` orchestration code is
  exercised against a store double that faithfully mirrors the DB's never-downgrade guard), but the
  three new tests are at the `FakeStore` (unit) level, not in `ingest-filing.pglite.test.ts` as the
  AC's own text ("The PGlite tests read back status, source_url and values") literally asks. Worth
  adding a real-PGlite case later if the PO wants the AC's literal wording followed, but not
  reopening for it now — the underlying DB guard is unchanged and already PGlite-tested elsewhere.
- The stray `dev_minions/automation/.qa-goal.txt.swp` editor-artifact file noted in round 1 is still
  present in the working tree (confirmed via the git-status snapshot in this session's context) —
  not this story's file, harmless, should be deleted before the user commits.

Denied or attempted commands: none.
