# US-014 review

## Round 1 — 2026-09-25

Verdict: PASS

Reviewer: `story-reviewer` subagent (independent context; wrote no code for this story). No git
commands were run (checked before every command: only `Read`/`Bash` against non-git tooling —
`pnpm typecheck/lint/test/build`, `grep`, `find`, `rm .next/lock`).

Sources read: `AGENTS.md`, `dev_minions/backlog/stories/US-014.md` (incl. its "Tech-lead review"
addendum), `dev_minions/verification/US-014-plan.md`, and every file listed under "Files changed"
in `dev_minions/HANDOVER.md`: `lib/ingestion/outcome.ts`, `outcome.test.ts`, `ingest-etf.ts`,
`ingest-etf.test.ts`, `ingest-etf.failures.test.ts`, `ingest-etf.pglite.test.ts`,
`select-values.ts`, `store.test.ts`, `store.pglite.test.ts`, `boundaries.test.ts`,
`run-daily.test.ts`, `lib/cron/daily-handler.test.ts`, `default-deps.cron.test.ts`,
`test/helpers/ingest-fakes.ts`. Also read `lib/ingestion/store.ts` and `lib/ingestion/run-daily.ts`
in full to confirm they were genuinely unmodified as the plan asserts, and checked
`dev_minions/.files-touched.log` for this story to confirm nothing outside the declared list was
touched (log matches the "Files changed" list exactly — no stray edits to `store.ts`,
`run-daily.ts`, `default-deps.ts`, or `app/**`).

### Acceptance criteria

- **AC1 — No adapter**: MET. `ingestEtf` resolves the adapter before any network call
  (`lib/ingestion/ingest-etf.ts:82-98`); `null`/unknown key both return `no_adapter` with the
  specified detail text, zero `fetch`/store calls (`ingest-etf.failures.test.ts` IF-1a/1b),
  isolation of a following ETF proven by IF-1c (one shared `fetchImpl`/`FakeStore`, second ETF
  ingests normally, `fetchImpl` called exactly twice total), and IF-1d proves no `reportDate` key
  is present on the outcome.
- **AC2 — Missing report**: MET. `discovery.status === 'not_found'` maps to `missing` with
  `reason` carrying `no_report_entries`/`list_not_found` (`ingest-etf.ts:123-130`); IF-2a/2b
  exercise both reasons through the real `discoverLatestReport`, assert exactly one fetch, no
  download, no `findReport`/`saveReport` call, and (IF-2a) no `reportDate` key.
- **AC3 — Fetch failures**: MET. `fetch_error` carries `stage`, `kind`, `httpStatus?` and a
  `detail` built by `formatFetchError` (`ingest-etf.ts:100-171`). The IF-3 parametrised table
  covers discovery/download × http_error/network/timeout, plus download `not_pdf`, each with the
  correct per-URL call count and "no row" assertions; `ingest-etf.test.ts`'s "every pre-date
  failure path writes nothing" describe block covers the same ground through a second, independent
  test surface.
- **AC4 — Unusable report**: MET. Unreadable text (`textResult.ok === false`), `canHandle` false,
  and adapter `ok: false` are all distinct `parse_error` reasons with no store call
  (`ingest-etf.ts:173-201`). IF-4c is the direct proof that `canHandle` false stops extraction even
  when `extract` would have returned a complete, contract-valid result (`extract` asserted never
  called); IF-4d repeats the gate against the real `brd-depositary` adapter and unrelated text.
  IF-4f plus `boundaries.test.ts` BD-14b jointly prove no fallback to `registry.detect`.
