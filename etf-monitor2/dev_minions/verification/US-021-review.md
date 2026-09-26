# US-021 — Independent review (Admin: tracked-field management per ETF)

## Round 1 — 2026-09-26

Verdict: PASS

Reviewer: story-reviewer subagent, fresh context. Never ran git (not even read-only). Evidence below is
from files I read myself and commands I ran myself in this round; the full suite (`pnpm test`) is the
tester's job and is not re-run here except for the specific files listed.

### Inputs read
- `AGENTS.md`, `dev_minions/backlog/stories/US-021.md`, `dev_minions/verification/US-021-plan.md`.
- `dev_minions/HANDOVER.md` "Files changed (active story)" list (US-021 section).
- Every file in that list, in full: `lib/config/tracked-fields.ts`, `lib/config/tracked-fields.pglite.test.ts`,
  `lib/config/tracked-fields.test.ts`, `lib/config/boundaries.test.ts`, `components/admin/TrackedFieldsAdmin.tsx`,
  `components/admin/EtfAdmin.tsx`, `app/admin/etfs/[symbol]/fields/{page.tsx,actions.ts,result-messages.ts,
  page.test.tsx,actions.test.ts,result-messages.test.ts}`, `app/admin/etfs/page.test.tsx`, `messages/{en,ro}.json`
  (Admin.fields / Admin.messages / Admin.etfs.fieldsLink keys), `components/admin/action-state.ts`,
  `lib/config/default-deps.ts` (structural fit of `EtfConfigDeps` into `TrackedFieldDeps`).
- `find -newer <US-020 story file>` (file-mtime scan, not git) to check nothing outside the declared list was
  touched for this story; everything extra belonged to US-020 (already closed) or to bookkeeping
  (`HANDOVER.md`, `.checkpoint.md`, `.files-touched.log`, automation logs, `status.md`,
  `DEC-016-shared-configuration-layer.md`, `decisions/README.md`, `SPRINT-05-review.md`), consistent with the
  plan's own list of files it read.

### Commands I ran myself this round
- `pnpm typecheck` → clean, 0 errors.
- `pnpm lint` → 0 errors, 3 pre-existing warnings in unrelated files (`lib/cron/default-deps.test.ts`,
  `lib/extraction/adapters/types.test.ts`, `lib/ingestion/load-etfs.test.ts`), matching HANDOVER's note.
- `pnpm vitest run lib/config/tracked-fields.pglite.test.ts lib/config/tracked-fields.test.ts
  lib/config/boundaries.test.ts "app/admin/etfs/[symbol]/fields" app/admin/etfs/page.test.tsx` →
  7 files, 72 tests, all passed.
- `pnpm vitest run i18n/messages.test.ts` → 4 tests passed (key-parity check, AC8).
- `env -u DATABASE_URL pnpm build` (webpack, `NODE_EXTRA_CA_CERTS` exported) → succeeded; route table lists
  `ƒ /admin/etfs/[symbol]/fields` as a new dynamic route.
