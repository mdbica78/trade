# US-005 review — Seed ETF registry and field catalogue

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer note: local checks re-run independently (typecheck, lint, test, build) —
all green. `pnpm test`: 50/50 passed (11 files), including `lib/db/seed-data.test.ts`
(5 tests). `pnpm build` succeeded (webpack, per DEC-008) with no `DATABASE_URL` set,
confirming `scripts/db-seed.ts` is not pulled into the app bundle/build path.

### Acceptance criteria

- **AC1** (`pnpm db:seed` inserts exactly 3 ETFs, 8 catalogue fields, 6 tracked-field
  rows, 1 settings row) — **MET (manual QA)**. Genuinely needs a live Neon DB; AGENTS.md
  forbids tests calling live Neon. The plan (`dev_minions/verification/US-005-plan.md`
  line 12) marks this MANUAL-QA with a concrete check (`pnpm db:seed` twice, inspect row
  counts), which is appropriate. Code review gives strong static confidence the counts
  are right: `lib/db/seed-data.ts` has exactly 3 entries in `seedEtfs` (lines 1-23) and 8
  in `seedFieldCatalog` (lines 25-82, one-to-one with the story's table); `lib/db/seed.ts`
  applies `seedTrackedFields` (2 entries, lines 40-48) inside a loop over all 3 ETFs,
  giving 6 rows; `seedSettings` is inserted once (lines 51-57). No live-DB unit test
  exists for this AC (correctly — not possible per AGENTS.md), so this is not upgraded
  beyond "manual QA".
- **AC2** (running the seed twice is a no-op, exits successfully) — **MET (manual QA)**,
  same live-DB constraint as AC1. `lib/db/seed.ts` uses `onConflictDoUpdate` for every
  table (`etfs` target `etfs.symbol` line 18; `fieldCatalog` target
  `[adapterKey, fieldKey]` line 28; `trackedFields` target `[etfId, fieldKey]` line 45;
  `settings` target `settings.id` line 55), each matching the unique constraint declared
  on that table in `lib/db/schema.ts` (lines 17, 38, 53, and the `settings` PK). Because
  every `set:` clause writes back the same values already in `seedEtfs`/
  `seedFieldCatalog`/`seedTrackedFields`/`seedSettings`, a second run changes nothing in
  practice and cannot throw a unique-violation. No test exercises this against a real DB;
  plan correctly scopes it to manual QA.
- **AC3** (reads `DATABASE_URL` from env; no connection string committed) — **MET**.
  `scripts/db-seed.ts:1-4` calls `getDb()` with no arguments; `lib/db/index.ts:17-22`
  (`createDb`) defaults to `process.env.DATABASE_URL` and throws
  `MissingDatabaseUrlError` if unset/blank. Grepped `lib/db`, `scripts`, `package.json`
  and `.env.example` for `postgres(ql)://` — the only hits are pre-existing fake
  placeholders in `lib/db/index.test.ts` (from US-003, unrelated to this story) and
  `.env.example`'s `DATABASE_URL=` (empty). No secret committed.
- **AC4** (unit test: every tracked field's `fieldKey` exists in the catalogue; every
  ETF's `adapterKey` exists in the catalogue; test runs against the seed definition, not
  a live DB) — **MET**. `lib/db/seed-data.test.ts:10-22` — first two `it` blocks do
  exactly this, importing only from `./seed-data` (no DB import anywhere in that file).
  Verified real assertion strength: I mutated `seedTrackedFields`/`seedEtfs` mentally (not
  on disk) — e.g. a tracked field key with a typo, or an ETF `adapterKey` not present in
  the catalogue — and confirmed each would fail the corresponding `expect(...).toBe(true)`
  the test is not a tautology. Three extra tests (exact counts, no-duplicate-keys,
  settings shape) go beyond the letter of AC4 but are harmless, accurate extra coverage,
  not scope creep (still testing the same seed-data module).
- **AC5** (`pnpm test`, `pnpm lint`, `pnpm build` pass) — **MET**. Re-ran all three
  independently just now: `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` 50/50,
  `pnpm build` succeeded.

### Findings (ordered by severity)

No Critical or Warning findings.

1. (Note) `lib/db/seed.ts` runs each insert as an independent `await` (no transaction) —
   fine for a manual/CLI seed script with idempotent upserts; if a future story wraps
   `seed()` in an automated path (e.g. cron-triggered re-seed) it should reconsider
   atomicity. Not a defect for this story's scope (CLI-only, `pnpm db:seed`).
2. (Note) `lib/db/seed.ts:33-38` re-selects each ETF's `id` by `symbol` in a second pass
   rather than reusing the row returned by the first `insert().onConflictDoUpdate()`
   (drizzle-orm's neon-http driver does not return rows from `onConflictDoUpdate` without
   an explicit `.returning()`, so the extra `select` is likely a deliberate workaround,
   not an oversight). Correct, just an extra round trip; negligible for a one-off seed
   script.

### Scope deviations

None. Cross-checked `dev_minions/.files-touched.log` (DEC-011) for the `US-005` tag
against HANDOVER.md's "Files changed" list — they match exactly: `lib/db/seed-data.ts`,
`lib/db/seed-data.test.ts`, `lib/db/seed.ts`, `scripts/db-seed.ts`, `package.json` (+
`pnpm-lock.yaml`, auto-updated by `pnpm add -D tsx`). No report/report-values tables
touched, no UI added (correctly out of scope per the story), no ICBETNETF entry. `tsx`
devDependency is small and justified in the plan (needed to run TS outside Next/Vitest
for the CLI script).

### Non-negotiable rules (AGENTS.md) — checked, all satisfied or not applicable

- Deterministic label-based extraction / adapter-per-format — N/A, no extraction code in
  this story; `adapterKey: "brd-depositary"` is seeded as plain data only, consistent
  with the Sprint 2 adapter that will key off it.
- Missing-report handling — N/A, no report ingestion in this story.
- next-intl ro+en for every UI string — N/A, no UI in this story (explicitly out of
  scope, confirmed no `app/`/`components/` files touched).
- Number display (DEC-007) — N/A, no rendered numbers.
- Secrets — none in code/logs (see AC3 above).
- Tests — none weakened, skipped, or rewritten to fit the code; no `.skip`/`.todo` found
  in the new test file.
- Scope — none beyond the story (see Scope deviations above).
