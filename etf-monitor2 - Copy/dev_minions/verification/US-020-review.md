# US-020 review — Admin: ETF management (add, remove, activate)

## Round 1 — 2026-09-26

Verdict: PASS

Reviewer: story-reviewer subagent (fresh context). Evidence below is from files I read myself this round
and from `pnpm typecheck` / `pnpm lint` that I ran myself this round. I did not re-run `pnpm test` or
`pnpm build` — HANDOVER.md reports both green (901 tests, `env -u DATABASE_URL pnpm build`); write "not
re-run" for those two.

### Acceptance criteria

- **AC1 (seed safe to re-run) — MET.** `lib/db/seed.ts` rewritten to insert-if-absent per-ETF CTE
  (`with "ins" as (insert ... on conflict ("symbol") do nothing returning "id") insert into
  "tracked_fields" ... from "ins" ...`, lib/db/seed.ts:44-52); `field_catalog` stays an upsert
  (lib/db/seed.ts:28-35); one `BatchRunner` call (lib/db/seed.ts:66-68). Tests: `SD-1`..`SD-6` in
  `lib/db/seed.pglite.test.ts:20-176` cover fresh-seed counts, idempotent re-seed, admin-change
  survival + deleted-tracked-field-stays-deleted (SD-3, lines 50-116), catalogue-label refresh (SD-4),
  pre-existing-symbol keeps its name and gets no tracked fields (SD-5, lines 140-162), and exactly one
  `BatchRunner` call (SD-6, lines 164-170). README.md:67-71 fixes W5 (CLI scripts read no env file) and
  README.md:85-89 documents `db:seed` as a safe-to-rerun bootstrap (W2).
- **AC2 (list) — MET.** `listEtfs` (lib/config/etfs.ts:53-69) returns `adapterAvailable = key !== null &&
  registry.get(key) !== undefined` (US-016 AC5 rule). Test `CE-L1` (lib/config/etfs.pglite.test.ts:53-81)
  covers an inactive ETF, a NULL key and an unregistered key, ordered by symbol. `app/admin/etfs/page.test.tsx`
  `PG-2/PG-3` (lines 36-54) and `PG-4` (lines 56-61) render the marker/empty-state in both locales.
- **AC3 (add) — MET.** `addEtf` (lib/config/etfs.ts:76-126) validates via `normaliseSymbol`/`normaliseName`
  before any DB or detect call. `CE-A1` (lib/config/etfs.pglite.test.ts:84-137) runs the real
  discover→download→extract→detect chain over the BTBETRETF fixtures with `fetch` mocked, and asserts zero
  `tracked_fields`/`reports` rows. `CE-A2` covers a null-detection insert. `CE-V`/`invalid symbol|name`
  unit tests in `lib/config/etfs.test.ts:29-72` assert zero runner/detect calls for every invalid input
  (empty, blank, hyphenated, non-Latin, non-string). `AR-1`-equivalent coverage: `result-messages.test.ts:30-44`
  maps `invalid_symbol`/`invalid_name` to `invalidSymbol`/`invalidName`, and `ActionMessage.test.tsx` proves
  the general translated-message-rendering mechanism (not a dedicated invalidSymbol render test, but the same
  code path as the tested `notFound` case — Note below).
- **AC4 (duplicates/reactivation) — MET.** `CE-D1` (already-active, zero detect calls, row snapshot
  unchanged), `CE-D2` (inactive reactivation keeps id/name/adapter_key/history, zero detect calls) and
  `CE-D3` (race between existence-check and insert never throws a unique violation) in
  `lib/config/etfs.pglite.test.ts:151-213`.
- **AC5 (remove/activate) — MET.** `setEtfActive` (lib/config/etfs.ts:130-140) deletes nothing.
  `CE-R1/CE-R2` (lib/config/etfs.pglite.test.ts:217-247) run the **shipped** `createHomeTableLoader`
  (lib/monitoring/home.ts) and `createDrizzleEtfLoader` (lib/ingestion/load-etfs.ts) after
  deactivate/reactivate and confirm absence/presence. `CE-R3` covers unknown symbol → `not_found`.