- Full `pnpm test` was not re-run by me (that is the tester's evidence); I ran the story's own test files
  directly, listed above.

### Acceptance criteria

- **AC1 (available vs tracked)** — MET. `listFieldsForEtf` (`lib/config/tracked-fields.ts:55-145`) computes
  `available` as catalogue rows filtered by `availableFieldKeys` (registry `fieldKeys` ∩ catalogue keys,
  decision 7). Tests: `LF-1` (lib/config/tracked-fields.pglite.test.ts:54), `LF-2` (:84, catalogue row the
  adapter doesn't declare is excluded and flagged when tracked), `LF-3` (:97, custom registry intersection),
  `LF-4` (:114, symbol normalisation / unknown → null). Render: `FP-1`/`FP-2`
  (app/admin/etfs/[symbol]/fields/page.test.tsx:55,64) show locale labels/units; all ran green.

- **AC2 (track)** — MET. `trackField` (`tracked-fields.ts:151-218`) inserts with `display_order` computed by
  `coalesce(max(...), -1) + 1` inside the insert statement, `on conflict do nothing`. Tests: `TR-1`
  (pglite.test.ts:143, order 0), `TR-2` (:153, ignores other ETFs' rows), `TR-3` (:171, already-tracked no-op,
  full snapshot unchanged), `TR-4` (:183, six rejection cases incl. wrong adapter's key, unknown key, catalogue-
  only "ghost" key, null adapter, unregistered adapter, unknown symbol — snapshot unchanged), `TR-5` (:233, a
  racy runner clears the adapter key between the two `run` calls — the insert's own `where` re-check catches it,
  no row written), `TR-6` (:248, two concurrent tracks for different fields get distinct `display_order`). All
  ran green.

- **AC3 (untrack keeps history)** — MET. `untrackField` (:222-254) only deletes the one row. `UT-1`
  (pglite.test.ts:264) inserts a report + report_values for the field, untracks it, and asserts both tables'
  full row sets are unchanged (`toEqual`); `UT-2` (:297) untracks a flagged/not-available field; `UT-3` (:306)
  covers not-tracked / unknown-symbol. All ran green.

- **AC4 (order)** — MET. `moveField` (:260-322) does the read + the renumbering in **one** `deps.run(...)` call
  (two statements in the same array, confirmed by reading the code and by `MV-5`, which counts runner
  invocations and asserts exactly 1). `MV-1` (:319) swaps adjacent positions; `MV-2` (:338) renumbers a
  gapped/duplicate starting order to strict `0..n-1`; `MV-3` (:351) first-up/last-down is a no-op with an
  unchanged snapshot; `MV-4` (:365) the other ETF's rows are untouched; `MV-6` (:394) a runner that appends a
  failing statement (`select 1/0`) to the same call rejects and leaves the ETF's order unchanged. All ran green.

- **AC5 (home table follows)** — MET. `HF-1`/`DJ-1` (pglite.test.ts:436) drives `trackField`/`moveField`/
  `untrackField` and, with **no code between the reads**, calls the shipped `createHomeTableLoader` from
  `lib/monitoring/home.ts` (imported unmodified) after each step; asserts columns appear/disappear/move exactly
  per Sprint 4 decision 3, including the specified "two ETFs, same field, different positions, lowest wins" case
  (step 4). `HF-2` (:489) confirms an inactive ETF's tracked field alone produces no column. Ran green.

- **AC6 (daily job follows)** — MET. Same `HF-1`/`DJ-1` test also calls the shipped
  `createDrizzleEtfLoader` from `lib/ingestion/load-etfs.ts` (imported unmodified) after steps (1), (3), (5),
  (8) and asserts each ETF's `trackedFieldKeys` in the new order. Ran green.

- **AC7 (no adapter)** — MET. `listFieldsForEtf` sets `adapterAvailable:false` and `available:[]` when
  `adapter_key` is null or unregistered (`LF-5`/`LF-6`, pglite.test.ts:120); tracked rows are still returned,
  flagged `available:false`, with fallback labels. `TrackedFieldsAdmin.tsx` renders `noAdapter` and hides the
  entire "Available, not tracked" section (line 101) when `!adapterAvailable`, and offers only an untrack
  control for flagged rows (lines 80-93 gate the move buttons on `field.available`). `FP-3`
  (page.test.tsx:73) renders this case and checks the noAdapter message, the flagged-field note, an untrack
  control, and the absence of move controls. Ran green.

- **AC8 (bilingual, failure states)** — MET. `i18n/messages.test.ts` key-parity test passes unchanged (4
  tests). `en`/`ro` catalogues carry identical key sets for `Admin.fields`, `Admin.messages`, `Admin.etfs`
  (verified myself with a script diffing the parsed JSON — no missing/extra keys either direction); real,
  distinct RO translations for every new string (spot-checked `orderNote`, `nextRunNote`, `notAvailableNote`,
  etc. — not placeholders). `AdminMessageKey` is typed from `ro.json` (`components/admin/action-state.ts:4`),
  so `result-messages.ts` mapping to a non-existent key would be a typecheck error (typecheck passed). `FP-1`/
  `FP-2` (page.test.tsx:55,64) show ro vs en labels and confirm no cross-language leakage. `FP-4` (:89) — unknown
  symbol calls `notFound()` exactly once, outside the try/catch (`page.tsx:24-30`). `FP-5` (:95) — a thrown
  error containing a connection string and the word "secret" produces only the translated `loadError` text, no
  secret-shaped substrings, `notFound` not called. Actions: `FA` tests
  (actions.test.ts) show a secret-shaped rejection from each config function returns the generic error state
  with no leaked text in the JSON-serialised state, and no `revalidatePath` call on a non-ok result. All ran
  green.

- **AC9 (boundaries and gates)** — MET. `lib/config/tracked-fields.ts` imports only `drizzle-orm`, `../db/index`
  (type), `../ingestion/load-etfs`, `../ingestion/store`, `../extraction/adapters/types` (type), `./etfs` — no
  `next/*`, React, `app/`, or AI-looking specifier; `boundaries.test.ts` `BC-5` (line 85) asserts this plus no
  `unpdf` / `@neondatabase/serverless` / `./default-deps` / `extraction/discovery` / `extraction/pdf`, and ran
  green alongside the pre-existing `BC-1..BC-4`. `pnpm typecheck`, `pnpm lint`, the story's test files, and
  `env -u DATABASE_URL pnpm build` all passed when I ran them myself (above). No test in the files I read opens
  a network connection or imports `getDb` unmocked.

All nine acceptance criteria are MET on evidence I produced myself this round. None required MANUAL-QA — the
plan's MQ-1..MQ-4 are correctly deferred to the QA checklist stage, not needed to prove any AC here.

### Non-negotiable rules (AGENTS.md)
- Deterministic extraction: untouched by this story (no code changes in `lib/extraction/**`). N/A here.
- Missing report → empty day: untouched; AC3/R5 correctly note untracking hides history-page rows without
  deleting data, which matches "no backfill" (FR4.2) and doesn't regress FR4.1.
- Database write rules (DEC-010, one batch, `ok` never downgraded): `moveField`'s renumbering is one statement
  inside one `run` call (AC4 evidence above); `trackField`'s insert computes "last" inside the statement so two
  concurrent inserts can't collide (TR-6). `trackField` issues up to three separate `run()` calls total (read,
  insert, and a conditional post-insert "already tracked?" check) rather than the plan's described "two calls,
  one of which writes" — see Note N1 below; this is a design deviation, not a correctness gap, since the insert
  re-validates availability in its own `WHERE`/`EXISTS` clause (proven by `TR-5`) and no partial write is
  possible in the split.
- next-intl ro+en for every UI string: MET, see AC8.
- Number display (DEC-007): not applicable — the only numbers shown are 1-based positions, displayed as plain
  integers matching the pattern of neighbouring admin pages; no thousands/decimal formatting involved.
- No secrets in code or logs: MET, see AC8 (FP-5, FA tests).
- No weakened/skipped tests: none found; every test I opened runs a real assertion against real behaviour
  (PGlite-backed reads/writes, real render output, real mocked-rejection paths).
- No scope creep: no schema/migration changes (matches plan §3, "None"); `lib/monitoring/home.ts` and
  `lib/ingestion/load-etfs.ts` are unmodified (required by AC5/AC6, confirmed by reading them alongside the
  test); the file-mtime scan found nothing touched for this story outside HANDOVER's declared list.

### Findings

- **Warning W1** — The plan's AC9 test-mapping table names `FA-5`, a source scan of
  `app/admin/etfs/[symbol]/fields/actions.ts` asserting no `drizzle-orm` import and no raw SQL text. The
  `describe` block in `actions.test.ts` is literally titled `"trackFieldAction (FA-1, FA-5, FA-6)"`, but no such
  scan test exists in that file (grep confirms). I read `actions.ts` myself: it has no SQL text and imports only
  `next/cache`, `@/lib/db`, `@/lib/config/default-deps`, `@/lib/config/tracked-fields`, and local types, so the
  boundary itself is currently respected — but there is no automated regression test for it (unlike `BC-5` for
  the config layer). Note this is the same gap as US-020's own `actions.test.ts`, which also has no such scan —
  not a new regression introduced by this story, but also not newly fixed as the plan implied it would be.
  Should fix: add the promised source-scan test (or drop the "FA-5" label from the describe title if it isn't
  going to be implemented).

- **Note N1** — `trackField` makes up to three separate `BatchRunner` calls (each its own Neon HTTP transaction:
  read, insert, and a conditional "already tracked?" existence check), where the plan's §2.1 describes two.
  Functionally sound (see AC2/DEC-010 discussion above; `TR-5`/`TR-6` cover the races this could otherwise
  introduce) but an extra network round-trip per track call and a design deviation from the plan's documented
  statement count. Not required to fix.

- **Note N2** — `result-messages.test.ts` ("RM-1") checks concrete input/output pairs rather than the plan's
  described "iterate the closed unions and check every key exists in both catalogues" version. Low risk because
  `AdminMessageKey` is compile-time typed from `ro.json` (a typo would be a typecheck error) and the i18n
  key-parity test independently covers catalogue completeness. No action required.

No Critical findings.

Denied or attempted commands: none.