- **AC5 — Incomplete extraction**: MET. `selectValuesToPersist`'s incomplete result feeds a single
  `persist('parse_error', formatMissingFields(...), selection.values)` call
  (`ingest-etf.ts:234-249`); IF-5a proves the single `saveReport` call's shape (status, report
  date, source URL, `fetchedAt`, `error_message` naming the missing key, found values for the
  others, no entry for the missing field); IF-5b proves the message uses tracked order and is
  built by calling `selectValuesToPersist` rather than re-implementing its rule; IF-5c covers
  "every tracked field missing" (`values: []`); IF-5d and IF-8c prove no `ok` row is ever written
  for an incomplete result. Atomicity is proven at three levels exactly as the plan specifies:
  SQ-14b (every statement carries the `"status" <> 'ok'` guard for a `parse_error` write), PG-14a
  (a fresh PGlite gets one row + the two found values, no `nav_per_unit` row), and E2E-3 (the same
  proof through the real `createDrizzleReportStore`, not a fake).
- **AC6 — Contract violations**: MET. Violations with a valid date write a `parse_error` row with
  `values: []` and a violation-only `error_message` (IF-6a, PG-14c); IF-6b independently proves the
  message never contains extracted text (`formatViolations` only uses `rule`/`fieldKey`, never
  `message`, `outcome.ts:50-53`, unit-proven again in `outcome.test.ts`); IF-6c proves an invalid
  `reportDate` (an `invalid_report_date` violation) writes no row and the outcome carries no
  `reportDate` key at all (`ingest-etf.ts:203-212` returns before calling `persist`); IF-6d proves
  violations win over incompleteness.
