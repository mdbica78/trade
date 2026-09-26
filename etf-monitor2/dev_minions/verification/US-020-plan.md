# US-020 plan — Admin: ETF management (add, remove, activate)

Planner: story-planner (opus), 2026-09-26. Mode: `plan US-020`.
Inputs read: `backlog/stories/US-020.md`, `backlog/sprints/sprint-05.md` (Decisions needed #1–#6, all settled or
default-shipped), `verification/SPRINT-05-review.md`, DEC-016, DEC-010, DEC-015, `architecture/data-model.md`
(incl. "Write rules"), requirements FR1/FR4.1/FR4.2/FR9/§3/§5/§6, `SPRINT-01-audit.md` W1/W2/W5/N5, and the code:
`lib/db/{seed,seed-data,index}.ts`, `scripts/db-seed.ts`, `test/helpers/pglite.ts`,
`lib/ingestion/{store,load-etfs,default-deps,run-daily}.ts`, `lib/ingestion/boundaries.test.ts`,
`lib/extraction/{discovery,pdf,http}.ts`, `lib/extraction/adapters/{types,registry,default-registry}.ts`,
`lib/monitoring/{home,history}.ts`, `app/{layout,page}.tsx`, `app/page.test.tsx`, `app/health/*`,
`app/api/cron/daily/route.ts`, `components/{AppHeader,HomeTable,LanguageSwitcher}.tsx`, `AppHeader.test.tsx`,
`messages/*.json`, `global.d.ts`, `eslint.config.mjs`, `i18n/request.ts`, `README.md`, `package.json`.

**No decision is open.** Nothing here is BLOCKED.

---

## 1. Acceptance criteria → tests

Test ids are the names the implementer gives the `it(...)` blocks (prefix per file), so the tester can map them.

