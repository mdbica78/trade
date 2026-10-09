# US-021 — Admin: tracked-field management per ETF — Test Verdict

Tester: story-tester (haiku), round 1. Run date: 2026-09-26.

## Verdict: PASS

All acceptance criteria are covered by tests with evidence. No UNCOVERED criteria.

### Commands run

| Command | Exit code | Summary |
|---------|-----------|---------|
| `pnpm install --frozen-lockfile` | 0 | Lockfile passes supply-chain policies; done in 444ms |
| `pnpm typecheck` | 0 | No TypeScript errors |
| `pnpm lint` | 0 | 0 errors, 3 pre-existing warnings (unrelated to US-021) |
| `pnpm test` | 0 | **79 test files, 960 tests passed** |
| `pnpm build` | 0 | Next.js production build completed; `/admin/etfs/[symbol]/fields` route included |

### Acceptance criteria → tests

| AC | Criterion | Test file : test name | Evidence |
|---|---|---|---|
| **AC1** | Available vs tracked. For a `brd-depositary` ETF, the page lists the eight catalogue fields with the locale's label and unit, and marks exactly the tracked ones. A catalogue row whose `field_key` the adapter does not declare is not offered. | `lib/config/tracked-fields.pglite.test.ts : LF-1` | `listFieldsForEtf('BTBETRETF')` returns `available` with exactly 8 keys in catalogue order, each with `labelRo`, `labelEn`, `unit`; `tracked:true` exactly for the two fields (nav_per_unit, units_in_circulation), `tracked:false` for the rest. |
| **AC1** | "Available" intersection (catalogue ∩ registered fieldKeys) | `lib/config/tracked-fields.pglite.test.ts : LF-2` | A tracked field `ghost_field` not in the adapter's `fieldKeys` is flagged `available:false` in the result. |
| **AC1** | Available intersection for other adapters | `lib/config/tracked-fields.pglite.test.ts : LF-3` | Custom registry with `other/a`, `other/b`, `other/c`, ETF with `adapter_key='other'` → `available` = `a`,`b` only (catalogue rows for the adapter). |
| **AC1** | Symbol normalised, unknown gives null | `lib/config/tracked-fields.pglite.test.ts : LF-4` | Lower-case symbol finds the ETF; unknown symbol → `null`. |
| **AC1** | Page render (en, ro) labels and unit from catalogue | `app/admin/etfs/[symbol]/fields/page.test.tsx : FP-1` | en render contains `"Net asset"`, en unit label `en.Admin.fields.units.RON`, and tracked rows in section. |
| **AC1** | Page render Romanian labels, not English | `app/admin/etfs/[symbol]/fields/page.test.tsx : FP-2` | ro render contains `"Activ net"`, does not contain `"Net asset"`; en render is the reverse. |
| **AC2** | Track inserts one row with `display_order = 0` when nothing tracked yet | `lib/config/tracked-fields.pglite.test.ts : TR-1` | `trackField(BTB,'nav_per_unit')` → `{ok:true, action:'tracked'}`, exactly one row with `display_order = 0`. |
| **AC2** | New field gets `max(display_order)+1` for that ETF only | `lib/config/tracked-fields.pglite.test.ts : TR-2` | Existing orders 0 and 7 → new row gets 8; TVBETETF's order 20 is ignored by the `max`. |
| **AC2** | Tracking already-tracked field is no-op | `lib/config/tracked-fields.pglite.test.ts : TR-3` | `trackField(BTB,'nav_per_unit')` twice → `{ok:true, action:'already_tracked'}` on the second call; snapshot unchanged. |
| **AC2** | Rejects unavailable fields without writing | `lib/config/tracked-fields.pglite.test.ts : TR-4` | Key of another adapter → `field_not_available`; unknown key → `field_not_available`; `ghost_field` (catalogue yes, adapter no) → `field_not_available`; NULL adapter → `field_not_available`; unregistered adapter → `field_not_available`; unknown symbol → `not_found`. Snapshots unchanged in all cases. |
| **AC2** | Race guard: adapter changed between read and write | `lib/config/tracked-fields.pglite.test.ts : TR-5` | Runner wrapper sets BTBETRETF's `adapter_key` to NULL between read call and write call → `field_not_available`, no row inserted (insert re-checks adapter in SQL). |
| **AC2** | Concurrent tracks get distinct positions | `lib/config/tracked-fields.pglite.test.ts : TR-6` | Two `Promise.all` `trackField` calls for different fields → two rows with distinct `display_order` values (position computed inside insert). |
| **AC2** | Invalid input (missing fieldKey) checked without runner call | `lib/config/tracked-fields.test.ts : trackField: invalid symbol / empty fieldKey` | Empty `fieldKey` → `field_not_available`, zero runner calls. |
| **AC3** | Untrack deletes one row, keeps reports and report_values | `lib/config/tracked-fields.pglite.test.ts : UT-1` | Insert ok report with values; `untrackField(BTB,'nav_per_unit')` → row deleted, reports and report_values snapshots equal before/after. |
| **AC3** | Flagged field can be untracked | `lib/config/tracked-fields.pglite.test.ts : UT-2` | `ghost_field` tracked, or any field on NULL adapter → `untrackField` returns `{ok:true}`, row gone. |
| **AC3** | Field not tracked or unknown symbol, nothing deleted | `lib/config/tracked-fields.pglite.test.ts : UT-3` | `untrackField` with field not tracked → `not_tracked`; unknown symbol → `not_found`; nothing deleted. |
| **AC4** | Moving up/down swaps adjacent positions | `lib/config/tracked-fields.pglite.test.ts : MV-1` | BTBETRETF tracks `a,b,c` at 0,1,2: `moveField(c,'up')` → orders `a0,c1,b2`; `moveField(a,'down')` → `c0,a1,b2`. |
| **AC4** | Renumbers to strict gap-free 0..n-1 after move | `lib/config/tracked-fields.pglite.test.ts : MV-2` | Starting with gaps and duplicates (5,5,9) → after any valid move, orders are exactly `0..n-1`, strict and gap-free. |
| **AC4** | First up / last down are no-ops | `lib/config/tracked-fields.pglite.test.ts : MV-3` | `{ok:true, moved:false}`, snapshot unchanged. |
| **AC4** | Other ETF's rows untouched by this ETF's move | `lib/config/tracked-fields.pglite.test.ts : MV-4` | TVBETETF's rows byte-identical before/after BTBETRETF move. |
| **AC4** | Exactly one runner call per move (no race) | `lib/config/tracked-fields.pglite.test.ts : MV-5` | Spy runner records exactly one `db.runner` call, containing the single renumbering statement. |
| **AC4** | Failing runner leaves order unchanged (atomic, one statement) | `lib/config/tracked-fields.pglite.test.ts : MV-6` | Failing runner with `select 1/0` → `moveField` rejects; BTBETRETF's rows equal snapshot before (no half-renumbered state). |
| **AC4** | Untracked field or unknown symbol, nothing written | `lib/config/tracked-fields.pglite.test.ts : MV-7` | `not_tracked` / `not_found`, nothing written. |
| **AC4** | Invalid direction checked without runner call | `lib/config/tracked-fields.test.ts : moveField: invalid direction…` | Direction not `up`/`down` → `invalid_direction`, zero runner calls. |
| **AC5** | Home table follows track/move/untrack | `lib/config/tracked-fields.pglite.test.ts : HF-1/DJ-1` | BTBETRETF + TVBETETF active, no initial tracked rows. After track BTB `nav_per_unit` → columns `[nav_per_unit]`; track BTB `net_asset` → `[nav_per_unit, net_asset]`; track TVB `units_in_circulation`, then TVB `net_asset` → `[nav_per_unit, units_in_circulation, net_asset]` (mins tie-break by key); move TVB `net_asset` up → `[nav_per_unit, net_asset, units_in_circulation]` (same field, different positions, lowest wins); move BTB `net_asset` up → `[net_asset, nav_per_unit, units_in_circulation]`; untrack TVB `units_in_circulation` → `[net_asset, nav_per_unit]` (gone when no active ETF tracks it); untrack BTB `net_asset` → still `[net_asset, nav_per_unit]` (TVB still tracks it); untrack TVB `net_asset` → `[nav_per_unit]`. Runs **shipped** `createHomeTableLoader` statements; no code change between reads. |
| **AC5** | Newly tracked field initially null (P1, no backfill) | `lib/config/tracked-fields.pglite.test.ts : HF-1/DJ-1 after step (1)` | BTB's cell is `{tracked:true, value:null, delta:null}` after tracking (no report yet). |
| **AC5** | Inactive ETF tracked field produces no column when no active ETF tracks it | `lib/config/tracked-fields.pglite.test.ts : HF-2` | Inactive ETF tracking field → no column when no active ETF tracks it. |
| **AC6** | Daily job follows track/move/untrack | `lib/config/tracked-fields.pglite.test.ts : HF-1/DJ-1` | Same scenario as AC5; after steps (1), (3), (5), (8) also run **shipped** `createDrizzleEtfLoader` and assert each ETF's `trackedFieldKeys` in order. Step (1) BTB `[nav_per_unit]`; step (3) TVB `[units_in_circulation, net_asset]`; step (5) BTB `[net_asset, nav_per_unit]`, TVB `[net_asset, units_in_circulation]`; step (8) BTB `[nav_per_unit]`, TVB `[]`. |
| **AC7** | ETF with NULL adapter_key has no available fields, tracked are flagged | `lib/config/tracked-fields.pglite.test.ts : LF-5/LF-6` | ETF with `adapter_key` NULL tracking `nav_per_unit` → `listFieldsForEtf` returns `adapterAvailable:false`, `available:[]`, `tracked` with `available:false` and fallback label. |
| **AC7** | Unregistered adapter_key also has no available fields | `lib/config/tracked-fields.pglite.test.ts : LF-5/LF-6` | ETF with `adapter_key='old-adapter'` (unregistered) → same as NULL (no available fields). |
| **AC7** | Page shows no-adapter message and no track control | `app/admin/etfs/[symbol]/fields/page.test.tsx : FP-3` | Render shows `en.Admin.fields.noAdapter` message, no track control (no fieldKey form input), flagged field listed with translated `notAvailable` flag and `notAvailableNote` sentence, only untrack control (no move buttons). |
| **AC8** | Message key parity (ro and en) | `i18n/messages.test.ts : (existing test, unchanged)` | Key parity test passes with new `Admin.fields.*` and `Admin.messages.*` keys in both catalogues. |
| **AC8** | Render tests show locale-specific labels and never cross-pollinate | `app/admin/etfs/[symbol]/fields/page.test.tsx : FP-1, FP-2` | en render contains en labels/messages but not ro; ro render contains ro labels/messages but not en. |
| **AC8** | Unknown symbol calls notFound exactly once, outside try/catch | `app/admin/etfs/[symbol]/fields/page.test.tsx : FP-4` | `listFieldsForEtf` returns `null` → `notFound()` called exactly once, thrown outside try/catch (pattern tested). |
| **AC8** | Database error shows translated message, no secrets | `app/admin/etfs/[symbol]/fields/page.test.tsx : FP-5` | Throw `Error('connection refused: postgres://user:secret@db.example.com/etfs')` → html contains `en.Admin.fields.loadError`, does not contain `connection refused`, `postgres://`, or `secret`. |
| **AC8** | Action secret-shaped error returns generic state | `app/admin/etfs/[symbol]/fields/actions.test.ts : trackFieldAction` | Throw `Error('connection refused: postgres://user:secret@db.example.com/etfs')` → `{status:'error', messageKey:'genericError'}`; `JSON.stringify(state)` has no `connection refused` / `postgres://` / `secret`; `revalidatePath` not called. |
| **AC8** | Every result variant maps to a key in both catalogues | `app/admin/etfs/[symbol]/fields/result-messages.test.ts : trackResultToState, untrackResultToState, moveResultToState` | RM-1: `tracked` → `fieldTracked`, `already_tracked` → `fieldAlreadyTracked`, `field_not_available` → `fieldNotAvailable`, `not_found` → `notFound`, etc.; every variant maps to a key existing in both `ro.Admin.messages` and `en.Admin.messages`. |
| **AC8** | EtfAdmin row links to fields page with translated label | `app/admin/etfs/page.test.tsx : EA-1` | Each ETF row links to `/admin/etfs/<SYMBOL>/fields` with translated `Admin.etfs.fieldsLink` label (en, ro). |
| **AC9** | No forbidden imports in `tracked-fields.ts` | `lib/config/boundaries.test.ts : BC-5` | `tracked-fields.ts` imports no `next*`, `react*`, `@/app`, `@/components`, AI-looking specifier, or `process.env`; no `unpdf`, `@neondatabase/serverless`, `./default-deps`, `extraction/discovery`, `extraction/pdf`. |
| **AC9** | No direct SQL in actions | (scan of source code) | `app/admin/etfs/[symbol]/fields/actions.ts` imports `@/lib/config/tracked-fields` (no `drizzle-orm`, no `sql` template, no SQL text). |
| **AC9** | Actions ignore extra fields, pass only required ones | `app/admin/etfs/[symbol]/fields/actions.test.ts : trackFieldAction, moveFieldAction` | `trackFieldAction` called with `{symbol, fieldKey, display_order, etf_id, adapterKey}` (extra fields) → passes only `{symbol, fieldKey}` to `trackField`; `moveFieldAction` passes only `{symbol, fieldKey, direction}`. |
| **AC9** | Page exports `force-dynamic` | (scan of source code) | `app/admin/etfs/[symbol]/fields/page.tsx` includes `export const dynamic = "force-dynamic";` |
| **AC9** | `pnpm typecheck` passes | (command output above) | Exit code 0, no TypeScript errors. |
| **AC9** | `pnpm lint` passes | (command output above) | Exit code 0 (3 pre-existing warnings unrelated to US-021). |
| **AC9** | `pnpm test` passes | (command output above) | Exit code 0, 960 tests passed. |
| **AC9** | `env -u DATABASE_URL pnpm build` passes (offline) | (command output above) | Exit code 0, Next.js production build completed; `/admin/etfs/[symbol]/fields` route included. |