- **AC7 — Precedence**: MET. The shared `persist()` helper applies the "never downgrade `ok`"
  check once for every write path (`ingest-etf.ts:33-74`): `findReport` returning `ok` and
  `saveReport` returning `already_ok` both short-circuit to `already_ingested` before any store
  mutation happens. IF-7a/7b/7c/7d cover the four required scenarios (existing `ok` row, the race
  where `saveReport` itself reports `already_ok`, `parse_error`→`ok` replacement, `parse_error`→
  `parse_error` replacement). The tech-lead's stricter requirement — that the guard also holds
  **inside the SQL**, not only via the caller's `findReport` check — is independently proven by
  PG-14d (an `ok` row survives a later `parse_error` save attempt with partial values) and PG-14e
  (same, with zero values, specifically exercising the case the tech-lead flagged: "the delete
  must not touch the `ok` row's values"). I read `store.ts` in full: `buildSaveReportStatements`
  guards every one of its four statements (claim, clear-old-values, per-value insert, finalize)
  with `"status" <> 'ok'`, confirming the plan's claim that no store code change was needed —
  US-012's SQL already covered this story's new input.
- **AC8 — Closed vocabulary, never throws, only ok/parse_error rows written**: MET.
  `INGEST_OUTCOME_CODES` is the exact seven-code list (`outcome.ts:3-11`, asserted in OC-8a).
  IF-8a is a genuine anti-vacuity test: a `Record<IngestOutcomeCode, ...>` trigger map (so
  `pnpm typecheck` would fail if a code were left untriggered), each trigger independently produces
  its code with a non-empty, newline-free `detail`, and a final assertion checks the produced-code
  set equals the full vocabulary. IF-8b parametrises over every injected function (`registry.get`,
  `discover`, `download`, `extractText`, `canHandle`, `extract`, `findReport`, `saveReport`)
  throwing both an `Error` and a non-Error (`'plain'`) value — 16 cases, all resolving to a typed
  outcome, never rejecting. IF-8c plus `boundaries.test.ts` BD-14a close the loop: every
  `SaveReportInput.status` ever sent across every IF scenario is `ok` or `parse_error`, both occur,
  the type itself is closed (`expectTypeOf`), and only `store.ts` contains
  `insert into "reports"`/`update "reports"` among non-test files in `lib/ingestion/`.
- **AC9 — Gates**: MET. Ran independently in this review session (not reusing the implementer's
  run): `pnpm typecheck` clean; `pnpm lint` 0 errors (2 pre-existing, unrelated warnings — unused
  test parameters in `lib/extraction/adapters/types.test.ts` and `lib/ingestion/load-etfs.test.ts`,
  both predate this story and are already flagged in HANDOVER.md); `pnpm test` 556/556 passed
  across 41 files, including every new US-014 test file; `pnpm build` succeeded (had to remove a
  stale `.next/lock` left by a previous interrupted build in this environment — not a code issue,
  no source files touched to fix it).

### Findings (ordered by severity)

No Critical or Warning findings.

1. **Note** — `lib/ingestion/ingest-etf.ts:132-140`. The `try { return await ingestReport(...) }
   catch { return persist_error }` wrapper around the `ingestReport` call inside `ingestEtf` is
   unreachable in the current code: every path inside `ingestReport` (download, text extraction,
   `canHandle`, `extract`, `validateExtractionResult`, `selectValuesToPersist`, and the `persist()`
   calls it makes) is already caught by `ingestReport`'s own internal try/catch or the `persist()`
   helper's own try/catch, so `ingestReport` never actually rejects. This is defensive dead code,
   not a functional bug — I could not construct a test input that reaches it, and none of the
   IF-8b throwers exercise it (`findReport`/`saveReport` throwing is correctly caught by
   `persist()`'s own catch instead, one call frame lower). Non-blocking, but worth a note for
   whoever next touches `ingestReport`: if it is refactored to genuinely throw before its own
   try-block (e.g. a future step added between the discovery-adapter hookup and the current top of
   `ingestReport`), this outer catch would mislabel that failure as `database write failed`, which
   would be wrong for anything other than an actual persistence failure.
2. **Note** — the plan's superseded-test table (`US-014-plan.md` "Superseded / edited US-012 and
   US-013 tests") is accurate against the actual diff: I checked each row against the current
   `ingest-etf.test.ts`/`run-daily.test.ts`/`daily-handler.test.ts`/`default-deps.cron.test.ts`
   content and found exactly the two behaviour-changed tests (the renamed "US-014 AC5..." test and
   the AC7-table row moved into IF-6a) plus vocabulary-only edits everywhere else — no test was
   deleted without a same-or-stricter replacement, satisfying AGENTS.md's "never weaken or skip a
   test" rule and the story's own tech-lead addendum.

### Scope deviations

None. `dev_minions/.files-touched.log` for US-014 matches the "Files changed" list in
`HANDOVER.md` exactly. `store.ts`, `run-daily.ts`, `default-deps.ts`, `load-etfs.ts`,
`lib/cron/**` source, `app/**`, `lib/extraction/**`, `lib/db/**`, `drizzle/**` and `package.json`
are all confirmed unchanged, as the plan specified. No new runtime dependency. `select-values.ts`'s
only change is the comment the plan called for — verified no logic diff by reading the file in
full.

### Non-negotiable rules (AGENTS.md)

- Deterministic label-based extraction: unaffected by this story (no adapter logic touched).
- Adapter-per-format / no silent fallback: `canHandle` false is a hard `parse_error`, never a
  `registry.detect` fallback (AC4, BD-14b). MET.
- Missing report leaves the day blank, no retry/alert: `missing`/`fetch_error`/`no_adapter`/
  date-less `parse_error` all write nothing (decision 1); nothing in this story schedules a retry
  or sends a notification. MET.
- next-intl ro+en: out of scope for this story (no UI strings — `detail`/`error_message` are
  explicitly documented as internal diagnostics, not UI text, story step 5). N/A.
- DEC-007 number display: not touched by this story.
- No secrets in code/logs: checked `outcome.ts` and `ingest-etf.ts` for `process.env` — none
  present (also enforced by `boundaries.test.ts`'s existing scan). `persist_error`'s message passes
  through a DB driver error's own text; the story's plan flags this as an open risk for US-015 to
  solve (redaction), not this story — correctly deferred, not silently ignored.
- No weakened/skipped tests: confirmed above (Findings #2).
- No scope creep: confirmed above.

### MANUAL-QA

None specific to this story, matching the plan. All three seeded ETFs use `brd-depositary`, so
`no_adapter` cannot occur in production today; the other failure paths depend on bvb.ro
misbehaving, which is not reproducible as a manual check. Live visibility of these codes is
US-015's `job_runs.log` (AC9 there) — correctly out of this story's scope.
