# US-021 plan — Admin: tracked-field management per ETF

Planner: story-planner (opus), 2026-09-26. Mode: `plan US-021`.
Inputs read: `backlog/stories/US-021.md`, `backlog/sprints/sprint-05.md` (Decisions needed #7, #8; Sprint 6 notes),
`verification/SPRINT-05-review.md`, `verification/US-020-plan.md`, `verification/US-020-review.md` (W1, N1, N2),
DEC-016, DEC-010, DEC-015, `architecture/data-model.md` (incl. "Write rules"), and the code:
`lib/config/{etfs,default-deps,boundaries.test,etfs.pglite.test}.ts`, `lib/monitoring/{home,history}.ts`,
`lib/ingestion/{load-etfs,store}.ts`, `lib/extraction/adapters/{types,registry}.ts`, `lib/db/seed-data.ts`,
`test/helpers/pglite.ts`, `app/admin/{layout.tsx,etfs/page.tsx,etfs/actions.ts,etfs/result-messages.ts}`,
`app/admin/etfs/{page,actions}.test.*`, `app/etf/[symbol]/page.tsx` + its test (notFound pattern),
`components/admin/{EtfAdmin,ActionForm,ActionMessage,action-state,sections}.ts*`, `messages/en.json`,
`i18n/messages.test.ts`, `eslint.config.mjs`, `package.json` (next-intl 4.x, so `t.has` exists).

**No decision is open.** Nothing here is BLOCKED. #7 is Decided; #8 ships its isolated default (§5).

---

## 1. Acceptance criteria → tests

Test ids are the names the implementer gives the `it(...)` blocks (prefix per file), so the tester can map them.
PGlite tests use `createTestDatabase()` (seeded BTBETRETF, `adapter_key='brd-depositary'`), insert the 8 catalogue
rows from `seed-data.ts` (`seedFieldCatalog`) in `beforeEach`, and stub global `fetch` to throw (pattern of
`lib/config/etfs.pglite.test.ts`). A second ETF, TVBETETF (`brd-depositary`, active), is inserted where needed.

| AC | What proves it | File / test ids |
|---|---|---|
| **AC1** Available vs tracked | **LF-1** BTBETRETF tracks `nav_per_unit` (order 0) and `units_in_circulation` (1): `listFieldsForEtf('BTBETRETF')` → `available` has exactly the 8 `seedFieldCatalog` keys in `field_catalog.id` order, each with `labelRo`, `labelEn`, `unit` from the catalogue; `tracked:true` exactly for the two, with `position` 1 and 2; the rest `tracked:false, position:null`. **LF-2** a catalogue row `('brd-depositary','ghost_field',…)` that `BRD_FIELD_KEYS` does not declare is **not** in `available`; if `ghost_field` is also tracked it is in `tracked` with `available:false` and its catalogue label. **LF-3** a custom registry (`createAdapterRegistry([stub('other', ['a','b'])])`) + catalogue rows `other/a`, `other/b`, `other/c`, ETF `adapter_key='other'` → `available` = `a`,`b` only (intersection, decision 7). **LF-4** lower-case symbol finds the ETF (normalised); unknown symbol → `null`. **FP-1/FP-2** page render (en, ro) of a view model: each available field shows the locale's label (en `Net asset` / ro `Activ net`) and the translated unit (`Admin.fields.units.RON`, `.count`); tracked rows are listed in the "tracked" section with their position, untracked ones in the "available" section with a track control. | `lib/config/tracked-fields.pglite.test.ts`, `app/admin/etfs/[symbol]/fields/page.test.tsx` |
| **AC2** Track | **TR-1** no tracked rows → `trackField(BTB,'nav_per_unit')` → `{ok:true, action:'tracked'}`, exactly one new row, `display_order = 0`. **TR-2** existing orders 0 and 7 → new row gets 8 (greater than every other of that ETF's rows); TVBETETF's rows (order 20) are ignored by the `max`. **TR-3** tracking an already tracked field → `{ok:true, action:'already_tracked'}`; full `tracked_fields` snapshot unchanged. **TR-4** errors, each with the full `tracked_fields` snapshot unchanged: key of another adapter (catalogue row `other-adapter/foo`) → `field_not_available`; unknown key `nope` → `field_not_available`; `ghost_field` (catalogue yes, adapter no) → `field_not_available`; ETF with `adapter_key` NULL → `field_not_available`; ETF with unregistered `adapter_key='old-adapter'` that has a catalogue row → `field_not_available`; unknown symbol → `not_found`. **TR-5** race guard: a runner wrapper that sets BTBETRETF's `adapter_key` to NULL between the read call and the write call → `field_not_available`, no row inserted (the insert re-checks the adapter in SQL). **TR-6** two `trackField` calls for different fields started together (`Promise.all`) → two rows with distinct `display_order` values (position computed inside the insert). | `lib/config/tracked-fields.pglite.test.ts` |
| **AC3** Untrack keeps history | **UT-1** BTBETRETF tracks `nav_per_unit`; insert an `ok` report with a `report_values` row for `nav_per_unit` (and one for `units_in_circulation`); snapshot `select * from reports order by id` and `select * from report_values order by id`; `untrackField(BTB,'nav_per_unit')` → `{ok:true}`; the `tracked_fields` row is gone, the other rows (incl. TVBETETF's) are unchanged, and both snapshots are `toEqual` the ones before. **UT-2** a flagged field (`ghost_field` tracked, or any field on an ETF whose `adapter_key` is set to NULL) can be untracked → `{ok:true}`, row gone. **UT-3** field not tracked → `not_tracked`; unknown symbol → `not_found`; nothing deleted. | `lib/config/tracked-fields.pglite.test.ts` |
| **AC4** Order | **MV-1** BTBETRETF tracks `a,b,c` at 0,1,2 (use real keys): `moveField(c,'up')` → orders `a0,c1,b2`; `moveField(a,'down')` → `c0,a1,b2`. **MV-2** starting orders with a gap and a duplicate (5,5,9 → loader order by `display_order, field_key`) → after any valid move the ETF's orders are exactly `0..n-1` (strict, gap-free) and follow the moved order. **MV-3** first field `up` and last field `down` → `{ok:true, moved:false}`, full `tracked_fields` snapshot unchanged. **MV-4** TVBETETF's rows are byte-identical before/after every BTBETRETF move. **MV-5** a spy runner around `db.runner` records exactly **one** call for `moveField`, and that call contains the single renumbering statement. **MV-6** failing runner: `(stmts) => db.runner([...stmts, db.mockDb.execute(sql\`select 1/0\`)])` → `moveField` rejects; BTBETRETF's rows equal the snapshot taken before (the transaction rolled back; the renumbering is one statement, so no half-renumbered state can exist even without rollback). **MV-7** untracked field → `not_tracked`; unknown symbol → `not_found`; nothing written. **MV-U1** (unit, fake runner) a direction other than `up`/`down` → `invalid_direction`, zero runner calls. | `lib/config/tracked-fields.pglite.test.ts`, `lib/config/tracked-fields.test.ts` |
| **AC5** Home table follows | **HF-1** one test, BTBETRETF + TVBETETF active, no tracked rows, no code between reads; after each step call `createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)()` (the **shipped** statements) and assert `columns.map(c => c.fieldKey)` equals the hand-computed list: (1) track BTB `nav_per_unit` → `[nav_per_unit]`; (2) track BTB `net_asset` → `[nav_per_unit, net_asset]`; (3) track TVB `units_in_circulation`, then TVB `net_asset` → `[nav_per_unit, units_in_circulation, net_asset]` (mins 0/0/1, tie by key); (4) move TVB `net_asset` up → `[nav_per_unit, net_asset, units_in_circulation]` (**same field, different positions**: BTB gives `net_asset` 1, TVB gives 0, the lowest wins); (5) move BTB `net_asset` up → `[net_asset, nav_per_unit, units_in_circulation]`; (6) untrack TVB `units_in_circulation` → `[net_asset, nav_per_unit]` (column gone when no active ETF tracks it); (7) untrack BTB `net_asset` → still `[net_asset, nav_per_unit]` (TVB still tracks it); (8) untrack TVB `net_asset` → `[nav_per_unit]`. Also after (1): BTB's cell is `{tracked:true, value:null, delta:null}` (no report yet, P1 / US-016 AC2). **HF-2** an **inactive** ETF that tracks a field no active ETF tracks produces no column (Sprint 4 decision 3 "active ETFs"). | `lib/config/tracked-fields.pglite.test.ts` |
| **AC6** Daily job follows | **DJ-1** inside HF-1, after steps (1), (3), (5) and (8) also call `createDrizzleEtfLoader(db.mockDb, db.runner)()` (shipped statement) and assert each ETF's `trackedFieldKeys` in order: (1) BTB `[nav_per_unit]`; (3) TVB `[units_in_circulation, net_asset]`; (5) BTB `[net_asset, nav_per_unit]`, TVB `[net_asset, units_in_circulation]`; (8) BTB `[nav_per_unit]`, TVB `[]`. | `lib/config/tracked-fields.pglite.test.ts` |
| **AC7** No adapter | **LF-5** ETF with `adapter_key` NULL that tracks `nav_per_unit`: `listFieldsForEtf` → `etf.adapterAvailable:false`, `available:[]`, `tracked` = `[{fieldKey:'nav_per_unit', available:false, position:1, labels = fieldKey fallback}]`. **LF-6** same with `adapter_key='old-adapter'` (unregistered). TR-4 already proves `trackField` refuses; UT-2 proves untrack works. **FP-3** page render (en, ro): translated `Admin.fields.noAdapter` message, **no** track control (no form with a `fieldKey` input for tracking), the flagged field listed with the translated `notAvailable` flag, the `notAvailableNote` sentence, and only an untrack control (no move buttons). | `lib/config/tracked-fields.pglite.test.ts`, `app/admin/etfs/[symbol]/fields/page.test.tsx` |
| **AC8** Bilingual, failure states | **I18N** existing `i18n/messages.test.ts` key parity passes with the new keys (unchanged test). **FP-1/FP-2** ro vs en renders: headings, section titles, column headers, `orderNote`, `nextRunNote`, control labels; the ro render contains none of en's differing strings and vice versa; field labels come from `labelRo`/`labelEn` of the view model. **FP-4** unknown symbol (mocked `listFieldsForEtf` → `null`) → `notFound()` called exactly once, outside the try/catch (pattern of `app/etf/[symbol]/page.test.tsx`). **FP-5** `listFieldsForEtf` throws `Error('connection refused: postgres://user:secret@db.example.com/etfs')` → translated `Admin.fields.loadError`, no `connection refused` / `postgres://` / `secret`, `notFound` not called. **FA-1..FA-3** each of the three actions, when its config call rejects with a secret-shaped error → `{status:'error', messageKey:'genericError'}`, `JSON.stringify(state)` has no part of the message, `revalidatePath` not called (all three, per US-020 review W1). **FA-4** `getDb` throwing → same generic state. **RM-1** `result-messages.ts`: every result variant of the three functions maps to a key that exists in both catalogues (iterate the closed unions and check `ro.Admin.messages[key]` and `en.Admin.messages[key]` are strings — the runtime version of US-020's AM-2, review N1). **EA-1** `EtfAdmin` render: every row links to `/admin/etfs/<SYMBOL>/fields` with the translated `Admin.etfs.fieldsLink` label (ro, en). | `app/admin/etfs/[symbol]/fields/{page.test.tsx,actions.test.ts,result-messages.test.ts}`, `app/admin/etfs/page.test.tsx` |
| **AC9** Boundaries and gates | **BC-1** (existing loop in `lib/config/boundaries.test.ts`) now also covers `tracked-fields.ts` automatically: no `next*`, `react*`, `@/app`, `@/components`, AI-looking specifier, no `process.env`. **BC-5** (new, same file) `tracked-fields.ts`: no `unpdf`, `@neondatabase/serverless`, `./default-deps`, `extraction/discovery`, `extraction/pdf`; no value import of `extraction/adapters/default-registry` (BC-4 already enforces that for every file). **FA-5** source scan of `app/admin/etfs/[symbol]/fields/actions.ts`: no `drizzle-orm` specifier, no `` sql` ``, no `insert into` / `update "` / `delete from` / `select ` text; it imports `@/lib/config/tracked-fields`. **FA-6** each action calls its config function with exactly the fields it needs (extra form fields such as `display_order`, `etf_id`, `adapterKey` ignored). **FP-6** page exports `dynamic = "force-dynamic"`. No test imports `getDb` unmocked or opens a network connection. Commands (tester runs, offline): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `env -u DATABASE_URL pnpm build` (with `NODE_EXTRA_CA_CERTS` exported, DEC-008). | `lib/config/boundaries.test.ts`, `app/admin/etfs/[symbol]/fields/{actions.test.ts,page.test.tsx}`; command output in `US-021-tests.md` |

**MANUAL-QA** (live; goes into `US-021-qa.md`):
- **MQ-1 (user, deployed app + Neon)** = sprint-05.md step 3: `/admin/etfs` → BTBETRETF "Fields" link → track "Activ net" and move it to position 1. Reload `/`: an "Activ net" column appears, empty for BTBETRETF until the next daily run (P1, FR4.2). Untrack it: the column disappears; in Neon, `select count(*) from report_values rv join reports r on r.id = rv.report_id join etfs e on e.id = r.etf_id where e.symbol='BTBETRETF' and rv.field_key='net_asset';` returns the same count before and after the untrack.
- **MQ-2 (user, Neon)** = sprint-05.md step 1, removed-field part: untrack one seeded field (e.g. BTBETRETF `units_in_circulation`), run `DATABASE_URL=<neon-url> pnpm db:seed` locally, then `select * from tracked_fields order by etf_id, display_order;` → the removed field did not come back, other orders unchanged.
- **MQ-3 (user, next day)**: after the next daily cron, a field tracked in MQ-1 (if left tracked) shows a value on `/` and a new `job_runs` row lists BTBETRETF `ok` (no `parse_error`, because only available fields can be tracked).
- **MQ-4 (Codex QA, local serve without `DATABASE_URL`)**: `/admin/etfs/BTBETRETF/fields` returns HTTP 200 with the translated load-error message and no stack trace.

---

## 2. Files and boundaries

### 2.1 Configuration layer — `lib/config/tracked-fields.ts` (new)
Plain TypeScript, same rules as `etfs.ts` (DEC-016 §1): `import type { Db }`, `sql` from `drizzle-orm`,
`rowsOf` + `type BatchRunner` from `../ingestion/store`, `type AdapterRegistry` from
`../extraction/adapters/types`, `normaliseSymbol` + `parsePgBoolean` reuse (`./etfs`, `../ingestion/load-etfs`).
No `next/*`, React, `app/`, AI, `process.env`, network. May throw on a database error (callers catch); never
throws for invalid input.

```ts
export type TrackedFieldDeps = { db: Db; run: BatchRunner; registry: Pick<AdapterRegistry, "get"> };
export type MoveDirection = "up" | "down";

export type AvailableField = { fieldKey: string; labelRo: string; labelEn: string; unit: string | null;
                               tracked: boolean; position: number | null };
export type TrackedField   = { fieldKey: string; labelRo: string; labelEn: string; unit: string | null;
                               position: number; available: boolean };
export type TrackedFieldsView = {
  etf: { symbol: string; name: string; adapterKey: string | null; adapterAvailable: boolean; isActive: boolean };
  available: readonly AvailableField[];   // decision 7, field_catalog.id order
  tracked: readonly TrackedField[];       // every tracked row, loader order; flagged ones have available:false
};

listFieldsForEtf(symbol: string, deps): Promise<TrackedFieldsView | null>
trackField({ symbol, fieldKey }, deps):
  Promise<{ ok: true; action: "tracked" | "already_tracked"; symbol: string }
        | { ok: false; error: "not_found" | "field_not_available" }>
untrackField({ symbol, fieldKey }, deps):
  Promise<{ ok: true; symbol: string } | { ok: false; error: "not_found" | "not_tracked" }>
moveField({ symbol, fieldKey, direction }, deps):
  Promise<{ ok: true; moved: boolean; symbol: string }
        | { ok: false; error: "not_found" | "not_tracked" | "invalid_direction" }>
```
Input: `symbol` goes through `normaliseSymbol` (invalid → `not_found`, no runner call — addresses US-020 review
N2 for the Sprint 6 chat); `fieldKey` must be a non-empty string, otherwise `field_not_available` /
`not_tracked` with no runner call. `symbol` and `fieldKey` are always bound parameters.

**"Available" (decision 7)** — one helper, `availableFieldKeys(adapterKey, catalogueKeys, registry)`:
`registry.get(adapterKey)?.fieldKeys` ∩ catalogue keys for that `adapter_key`. NULL or unregistered key → empty.

**`listFieldsForEtf`** — one `run` call, three read statements:
1. `select "id","symbol","name","adapter_key","is_active" from "etfs" where "symbol" = $s` (0 rows → `null`);
2. `select "fc"."field_key","fc"."label_ro","fc"."label_en","fc"."unit" from "field_catalog" "fc" join "etfs" "e" on "e"."adapter_key" = "fc"."adapter_key" where "e"."symbol" = $s order by "fc"."id"`;
3. `select "t"."field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id" where "e"."symbol" = $s order by "t"."display_order", "t"."field_key"` — the **same order** both loaders use.
`position` = 1-based rank in statement 3 (not the raw `display_order`, which may have gaps after an untrack).
A tracked key with no catalogue row for the ETF's adapter gets `labelRo = labelEn = fieldKey`, `unit = null`
(same fallback as `history.ts`). `adapterAvailable` = key set and `registry.get` defined (US-016 AC5 rule).

**`trackField`** — two `run` calls, one of which writes:
1. Read: statement 1 above (id, `adapter_key`) and `select 1 from "field_catalog" "fc" join "etfs" "e" on "e"."adapter_key" = "fc"."adapter_key" where "e"."symbol" = $s and "fc"."field_key" = $k`. ETF missing → `not_found`. Not in `registry.get(adapter_key).fieldKeys`, or no catalogue row → `field_not_available` (no write).
2. Write, one batch of two statements:
   ```sql
   insert into "tracked_fields" ("etf_id","field_key","display_order")
   select "e"."id", $k,
          coalesce((select max("t"."display_order") from "tracked_fields" "t" where "t"."etf_id" = "e"."id"), -1) + 1
   from "etfs" "e"
   where "e"."symbol" = $s
     and "e"."adapter_key" = $adapterKeyReadInStep1
     and exists (select 1 from "field_catalog" "fc" where "fc"."adapter_key" = "e"."adapter_key" and "fc"."field_key" = $k)
   on conflict ("etf_id","field_key") do nothing
   returning "id"
   ```
   then `select 1 from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id" where "e"."symbol" = $s and "t"."field_key" = $k` (sees the insert, same transaction).
   Inserted → `tracked`; not inserted but present → `already_tracked` (no change); neither → `field_not_available` (adapter changed between the calls, TR-5).
   "Placed last" is computed inside the insert (story verification note), so two quick clicks cannot produce equal
   positions. A new field goes last **for that ETF** (decision 8 default).
   Inactive ETFs may be configured (the page lists every ETF, US-020); nothing here checks `is_active`.

**`untrackField`** — one `run` call: statement 1 (existence) and
`delete from "tracked_fields" "t" using "etfs" "e" where "t"."etf_id" = "e"."id" and "e"."symbol" = $s and "t"."field_key" = $k returning "t"."id"`.
No availability check (flagged fields must be removable). Deletes nothing else and renumbers nothing ("Deletes
nothing else"); a gap left behind is harmless (both loaders sort, the home rule takes a minimum) and the next move
closes it.

**`moveField`** — `direction` checked first (`invalid_direction`, no runner call). Then **one** `run` call with
two statements (up/down chosen over an explicit-position API: smallest UI, and the story leaves it to the plan):
1. `select "e"."id", exists(select 1 from "tracked_fields" "t" where "t"."etf_id" = "e"."id" and "t"."field_key" = $k) as "tracked" from "etfs" "e" where "e"."symbol" = $s`;
2. the renumbering, a single statement (delta = `-1` for up, `+1` for down, bound as `::int`):
   ```sql
   with "ordered" as (
     select "t"."id", "t"."field_key",
            (row_number() over (order by "t"."display_order", "t"."field_key") - 1)::int as "pos"
     from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id"
     where "e"."symbol" = $s
   ),
   "target" as (select "pos" as "from_pos", "pos" + $delta::int as "to_pos" from "ordered" where "field_key" = $k),
   "renumbered" as (
     select "o"."id",
            case when "o"."pos" = "tg"."from_pos" then "tg"."to_pos"
                 when "o"."pos" = "tg"."to_pos"   then "tg"."from_pos"
                 else "o"."pos" end as "new_pos"
     from "ordered" "o" cross join "target" "tg"
     where "tg"."to_pos" between 0 and (select count(*) - 1 from "ordered")
   )
   update "tracked_fields" "t" set "display_order" = "r"."new_pos"
   from "renumbered" "r" where "t"."id" = "r"."id"
   returning "t"."id"
   ```
   Statement 1 empty → `not_found`; `tracked` false → `not_tracked`; statement 2 returned rows → `moved:true`,
   none → `moved:false` (first up / last down: nothing written, MV-3). A valid move rewrites **all** of that ETF's
   rows to `0..n-1` in the loaders' order with the two positions swapped: strict and gap-free (MV-2), only that ETF
   (the join on `symbol`), in one statement inside one batch (DEC-010; MV-5, MV-6). Tracked-but-not-available rows
   take part in the order (both loaders include them); the function allows moving them, the page offers no control
   for them (story Task 2).

### 2.2 Page, component, actions
- **`app/admin/etfs/[symbol]/fields/page.tsx`** (new, server component): `export const dynamic = "force-dynamic";`
  `params: Promise<{ symbol: string }>`. `load(symbol)` = `try { listFieldsForEtf(symbol, createEtfConfigDeps(getDb())) } catch { status:'error' }`;
  `null` → `notFound()` **outside** the try/catch (pattern `app/etf/[symbol]/page.tsx`). Renders
  `<TrackedFieldsAdmin … actions={{ track: trackFieldAction, untrack: untrackFieldAction, move: moveFieldAction }} />`.
  No `maxDuration` export: these actions make no network request. `createEtfConfigDeps` is reused as-is (its
  return type structurally satisfies `TrackedFieldDeps`; its `detect` is never called here).
- **`components/admin/TrackedFieldsAdmin.tsx`** (new, presentational, sync; `useTranslations("Admin.fields")`,
  `useLocale()` to pick `labelRo`/`labelEn` as `HomeTable` does). Props:
  `{status:'error'} | {status:'ok'; view: TrackedFieldsView; actions: {track, untrack, move}}`. Renders:
  heading with `{symbol}` and the ETF name, a back link to `/admin/etfs`; `orderNote` (decision 8 sentence) and
  `nextRunNote` (P1/FR4.2 sentence); when `!view.etf.adapterAvailable` the `noAdapter` message.
  Section "Tracked, in order": `view.tracked` in order — position, label, unit, and for `available:true` rows an
  untrack form plus a move-up form (omitted for position 1) and a move-down form (omitted for the last);
  for `available:false` rows the `notAvailable` flag and **only** an untrack form; when any flagged row exists,
  the `notAvailableNote` sentence (extraction for this ETF records an error while such a field is tracked, US-012
  AC3). Section "Available, not tracked": `view.available.filter(f => !f.tracked)` with a track form each (the
  section is absent when `available` is empty; `emptyAvailable`/`emptyTracked` messages otherwise).
  Every form is an `ActionForm` (US-020) with hidden `symbol`, `fieldKey` and, for moves, `direction`.
  Unit display: `null` → `t("units.none")`; a code in the closed list `["RON","count"]` → `t("units.<code>")`;
  any other code verbatim (catalogue data, like labels). Button glyphs/text come only from messages
  (`react/jsx-no-literals`).
- **`app/admin/etfs/[symbol]/fields/actions.ts`** (new, `"use server"`): `trackFieldAction`, `untrackFieldAction`,
  `moveFieldAction`, each `(prev: AdminActionState, formData: FormData) => Promise<AdminActionState>`. Reads only
  `symbol`, `fieldKey` (+ `direction` for move; must be exactly `up`/`down`, else `invalidRequest` without calling
  the config layer). `try { result = await fn(input, createEtfConfigDeps(getDb())) } catch { return genericError }`.
  On `ok` (including `already_tracked` and `moved:false`) → `revalidatePath("/")`, `(`/etf/${result.symbol}`)`,
  `(`/admin/etfs/${result.symbol}/fields`)` — the normalised symbol from the result, never raw input. No SQL, no
  exception text.
- **`app/admin/etfs/[symbol]/fields/result-messages.ts`** (new): `trackResultToState`, `untrackResultToState`,
  `moveResultToState` → `AdminActionState` with `values: { symbol }` only (no field text: it would need a locale in
  the action; each message appears next to its own control, so the field is clear from context).
- **`components/admin/EtfAdmin.tsx`** (edit): per row, a `Link` to `/admin/etfs/${encodeURIComponent(symbol)}/fields`
  labelled `t("fieldsLink")`. `components/admin/sections.ts` is **not** changed (the page is per ETF, not a nav
  section).
- **`messages/ro.json`, `messages/en.json`** (same keys in both):
  - `Admin.etfs.fieldsLink`;
  - `Admin.fields.{heading ("Tracked fields — {symbol}"), backLink, loadError, noAdapter, orderNote, nextRunNote,
    trackedHeading, availableHeading, emptyTracked, emptyAvailable, positionColumn, fieldColumn, unitColumn,
    actionsColumn, notAvailable, notAvailableNote, track, untrack, moveUp, moveDown}` and
    `Admin.fields.units.{RON, count, none}`;
  - `Admin.messages.{fieldTracked, fieldAlreadyTracked, fieldUntracked, fieldMoved, fieldNotMoved,
    fieldNotAvailable, fieldNotTracked, invalidDirection}` (reuse existing `notFound`, `invalidRequest`,
    `genericError`). `AdminMessageKey` is typed from `ro.json`, so a missing key is a type error.
  Wording of the two explanatory sentences (en): `orderNote` "The home table has one column per field. A column's
  position is the lowest position any active ETF gives that field, so the order you set here applies to this ETF
  and may be combined with other ETFs' orders." `nextRunNote` "A newly tracked field gets values from the next
  daily run on; earlier days are not filled in." `notAvailableNote` "While a field that is not available is
  tracked, the daily extraction for this ETF records an error. Remove it." (ro translations of the same.)

### 2.3 Tests (new unless noted)
`lib/config/tracked-fields.pglite.test.ts` (LF, TR, UT, MV, HF, DJ), `lib/config/tracked-fields.test.ts` (unit:
input validation with a recording fake runner — zero calls on invalid input; `availableFieldKeys`),
`lib/config/boundaries.test.ts` (edit: add BC-5), `app/admin/etfs/[symbol]/fields/page.test.tsx` (FP; mocks
`@/lib/db`, `@/lib/config/default-deps`, `@/lib/config/tracked-fields`, `./actions`, `next/navigation`),
`app/admin/etfs/[symbol]/fields/actions.test.ts` (FA; mocks `next/cache`, `@/lib/db`,
`@/lib/config/default-deps`, `@/lib/config/tracked-fields`), `app/admin/etfs/[symbol]/fields/result-messages.test.ts`
(RM), `app/admin/etfs/page.test.tsx` (edit: EA-1). Render via `renderToStaticMarkup` inside
`NextIntlClientProvider` (pattern of `app/admin/etfs/page.test.tsx`).

### 2.4 Boundaries (who may call whom)
`app/admin/etfs/[symbol]/fields/**` → `lib/config/tracked-fields.ts` + `lib/config/default-deps.ts` + `lib/db`
(`getDb`) → never SQL. `lib/config/tracked-fields.ts` → `./etfs` (`normaliseSymbol`), `lib/ingestion/store`,
`lib/ingestion/load-etfs` (`parsePgBoolean`), types from `lib/db` and `lib/extraction/adapters/types`.
`lib/monitoring/home.ts`, `lib/ingestion/load-etfs.ts`, `lib/extraction/*`, `lib/db/*`: **unchanged** (AC5/AC6
must run them as shipped).

---

## 3. Data model and migrations
None. `tracked_fields (etf_id, field_key, display_order)` with `UNIQUE (etf_id, field_key)` already supports
every operation; `field_catalog` is read only. No `pnpm db:generate`. No `reports` / `report_values` write
(FR4.2; AC3 proves they are untouched). Writes are single statements or one batch (DEC-010).

---

## 4. Risks and the smallest design

| # | Risk | Mitigation |
|---|---|---|
| R1 | A move half-applied, or a concurrent move/track producing duplicate positions | Renumbering is one SQL statement computed from the rows it updates (MV-5, MV-6); "last" is computed inside the insert (TR-6). |
| R2 | Tracking a field the adapter cannot extract → every daily run a `parse_error` | Availability = registry `fieldKeys` ∩ catalogue (decision 7), checked in TS **and** re-checked in the insert's `where` against the adapter key read in step 1 (TR-4, TR-5). |
| R3 | Page and loaders disagree on order | `listFieldsForEtf` and `moveField` order by `display_order, field_key`, the loaders' exact tie-break; HF-1/DJ-1 run the shipped loaders. |
| R4 | Per-ETF order vs one shared header surprises the user | Decision 8 default + `orderNote` sentence; HF-1 step (4) pins the "lowest position wins" behaviour. |
| R5 | Untracking hides the field's history on `/etf/<symbol>` (US-018 shows tracked fields only) | Data is kept (AC3, MQ-1); re-tracking shows it again. Existing US-018 behaviour, noted for the PO at the demo, not changed here. |
| R6 | Raw symbols from the future chat | `normaliseSymbol` in every function; bound parameters only (US-020 review N2). |
| R7 | Action feedback lost when a row moves between sections after revalidation | Acceptable: the list itself shows the change; the message is secondary. Messages are still covered by RM-1 and FA tests. |
| R8 | `useActionState` under static rendering | As US-020 R7: initial state rendered; messages tested through `result-messages` and existing `ActionMessage` tests. |
| R9 | Next.js dynamic `[symbol]` params arriving URL-encoded | Symbols are `[A-Z0-9]+` (US-020 validation) and the link uses `encodeURIComponent`; `normaliseSymbol` rejects anything else → 404. |

Smallest design: one config module with four functions, one page, one presentational component, three actions,
no new dependency, no schema change, no change to the loaders. Extensible only where required: `lib/config/*` for
the Sprint 6 chat (DEC-016); new adapters bring their own `fieldKeys` and catalogue rows, and the page follows
without change.

Implementation order: `tracked-fields.ts` + its PGlite/unit tests (incl. HF/DJ) → BC-5 → messages →
`TrackedFieldsAdmin.tsx` → page, actions, result-messages + tests → `EtfAdmin` link + test → `pnpm typecheck`,
`pnpm lint`, `pnpm test`, `env -u DATABASE_URL pnpm build`. Add every created/modified file to HANDOVER.md
"Files changed" as you go.

---

## 5. Decisions needed

| # | Type | Question | Status |
|---|---|---|---|
| S5-7 | TECHNICAL | What is "available" for an ETF | Decided (sprint-05.md #7). Applied in §2.1 (`availableFieldKeys`, insert guard). |
| S5-8 | PRODUCT | Order per ETF, new field last | NEEDS USER — isolated default ships in `lib/config/tracked-fields.ts` (`trackField` "last" computation, `moveField` per-ETF renumbering) plus the `Admin.fields.orderNote` sentence. |
| — | TECHNICAL (plan's call, delegated by the story) | `moveField` API: up/down vs explicit position | Settled here: up/down, one renumbering statement. Not a new decision. |

No new open item. PO-facing readings for the demo (not decisions): untrack leaves a gap until the next move (R1
is unaffected); untracking hides the field on the history page while keeping its data (R5); inactive ETFs can be
configured.
