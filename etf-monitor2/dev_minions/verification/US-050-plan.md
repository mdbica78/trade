# US-050 plan: simplify the home page and monitoring code

> story-planner, 2026-10-04. Binding text: `backlog/stories/US-050.md`, `verification/CODE-REVIEW-20261004.md`
> ("Rules for every Sprint 12 story" and §B items 1-9), DEC-007, DEC-019 §3, DEC-020 §6/§10, exact bigint decimals.
> No schema change, no migration, no new dependency, no message-key change. Depends on US-049 being finished first:
> both stories touch `lib/ingestion/store.ts` exports that `home.ts` imports (`rowsOf`, `BatchRunner`, `neonBatchRunner`).

Nothing TECHNICAL is open. Planner-level points PL-1..PL-7 (§5) are settled here; the tech-lead can overrule any of them
at the sprint audit. There is no PRODUCT item: the two behaviour changes (B3, B5) are named as allowed in the story.
**Not blocked.**

## 0. What the code and tests show (this shapes the plan)

1. **B9 "make `customization` required" is skipped (PL-1).** `app/page.test.tsx` (4 cases) and `app/page.wrapper.test.tsx`
   (2 cases) mock the loader with `HomeTableViewModel` values that have no `customization`. `tsconfig.json` includes
   `**/*.ts(x)`, so a required field breaks `pnpm typecheck` on those files. Fixing that means editing behaviour-test
   fixtures for code that is not deleted (rule 2). `app/page.tsx` keeps `?? EMPTY_CUSTOMIZATION` and is **not touched**.
   HANDOVER line: `skipped: B9 customization required, reason: page tests mock the view model without it (rule 2)`.
2. **`lib/monitoring/delta.ts` keeps `export { isCanonicalDecimal }`.** `lib/monitoring/delta.test.ts` imports it from
   `./delta`. B6 only changes `home.ts` to import it from `./exact-decimal` directly.
3. **`formatDeltaAbsolute` stays exported.** `lib/format/delta.test.ts` imports it. "Fold" means: delete the private
   `withExplicitSign` and `isZeroMagnitude`; `formatDeltaAbsolute` holds the logic; `formatDeltaPercent` calls it.
4. **The two zero detectors agree on every reachable input.** `isZeroMagnitude` is `/^-?0(\.0+)?$/`, `deltaDirection` is
   `/^0+(?:\.0+)?$/` after removing a leading `-`. They differ only for strings with more than one leading zero
   (`"00"`, `"-00.0"`). Every delta string comes from `formatSigned` (`exact-decimal.ts`), which never prints more than one
   leading zero, through `computeDelta` (home table) or `evaluateWidget` (widget `change`/`percent_change`). Keep
   `deltaDirection` (the broader, correct one); `formatDeltaAbsolute` switches on it (PL-2).
5. **No exact-markup test covers the change line or the widget arrow.** `HomeTable.test.tsx`, `CustomValues.test.tsx`
   and `HomeCustomizePanel.test.tsx` use `toContain`/order checks. AC2 says "byte-identical", so a golden test is written
   and run **before** any source edit (§1 AC2, §2 step 1). No snapshot is used anywhere in the repo yet; Vitest's built-in
   `toMatchSnapshot` is used (no new dependency). The `.snap` file is committed.
6. **Boundary tests that pin `home.ts`:**
   - LB-E3 (`app/load-error.boundary.test.ts`) needs the literal text `logLoadError("home/report-links"` in `home.ts`.
     Both scopes stay as **literal** calls; do not move them into a table (`logLoadError(fallback.scope, …)` fails LB-E3).
   - BC-10 (`lib/config/boundaries.test.ts`): only `config/home-display.ts`, `db/schema.ts` and `monitoring/home.ts` may
     contain the text `home_display_settings|columns|etfs`. Any new lib file must not mention those names.
   - BD-16 (`lib/ingestion/boundaries.test.ts`): only `monitoring/home.ts` may contain `from "etf_report_links"` or
     `join "etf_report_links"`.
