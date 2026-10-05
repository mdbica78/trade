# US-049 review

## Round 1 — 2026-10-04

Verdict: PASS

Reviewer: independent `story-reviewer` context (fresh; did not write this code). Evidence cited
below is either read directly from the current files or re-run myself this round; nothing is
taken on HANDOVER's word alone unless marked so.

Inputs read: `AGENTS.md`, `dev_minions/backlog/stories/US-049.md`,
`dev_minions/verification/US-049-plan.md`, `dev_minions/backlog/sprints/sprint-12.md`,
`dev_minions/verification/CODE-REVIEW-20261004.md`, `dev_minions/HANDOVER.md`'s active-story
section. No explicit "Files changed" list exists for US-049 in HANDOVER.md (see W4 below); the
file set was reconstructed from the story's named scope (`lib/ingestion/*`, `lib/extraction/**`,
`lib/cron/*`, `lib/deploy/migrate.ts`, `lib/smoke/deploy.ts`, `lib/health.ts`,
`scripts/db-seed.ts`) cross-checked against the git-status listing already present in this
session's system context (not run by me) and `find`/`ls` existence checks (not git) for the new
test files the plan names.

### Acceptance criteria

- **AC1 (no behaviour change beyond the allowed A13 change)** — MET.
  - Re-ran myself, `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY`
    unset: `pnpm typecheck` → 0 errors. `pnpm lint` → 0 errors, 11 warnings (two new in
    `lib/ingestion/ingest-etf.ts:96,223` for an unused `error` binding in a caught-but-ignored
    discover/download rejection — cosmetic, matches HANDOVER's count). `pnpm test` → **217 files /
    2210 tests, all green** (matches HANDOVER's own count exactly). `pnpm build` (offline) → exit
    0, `migrate-on-deploy: skipped (not a production build)`, all 12 dynamic routes generated.
  - Every deliberate test change named in plan §3 was checked against the actual diff: `findReport`/
    `findReportCalls`/`findReportImpl` are gone from `test/helpers/ingest-fakes.ts` and
    `request-bound.test.ts`'s `inMemoryStore`; `describe("buildFindReportStatement")` is gone from
    `lib/ingestion/store.test.ts`; `describe("createDefaultIngestDeps")` is gone from
    `lib/ingestion/default-deps.test.ts`; `isStorableReportUrl`/`UpsertReportLinkResult`/
    `rejected_url` have zero occurrences anywhere under `lib/` or `test/` (grepped); `FL-2` is gone
    from `lib/extraction/discovery.filing.test.ts` (only `FL-4` remains); `SMOKE_LOCALES` is gone
    from `lib/smoke/deploy.ts`/`deploy.test.ts` (both now import `locales` from `i18n/locale`); the
    `PageOutcome` type in `deploy.ts` has no `headers` member. No test assertion was loosened —
    every change either deletes a test for code that no longer exists, or restates the same
    assertion against the new call shape (e.g. `MFP-7`'s `saveReportCalls` length 1→2 with an
    explicit comment on why).
  - `lib/extraction/fixtures.test.ts` (the committed-fixture pin, AC3's main proof) was **not**
    touched (absent from the modified-file set) and is part of the 217 green files.

- **AC2 (fewer requests: A1, A7, A12)** — MET.
  - A1: `lib/ingestion/ingest-reads.test.ts` IR-1/IR-2 use a `RecordingStore` and assert
    `store.calls` is exactly `["findStoredReportUrls", "saveReport", "saveReport"]` for a 2-link
    filing (one read, then one save per link, never a read between saves); IR-3
    (`expectTypeOf<keyof ReportStore>().toEqualTypeOf<"saveReport" | "findStoredReportUrls">()`)
    proves `findReport` cannot exist on the interface. `lib/ingestion/store.ts`'s `ReportStore` has
    exactly those two methods (read myself, lines 17-20); `ingest-etf.ts`'s `persist` calls
    `store.saveReport` directly with no preceding read (read myself, lines 46-66).
  - A12: `lib/health.test.ts` HC-7 (read myself) gives a fake `db` whose `select` throws if ever
    called and whose `execute` is counted; asserts `executeCalls` is exactly 1 and the right
    connected status. `lib/health.ts`'s `getHealthStatus` calls `buildHealthStatement` once via
    `db.execute` (read myself, lines 37-52); the real-PGlite `lib/health.pglite.test.ts` (HS-1..3,
    unmodified) stays green in the full run, so the single statement is real, executable SQL, not
    just a satisfied mock.
  - A7: `lib/extraction/discovery.test.ts` DS-P1 (read myself) counts `toString()` conversions of
    the fetched page text via a counting stub and asserts exactly 1 (previously 2).
    `discoverLatestReport` (read myself, `discovery.ts` lines 169-202) calls `parseReportList` once
    and reuses its `entries` for `latestFiling`; the old `findLatestReportLink` (which re-parsed)
    no longer exists in source (grepped, zero hits in `lib/`).

- **AC3 (adapters' error strings/values/dates unchanged; validation order unchanged)** — MET.
  - `lib/extraction/adapters/report-date-errors.test.ts` AE-1..AE-10 (read myself) pin the exact
    strings named in the plan for both adapters (footer-missing, no-token, invalid date, wrong
    shape, conflicting dates; and the `"Data:"`-labelled equivalents for InterCapital); these run
    against the real `brdDepositaryAdapter.extract`/`intercapitalNavAdapter.extract`, not a stub.
  - `lib/extraction/adapters/validate.test.ts` VO-1 (read myself) pins a 7-violation mixed order. I
    hand-traced `validateExtractionResult` (read myself, `validate.ts` lines 60-93) against VO-1's
    input and reproduced the exact expected order (unknown x, unknown y, duplicate x, duplicate a,
    uncovered c, invalid_numeric_value x, empty_raw_value x) — matches the test's `toEqual` exactly.
  - The shared fixtures suite (`fixtures.test.ts`, every committed PDF fixture) is untouched and
    green in the full run (AC1 above).

- **AC4 (DEC-010/DEC-018 unchanged)** — MET.
  - A8 is explicitly skipped (plan §0.1, HANDOVER confirms): `lib/ingestion/run-daily.ts` still
    declares `DailyEtf = IngestEtfInput & { isActive: boolean }` and filters on it (read myself,
    lines 47, 72) — `run-deadline.test.ts`/`run-daily.test.ts`'s `isActive` assertions are
    therefore genuinely unchanged, not just claimed so.
  - `lib/ingestion/store.ts`'s `buildSaveReportStatements` (read myself, lines 65-102) is the same
    one-batch, `ok`-last, `status <> 'ok'`-guarded shape as before; `ingestFiling` (read myself,
    `ingest-etf.ts` lines 136-179) still processes links sequentially in one filing, one
    `combineFilingOutcomes` call. `request-bound.test.ts`, `ingest-filing.test.ts` MF-7..9,
    `run-deadline.test.ts`, `deadline.pglite.test.ts` and the e2e pipeline test all pass in the
    full run with no assertion change beyond what plan §3 names.

- **AC5 (no URL/fetch message in `job_runs.log` or the cron response)** — MET.
  - `lib/cron/fetch-detail.test.ts` FD-1..FD-5 (read myself) drive the real
    `discoverLatestReport`/`downloadReportPdf` through a mocked `fetchImpl` that throws a message
    containing both a URL-shaped string and a sentinel, via `runDailyIngestion` → `runDailyJob` →
    `handleDailyCron`, and assert the finished `job_runs.log` row and the cron JSON response body
    contain none of `://`, the sentinel, `fetch failed`, `is not a PDF`, `timed out after` — only
    `discovery network` / `discovery http_error 503` / `download network` / `download not_pdf` /
    `download timeout`. `lib/ingestion/outcome.ts`'s `formatFetchError` (read myself, lines 93-101)
    takes no message parameter at all, so there is nothing for a caller to leak even by mistake.

- **AC6 (HANDOVER records done/skipped per finding, with wc -l before/after)** — MET, with a
  Warning (see W1/W2 below). Every finding A1..A13 has a `done`/`skipped: reason` line in
  HANDOVER's active-story section, and A8's skip reason matches what the code and tests actually
  show (checked above, AC4). I independently ran `wc -l` on all 17 touched source files named in
  HANDOVER's "after" list; **16 of 17 match exactly**, but `lib/cron/daily-job.ts` is reported as
  70 lines and is actually **57** (see W1). "Before" counts are not given at all — HANDOVER
  discloses this openly as a gap from an untracked prior session rather than fabricating numbers,
  which I accept as the honest alternative, but the criterion as drafted ("the line count
  before/after") is still only half delivered.

### Non-negotiable rules (AGENTS.md) — checked, no violation found
- Deterministic label-based extraction: both adapters' `extract`/`canHandle` stayed structural
  regex/label matching; no AI, no behaviour change to the matching rules themselves (only the
  date-finding loop and the values/missingFields assembly were factored into shared `text.ts`
  helpers — confirmed by AE-1..10 and the unchanged `fixtures.test.ts`).
- One adapter per format: unchanged (`brdDepositaryAdapter`, `intercapitalNavAdapter`, same keys).
- Missing report → empty day: not touched by this story; no regression found in the full suite.
- DEC-010 write rules: confirmed above (AC4) — one batch, `ok` last, guard unchanged, no retry.
- No secrets in code or logs: A13's whole point is removing URL/message leakage from
  `job_runs.log` and the cron response; FD-1..5 prove it for the fetch path. No new secret-bearing
  string was introduced anywhere I read.
- No weakened/skipped tests: every deletion in plan §3 corresponds to code that was actually
  deleted (`findReport`, `isStorableReportUrl`, `SMOKE_LOCALES`, `createDefaultIngestDeps`,
  `findLatestReportLink`, `rejected_url`/`UpsertReportLinkResult`) — grepped zero remaining
  references for each. No assertion was loosened; several became stricter (`IF-3`'s details moved
  from a prefix check to an exact `toBe`).
- No scope creep: every modified source file under the story's named scope maps to a named finding
  (A1-A13) in the plan; `app/health/page.failure.test.tsx`, `lib/config/detect-adapter.test.ts` and
  `lib/extraction/report-latest.test.ts` are test-only, consequential, type-only updates the plan
  names explicitly (A7/A12 fallout), not new behaviour.

### Findings

**Critical:** none.

**Warning:**
- **W1** — AC6's `wc -l` record for `lib/cron/daily-job.ts` is wrong: HANDOVER says 70, the file
  is actually 57 lines (verified with `wc -l` myself). All other 16 reported "after" counts match
  exactly. Not a behaviour issue, but AC6 is a documentation acceptance criterion and this number
  is simply incorrect; fix the line in HANDOVER before closing the story.
- **W2** — AC6 has no "before" `wc -l` counts at all (HANDOVER discloses this as a gap from an
  untracked prior session, not fabricated). Given the plan's step 0 ("wc -l every source file ...
  before the first edit") was written precisely so this gap wouldn't happen, log this as a process
  note for the sprint audit even though no number was invented.
- **W3** — A2's shipped structure keeps two separate `discover()` call-and-try/catch sites
  (`ingestEtf`'s happy path at `ingest-etf.ts:93-104`, and `ingestNoAdapter`'s own discover at
  `ingest-etf.ts:186-192`), rather than the plan's literal "one guarded discover call" wording.
  Behaviour is correct and fully tested (at most one discovery request per `ingestEtf` call, since
  the two paths are mutually exclusive on whether an adapter is registered), and the two paths
  genuinely return different outcome codes (`fetch_error` vs `no_adapter`) so full unification
  would need a shared branch anyway — but the duplication A2 called out (two try/catch blocks
  around `deps.discover`) is only partly reduced, not eliminated. Not blocking; worth a one-line
  note for whoever next touches this file.
- **W4** — HANDOVER.md's US-049 section has no explicit "Files changed" list (every other story in
  this file's history has one). I had to reconstruct the file set from the story's named scope,
  the plan's §2/§3, and the git-status snapshot already present in this session's context (I did
  not run git myself). This made independent verification slower than it should be; add the list
  before the story leaves "implement".

**Note:**
- `lib/ingestion/outcome.ts`'s `formatNoAdapterDetail` "discovery_error" branch
  (`` `${base}; report link not stored: discovery ${link.errorKind}${status}` ``) hand-duplicates
  `formatFetchError`'s `` `${stage} ${kind}${status}` `` shape instead of calling it directly, even
  though the plan's A13 row says the no-adapter case "reuses it (same output)". Output is byte-for-
  byte identical either way (checked by inspection), so this is cosmetic only.

### Tests I ran myself this round (not re-run: anything not listed here)
- `pnpm typecheck` → exit 0.
- `pnpm lint` → exit 0, 11 warnings (same count HANDOVER reports).
- `pnpm test` → 217 files / 2210 tests, all green (same counts HANDOVER reports).
- `pnpm build` (offline) → exit 0, 12 dynamic routes, `migrate-on-deploy: skipped`.
- `wc -l` on all 17 source files HANDOVER names in its "after" line-count record.
All four runs were with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`,
`GEMINI_API_KEY`, `GROQ_API_KEY` unset, matching HANDOVER's claimed environment.

Denied or attempted commands: none.