- **AC6 (adapter detection) — MET.** `detectAdapter` (lib/config/detect-adapter.ts:29-62) never throws
  (whole body in try/catch → `internal_error`), takes no store. `DA-1`..`DA-8b`
  (lib/config/detect-adapter.test.ts) cover exactly-one-match, `not_found`, `fetch_error` (page and PDF),
  `unreadable`, `no_match`, `ambiguous`, and two internal-error paths (a throw in `discover` and in
  `extractText`), each asserting call counts where relevant. `BC-3`
  (lib/config/boundaries.test.ts:64-70) asserts the source contains no `ReportStore`/`insert into`/
  `update "`/`"reports"`. `CE-A1` independently confirms zero `reports` rows after a real `addEtf` call.
- **AC7 (manual override/re-detect) — MET.** `setEtfAdapter`/`detectEtfAdapter`
  (lib/config/etfs.ts:144-180). `CE-M1`..`CE-M8` (lib/config/etfs.pglite.test.ts:255-319) cover storing a
  registered key or null, rejecting an unregistered key with the row unchanged, `not_found` on both
  functions, re-detect storing a null result with its reason (CE-M6), and detect receiving the row's
  **stored** `bvb_url` rather than one built from the input symbol (CE-M8).
- **AC8 (shared configuration layer) — MET.** `lib/config/boundaries.test.ts` enumerates every non-test
  `.ts` file under `lib/config/` (≥3, not vacuous, line 14-16) and checks no `next`/`react`/`app`/
  `components`/AI-looking import and no `process.env` (lines 18-46); `BC-2`/`BC-2b` confirm `etfs.ts` and
  `detect-adapter.ts` avoid concrete I/O and import the extraction types only as `import type`; `BC-4`
  confirms `default-deps.ts` is the only file wiring the adapter registry as a value import.
  `app/admin/etfs/actions.ts` contains no SQL and calls only `lib/config/etfs.ts` functions; `AR-6`-style
  coverage in `app/admin/etfs/actions.test.ts:29-41,64-101` proves each action calls its config function
  with exactly the fields it needs, ignoring extra form fields (`bvb_url`, `adapter_key`, `is_active`,
  `name`, `adapterKey`).
- **AC9 (failure states/secrets) — MET.** `app/admin/etfs/page.tsx:26-29` never renders the exception;
  `PG-5` (page.test.tsx:63-73) proves a thrown error with a connection-string-shaped message never leaks
  `connection refused`/`postgres://`/`secret` and shows the translated `loadError`. In
  `app/admin/etfs/actions.ts` every action wraps `createEtfConfigDeps(getDb())` + the config call in one
  try/catch → fixed `genericError`. Tested end to end for `addEtfAction` and `setEtfActiveAction`
  (actions.test.ts:51-61, 79-84: secret-shaped rejection → generic error, no leak, `revalidatePath` not
  called for the add case). Note: `setEtfAdapterAction`/`redetectEtfAdapterAction` share the identical
  try/catch structure (verified by reading actions.ts) but have no dedicated thrown-error test — see
  Warning W1 below.
- **AC10 (bilingual) — MET.** `messages/ro.json` and `messages/en.json` `Admin.*` namespaces have
  identical key sets (verified with `python3 -c "json.load(...)"` diff of both trees — same keys in
  `nav`, `index`, `etfs`, `messages`, `detectionReason`). `i18n/messages.test.ts` asserts `ro`/`en` have
  identical dotted key paths generically (covers `Admin.*` with no extra work). `AdminMessageKey` is
  typed from `ro.json` (`components/admin/action-state.ts:4`) and `global.d.ts` wires next-intl's
  `Messages` type to the same `ro.json`, so a message key or `DetectionReason` value missing from either
  catalogue is a type error — confirmed by a clean `pnpm typecheck` run (see below) after reading these
  files. `AL-1/AL-2` (app/admin/layout.test.tsx), `AI-1` (app/admin/page.test.tsx), `PG-2/3/4/5/6`
  (page.test.tsx), `HD-1`-equivalent (`components/AppHeader.test.tsx:31-40`, asserts both `Nav.admin` and
  `Nav.health` hrefs, N5) all render ro/en and assert the other locale's differing text is absent.