7. **Client bundle.** `components/HomeCustomizePanel.tsx` is `"use client"` and imports `components/home-display-state.ts`.
   `home.ts` imports drizzle, neon and the adapter registry (unpdf). The shared panel comparator (B1) must therefore live
   in a new import-free file, not in `home.ts` (PL-3).
8. **One existing test pins the old label rule** (B3): `lib/monitoring/home.pglite.test.ts`, "AC2: label tie-break picks
   the alphabetically first adapter_key …". It inserts `z-adapter` first (lower id) and expects the `a-adapter` label.
   Under the allowed change it must expect the `z-adapter` label. This is the only deliberate test change (§3). It
   supersedes Sprint 4 decision 3's alphabetical tie-break (`backlog/stories/US-016.md` line 99). The Technical Lead
   approved that in the code review. Do not edit the old sprint or story files.
9. **Production effect of B3 is nil today.** In `lib/db/seed-data.ts` the shared keys (`nav_per_unit`,
   `units_in_circulation`) have identical labels for both adapters, and `seed-data.test.ts` SL-1 enforces that. The
   brd rows are also seeded first (lower ids).
10. **`lib/config/home-display.ts` already uses the lowest-id rule** (`order by "field_key", "id"`, first per key). So
    after B3 the default view, the saved view, the panel and the post-save panel (`panelModelFromSave` → `saved.catalogue`)
    all use one rule. `lib/config/home-display.ts` is not touched (US-052 owns `lib/config`).
11. **B5 has no pinning test.** The only PGlite panel tests (`home-display.pglite.test.ts` HD-H1/H2,
    `app/home-display-actions.pglite.test.ts` HD-A1..A6) give every tracked field a catalogue row.
12. **No BigInt literals.** `tsconfig` targets ES2017 (DEC-008), so `5n` does not compile. Tests and code use
    `BigInt(5)`, as `delta.ts` does today.

## 1. Acceptance criteria → tests

