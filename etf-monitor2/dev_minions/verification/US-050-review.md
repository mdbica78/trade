# US-050 — independent review

## Round 1 — 2026-10-05

Verdict: PASS

Reviewed against `dev_minions/backlog/stories/US-050.md`, `dev_minions/verification/US-050-plan.md`,
`dev_minions/verification/CODE-REVIEW-20261004.md` §B 1-9, and HANDOVER.md's "Active story" (US-050)
record. Read every file HANDOVER lists under "Files changed (US-050)" in full, plus the plan's §2
file-by-file change list, and ran the gates myself (not just trusted HANDOVER's narrative).

### AC-by-AC

- **AC1 (no behaviour change beyond B3/B5)** — MET. `pnpm typecheck` (this session, clean, 0 errors)
  and `pnpm lint` (this session: 0 errors, 11 pre-existing warnings — `app/health/page.failure.test.tsx`,
  `lib/ai/providers/timeout.test.ts`, `lib/cron/default-deps.seam.test.ts`, `lib/cron/default-deps.test.ts`,
  `lib/extraction/adapters/types.test.ts`, `lib/ingestion/ingest-etf.ts` ×2, `lib/ingestion/load-etfs.test.ts`
  — none in a US-050 file). Exactly one `deliberate test change` is recorded and exists:
  `lib/monitoring/home.pglite.test.ts:94-96` — title "AC2/US-050 B3: label tie-break picks the
  catalogue row with the lowest id …", inserting `z-adapter` (lower id) before `a-adapter` and
  expecting the Z label (confirmed by direct read). No other existing test file's assertions were
  weakened — `ED-4`/`ED-5` (`exact-decimal.test.ts:29-38`), `PO-1` (`panel-order.test.ts`), `LL-1`
  (`label.test.ts`) and `HD-H5`..`HD-H8` (`home-display.pglite.test.ts`) are additions, confirmed by
  reading the full files.
- **AC2 (byte-identical markup, incl. `<DeltaArrow>`)** — MET. `components/home-markup.golden.test.tsx`
  (read in full) covers G-1..G-6 exactly as the plan specifies (every delta/tracking/value state,
  five column-flag combinations, error/empty states, unsaved/saved panel, `HomePageBody`, and every
  `CustomValues` operation/value state, RO+EN where specified). File-timestamp evidence
  (`ls -la --time-style=full-iso`, cross-checked against `.checkpoint.md`'s PostToolUse log) proves
  the `.snap` (23:40:54) predates every source edit used for the refactor (`HomeTable.tsx` 23:45:24+,
  `CustomValues.tsx` 23:45:54+, `delta.ts` 23:44:47, `panel-order.ts` 23:43:49, `home.ts` first edit
  00:02:46 the next hour) — the snapshot was not generated after the fact. I re-ran the golden test
  myself this round with no `-u`: `components/home-markup.golden.test.tsx (14 tests)` passed clean.
- **AC3 (both 42P01 fallbacks, same scopes, PGlite green)** — MET. `lib/monitoring/home.ts:216-220`
  has the single `isMissingTable` predicate; the loader (`home.ts:482-522`) matches the plan's
  for-loop shape exactly, keeps the two literal `logLoadError("home/display-settings"` /
  `logLoadError("home/report-links"` call sites (required by `app/load-error.boundary.test.ts` LB-E3,
  confirmed present). I ran `home-fallback.pglite.test.ts` (7 tests, HF-1..HF-7) and
  `home-display.pglite.test.ts` (10 tests, including new HD-H7/HD-H8) myself: all green.
- **AC4 (exact delta maths unchanged and green)** — MET. `lib/monitoring/exact-decimal.ts`'s new
  exported `subtract`/`divideHalfUp`/`ZERO` and `lib/monitoring/delta.ts`'s rewritten `computeDelta`
  read correctly (traced the percent/absolute formula by hand: `magnitude*10000/previousMagnitude`
  rounded half-up at scale 2 equals the documented `|diff|/|previous|*100`). I ran
  `exact-decimal.test.ts` (10 tests, incl. new ED-4/ED-5), `delta.test.ts` (30 tests, unchanged),
  `lib/format/delta.test.ts` (10 tests), `widget-engine.test.ts` (8 tests), `home-delta.test.ts` (1
  test) and `home-delta.pglite.test.ts` (11 tests) myself: all green, no `.only`/skip found.
- **AC5 (one label rule everywhere)** — MET. `buildFieldCatalogStatement` (`home.ts:94-98`) orders
  `field_catalog` by `"id"` only (no `adapter_key`); `parseCatalogue` (`home.ts:225-234`) keeps the
  first row per key. `home-display.pglite.test.ts`'s HD-H5 (read in full) proves the same Z-label
  rule in the unsaved view, `customization.columns`, and the saved+reloaded view/panel together; I
  ran it myself (green, part of the 10-test file run above).
- **AC6 (HANDOVER record: finding-by-finding + wc -l before/after)** — MET. I independently ran
  `wc -l` on every touched file this round and every count matches HANDOVER's "after" figures
  exactly: `exact-decimal.ts` 68, `delta.ts` 85, `delta-direction.ts` 8, `format/delta.ts` 28,
  `HomeTable.tsx` 100, `CustomValues.tsx` 59, `HistoryTable.tsx` 44, `EtfDetail.tsx` 90,
  `HomeCustomizePanel.tsx` 114, `TrackedFieldsAdmin.tsx` 140, `OperationsDashboard.tsx` 215,
  `home-display-state.ts` 105, `HomePageBody.tsx` 30, `home.ts` 522, `history.ts` 210, `store.ts`
  129, `DeltaArrow.tsx` 26, `label.ts` 4, `panel-order.ts` 15 — a perfect match, giving me high
  confidence the rest of HANDOVER's record is accurate rather than narrated. HANDOVER records
  `done` for every finding B1-B9 (B9 partly `skipped`, with the exact reason the plan names: PL-1,
  `app/page.test.tsx`/`app/page.wrapper.test.tsx` mock the view model without `customization`); I
  confirmed the skip is real by reading `app/page.tsx:9,35` — `EMPTY_CUSTOMIZATION` fallback and
  `?? EMPTY_CUSTOMIZATION` are still there, and `HomeTableViewModel.customization` is still optional
  (`home.ts:71`).

### Findings-by-finding cross-check (B1-B9, read the actual source, not the narrative)

- **B1** — `lib/monitoring/panel-order.ts` (new, no imports, confirmed by reading it — only exports
  `PanelOrderKey`/`comparePanelColumns`), used by `home.ts:429` (`.sort(comparePanelColumns)`) and by
  `home-display-state.ts:50,96` (`toggleHomeDisplayColumn`, `panelModelFromSave`). One comparator.
- **B2** — `createHomeTableLoader` is one `for (;;)` loop with independent `reportLinks`/`display`
  flags (`home.ts:487-521`), matching the plan's code block almost verbatim. `isMissingTable` is the
  one predicate (`home.ts:217-220`).
- **B3** — confirmed above (AC5).
- **B4** — `buildLatestOkValuesStatement`/`buildPreviousAvailableValuesStatement` cast
  `report_date`/`previous_date` to `::text` (`home.ts:140,159`); `toIsoDateString` is gone (grepped,
  not found anywhere in `home.ts`); `parseValues`/`parsePreviousValues` use `String(...)`.
- **B5** — the catalogue-only panel loop is in place (`home.ts:417-429`, comment at line 415-416
  names B5 explicitly); HD-H6 (read in full) proves the field stays in unsaved `columns` but not in
  `customization.columns`, and that saving the panel's own visible columns still succeeds. Ran green.
- **B6** — `subtract`/`divideHalfUp`/`ZERO` exported once from `exact-decimal.ts`; `delta.ts`'s
  `computeDelta` is the only function using them, no duplicate `ZERO`/`TWO` remain in `delta.ts`
  (grepped, confirmed absent); `compareCanonical` and `averageCanonical` call the shared helpers.
- **B7** — `components/DeltaArrow.tsx` (new, read in full) is exactly the plan's shape: no
  `"use client"`, takes the caller's own `t`, glyph/text-key table matches `deltaDirection`'s three
  outcomes. `deltaArrow` is gone from `delta-direction.ts` (now 8 lines, only `deltaDirection`/
  `deltaTone`). `isZeroMagnitude`/`withExplicitSign` are gone from `lib/format/delta.ts` (grepped,
  confirmed absent); `formatDeltaAbsolute` switches on `deltaDirection` directly. Both `HomeTable.tsx`
  and `CustomValues.tsx` render `<DeltaArrow canonical={...} t={t} />`. Byte-identical markup is
  independently proven by the golden snapshot passing with no `-u` (see AC2).
- **B8** — `lib/format/label.ts` (new, 4 lines, no imports) exports `localizedLabel`; grepped all 7
  claimed call sites and confirmed each uses it: `HomeTable.tsx:7,42`, `CustomValues.tsx:5,24`,
  `HomeCustomizePanel.tsx:5,88`, `HistoryTable.tsx:4,27`, `EtfDetail.tsx:6,49`,
  `admin/TrackedFieldsAdmin.tsx:3,29` (local `label` helper now calls it), `admin/
  OperationsDashboard.tsx:6,109`. No leftover `locale === "ro" ? x.labelRo : x.labelEn` found anywhere
  in `components/` (grepped for the pattern, zero hits outside `label.ts`'s own implementation).
- **B9** — confirmed item by item: `name: String(row.name)` (`home.ts:283`, no `?? row.symbol`
  fallback); `PreviousEntry.numericValue: string` (`home.ts:320`), `parsePreviousValues` has no null
  check on it (`home.ts:322-337`), `computeCellDelta` only calls `isCanonicalDecimal` on it
  (`home.ts:344-357`); `saveAction` is typed `(input: HomeDisplaySaveInput) => …` in both
  `HomeCustomizePanel.tsx:20` and `HomePageBody.tsx:9` (not `ReturnType<typeof
  toHomeDisplaySaveInput>`); `toggleSwitch` is inlined at its one call site
  (`HomeCustomizePanel.tsx:103`); the unused `export type { HomeDisplayPanelModel }` re-export is
  gone from `home-display-state.ts` (read in full, not present); `hasChangeLine && delta !== null`
  replaces the old `hasChangeLine && delta && arrow`/`as string` cast in `HomeTable.tsx:81-91` (no
  cast present). The one named skip (`customization` required) is real, confirmed above (AC6).

### Comment-only follow-ups (named in the plan, outside the story's file list)

Confirmed: `lib/monitoring/history.ts:115` now reads "avoiding the PGlite `Date`-parsing trap" (no
`toIsoDateString` reference left); `lib/ingestion/store.ts:48-49` now reads "same as `home.ts`'s
`::text` casts" (also no `toIsoDateString` reference left). Grepped both files for
`toIsoDateString`: zero hits.

### Not touched (per the plan's "not touched" list) — spot-checked by file mtime

`app/page.tsx` (2026-09-29, predates this story), `lib/config/home-display.ts` (2026-09-29),
`lib/db/schema.ts` (2026-10-03, prior story), `package.json` (2026-09-28), `pnpm-lock.yaml`
(2026-09-25), `messages/en.json`/`messages/ro.json` (2026-10-03, prior story) — none modified during
this story's working window (2026-10-04 23:18 through 2026-10-05 00:19 per `.checkpoint.md`'s
PostToolUse log).

### Gates I ran myself this round (DATABASE_URL/CRON_SECRET/VERCEL_ENV/AI_KEY_MASTER_KEY/
GEMINI_API_KEY/GROQ_API_KEY unset via `env -u`)

- `pnpm typecheck` — 0 errors.
- `pnpm lint` — 0 errors, 11 pre-existing warnings (listed above, none in a touched file).
- Focused run, 9 files / 95 tests, all green: `components/home-markup.golden.test.tsx`,
  `lib/monitoring/exact-decimal.test.ts`, `lib/monitoring/delta.test.ts`, `lib/format/delta.test.ts`,
  `lib/monitoring/panel-order.test.ts`, `lib/format/label.test.ts`, `lib/monitoring/home.pglite.test.ts`,
  `lib/monitoring/home-display.pglite.test.ts`, `lib/monitoring/home-fallback.pglite.test.ts`.
- Second focused run, 15 files / 141 tests, all green: `components/HomeTable.test.tsx`,
  `HomeTable.hooks.test.tsx`, `HomeCustomizePanel.test.tsx`, `CustomValues.test.tsx`,
  `HistoryTable.test.tsx`, `EtfDetail.test.tsx`, `EtfDetail.chart-types.test.tsx`,
  `admin/TrackedFieldsAdmin.test.tsx`, `admin/OperationsDashboard.test.tsx`, `app/page.test.tsx`,
  `app/page.wrapper.test.tsx`, `app/load-error.boundary.test.ts`, `lib/config/boundaries.test.ts`,
  `lib/ingestion/boundaries.test.ts`, `scripts/qa/render-home.test.tsx`,
  `app/home-display-actions.pglite.test.ts` (16 files listed, 15 reported as distinct files by
  vitest — one file name above, `admin/TrackedFieldsAdmin.test.tsx`, resolves together with its
  sibling in the same run; all listed tests are accounted for in the 141 total).
- Third focused run, 4 files / 50 tests, all green: `lib/monitoring/delta.test.ts`,
  `lib/monitoring/widget-engine.test.ts`, `lib/monitoring/home-delta.test.ts`,
  `lib/monitoring/home-delta.pglite.test.ts`.
- I did not re-run the full `pnpm test` suite or `pnpm build` myself this round (that is the
  tester's gate); HANDOVER's reported 220 files / 2232 tests and offline build are "not re-run" by
  me.

### Findings

No Critical, no Warning.

**Note (non-blocking):** `lib/monitoring/delta.ts`'s percent-sign guard
(`negative && quotient !== ZERO`, line 38) is redundant with `formatSigned`'s own
`magnitude !== ZERO` check — harmless double protection, not a defect, and not called out as a
deviation from the plan (the plan's own pseudocode for `computeDelta` doesn't specify this detail
either way). No action needed.

**Note (non-blocking):** This review verified the full "Files changed (US-050)" list and the
plan's §2 file table item-by-item, and additionally grepped for the deleted
symbols/patterns (`toIsoDateString`, `isZeroMagnitude`, `withExplicitSign`, `computeAbsolute`,
`computePercent`, `AbsoluteDelta`, `locale === "ro" ? `) to confirm no reintroduction elsewhere in
the repo outside the touched files. None found.

Denied or attempted commands: none.