- **AC11 (offline/build-safe) — MET** for the parts I checked myself: `pnpm typecheck` (I ran it, clean,
  no output) and `pnpm lint` (I ran it, exit 0, only 3 pre-existing warnings in files not in this story's
  "Files changed" list). Every new PGlite/unit test stubs `fetch` to throw on any real call
  (`lib/config/etfs.pglite.test.ts:24-29`) or injects a `fetchImpl` (detect-adapter.test.ts), and mocks
  `@/lib/db` in every action/page test — no test reaches Neon or bvb.ro. `PG-7`
  (page.test.tsx:84-88) pins `dynamic = "force-dynamic"` and `maxDuration = 60`. `pnpm test` (901 passed)
  and `env -u DATABASE_URL pnpm build` — not re-run by me this round; taken from HANDOVER.md's report.

### Scope check

Grepped for the story's new exported symbols (`createEtfConfigDeps`, `listEtfs`, `detectAdapter`) across
the whole repo: every match is inside a file already on HANDOVER.md's "Files changed" list — no
unlisted file was touched for this story.

### Non-negotiable rules (AGENTS.md)

- Deterministic extraction: unchanged; detection reuses the existing label-based adapters, no AI.
- Adapter per report format: unchanged, only detection wiring added.
- Missing/unmatched report → empty/no-guess: `addEtf` inserts `adapter_key = null` when detection fails,
  never guesses (CE-A2).
- next-intl ro+en for every new UI string: verified above (AC10).
- Number display (DEC-007): not touched by this story (no new numeric UI).
- No secrets in code/logs: verified above (AC9); `boundaries.test.ts` also forbids `process.env` in
  `lib/config/*`.
- No weakened/skipped tests: none observed; all new tests assert real outcomes, none are `.skip`/`.todo`.
- No scope creep: confirmed above.

### Findings

- **Warning W1** — `app/admin/etfs/actions.test.ts` exercises the "config call throws → generic error,
  no leak, no revalidate" path for `addEtfAction` and `setEtfActiveAction` only. `setEtfAdapterAction`
  and `redetectEtfAdapterAction` share byte-for-byte the same try/catch/generic-error structure (read
  myself in `app/admin/etfs/actions.ts:55-83`), so AC9 is still functionally covered, but a story-tester
  or a future refactor would benefit from the same explicit test on the other two actions. Should fix,
  not blocking.
- **Note N1** — The plan named a dedicated `AM-2` test ("every `AdminMessageKey` and every
  `DetectionReason` exists in both catalogues, iterating the closed unions") that isn't present as a
  standalone runtime test. The equivalent guarantee exists at compile time (`AdminMessageKey`/next-intl's
  `Messages` type both derive from `ro.json`; a mismatched key used anywhere is a type error), confirmed
  by a clean `pnpm typecheck`. Not a gap in coverage, just a deviation from the plan's stated test list.
- **Note N2** — `setEtfActive`/`setEtfAdapter` accept a raw `symbol` string with no format validation
  (unlike `addEtf`). This is safe today because the only caller is the admin form, which always sends a
  hidden field populated from `listEtfs`'s own normalised output, and the SQL is parameterised
  (no injection risk) — an unknown/malformed symbol simply yields `not_found`. Worth a mention at demo if
  a future caller (e.g. Sprint 6 chat) passes raw user input straight to these functions.

No Critical finding.

Denied or attempted commands: none.