| AC | Proof |
|---|---|
| AC1 no behaviour change beyond B3/B5 | `pnpm typecheck`, `pnpm lint`, offline `pnpm build`, full `pnpm test`, `bash scripts/claude/predeploy-check.sh`, all with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset. HANDOVER lists exactly one `deliberate test change` (§3). No other existing test file is edited. New test files and new cases may be added. |
| AC2 byte-identical markup, incl. `<DeltaArrow>` | New **`components/home-markup.golden.test.tsx`**, written and run **before** the refactor. It generates `components/__snapshots__/home-markup.golden.test.tsx.snap`, which is committed and then left alone. Each case is `renderToStaticMarkup(...)` → `toMatchSnapshot()`, for both `ro` and `en`. **G-1** `HomeTable` with a fixture that has a gain, a loss, a flat (`"0"`), a zero-divisor (`percent: null`), `delta: null`, `{tracked:false}`, `value: null`, `adapterAvailable: false`, with and without `latestPdfUrl`. **G-2** the same rows under five column-flag sets: all default (flags absent), arrow only, absolute only, percent only, all `false`. **G-3** `HomeTable` `status:"error"` and the empty rows. **G-4** `HomeCustomizePanel` with `initialOpen` for a saved and an unsaved model. **G-5** `HomePageBody` with `ok` and `error` table props. **G-6** `CustomValues` with change gain/loss/flat (`"0.00"`), `percent_change` with a value and with `null`, `average`, `insufficient_history`, a custom `title`. After the refactor the snapshot must match with **no `-u`**. Existing `HomeTable.test.tsx`, `HomeTable.hooks.test.tsx`, `HomeCustomizePanel.test.tsx`, `CustomValues.test.tsx`, `HistoryTable.test.tsx`, `EtfDetail*.test.tsx`, `admin/TrackedFieldsAdmin` and `OperationsDashboard` tests, `app/page*.test.tsx` and `scripts/qa/render-home.test.tsx` pass unchanged. |
| AC3 both 42P01 fallbacks, same scopes | Unchanged and green: `home-fallback.pglite.test.ts` HF-1..HF-7 (call counts 2/1/1/1/2/1 stay exact), `home-display.pglite.test.ts` HD-H3 (×3 tables), HD-H4, LB-E3. New in `home-display.pglite.test.ts`: **HD-H7** drop `etf_report_links` **and** `home_display_columns`. The result has `customization.saved === false` and the unsaved default columns. The runner is called exactly 3 times. There are exactly two `[load-error]` lines, and their scope set (order-free) is `{home/report-links, home/display-settings}`. **HD-H8** a saved view (via `saveHomeDisplay`), then drop `etf_report_links`. The saved columns and ETF filter are kept, there are 2 runner calls, and there is one `home/report-links` line. |
| AC4 exact delta maths | Unchanged and green: `lib/monitoring/delta.test.ts`, `exact-decimal.test.ts`, `widget-engine.test.ts`, `home-delta.test.ts`, `home-delta.pglite.test.ts`, `lib/format/delta.test.ts`. New in `exact-decimal.test.ts` (added cases only): **ED-4** `subtract` at mixed scales: `"1.5"` − `"0.25"` gives difference `BigInt(125)` at scale 2, and `"-0.001"` − `"0"` gives `BigInt(-1)` at scale 3. **ED-5** `divideHalfUp(BigInt(5), BigInt(2))` is `BigInt(3)`, `(4, 3)` gives 1, `(0, 7)` gives 0. |
| AC5 one label rule | New **HD-H5** (`home-display.pglite.test.ts`). Insert catalogue `('z-adapter','shared_field','Z ro','Z en')` and then `('a-adapter','shared_field','A ro','A en')`, and track `shared_field` for AAA. The default view's column, and its `customization.columns` entry, have `labelRo "Z ro"`/`labelEn "Z en"`. Then save via `saveHomeDisplay` with `shared_field` at position 0. `display.columns[0]` and the `shared_field` entry in `display.catalogue` carry the Z labels. The reloaded saved view's column and panel entry carry the Z labels. Plus the edited old test (§3). **HD-H6** (B5): track `no_catalogue_field` for AAA with no catalogue row. The unsaved `columns` include it (label = key), `customization.columns` does not, and `saveHomeDisplay` of the panel's visible columns returns `ok: true`. |
| AC6 HANDOVER record | One line per finding B1..B9 (`done` / `skipped: <reason>`; B9's customization part is skipped, §0.1). Add `wc -l` before and after for every source file in §2. Take the "before" counts **before the first edit**. New files count as 0 before. Documentation check, no test. |

New small unit test: **LL-1** `lib/format/label.test.ts`: `localizedLabel({labelRo:"R",labelEn:"E"}, "ro") === "R"`, and
`"en"` gives `"E"`. **PO-1** `lib/monitoring/panel-order.test.ts`: positioned before unpositioned, then by position, then
by `catalogueOrder`. No criterion needs a live resource. The Codex QA spot-check is in the story.

## 2. Files and the change per finding (order of work)

**Step 0.** Run `wc -l` on every file below and record the counts in HANDOVER.
**Step 1.** Write `components/home-markup.golden.test.tsx` (AC2) and run it once against the unchanged code, so the
`.snap` file is created. Record in HANDOVER that the snapshot predates the refactor. Also add HD-H7/HD-H8 and confirm
they pass on the **old** loader. HD-H5/HD-H6 are written now and expected to fail until B3/B5 land.

| File | Change |
|---|---|
| `lib/monitoring/exact-decimal.ts` | **B6.** Export `ZERO` and add exported `subtract(a: ScaledDecimal, b: ScaledDecimal): { difference: bigint; scale: number }` (common scale = max, `rescale` both, subtract). Add exported `divideHalfUp(numerator: bigint, divisor: bigint): bigint` for non-negative inputs (`q = n / d; if ((n % d) * TWO >= d) q += 1`). `compareCanonical` uses `subtract`. `averageCanonical` uses `divideHalfUp(signed, divisor)`. `TWO` stays private here (its only user). |
| `lib/monitoring/delta.ts` | **B6.** Delete the local `ZERO`/`TWO`, `AbsoluteDelta`, `computeAbsolute` and `computePercent`. `computeDelta` parses both values, calls `subtract` once, gets `magnitude = |difference|`, and sets `absolute = formatSigned(magnitude, scale, difference < ZERO)` and `percent = previous.digits === ZERO ? null : formatSigned(divideHalfUp(magnitude * TEN_THOUSAND, |rescale(previous, scale)|), 2, difference < ZERO)`. `formatSigned` already drops the sign of a zero magnitude, so the old `isZero` guard is redundant. Keep `export { isCanonicalDecimal }` (§0.2), `previousCalendarDay` and its doc comments. Keep the "no Number/float" header comment. |
| `lib/format/delta-direction.ts` | **B7.** Keep `deltaDirection` and `deltaTone`. Move `deltaArrow` (glyph and text key) into `components/DeltaArrow.tsx`, its only user after this story. Delete it here. |
| `lib/format/delta.ts` | **B7.** Delete `isZeroMagnitude` and `withExplicitSign`. `formatDeltaAbsolute` switches on `deltaDirection(canonical)`: `flat` → `formatNumber(canonical.replace(/^-/, ""), locale)`, `loss` → `formatNumber(canonical, locale)`, `gain` → `` `+${formatNumber(canonical, locale)}` ``. `formatDeltaPercent` → `` `${formatDeltaAbsolute(canonical, locale)}%` ``. Keep both doc comments, shortened. |
| `components/DeltaArrow.tsx` (new) | **B7.** No `"use client"`. Props: `{ canonical: string; t: (key: "arrowUp" \| "arrowDown" \| "arrowFlat") => string }`. It returns exactly `<><span aria-hidden="true">{glyph}</span><span className="sr-only">{t(textKey)}</span>{" "}</>`, with glyphs ▲/▼/– by `deltaDirection`. Callers pass their own namespaced `t` (`Home` / `EtfDetail.widgets`). Both namespaces already define the three keys. |
| `components/HomeTable.tsx` | **B7/B8/B9.** Header label → `localizedLabel(column, locale)`. Cell: `const percent = column.showPercent === false ? null : delta?.percent ?? null;` and `const hasChangeLine = delta !== null && (showArrow \|\| showAbsolute \|\| percent !== null);`. Render `{hasChangeLine && (<div …>{showArrow && <DeltaArrow canonical={delta.absolute} t={t} />}{showAbsolute && formatDeltaAbsolute(…)}{percent !== null && <> {formatDeltaPercent(percent, locale)}</>}</div>)}`. This drops `&& delta && arrow` and the `as string` cast. `delta` is a `const`, so TS narrows through the aliased `hasChangeLine`. If the installed TS version does not narrow it, use `delta !== null && hasChangeLine` (still no cast). The output stays identical: `delta === null` gives no line, as today. |
| `components/CustomValues.tsx` | **B7/B8.** `field: localizedLabel(widget, locale)`. `const signed = change && value !== null ? value : null;`, `className={signed === null ? undefined : deltaTone(signed)}`, `{signed !== null && <DeltaArrow canonical={signed} t={t} />}`. `displayed` is unchanged. |
| `lib/format/label.ts` (new) | **B8.** `export function localizedLabel(item: { labelRo: string; labelEn: string }, locale: string): string`. It has no imports and is client-safe. It takes `string` because `HomeCustomizePanel` uses untyped `useLocale()`. |
| `components/HistoryTable.tsx`, `components/EtfDetail.tsx`, `components/HomeCustomizePanel.tsx`, `components/admin/TrackedFieldsAdmin.tsx`, `components/admin/OperationsDashboard.tsx` | **B8.** Replace the 5 remaining `locale === "ro" ? x.labelRo : x.labelEn` uses (TrackedFieldsAdmin: its local `label` helper becomes calls to `localizedLabel`). Change nothing else in the admin files (US-052 owns their other findings). |
| `lib/monitoring/panel-order.ts` (new) | **B1.** `export function comparePanelColumns(a: PanelOrderKey, b: PanelOrderKey): number`, where `PanelOrderKey = { position: number \| null; catalogueOrder: number }`. Body = today's `home-display-state.ts:97-104` comparator. No imports. Must not mention `home_display_*` (BC-10). |
| `components/home-display-state.ts` | **B1/B9.** `panelModelFromSave` sorts with `comparePanelColumns`. Optionally `toggleHomeDisplayColumn`'s `remaining.sort` does too: all positions there are `null`, so the result is the same. Delete `export type { HomeDisplayPanelModel } …` (no importer, §0). |
| `components/HomeCustomizePanel.tsx` | **B9.** `saveAction: (input: HomeDisplaySaveInput) => …`. Inline `toggleSwitch` as `onChange={() => save(toggleHomeDisplaySwitch(draft, name))}`. |
| `components/HomePageBody.tsx` | **B9.** `saveAction: (input: HomeDisplaySaveInput) => …`, import the type instead of `typeof toHomeDisplaySaveInput`. |
| `lib/monitoring/home.ts` | **B1-B5, B9**, see §2.1. |
| `lib/monitoring/history.ts` | Comment only: lines 115-116 mention `home.ts`'s `toIsoDateString`. Reword them to "the PGlite `Date`-parsing trap". |
| `lib/ingestion/store.ts` | Comment only, optional (outside the story's file list, so log it in HANDOVER). Lines 48-49 say "same as `home.ts`'s `toIsoDateString`". Reword to "same as `home.ts`'s `::text` casts". |
| `app/page.tsx` | Not touched (§0.1). |

### 2.1 `lib/monitoring/home.ts`

- **B4.** `buildLatestOkValuesStatement`: select `"latest"."report_date"::text as "report_date"`.
  `buildPreviousAvailableValuesStatement`: select `"candidate"."report_date"::text as "previous_date"`. Its
  `order by "candidate"."report_date" desc` refers to the input column, so the ordering is unchanged. Delete
  `toIsoDateString` and its comment. `parseValues`/`parsePreviousValues` use `String(...)`. `::text` gives exactly
  what neon-http already returns (raw text under the default ISO `DateStyle`), and the same thing `store.ts` already does.
  The PGlite tests prove the strings (`home-delta.pglite.test.ts`, `home.pglite.test.ts` AC3).
- **B3.** `buildFieldCatalogStatement`: `select "id", "field_key", "label_ro", "label_en" from "field_catalog" order by "id"`.
  Update its doc comment to "first row per `field_key` = lowest id". One helper,
  `parseCatalogue(rows): Map<string, CatalogueField>`, keeps the first row per key, with `order: Number(row.id)`. Delete
  `parseCatalogueFields`, its JS sort and both `Number.isFinite` guards. `parseColumns(etfRows, labels)` takes the map
  instead of building its own label map. A local `labelOf(fieldKey)` returns the map entry or
  `{ labelRo: fieldKey, labelEn: fieldKey }`, and is used by the default columns and the saved columns.
- **B1.** Restructure `buildViewModel` to take one object
  `{ etfs, catalog, values, previous, links, settings, displayColumns, displayEtfs }` (all row arrays) plus `registry`:
  - Parse the saved column rows **once**: `{ fieldKey, showAbsolute, showPercent, showArrow }` with `nullablePgBoolean`.
  - `columns = saved ? savedColumns.map(c => ({ fieldKey, ...labelOf, showX: c.showX ?? globalX })) : defaultColumns`.
    This is chosen once. `positionOf = new Map(columns.map((c, i) => [c.fieldKey, i]))`, so the second
    `saved ? savedColumns : defaultColumns` goes away.
  - `overrides = new Map(saved ? savedColumns.map(c => [c.fieldKey, c]) : [])`. Keep the `saved ?` guard: today an
    orphan `home_display_columns` row with no settings row is ignored, and it must stay ignored.
  - Panel columns = `[...catalogue.values()].map(field => ({ fieldKey, labelRo, labelEn, visible: positionOf.has(key),
    position: positionOf.get(key) ?? null, catalogueOrder: field.order, showAbsolute: overrides.get(key)?.showAbsolute
    ?? null, … })).sort(comparePanelColumns)`. One catalogue map (the old `labels` and `panelColumns` maps merge).
  - **B5.** The loop that adds tracked fields without a catalogue row (old lines 459-463) is deleted. The panel is the
    catalogue only.
  - The rows/cells logic is unchanged.
- **B9 in home.ts.** `name: String(row.name)` (`etfs.name` is `notNull`). Update the `HomeRow.name` doc ("Falls back to
  the symbol" → delete that sentence). `parsePreviousValues` drops the `field_key` null check: it comes from an inner
  join and `report_values.field_key` is `notNull`. `PreviousEntry.numericValue` becomes `string`: the statement filters
  `numeric_value is not null`. `computeCellDelta` drops its `=== null` check for it and keeps `isCanonicalDecimal`.
  Import `isCanonicalDecimal` from `./exact-decimal` and `computeDelta`/`Delta` from `./delta`. `parseValues` keeps its
  null checks (left join).
- **B2/B9.** One predicate:
  `function isMissingTable(error: unknown, tables: readonly string[]): boolean { const { code, relation } = describeLoadError(error); return code === "42P01" && relation !== undefined && tables.includes(relation); }`.
  Use it with `HOME_DISPLAY_TABLES` (a plain array) and `[REPORT_LINKS_TABLE]`.
  Delete `isMissingReportLinksTable` and `isMissingHomeDisplayTable`. The loader becomes:

```ts
return async () => {
  let reportLinks = true;
  let display = true;
  for (;;) {
    try {
      const results = await run([
        buildActiveEtfsStatement(db), buildFieldCatalogStatement(db), buildLatestOkValuesStatement(db),
        buildPreviousAvailableValuesStatement(db),
        reportLinks ? buildLatestReportLinksStatement(db) : buildReportOnlyLinksStatement(db),
        ...(display ? [buildHomeDisplaySettingsStatement(db), buildHomeDisplayColumnsStatement(db), buildHomeDisplayEtfsStatement(db)] : []),
      ]);
      const [etfs, catalog, values, previous, links, settings, displayColumns, displayEtfs] =
        Array.from({ length: 8 }, (_, i) => rowsOf(results[i]));   // missing display results -> []
      return buildViewModel({ etfs, catalog, values, previous, links, settings, displayColumns, displayEtfs }, registry);
    } catch (error) {
      if (display && isMissingTable(error, HOME_DISPLAY_TABLES)) { logLoadError("home/display-settings", error); display = false; continue; }
      if (reportLinks && isMissingTable(error, [REPORT_LINKS_TABLE])) { logLoadError("home/report-links", error); reportLinks = false; continue; }
      throw error;
    }
  }
};
```

  Each flag flips at most once, so there are at most 3 calls. That matches today's worst case.

  Equivalence check against today's paths: normal = 1 call. Links missing only = 2 calls (HF-1, HF-5), and the saved
  display is kept (HD-H8). Display missing only = 2 calls, unsaved view (HD-H3). Other errors propagate after 1 call
  (HF-2/3/4, HD-H4).
  The only observable difference: when **both** tables are missing, the two log lines come out in the opposite order,
  because the link statement now runs before the display statements. No test pins that order. HD-H7 checks the scope
  set. The review asked for this order ("display statements after the five home statements").
- Delete `makeViewModel`, `loadDefaultView`, the offset slicing and the `homeStatements` helper. Keep every exported
  statement builder (review: "statement builders stay").

## 3. Deliberate test changes (the only edit to an existing test)

- `lib/monitoring/home.pglite.test.ts`, "AC2: label tie-break picks the alphabetically first adapter_key when two
  adapters define the same field_key". The new title is "AC2/US-050 B3: label tie-break picks the catalogue row with the
  lowest id …". Expected `{ fieldKey: "shared_field", labelRo: "Z label ro", labelEn: "Z label en" }`. Reason: B3 allowed
  change. The old alphabetical rule is deleted code.

No other existing test is edited, deleted or loosened. If one fails, the refactor is wrong. Fix the code, not the test.

## 4. Data model / migration

None. Two read statements change only their select list and order (`::text` casts; catalogue `order by "id"`). No
schema change, no `pnpm db:generate`. `dev_minions/architecture/data-model.md` is unaffected: it has no read-side label rule.

## 5. Risks and planner-level points (settled)

- **PL-1** B9 `customization` required → skipped (§0.1). **PL-2** keep `deltaDirection` as the single zero detector
  (§0.4). **PL-3** the panel comparator goes in new import-free `lib/monitoring/panel-order.ts`, not `home.ts` (client
  bundle) and not `components/` (lib must not depend on components). **PL-4** `::text` instead of
  `to_char(…,'YYYY-MM-DD')`: it matches the current neon-http output exactly. `history.ts` keeps its `to_char`.
  **PL-5** `DeltaArrow` takes the caller's `t`, because the two callers use different message namespaces. No new message
  keys. **PL-6** `divideHalfUp` is added so `delta.ts` needs no `TWO` and the rounding exists once. It is the same
  half-away-from-zero rounding on non-negative magnitudes. **PL-7** golden snapshot first (§0.5): the only way to prove
  "byte-identical" where no exact-markup test exists.
- **Risk:** the golden snapshot is generated after a source edit, so it proves nothing. Mitigation: step 1 runs it first.
  HANDOVER records it, and the reviewer checks that `.snap` predates the source edits (file modification times in
  `.checkpoint.md`/`.files-touched.log`).
- **Risk:** `Array.from({length: 8}, …)` hides a statement-order mistake. HD-H2 (saved view), HD-H3 and HF-1 catch any
  mix-up of display and home results.
- **Risk:** React text-node output across the new `DeltaArrow` component boundary. `renderToStaticMarkup` output does
  not depend on component boundaries. G-1/G-2/G-6 prove it.
- Smallest design: no new abstraction beyond the four named helpers (`subtract`, `divideHalfUp`, `localizedLabel`,
  `comparePanelColumns`) and one component (`DeltaArrow`). Line counts: `home.ts` should drop about 90-110 lines, the
  delta/format files about 35, the components about 15. The three new files add about 35.

## 6. Decisions needed

None. Every item is TECHNICAL and settled by the code review and §5. There is no PRODUCT item: B3 and B5 are allowed
changes named in the story. B3 only affects a key shared by two adapters with different labels, which does not exist in
the seed data (§0.9).

## 7. Files changed (expected)

- new: `components/DeltaArrow.tsx`, `lib/format/label.ts`, `lib/format/label.test.ts`, `lib/monitoring/panel-order.ts`,
  `lib/monitoring/panel-order.test.ts`, `components/home-markup.golden.test.tsx`,
  `components/__snapshots__/home-markup.golden.test.tsx.snap`
- changed (source): `lib/monitoring/home.ts`, `lib/monitoring/delta.ts`, `lib/monitoring/exact-decimal.ts`,
  `lib/monitoring/history.ts` (comment), `lib/format/delta.ts`, `lib/format/delta-direction.ts`, `components/HomeTable.tsx`,
  `components/CustomValues.tsx`, `components/HomeCustomizePanel.tsx`, `components/HomePageBody.tsx`,
  `components/home-display-state.ts`, `components/HistoryTable.tsx`, `components/EtfDetail.tsx`,
  `components/admin/TrackedFieldsAdmin.tsx`, `components/admin/OperationsDashboard.tsx`; optional `lib/ingestion/store.ts`
  (comment)
- changed (tests, additions only): `lib/monitoring/exact-decimal.test.ts` (ED-4, ED-5),
  `lib/monitoring/home-display.pglite.test.ts` (HD-H5..HD-H8)
- deliberate test change: `lib/monitoring/home.pglite.test.ts` (§3)
- not touched: `app/page.tsx`, `lib/config/*`, `messages/*.json`, `drizzle/`, `lib/db/schema.ts`, `package.json`,
  lockfile
