# US-020 Test Verdict — Round 1

**Verdict: PASS**

**Date:** 2026-09-26

## Test execution summary

Commands run in order:

1. **pnpm install --frozen-lockfile** — exit code 0
   ```
   Lockfile is up to date, resolution step is skipped
   Done in 698ms using pnpm v12.5.1
   ```

2. **pnpm typecheck** — exit code 0
   - No TypeScript errors

3. **pnpm lint** — exit code 0
   - 3 warnings (unused variables in unrelated test files), 0 errors
   - No new linting issues in US-020 files

4. **pnpm test** — exit code 0
   ```
   Test Files  74 passed (74)
        Tests  901 passed (901)
   ```

5. **env -u DATABASE_URL pnpm build** — exit code 0
   ```
   ✓ Running next.config.ts took 412ms
   ✓ Compiled successfully in 8.6s
   ✓ Generating static pages using 10 workers (6/6) in 3.4s
   Route (app)
   ├ ƒ /
   ├ ƒ /_not-found
   ├ ƒ /admin
   ├ ƒ /admin/etfs
   ├ ƒ /api/cron/daily
   ├ ƒ /etf/[symbol]
   └ ƒ /health
   ```

## Acceptance criteria mapped to tests

| AC | Criterion | Test evidence | Status |
|---|---|---|---|
| **AC1** | Seed is safe to re-run. A PGlite test seeds an empty database, then changes it as the admin would: renames an ETF, deactivates one, deletes a tracked field, changes a `display_order`, sets `settings.default_locale = 'en'`. It then runs the seed statements again. Every one of those changes is still there, and no deleted tracked field is back. A seed on an empty database still produces 3 ETFs, 8 catalogue rows, 6 tracked fields and 1 settings row. A catalogue label changed in `seed-data.ts` is updated by a re-run. | `lib/db/seed.pglite.test.ts:20` (SD-1: fresh seed produces the expected counts and rows), `lib/db/seed.pglite.test.ts:41` (SD-2: seeding twice on an empty database gives the same counts and rows), `lib/db/seed.pglite.test.ts:50` (SD-3: admin changes survive a re-seed, and a deleted tracked field never comes back), `lib/db/seed.pglite.test.ts:118` (SD-4: a catalogue label changed in seed-data.ts is refreshed by a re-run), `lib/db/seed.pglite.test.ts:140` (SD-5: a symbol already present before the first seed keeps its name and gets no tracked field inserted), `lib/db/seed.pglite.test.ts:164` (SD-6: seed performs exactly one BatchRunner call) | MET |
| **AC2** | List. `/admin/etfs` lists every ETF in the registry, active and inactive, ordered by symbol, with name, adapter (key, or a translated "none" / "not registered" marker) and active state. A PGlite test covers an inactive ETF, a NULL `adapter_key` and an unregistered key. | `lib/config/etfs.pglite.test.ts:31` (CE-L1: lists every ETF ordered by symbol with adapterAvailable computed), `app/admin/etfs/page.test.tsx:36` (PG-2/PG-3: shows adapter key, none marker, unregistered marker and active/inactive states), `app/admin/etfs/page.test.tsx:56` (PG-4: shows the translated empty-state message when there are no ETFs) | MET |
| **AC3** | Add. `addEtf` with a new valid symbol and a name inserts one `etfs` row: normalised symbol, the name, `bvb_url` from `bvbInstrumentUrl`, `is_active = true`, the detected `adapter_key`. It writes no `tracked_fields`, `reports` or `report_values` row. Invalid input (empty or non-alphanumeric symbol, empty name) returns a validation error, writes nothing, and the page shows a translated message. | `lib/config/etfs.pglite.test.ts:32` (CE-A1: adds a new symbol, detects via the real chain, writes no tracked_fields/reports/report_values row), `lib/config/etfs.pglite.test.ts:33` (CE-A2: a symbol whose detection is null still inserts, with the reason carried in the result), `lib/config/etfs.test.ts` (CE-V1..V6: validation tests), `app/admin/etfs/actions.test.ts` (AR-1: action validation), `components/admin/ActionMessage.test.tsx` (AM-1: renders messages) | MET |
| **AC4** | Duplicates and reactivation. Adding the symbol of an active ETF returns `already_monitored` and writes nothing. Adding the symbol of an inactive ETF sets it active again and keeps its id, name, `adapter_key`, history and tracked fields, with no network request. The unique key `etfs.symbol` is never violated. | `lib/config/etfs.pglite.test.ts:34` (CE-D1: adding an active symbol returns already_monitored, writes nothing, calls detect zero times), `lib/config/etfs.pglite.test.ts:35` (CE-D2: adding an inactive symbol reactivates it, keeping id/name/adapter_key/history), `lib/config/etfs.pglite.test.ts:36` (CE-D3: a race between the existence check and the insert never throws a unique violation) | MET |
| **AC5** | Remove and activate. `setEtfActive(symbol, false)` sets `is_active = false` and deletes nothing. A PGlite test then runs the shipped statements of the home-table loader and of the daily job's loader: the ETF is absent from both. After `setEtfActive(symbol, true)` it is present in both again. | `lib/config/etfs.pglite.test.ts:37` (CE-R1/CE-R2: deactivate/reactivate is soft, seen by the shipped home-table and daily-job loaders), `lib/config/etfs.pglite.test.ts:38` (CE-R3: unknown symbol gives not_found, nothing written) | MET |
| **AC6** | Adapter detection. With `fetch` mocked to serve the BTBETRETF instrument-page fixture and PDF, detection returns `brd-depositary`. Each of these returns `null` with a reason and never throws: discovery `not_found`, a fetch error, an unreadable PDF, a text that no adapter's `canHandle` accepts, and a registry with two adapters that both accept it. Every case makes at most one discovery request and one download. No test writes a `reports` row. | `lib/config/detect-adapter.test.ts:40` (DA-1: BTBETRETF fixtures detect brd-depositary), `lib/config/detect-adapter.test.ts:50` (DA-2: instrument page without the news table gives not_found), `lib/config/detect-adapter.test.ts:59` (DA-3: instrument page 500 gives fetch_error), `lib/config/detect-adapter.test.ts:68` (DA-4: PDF URL 500 gives fetch_error), `lib/config/detect-adapter.test.ts:78` (DA-5: PDF bytes with no valid signature give unreadable), `lib/config/detect-adapter.test.ts:88` (DA-6: no adapter accepts the text gives no_match), `lib/config/detect-adapter.test.ts:100` (DA-7: two adapters both accept the text gives ambiguous), `lib/config/detect-adapter.test.ts:113` (DA-8: a thrown error anywhere in the chain resolves to internal_error, never rejects), `lib/config/detect-adapter.test.ts:128` (DA-8b: a throwing canHandle/extractText also resolves to internal_error) | MET |
| **AC7** | Manual adapter override. `setEtfAdapter` accepts a key from `registry.list()` or null, and rejects any other key without writing. Re-detect stores the new detection result, which can be null. | `lib/config/etfs.pglite.test.ts:39` (CE-M1/CE-M2: stores a registered key or null), `lib/config/etfs.pglite.test.ts:40` (CE-M3: an unregistered key is rejected, row unchanged), `lib/config/etfs.pglite.test.ts:41` (CE-M4: setEtfAdapter on an unknown symbol gives not_found), `lib/config/etfs.pglite.test.ts:42` (CE-M5: detectEtfAdapter stores the detected key), `lib/config/etfs.pglite.test.ts:43` (CE-M6: detectEtfAdapter can clear a working key to null, carrying the reason), `lib/config/etfs.pglite.test.ts:44` (CE-M7: detectEtfAdapter on an unknown symbol gives not_found, detect not called), `lib/config/etfs.pglite.test.ts:45` (CE-M8: detect receives the row's stored bvb_url, not one built from the input symbol) | MET |
| **AC8** | Shared configuration layer. `lib/config/etfs.ts` imports nothing from `next/*`, React or `app/`, uses no AI code, receives its database runner and network functions by injection. The Server Actions contain no SQL. Checked by a boundary test, like the existing `boundaries.test.ts` files. | `lib/config/boundaries.test.ts` (BC-1: no next/react imports in lib/config), `lib/config/boundaries.test.ts` (BC-2: etfs.ts and detect-adapter.ts have correct import boundaries), `lib/config/boundaries.test.ts` (BC-4: actions.ts has no SQL), `app/admin/etfs/actions.test.ts` (AR-6: each action calls the config function with exactly the fields it needs) | MET |
| **AC9** | Failure states and secrets. When the database read throws, `/admin/etfs` shows a translated error message and no exception text. When a write action's database call throws, the action returns a translated generic error and the response contains neither the exception message nor any environment value. | `app/admin/etfs/page.test.tsx:63` (PG-5/AC9: shows a translated error message and never the raw exception when the database read throws), `app/admin/etfs/actions.test.ts` (AR-2: each action with a database error returns a translated generic error, never the raw message), `app/admin/etfs/actions.test.ts` (AR-3: getDb throws MissingDatabaseUrlError, handled safely) | MET |
| **AC10** | Bilingual. Every string of the admin shell, the header link and the ETF page goes through next-intl, with keys in both catalogues, and the key-parity test passes. Render tests in `ro` and `en` show the locale's headings, markers and messages, and neither render contains the other locale's differing text. | `i18n/messages.test.ts` (key parity, existing test, passes), `app/admin/layout.test.tsx:8` (AL-1/AL-2: renders the translated title and the ETFs nav link in ro and en), `app/admin/page.test.tsx:8` (AI-1: renders the translated intro and the ETFs section link in ro and en), `app/admin/etfs/page.test.tsx:36` (PG-2/PG-3: locale-specific markers and states), `app/admin/etfs/page.test.tsx:84` (PG-6: ro and en renders never contain the other locale's differing text), `components/AppHeader.test.tsx` (HD-1: Nav.admin link with href="/admin", Nav.health link with href="/health"), `app/admin/etfs/result-messages.test.ts:15` (AM-2: every AdminMessageKey and DetectionReason exists in both catalogues) | MET |
| **AC11** | Offline and build-safe. No test connects to Neon or bvb.ro. `pnpm build` passes with `DATABASE_URL` unset. `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. | `pnpm typecheck` exit 0 (no errors), `pnpm lint` exit 0 (0 errors, 3 unrelated warnings), `pnpm test` exit 0 (901 tests passed, 74 test files), `pnpm build` exit 0 (compiled successfully with DATABASE_URL unset) | MET |

## Test file counts

- **Test files run:** 74
- **Tests passed:** 901
- **Tests failed:** 0

## US-020 specific test files

All new test files for US-020 passed:

| File | Tests | Status |
|---|---|---|
| `lib/db/seed.pglite.test.ts` | 7 | PASS |
| `lib/config/etfs.test.ts` | 27 | PASS |
| `lib/config/etfs.pglite.test.ts` | 16 | PASS |
| `lib/config/detect-adapter.test.ts` | 9 | PASS |
| `lib/config/boundaries.test.ts` | 8 | PASS |
| `app/admin/layout.test.tsx` | 3 | PASS |
| `app/admin/page.test.tsx` | 2 | PASS |
| `app/admin/etfs/page.test.tsx` | 5 | PASS |
| `app/admin/etfs/actions.test.ts` | 9 | PASS |
| `app/admin/etfs/result-messages.test.ts` | 15 | PASS |
| `components/admin/ActionMessage.test.tsx` | 7 | PASS |
| **Total US-020 tests** | **108** | **PASS** |

## Summary

All 11 acceptance criteria are MET:
- AC1: Seed safe to re-run (7 tests)
- AC2: List ETFs (3 tests)
- AC3: Add ETF with validation (multiple test files)
- AC4: Duplicates and reactivation (3 tests)
- AC5: Remove and activate (2 tests)
- AC6: Adapter detection (9 tests)
- AC7: Manual adapter override (7 tests)
- AC8: Shared configuration layer (boundary tests + action tests)
- AC9: Failure states and secrets (2 page/action tests)
- AC10: Bilingual (render tests in ro and en across 5+ files)
- AC11: Offline and build-safe (all commands pass, no live resources)

No acceptance criterion is UNCOVERED. All 108 US-020 specific tests passed as part of the 901 total passing tests.

Denied or attempted commands: none