| AC | What proves it | File / test ids |
|---|---|---|
| **AC1** Seed safe to re-run | PGlite on an **empty** database (new helper `createEmptyTestDatabase`, §2.1). **SD-1** fresh seed → exactly 3 `etfs` (symbol, name, `bvb_url`, `adapter_key='brd-depositary'`, active), 8 `field_catalog`, 6 `tracked_fields` (2 per ETF, orders 0/1), 1 `settings` (`default_locale='ro'`). **SD-2** seed twice on empty DB → same counts, same rows. **SD-3** seed, then as the admin would: rename one ETF, deactivate one, set one `adapter_key` to NULL, delete one tracked field, change another's `display_order`, `update settings set default_locale='en'`; seed again → every change still there, the deleted tracked field is **not** back, counts are 3/8/5/1. **SD-4** `update field_catalog set label_en='stale'` on one row; seed again → label equals `seed-data.ts` (catalogue stays an upsert). **SD-5** an ETF with a seeded symbol already present before the first seed (as if added in `/admin`, different name, no tracked fields) → seed keeps its name and inserts **no** tracked field for it (the "inserted by this run" rule). **SD-6** the seed performs exactly one `BatchRunner` call (spy on the PGlite runner) — all-or-nothing. | `lib/db/seed.pglite.test.ts` |
| **AC2** List | **CE-L1** PGlite: seeded BTBETRETF + inserted `ZZZETF` inactive with NULL key + `AAAETF` with key `old-adapter` (unregistered) → `listEtfs` returns all three, ordered by symbol, with `name`, `adapterKey`, `adapterAvailable` (`true` / `false` / `false`), `isActive`. **PG-2/PG-3** page render (ro, en) of that view model shows the key for BTBETRETF, the translated "none" marker for NULL, `old-adapter` + translated "not registered" marker, and translated active/inactive states. **PG-4** empty list → translated empty-state message. | `lib/config/etfs.pglite.test.ts`, `app/admin/etfs/page.test.tsx` |
| **AC3** Add | **CE-A1** PGlite, empty DB, `detect` = the real chain over mocked `fetch` serving the BTBETRETF instrument fixture at `bvbInstrumentUrl('BTBETRETF')` and `BTBETRETF-2026-09-22.pdf` at its link: `addEtf({symbol:'  btbetretf ', name:' BT Index '})` → one row: `symbol='BTBETRETF'`, `name='BT Index'`, `bvb_url=bvbInstrumentUrl('BTBETRETF')`, `is_active=true`, `adapter_key='brd-depositary'`; result `{ok:true, action:'added', adapterKey:'brd-depositary', reason:'detected'}`; `tracked_fields`, `reports`, `report_values` counts are 0. **CE-A2** a symbol whose detection returns `null` (stub `detect`) → row inserted with `adapter_key` NULL, result carries the reason. **CE-V1..V6** (unit, fake runner that records calls): `''`, `'   '`, `'BT-ETF'`, `'BT ETF'`, `'ȘTEF'`, non-string → `invalid_symbol`; empty/blank name → `invalid_name`; in every case zero runner calls and zero `detect` calls. **CE-U1** `bvbInstrumentUrl(s)` equals the `bvbUrl` in `seed-data.ts` for every seeded symbol. **AR-1** `addEtfAction` with `invalid_symbol` returns state `{status:'error', messageKey:'invalidSymbol'}`; **AM-1** `ActionMessage` renders that key translated in ro and en. | `lib/config/etfs.pglite.test.ts`, `lib/config/etfs.test.ts`, `app/admin/etfs/actions.test.ts`, `components/admin/ActionMessage.test.tsx` |
| **AC4** Duplicates / reactivation | **CE-D1** active BTBETRETF: `addEtf({symbol:'btbetretf', …})` → `{ok:false, error:'already_monitored'}`; table snapshot (all `etfs` columns) unchanged; `detect` spy not called. **CE-D2** BTBETRETF made inactive with a `reports` + `report_values` row and 2 tracked fields: `addEtf({symbol:'BTBETRETF', name:'Other name'})` → `{ok:true, action:'reactivated'}`; same `id`, original `name`, original `adapter_key`, `is_active=true`, report/value/tracked counts unchanged; `detect` not called. **CE-D3** race guard: the insert statement is `on conflict ("symbol") do nothing returning "id"`; a test pre-inserts the symbol *between* the existence check and the insert (runner wrapper that injects the row on the 2nd call) → `already_monitored`, no unique-violation error thrown. | `lib/config/etfs.pglite.test.ts` |
| **AC5** Remove / activate | **CE-R1** with a report, values and tracked fields for BTBETRETF: `setEtfActive({symbol:'BTBETRETF', active:false})` → `is_active=false`; `reports`, `report_values`, `tracked_fields` counts unchanged. Then `createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)()` and `createDrizzleEtfLoader(db.mockDb, db.runner)()` (the **shipped** statements) → symbol absent from both. **CE-R2** `setEtfActive(..., true)` → present in both again. **CE-R3** unknown symbol → `{ok:false, error:'not_found'}`, nothing written. | `lib/config/etfs.pglite.test.ts` |
| **AC6** Detection | Real `discoverLatestReport` / `downloadReportPdf` / `extractPdfText` with an injected `fetchImpl` (pattern of `ingest-etf.pglite.test.ts`); global `fetch` stubbed to throw. **DA-1** BTBETRETF fixtures → `{adapterKey:'brd-depositary', reason:'detected'}`, 1 discovery + 1 download call. **DA-2** instrument page without the news table → `{null,'not_found'}`, 1 call, 0 downloads. **DA-3** instrument page 500 / fetch throws → `{null,'fetch_error'}`, exactly 1 call (no retry). **DA-4** PDF URL returns 500 → `fetch_error`, 1 + 1 calls. **DA-5** PDF URL returns bytes `%PDF-1.4 garbage` → `{null,'unreadable'}`. **DA-6** registry with one stub adapter whose `canHandle` is false → `{null,'no_match'}`. **DA-7** `createAdapterRegistry([brdDepositaryAdapter, stubAlwaysTrue('other')])` → `{null,'ambiguous'}`. **DA-8** `extractText` stub throws / a `canHandle` throws → `{null,'internal_error'}`, the promise resolves (never rejects). **DA-9** a real-chain `addEtf` run on PGlite (CE-A1) leaves `reports` empty. **BC-3** boundary: `detect-adapter.ts` takes no store — source contains no `ReportStore`, `insert into`, `update "`, `"reports"`; its deps type has only `discover`, `download`, `extractText`, `registry`. | `lib/config/detect-adapter.test.ts`, `lib/config/boundaries.test.ts` |
| **AC7** Manual override / re-detect | **CE-M1** `setEtfAdapter({symbol, adapterKey:'brd-depositary'})` stores it; **CE-M2** `adapterKey:null` stores NULL; **CE-M3** `'nope'` → `{ok:false, error:'unknown_adapter'}`, row unchanged; **CE-M4** unknown symbol → `not_found`. **CE-M5** `detectEtfAdapter({symbol})` with stub `detect` returning `brd-depositary` → stored; **CE-M6** with stub returning `{null,'fetch_error'}` on an ETF that had a key → stored NULL, result carries the reason (AC7 literal: "which can be null"); **CE-M7** unknown symbol → `not_found`, `detect` not called. **CE-M8** `detect` receives the row's stored `bvb_url`, not one built from input. | `lib/config/etfs.pglite.test.ts` |
| **AC8** Shared layer | **BC-1** every non-test `.ts` in `lib/config/`: no specifier `next`/`next/*`, `react*`, `@/app`, `@/components`, `../../app`, `../../components`, nothing AI-looking (same regexes as `lib/ingestion/boundaries.test.ts`), no `process.env`; not vacuous (≥ 3 files). **BC-2** `etfs.ts` and `detect-adapter.ts`: no `unpdf`, no `@neondatabase/serverless`, no `getDb`, no `./default-deps`; `etfs.ts` imports nothing from `../extraction/discovery` or `../extraction/pdf`; `detect-adapter.ts` imports those two only with `import type`. **BC-4** `app/admin/etfs/actions.ts`: no `drizzle-orm` specifier, no `sql\``, no `insert into` / `update "` / `delete from` / `select ` SQL text; it imports `@/lib/config/etfs`. **AR-6** action tests: each action calls the (mocked) config function with exactly the fields it needs (`addEtfAction` → `{symbol, name}` even when the `FormData` also carries `bvb_url`, `adapter_key`, `is_active`). | `lib/config/boundaries.test.ts`, `app/admin/etfs/actions.test.ts` |
| **AC9** Failure states / secrets | **PG-5** page: mocked `listEtfs` throws `Error('connection refused: postgres://user:secret@db.example.com/etfs')` → translated `Admin.etfs.loadError`, no `connection refused`, `postgres://`, `secret`. **AR-2** with `vi.stubEnv('DATABASE_URL', 'postgres://user:secret@h/db')`, each of the 4 actions whose config call throws that error → `{status:'error', messageKey:'genericError'}`; `JSON.stringify(state)` contains neither the message nor the env value; `revalidatePath` not called. **AR-3** `getDb` throws `MissingDatabaseUrlError` → same generic state. | `app/admin/etfs/page.test.tsx`, `app/admin/etfs/actions.test.ts` |
| **AC10** Bilingual | **I18N** existing `i18n/messages.test.ts` key parity (unchanged, must pass with the new `Admin.*` keys). **AL-1/AL-2** admin layout render (ro, en): `Admin.title`, `Admin.nav.etfs`, link `href="/admin/etfs"`. **AI-1** `/admin` index render (ro, en): section link(s). **PG-2/PG-3/PG-6** ETF page ro vs en: headings, column headers, markers, form labels; ro render contains none of en's differing strings and vice versa. **HD-1** `AppHeader`: `Nav.admin` link with `href="/admin"` and `Nav.health` link with `href="/health"` in both locales (N5). **AM-2** every `AdminMessageKey` and every `DetectionReason` produced by `result-messages.ts` exists in both catalogues (iterate the closed unions). **Lint**: `react/jsx-no-literals` passes on the new `app/**`/`components/**` files. | `app/admin/layout.test.tsx`, `app/admin/page.test.tsx`, `app/admin/etfs/page.test.tsx`, `components/AppHeader.test.tsx`, `app/admin/etfs/result-messages.test.ts` |
| **AC11** Offline, build-safe | Every new test stubs global `fetch` to throw (pattern above) or mocks `@/lib/db`; no test imports `getDb` unmocked. **PG-7** `app/admin/etfs/page.tsx` exports `dynamic = "force-dynamic"` and `maxDuration = 60`. Command checks (tester runs them locally, no live resource): `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `env -u DATABASE_URL pnpm build` (with `NODE_EXTRA_CA_CERTS` exported, DEC-008). | all of the above; command output in `US-020-tests.md` |

**MANUAL-QA** (live Neon / Vercel / bvb.ro; goes into `US-020-qa.md`, user or Codex QA as applicable):
- **MQ-1 (user, Neon)** = sprint-05.md step 1: note `select symbol, name, is_active, adapter_key from etfs; select * from tracked_fields order by etf_id, field_key; select * from settings;`; in `/admin/etfs` deactivate one ETF and rename nothing else; run `DATABASE_URL=<neon-url> pnpm db:seed`; re-run the queries → identical except nothing reverted (ETF still inactive), no row added. (Removing a tracked field waits for US-021.)
- **MQ-2 (user, deployed app + live bvb.ro)** = sprint-05.md step 2: add `ICBETNETF` with a name → listed; adapter shows "none" and the success message names the detection reason; home table shows it with "extraction unavailable"; Remove → gone from `/`; after the next daily run its symbol is absent from the newest `job_runs.log`; Activate → back on `/`.
- **MQ-3 (Codex QA, local serve, no `DATABASE_URL`)**: `/admin` and `/admin/etfs` render (HTTP 200) with the translated load-error message on `/admin/etfs` and no stack trace; submitting the add form shows the translated generic error.

---

## 2. Files and boundaries

### 2.1 Seed fix (Task 1)
- **`lib/db/seed.ts`** (rewrite). `export function buildSeedStatements(db: Db)` returns the statement list; `export async function seed(db: Db, run: BatchRunner): Promise<void>` runs it in **one** `run([...])` call (atomic on Neon via `db.batch`, a transaction on PGlite). Statements, all `db.execute(sql…)`:
  1. `field_catalog`: one multi-row `insert … values (…),(…) on conflict ("adapter_key","field_key") do update set "label_ro"=excluded."label_ro", "label_en"=excluded."label_en", "unit"=excluded."unit"` (unchanged semantics).
  2. Per seeded ETF, one statement (decision 1's single-statement form):
     ```sql
     with "ins" as (
       insert into "etfs" ("symbol","name","bvb_url","adapter_key") values ($1,$2,$3,$4)
       on conflict ("symbol") do nothing
       returning "id")
     insert into "tracked_fields" ("etf_id","field_key","display_order")
     select "ins"."id", "v"."field_key", "v"."display_order"
     from "ins" cross join (values ($5::text,$6::int), ($7::text,$8::int)) as "v"("field_key","display_order")
     on conflict ("etf_id","field_key") do nothing
     ```
     The `values` list is built with `sql.join` from `seedTrackedFields`. No re-select of the id anywhere.
  3. `settings`: `insert into "settings" ("id","default_locale") values (1, $1) on conflict ("id") do nothing`.
  `seed-data.ts` is unchanged (its test stays as is).
- **`scripts/db-seed.ts`**: `const db = getDb(); seed(db, neonBatchRunner(db))`. Nothing else changes.
- **`test/helpers/pglite.ts`**: extract `createEmptyTestDatabase(): Promise<Omit<TestDatabase,'etfId'>>` (migrations + `mockDb` + runners, no row); `createTestDatabase()` calls it and inserts BTBETRETF exactly as today. Existing tests untouched and must stay green.
- **`README.md`**: "Environment variables" — say `.env.local` is read by `pnpm dev`/`next`, while the CLI scripts (`db:migrate`, `db:seed`, `report:latest`) read no env file: export `DATABASE_URL` or pass it inline (`DATABASE_URL=<url> pnpm db:seed`) (W5). "Deployment" step 5 — `db:seed` is a first-install bootstrap, safe to re-run: it only inserts ETFs, tracked fields and settings that are absent (tracked fields only for ETFs that run inserted), never overwrites admin changes, and refreshes field-catalogue labels. Add one line under a new short "Administration" note: `/admin` is open (no login, requirements §6).

### 2.2 Configuration layer (Task 2) — `lib/config/`
Plain TypeScript, no `next/*`, React, `app/`, AI, `process.env` (DEC-016 §1).
- **`lib/config/etfs.ts`**
  - `export type EtfConfigDeps = { db: Db; run: BatchRunner; registry: Pick<AdapterRegistry,'get'|'list'>; detect: (etf: { symbol: string; bvbUrl: string }) => Promise<DetectionResult> }` (`Db` via `import type`).
  - `export const BVB_INSTRUMENT_URL_PREFIX = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s="`; `export function bvbInstrumentUrl(symbol)` (decision 5 default).
  - `export function normaliseSymbol(raw: unknown): string | null` — string, trimmed, matches `/^[A-Za-z0-9]+$/` **before** upper-casing (so `ß`→`SS`-style case mapping can never turn invalid input valid), then `toUpperCase()`. `normaliseName(raw: unknown): string | null` — string, trimmed, non-empty. (decision 5 default)
  - `listEtfs(deps)` → `EtfListItem[]` `{symbol,name,adapterKey,adapterAvailable,isActive}`; one statement `select "symbol","name","adapter_key","is_active" from "etfs" order by "symbol"`; `adapterAvailable = key !== null && registry.get(key) !== undefined` (US-016 AC5 rule). May throw on a DB error (caller catches).
  - `registeredAdapterKeys(deps)` → `registry.list().map(a => a.key)` (the select's options).
  - `addEtf(input: {symbol: unknown; name: unknown}, deps)` → `AddEtfResult`:
    `{ok:true; action:'added'; symbol; adapterKey: string|null; reason: DetectionReason}` |
    `{ok:true; action:'reactivated'; symbol}` | `{ok:false; error:'invalid_symbol'|'invalid_name'|'already_monitored'}`.
    Order: validate → one runner call `select "id","is_active" from "etfs" where "symbol"=$1` → active: `already_monitored` (no write, no detect) → inactive: `update "etfs" set "is_active"=true where "symbol"=$1 and "is_active"=false returning "id"`; 0 rows → `already_monitored` (concurrent reactivation) → absent: `deps.detect({symbol, bvbUrl})`, then `insert into "etfs" ("symbol","name","bvb_url","adapter_key","is_active") values (…, true) on conflict ("symbol") do nothing returning "id"`; 0 rows → `already_monitored`. Writes no `tracked_fields` (decision 6 default).
  - `setEtfActive({symbol, active}, deps)` → `{ok:true}` | `{ok:false; error:'not_found'}`; `update "etfs" set "is_active"=$2 where "symbol"=$1 returning "id"`. An invalid symbol string is `not_found` (it cannot exist). Deletes nothing (decision 4 default).
  - `setEtfAdapter({symbol, adapterKey}, deps)` → `{ok:true}` | `{ok:false; error:'unknown_adapter'|'not_found'}`; key must be `null` or `registry.get(key) !== undefined`, checked before any runner call.
  - `detectEtfAdapter({symbol}, deps)` → `{ok:true; adapterKey; reason}` | `{ok:false; error:'not_found'}`; reads `bvb_url` for the symbol, runs `deps.detect` with the **stored** URL, then `update "etfs" set "adapter_key"=$2 where "symbol"=$1`.
  - Boolean columns parsed with `parsePgBoolean`, now exported from `lib/ingestion/load-etfs.ts` (one-word change, no behaviour change). `rowsOf`, `BatchRunner` reused from `lib/ingestion/store.ts` (carry-forward note).
- **`lib/config/detect-adapter.ts`**
  - `export type DetectionReason = 'detected'|'not_found'|'fetch_error'|'unreadable'|'no_match'|'ambiguous'|'internal_error'`; `DetectionResult = { adapterKey: string|null; reason: DetectionReason }`.
  - `export type DetectAdapterDeps = { discover(etf): Promise<DiscoveryResult>; download(url): Promise<PdfDownloadResult>; extractText(bytes): Promise<PdfTextResult>; registry: Pick<AdapterRegistry,'list'|'detect'> }` (types only from `lib/extraction/*`).
  - `detectAdapter(etf, deps)`: whole body in `try/catch` → `internal_error`. `discover`: `not_found` → `not_found`; `error` → `fetch_error`. `download`: `not_pdf` → `unreadable`, other failures → `fetch_error`. `extractText` not ok → `unreadable`. Then `registry.detect(text)`: an adapter → `{key,'detected'}`. `undefined` → count `registry.list().filter(a => a.canHandle(text))`: 0 → `no_match`, ≥ 2 → `ambiguous`. The key comes only from `detect()` (the single "exactly one" rule); `list()` only picks the reason. One call each, no loop, no retry (FR4.1). No store parameter; writes nothing (FR4.2).
- **`lib/config/default-deps.ts`** (the only `lib/config` file that wires concrete I/O, like `lib/ingestion/default-deps.ts`): `createEtfConfigDeps(db: Db): EtfConfigDeps` → `{ db, run: neonBatchRunner(db), registry: defaultAdapterRegistry, detect: (etf) => detectAdapter(etf, { discover: (e) => discoverLatestReport(e, {timeoutMs: CRON_FETCH_TIMEOUT_MS}), download: (u) => downloadReportPdf(u, {timeoutMs: CRON_FETCH_TIMEOUT_MS}), extractText: extractPdfText, registry: defaultAdapterRegistry }) }`. Takes `db` as a parameter (no `getDb()` here).

### 2.3 Admin UI (Tasks 4–5)
- **`components/admin/sections.ts`**: `ADMIN_SECTIONS = [{ href: '/admin/etfs', labelKey: 'etfs' }] as const` — US-021..024 append here. **`components/admin/AdminNav.tsx`**: renders `ADMIN_SECTIONS` as `Link`s with `useTranslations('Admin.nav')`.
- **`app/admin/layout.tsx`**: sync server component, `useTranslations('Admin')`: `<h1>{t('title')}</h1>`, `<AdminNav/>`, `{children}`.
- **`app/admin/page.tsx`**: `t('index.intro')` + `<AdminNav/>` (section links). No DB access.
- **`components/admin/action-state.ts`**: `type AdminMessageKey = keyof (typeof ro)['Admin']['messages']` (typed from `messages/ro.json`, so typecheck catches a missing key); `type AdminActionState = {status:'idle'} | {status:'success'|'error'; messageKey: AdminMessageKey; values?: {symbol?: string; adapter?: string}; reason?: Exclude<DetectionReason,'detected'>}`; `export const IDLE_STATE`. `values` only ever holds a normalised symbol or a registered adapter key — never raw input or exception text.
- **`components/admin/ActionMessage.tsx`**: renders a state: nothing for idle; `t(messageKey, values)` plus, when `reason` is set, `t('detectionReason.' + reason)`; `role="status"` / `role="alert"`.
- **`components/admin/ActionForm.tsx`** (`"use client"`): `useActionState(action, IDLE_STATE)`; props `action`, `submitLabel: string` (translated by the parent), `children` (inputs); renders `<form action={formAction}>{children}<button disabled={pending}>…</button><ActionMessage state={state}/></form>`. Reused by US-021..US-024.
- **`components/admin/EtfAdmin.tsx`**: presentational, sync, `useTranslations('Admin.etfs')`. Props: `{status:'error'} | {status:'ok'; etfs: EtfListItem[]; adapterKeys: string[]}` plus `actions: {add, setActive, setAdapter, redetect}` (server-action references passed down, so tests inject fakes). Renders: add form (symbol, name), empty state, table (symbol, name, adapter cell: key / `adapterNone` / `key (adapterNotRegistered)`, status `active`/`inactive`), per row: remove-or-activate form (hidden `symbol`, hidden `active`), adapter form (hidden `symbol`, `<select name="adapterKey">` with `""` = `noneOption` + `adapterKeys`, default = stored key if registered else `""`), re-detect form (hidden `symbol`).
- **`app/admin/etfs/page.tsx`**: `export const dynamic = 'force-dynamic'; export const maxDuration = 60;` async page: `try { deps = createEtfConfigDeps(getDb()); etfs = await listEtfs(deps); adapterKeys = registeredAdapterKeys(deps) } catch { status:'error' }` (never render the exception, as `app/page.tsx`); renders `<EtfAdmin … actions={{add: addEtfAction, …}}/>`.
- **`app/admin/etfs/actions.ts`** (`"use server"`, exports only async functions): `addEtfAction`, `setEtfActiveAction`, `setEtfAdapterAction`, `redetectEtfAdapterAction`, each `(prev: AdminActionState, formData: FormData) => Promise<AdminActionState>`. Each reads only its fields (`symbol`,`name` / `symbol`,`active` / `symbol`,`adapterKey` / `symbol`); `active` must be exactly `"true"`/`"false"` and `adapterKey` a string (`""` → `null`), else `invalidRequest` without calling the config layer. `try { result = await fn(input, createEtfConfigDeps(getDb())) } catch { return genericError }`. On `ok` → `revalidatePath('/')`, `('/admin')`, `('/admin/etfs')`, then return the mapped state. No SQL, no exception text.
- **`app/admin/etfs/result-messages.ts`**: pure maps `addResultToState`, `setActiveResultToState`, `setAdapterResultToState`, `detectResultToState` (config result → `AdminActionState`), unit-tested for every variant.
- **`components/AppHeader.tsx`**: add `<Link href="/admin">{t('Nav.admin')}</Link>` between Health and the switcher. **`components/AppHeader.test.tsx`**: add the `Nav.admin` and `Nav.health` href assertions (N5).
- **`messages/ro.json`, `messages/en.json`**: new `Admin` namespace (same keys in both):
  `title`; `nav.etfs`; `index.intro`; `etfs.{heading, loadError, empty, symbolColumn, nameColumn, adapterColumn, statusColumn, actionsColumn, adapterNone, adapterNotRegistered, active, inactive, addHeading, symbolLabel, nameLabel, addSubmit, remove, activate, adapterLabel, noneOption, setAdapterSubmit, redetectSubmit}`;
  `messages.{added, addedNoAdapter, reactivated, alreadyMonitored, invalidSymbol, invalidName, deactivated, activated, adapterSet, adapterCleared, unknownAdapter, notFound, detected, notDetected, invalidRequest, genericError}` (`added` uses `{symbol}` and `{adapter}`, the rest `{symbol}` where relevant; `addedNoAdapter`/`notDetected` say extraction is unavailable, section 3);
  `detectionReason.{not_found, fetch_error, unreadable, no_match, ambiguous, internal_error}`.
  `invalidSymbol` states the rule ("letters and digits only").

### 2.4 New tests / helpers
`lib/db/seed.pglite.test.ts`, `lib/config/etfs.test.ts`, `lib/config/etfs.pglite.test.ts`, `lib/config/detect-adapter.test.ts`, `lib/config/boundaries.test.ts`, `test/helpers/module-specifiers.ts` (the `extractModuleSpecifiers` function, used by the new boundary test; existing boundary tests are not edited), `app/admin/layout.test.tsx`, `app/admin/page.test.tsx`, `app/admin/etfs/page.test.tsx`, `app/admin/etfs/actions.test.ts`, `app/admin/etfs/result-messages.test.ts`, `components/admin/ActionMessage.test.tsx`. Page and component tests use `renderToStaticMarkup` inside `NextIntlClientProvider` (pattern of `app/page.test.tsx`), mocking `@/lib/db`, `@/lib/config/etfs`, `@/lib/config/default-deps` and `./actions`; action tests mock `next/cache`, `@/lib/db`, `@/lib/config/etfs`, `@/lib/config/default-deps`.

### 2.5 Boundaries (who may call whom)
`app/admin/**` → `lib/config/etfs.ts` + `lib/config/default-deps.ts` + `lib/db` (`getDb`) → never SQL.
`lib/config/etfs.ts` → `lib/ingestion/store` (`rowsOf`, `BatchRunner` type), `lib/ingestion/load-etfs` (`parsePgBoolean`), types from `lib/db`, `lib/extraction/adapters/types`, `./detect-adapter` (types).
`lib/config/detect-adapter.ts` → types only from `lib/extraction/*`. `lib/config/default-deps.ts` is the only wiring file.
`lib/ingestion`, `lib/monitoring`, `lib/extraction` behaviour: unchanged.

---

## 3. Data model and migrations
None. Every column written exists (`etfs.symbol/name/bvb_url/adapter_key/is_active`, `tracked_fields`, `settings`,
`field_catalog`). No `pnpm db:generate`. The write rules for `reports` are untouched: this story writes no `reports`
or `report_values` row (FR4.2). Seed writes are one batch (DEC-010 pattern: no interactive transaction on neon-http).

---

## 4. Risks and the smallest design

| # | Risk | Mitigation in this plan |
|---|---|---|
| R1 | Seed re-inserts removed tracked fields (W2) | "Inserted by this run" only from the CTE's `returning` (decision 1); SD-3/SD-5 fail on any re-select. |
| R2 | Detection time inside a Server Action on Vercel | Worst case: discovery 7 s + download 7 s (`fetchOnce` races body read too) + `extractPdfText` (one small PDF; not separately measured, same step the cron already runs inside 60 s for 3 ETFs) + 2 Neon HTTP round-trips ≈ 20 s < `maxDuration = 60` exported by `app/admin/etfs/page.tsx` (decision 3b). Reactivation/duplicate make no request. PG-7 pins the exports. |
| R3 | Open write endpoints (§6, no login) | Validation in `lib/config/` is the only guard: alphanumeric symbol, URL built on a fixed host (no SSRF), adapter key must be registered, each action reads only its fields (AR-6). No length cap is added beyond decision 5; Next's default Server Action body limit (1 MB) bounds input size. Noted for the PO, not a new rule. |
| R4 | Exception / secret leakage | Page and actions catch everything and return fixed translated keys; `values` carry only normalised symbols and registered keys (AR-2, PG-5). |
| R5 | Re-detect on a transient bvb.ro failure clears a working key | Literal AC7 ("which can be null"). The message shows the translated reason, and the manual override restores it. Flagged for the PO at the demo (story AC is agent-drafted), not changed here. |
| R6 | Race between the existence check and the insert/reactivation | `on conflict do nothing returning` / `where is_active = false returning` → `already_monitored`, never a unique violation (CE-D3). |
| R7 | `useActionState` under `renderToStaticMarkup` | React 19 server rendering returns the initial state; message rendering is also tested directly on `ActionMessage` with a given state, so coverage does not depend on it. |
| R8 | Existing tests break through the helper change | `createTestDatabase` keeps its exact behaviour; only a new sibling function is added. |
| R9 | PGlite vs Neon result shapes for `returning` in a CTE / batch | `rowsOf` already normalises both; SD/CE tests run the shipped statements. The seed's first live run is MQ-1. |

Smallest design: no new dependency, no schema change, no client state library; one generic `ActionForm` +
`ActionMessage` pair that later Sprint 5 stories reuse; detection is one function over the existing Sprint 2 chain.
Extensibility only where required: `ADMIN_SECTIONS` (later admin stories), `lib/config/*` (Sprint 6 chat, DEC-016),
the adapter registry (new adapters are code).

Implementation order: 2.1 seed + helper → `detect-adapter.ts` → `etfs.ts` + `default-deps.ts` → messages →
components → pages/actions → header → README → full `typecheck`/`lint`/`test`/`build` (unset `DATABASE_URL`).
Add every created/modified file to HANDOVER.md "Files changed" as you go.

---

## 5. Decisions needed

| # | Type | Question | Status |
|---|---|---|---|
| S5-1 | TECHNICAL | Seed insert-if-absent rule | Decided (sprint-05.md #1). Applied in §2.1. |
| S5-2 | TECHNICAL | Server Actions over `lib/config/` | Decided, DEC-016. Applied in §2.2–2.3. Implementation choice inside it: `useActionState` returning a closed message key (the story's "return a translated message key"), no new decision. |
| S5-3 | TECHNICAL | Detection at add time + manual override, `maxDuration = 60` | Decided (sprint-05.md #3, DEC-016). Applied in §2.2, R2. |
| S5-4 | PRODUCT | Soft removal; re-add reactivates | NEEDS USER — isolated default ships in `lib/config/etfs.ts` (`setEtfActive`, `addEtf` reactivation branch). |
| S5-5 | PRODUCT | Add-form inputs, `bvb_url` from the symbol, no live BVB-list check | NEEDS USER — isolated default ships in `lib/config/etfs.ts` (`bvbInstrumentUrl`, `normaliseSymbol`, `normaliseName`). |
| S5-6 | PRODUCT | A new ETF tracks no fields | NEEDS USER — isolated default ships in `addEtf` (writes no `tracked_fields`). |

No new item. The two PO-facing notes (R3 no length cap, R5 re-detect may clear a key) are readings of the drafted
ACs for the demo, not open decisions.