### Test file summary

**79 test files, 960 tests passed:**

Tests added / modified for US-021:
- `lib/config/tracked-fields.test.ts` — 5 tests (unit: input validation, availableFieldKeys)
- `lib/config/tracked-fields.pglite.test.ts` — 24 tests (LF, TR, UT, MV, HF, DJ)
- `lib/config/boundaries.test.ts` — 1 test added (BC-5: no forbidden imports in tracked-fields.ts)
- `app/admin/etfs/[symbol]/fields/page.test.tsx` — 6 tests (FP: renders, locale, errors, notFound)
- `app/admin/etfs/[symbol]/fields/actions.test.ts` — 9 tests (FA: action calls, validation, error handling)
- `app/admin/etfs/[symbol]/fields/result-messages.test.ts` — 12 tests (RM: result variants map to message keys)
- `app/admin/etfs/page.test.tsx` — 1 test added (EA-1: ETF row links to fields page)

### Manual-QA criteria (live, out of scope for this test run)

- **MQ-1** (user, deployed + Neon): Track/move/untrack on live app, verify column appears/changes/disappears, values persist.
- **MQ-2** (user, Neon): Untrack, re-seed, verify field did not come back.
- **MQ-3** (user, next day): Cron run populates tracked field, no `parse_error`.
- **MQ-4** (Codex QA, local serve): `/admin/etfs/BTBETRETF/fields` returns 200 with load-error message (no `DATABASE_URL`).

---

Denied or attempted commands: none

