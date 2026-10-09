# US-033 plan — Diagnosable load failures and schema-drift visibility

> story-planner, 2026-09-28. Binding text: DEC-019 §1–§3 (Decided). Sprint 8 "Decisions needed" #1–#3 are settled.
> No schema change, no migration, no new dependency (`drizzle-orm/pglite` ships inside the existing `drizzle-orm`
> package and is imported by one **test helper** only; `@electric-sql/pglite` is already a devDependency).

Nothing is open. **Not blocked.**

## 0. Inventory — every load-failure catch in scope (story Task 2)

Found by searching `catch` under `app/` (non-test) and following the one page (`/chat`) whose catch lives in `lib/`.
Scopes are fixed string literals; the boundary test (AC5) pins this list.

| # | Catch block | Scope literal | Today's HTML on failure |
|---|---|---|---|
| 1 | `app/page.tsx` `loadHomeTableProps` | `home` | `Home.loadError` |
| 2 | `app/etf/[symbol]/page.tsx` `load` | `etf-detail` | `EtfDetail.loadError` |
| 3 | `app/health/page.tsx` `loadHealthStatus` (only `getDb()` throwing reaches it) | `health` | `Health.dbError` + raw message (**P15, unchanged**) |
| 4 | `lib/health.ts` `getHealthStatus` catch (query rejected) | `health` | same as 3 |
| 5 | `lib/ai/chat.ts` `getChatAvailability` catch (the `/chat` page has no catch of its own) | `chat` | `Chat.loadError` |
| 6 | `app/admin/etfs/page.tsx` `loadEtfAdminProps` | `admin/etfs` | `Admin.etfs.loadError` |
| 7 | `app/admin/etfs/[symbol]/fields/page.tsx` `load` | `admin/etf-fields` | `Admin.fields.loadError` |
| 8 | `app/admin/ai/page.tsx` `loadSettings` | `admin/ai` | `Admin.ai.loadError` |
| 9 | `app/admin/cron/page.tsx` `loadDesired` | `admin/cron` | `Admin.cron.loadError` |
| 10 | `app/admin/operations/page.tsx` `load` | `admin/operations` | `Admin.operations.loadError` |
| 11 | `lib/monitoring/home.ts` fallback branch (§3, not a page failure — the page renders) | `home/report-links` | table renders |

`app/admin/page.tsx` has no data load. Out of scope (not page loads, story Task 2 wording): the catches in
`app/**/actions.ts` and in `lib/ai/chat.ts` `sendChatMessage` (Server Action paths). Listed for a later story if the PO
wants action failures logged too.

## 1. Acceptance criteria → tests

Every new test that triggers a failure installs `vi.spyOn(console, "error").mockImplementation(() => {})` and restores
it. "Load-error lines" below = `spy.mock.calls.filter(c => typeof c[0] === "string" && c[0].startsWith("[load-error]"))`.
The sentinel everywhere is `SENTINEL = "postgres://user:SENTINELPW@host/db"`; a sentinel error puts it in `message`,
in `stack` (assigned explicitly), and in its `cause`'s `message`.

### AC1 — Safe log line (DEC-019 §1) → `lib/log/load-error.test.ts` (new)
- **LE-1** Drizzle-style wrapper: outer `Error("Failed query: select … params: " + SENTINEL, { cause: driver })`, outer
  `name = "DrizzleQueryError"`; `driver = Object.assign(new Error('relation "etf_report_links" does not exist ' + SENTINEL), { name: "NeonDbError", code: "42P01" })`.
  `describeLoadError(outer)` `toEqual({ name: "DrizzleQueryError", code: "42P01", relation: "etf_report_links" })` and
  `Object.keys(...)` is exactly those three.
- **LE-2** `logLoadError("home", outer)`: `console.error` called exactly once, with exactly one argument, equal to
  `"[load-error] home name=DrizzleQueryError code=42P01 relation=etf_report_links"`. The line contains none of
  `SENTINELPW`, `://`, `does not exist`, `Failed query`, `\n`, `    at `.
- **LE-3** Invalid codes are dropped (no `code` key, no `code=` in the line): `"4201"`, `"42p01"`, `"ECONNREFUSED"`,
  `42601` (number), `"42P01 "`, `"42P01;x"`.
- **LE-4** Invalid relations are dropped (no `relation` key / `relation=`): `table: "etf report"`, `table: 'etf"x'`,
  `table: "public.etfs"`, `table: "Etfs"`, message `relation "public.etf_report_links" does not exist`,
  message `relation "a b" does not exist`.
- **LE-5** A valid `table` field wins over the message; with no `table`, the relation is parsed from
  `relation "<x>" does not exist` and then validated.
- **LE-6** Cause walk: code found on the 3rd `cause` level is reported; a code only on a 4th level is not; a cyclic
  cause (`e.cause = e`) terminates.
- **LE-7** Non-Error / unsafe names: thrown string `SENTINEL`, `null`, `undefined`, `{}` → `{ name: "Unknown" }`; an
  Error whose `name` is `"Bad Name://x"` → `name: "Unknown"`. `MissingDatabaseUrlError` → `{ name: "MissingDatabaseUrlError" }`.
- **LE-8** Never throws: an error whose `code` / `cause` / `message` getters throw → `logLoadError` does not throw
  and still prints one `[load-error] <scope> name=…` line.
- **LE-9** `vi.stubEnv("DATABASE_URL", SENTINEL)` and a message containing it → the line excludes `SENTINELPW`
  (holds by construction; the module never reads `process.env`, see AC5).
- **LE-10** Scope sanitised: `logLoadError("Bad scope://x", e)` prints `[load-error] unknown …`.

### AC2 — Pages log but do not leak → one new case in each existing page test (reuse that file's throwing mock)
For pages 1, 2, 6–10: loader (or `getDb()`) throws the sentinel error. Assert:
(a) HTML is **byte-identical** to the HTML rendered when the loader throws a plain `new Error("x")` (proves "equals
today's generic error state"), contains the page's `*.loadError` text, and contains neither `SENTINELPW`, `://`,
`42P01`, nor the error name; (b) exactly **one** load-error line, starting `[load-error] <scope> `, without `SENTINELPW`.

| Test file (changed) | New case | Scope |
|---|---|---|
| `app/page.test.tsx` | `LE-P1` (ro, en) | `home` |
| `app/etf/[symbol]/page.test.tsx` | `LE-P2` + `LE-P2n`: the not-found path logs **nothing** | `etf-detail` |
| `app/admin/etfs/page.test.tsx` | `LE-P6` | `admin/etfs` |
| `app/admin/etfs/[symbol]/fields/page.test.tsx` | `LE-P7` + `LE-P7n` (not-found logs nothing) | `admin/etf-fields` |
| `app/admin/ai/page.test.tsx` | `LE-P8` (key table still renders, as PA-6) | `admin/ai` |
| `app/admin/cron/page.test.tsx` | `LE-P9` (effective window still renders, as CG-6) | `admin/cron` |
| `app/admin/operations/page.test.tsx` | `LE-P10` | `admin/operations` |
| `app/chat/page.load-error.test.tsx` (**new**; `page.test.tsx` mocks `getChatAvailability` away) | `LE-P5` (ro, en): `@/lib/db` `getDb` throws the sentinel error, `./actions` mocked, real `getChatAvailability` | `chat` |
| `lib/ai/chat.test.ts` | `LE-C1`: `getChatAvailability(() => { throw sentinelError })` → `{ status: "error" }` + one `chat` line | `chat` |
| `app/health/page.failure.test.tsx` | `HP-F4` (ro, en): `getDb()` throws the sentinel error → exactly one `[load-error] health ` line without `SENTINELPW`. **HTML is not asserted sentinel-free**: `/health` shows the raw message by P15 (DEC-019 §2 "P15 untouched"); HP-F1 stays unchanged | `health` |
| `lib/health.test.ts` | `HC-6`: query rejects with the sentinel error → status unchanged (`{ dbConnected: false, error: … }`) + one `health` line without `SENTINELPW` | `health` |

Existing assertions in these files are not edited (US-016 AC9, US-018 AC6, US-028 AC7 stay met).
`app/page.test.tsx`'s "US-030 AC8" case mocks the whole loader and stays green unchanged (the §3 fallback lives inside
the real loader, proven in AC4).

### AC3 — `/health` names a stale schema (DEC-019 §2, FR8.1)
- `lib/health.pglite.test.ts` (**new**, real drizzle over PGlite via `test/helpers/pglite-drizzle.ts`, hooks 60 s):
  - **HS-1** fully migrated → `{ dbConnected: true, etfCount: 1, fieldCatalogCount: 0, schema: { missingTables: [] } }`.
  - **HS-2** `drop table "etf_report_links"` → `schema.missingTables` `toEqual(["etf_report_links"])`.
  - **HS-3** derived list: `getHealthStatus(db, { tables: schemaTableNames({ ...schema, syntheticProbe: pgTable("synthetic_probe", { id: integer("id") }) }) })`
    → `missingTables` `toEqual(["synthetic_probe"])` (no hand-kept list involved).
- `lib/health.test.ts` (changed):
  - **ST-1** `schemaTableNames(schema)` equals the sorted `name`s of `drizzle/meta/<last journal tag's idx>_snapshot.json`
    `tables` (read the journal's last entry, then `drizzle/meta/%s_snapshot.json` with `idx` zero-padded to 4) —
    the list stays in step with migrations with no manual edit.
  - **HC-5** counts resolve, `execute` never settles → `{ dbConnected: false, timedOut: true }` at
    `HEALTH_QUERY_TIMEOUT_MS`, not before (the probe is inside the 8 s race).
  - Fixture update, not an assertion weakening: `fakeDb` gains `execute: () => Promise.resolve([])`; the success-path
    expectation gains `schema: { missingTables: [] }` (the story adds `schema` to the connected member). HC-1..HC-4 and
    the two rejection cases keep their assertions.
- `app/health/page.schema.pglite.test.tsx` (**new**, same `next-intl/server` mock as `page.failure.test.tsx`, `@/lib/db`
  `getDb` → PGlite drizzle db):
  - **HP-S1** (ro, en) `etf_report_links` dropped → HTML contains `messages.Health.schemaStale` and
    `<li data-missing-table="etf_report_links">`; every `data-missing-table` value matches `^[a-z_][a-z0-9_]*$`; the
    connected counts still render.
  - **HP-S2** (ro, en) fully migrated → HTML does not contain `messages.Health.schemaStale` nor `data-missing-table`.
- `app/health/page.test.tsx` (changed): the `mockStatus` fixtures gain `schema: { missingTables: [] }` (type change);
  **HP-S3** mocked stale status (ro, en) → the line and two listed tables render; existing cases unchanged.
- **HP-F2 stays green unchanged**: its fake db has only `select`, whose counts never settle, so the probe (run after
  the counts, §2.3) is never reached and the race times out exactly as today.

### AC4 — Home falls back only for the optional join (DEC-019 §3) → `lib/monitoring/home-fallback.pglite.test.ts` (new)
Seam: the `run: BatchRunner` parameter of `createHomeTableLoader(db, registry, run)` (the batch runner). Tests pass
`db.runner` (PGlite) or a wrapper around it that counts calls / throws a crafted error.
- **HF-1** Seed one tracked field + catalogue row + an `ok` report with a `source_url` and a value (and the day-before
  `ok` report so a delta exists). Load once with the table present (`before`). `drop table "etf_report_links"`. Load
  again (`after`): `after` `toEqual(before)` (values, deltas, `valueDate`, report-derived `latestPdfUrl`), the loader
  resolves (not rejects), runner called exactly **2** times, exactly one load-error line matching
  `/^\[load-error\] home\/report-links name=[A-Za-z_$][\w$]* code=42P01 relation=etf_report_links$/`.
- **HF-2** `drop table "reports" cascade` (links table present) → loader **rejects**; runner called **1** time; **0**
  load-error lines from the loader (the page's catch logs it — AC2).
- **HF-3** Stub runner throws a wrapper whose `cause` is `{ code: "42703", message: 'column "x" of relation "etf_report_links" does not exist' }`
  → rejects, 1 call (proves the code gate: the message alone would parse the right relation).
- **HF-4** Stub throws `42P01` with `relation "reports" does not exist` → rejects, 1 call.
- **HF-5** Stub: 1st call `42P01`/`etf_report_links` (flat driver error, no wrapper), 2nd call throws `new Error("boom")`
  → rejects with the second error; 2 calls; exactly one `home/report-links` line.
- **HF-6** Table present (normal path) → 1 call, 0 load-error lines.
- **HF-7** Reports-only statement equivalence: on a DB with the table present but empty and three ETFs (link-only
  shapes excluded: no `etf_report_links` rows), `buildReportOnlyLinksStatement` rows `toEqual`
  `buildLatestReportLinksStatement` rows (sorted by `etf_id`), including an inactive ETF and a NULL `source_url` report.
- `lib/monitoring/home-links.pglite.test.ts`, `home.pglite.test.ts`, `home-delta.pglite.test.ts`: **unchanged**, must stay green.

### AC5 — No new secret path → `app/load-error.boundary.test.ts` (new; reads sources with `fs`, like `app/actions.boundary.test.ts`)
- **LB-E0** (not vacuous) exactly these `app/**/page.tsx` contain a `catch`: the 8 page files of §0 rows 1–3, 6–10.
- **LB-E1** each of them: every `catch` binds a variable (`catch (error)`), and every brace-balanced catch body calls
  `logLoadError("<scope from §0>", error)`; no `console.` anywhere in any `app/**/page.tsx`.
- **LB-E2** every `app/**/page.tsx` that imports `@/lib/db` contains `logLoadError(` (a new DB page cannot skip it).
- **LB-E3** `lib/ai/chat.ts`'s `getChatAvailability` catch body calls `logLoadError("chat"`; `lib/health.ts`'s catch
  calls `logLoadError("health"`; `lib/monitoring/home.ts` calls `logLoadError("home/report-links"`.
- **LB-E4** `lib/log/load-error.ts`: no `process.env`, no `.stack`, exactly one `console.error(`, no import at all.
- **LB-E5** `console.` occurs in non-test `lib/**` sources only in `lib/log/load-error.ts` and (pre-existing)
  `lib/cron/daily-handler.ts`; in non-test `app/**` sources nowhere.
- `lib/ai/boundaries.test.ts` LB-9 (no `console.` in `lib/ai`) stays green: `lib/ai/chat.ts` only imports the helper.

### AC6 — Bilingual and gates
- `messages/en.json` / `ro.json`: `Health.schemaStale` (plain string, no `{…}` placeholder, so it can later serve as a
  smoke failure key). Suggested en: `"Database schema out of date: run pnpm db:migrate. Missing tables:"`; ro:
  `"Schema bazei de date nu este la zi: rulați pnpm db:migrate. Tabele lipsă:"` (match the existing ro register).
  Proven by `i18n/messages.test.ts` (key parity, unchanged) and HP-S1/HP-S3.
- Gates: `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY` + `pnpm typecheck && pnpm lint &&
  pnpm build && pnpm test` (or `bash scripts/claude/predeploy-check.sh`). Tester quotes command, exit code, tail.

### AC7 — README → `test/readme-deployment.test.ts` (new)
- **RD-D1** the `## Deployment` section (text up to the next `## `) contains the exact sentence
  `**Migrate first, then deploy.**` placed before the deploy step, and the exact code
  `select to_regclass('public.etf_report_links');` with the words `null` and `pnpm db:migrate` in the same paragraph.
- **RD-D2** the `## Health check` section mentions `pnpm db:migrate` (the stale-schema line) and `[load-error]`.
- **MANUAL-QA (user)**: after migrating Neon and redeploying, open `/health`: no schema line. If the schema is behind,
  the line names the missing table(s). Vercel → Logs: a failing page shows one `[load-error] <scope> name=… code=… relation=…`
  line and nothing else about the error.

## 2. Files and boundaries

### 2.1 `lib/log/load-error.ts` (new) — pure, no imports, no `process.env`
```ts
export type LoadErrorDescription = { name: string; code?: string; relation?: string };
export function describeLoadError(error: unknown): LoadErrorDescription;
export function logLoadError(scope: string, error: unknown): void; // never throws
```
- Levels walked: `error`, then `.cause` up to 3 times (4 objects max); stop at a non-object or a repeat.
- `name`: the outermost value's `name` if it is a string matching `^[A-Za-z_$][A-Za-z0-9_$]{0,63}$`, else `"Unknown"`.
  (Hardening inside DEC-019 §1: "ErrorName" must not be able to carry text.)
- `code`: first level whose `code` is a string matching `^[0-9A-Z]{5}$`.
- `relation`: first level whose `table` is a string matching `^[a-z_][a-z0-9_]*$`; else the first level whose
  `message` (string) matches `/relation "([^"]*)" does not exist/` with the capture passing the same regex.
  The message is read only to run this regex; it is never stored or returned.
- Keys absent when not found (no `undefined` values).
- `logLoadError`: scope must match `^[a-z0-9][a-z0-9/_-]*$` else `"unknown"`; builds
  `` `[load-error] ${scope} name=${name}` `` + `` ` code=${code}` `` + `` ` relation=${relation}` `` (only when present);
  one `console.error(line)`. Whole body in `try/catch`; on an internal failure prints
  `[load-error] <scope> name=Unknown`, never rethrows.
- Output can contain only regex-validated identifier tokens, so it cannot contain `://`, whitespace-bearing text, a
  stack or the `DATABASE_URL` value.

### 2.2 Pages (changed) — `catch {` → `catch (error) { logLoadError("<scope>", error); …unchanged return… }`
`app/page.tsx`, `app/etf/[symbol]/page.tsx`, `app/health/page.tsx`, `app/admin/etfs/page.tsx`,
`app/admin/etfs/[symbol]/fields/page.tsx`, `app/admin/ai/page.tsx`, `app/admin/cron/page.tsx`,
`app/admin/operations/page.tsx`. Import `{ logLoadError } from "@/lib/log/load-error"`. Keep the existing AC comments.
`notFound()` stays outside the try in the two `[symbol]` pages. No JSX change except `/health` (2.4).

`lib/ai/chat.ts`: `getChatAvailability`'s `catch {` → `catch (error) { logLoadError("chat", error); return { status: "error" }; }`.
Import via `"../log/load-error"`; add `"lib/log/load-error"` to `ALLOWED_TARGETS` in `lib/ai/boundaries.test.ts`
(no network, no env, no console token in `lib/ai`).

### 2.3 `lib/health.ts` (changed)
- `import * as schema from "./db/schema"`, `getTableName`/`is` from `drizzle-orm`, `PgTable` from `drizzle-orm/pg-core`,
  `rowsOf` from `./ingestion/store`, `logLoadError`.
- `export function schemaTableNames(schemaModule: Record<string, unknown>): string[]` — `Object.values` filtered by
  `is(v, PgTable)`, mapped with `getTableName`, sorted.
- `export function buildSchemaProbeStatement(db: Db, tables: readonly string[])` — one statement, one parameter:
  ```sql
  select "t"."name" from unnest(string_to_array($1::text, ',')) as "t"("name")
  where to_regclass('public.' || "t"."name") is null order by "t"."name"
  ```
  with `$1 = tables.join(",")`. It never names a table literally (BD-16's `from/join "etf_report_links"` scan stays green).
- `HealthStatus` connected member: `{ dbConnected: true; etfCount: number; fieldCatalogCount: number; schema: { missingTables: readonly string[] } }`.
- `getHealthStatus(db: Db, options: { tables?: readonly string[] } = {})`; default `tables = schemaTableNames(schema)`.
  `query` becomes one async chain: `await Promise.all([counts])`, **then** `rowsOf(await db.execute(probe))` →
  `missingTables`. The chain is what races the timeout (keep `query.catch(() => undefined)` and `clearTimeout`).
  Sequential (not parallel) on purpose: HP-F2's select-only fake never reaches `execute`, and a count failure keeps
  today's error branch. Cost: one extra HTTP round trip on a healthy DB.
- `catch (error)`: `logLoadError("health", error)` then today's return, unchanged (P15).

### 2.4 `app/health/page.tsx` (changed)
Inside the `status.dbConnected` fragment, after the counts, only when `status.schema.missingTables.length > 0`:
```tsx
<div role="alert" className="text-sm text-[var(--loss)]">
  <p>{t("schemaStale")}</p>
  <ul>{status.schema.missingTables.map((n) => <li key={n} data-missing-table={n}><code>{n}</code></li>)}</ul>
</div>
```
Nothing rendered when the list is empty. Status dot and "Connected" unchanged. `failure-text.ts` untouched.

### 2.5 `lib/monitoring/home.ts` (changed) — §3 confined to `etf_report_links` + `42P01`
- Extract the existing newest-report-link subquery into `NEWEST_REPORT_LINK_FRAGMENT` (same SQL), used by
  `buildLatestReportLinksStatement` (behaviour identical) and a new
  `export function buildReportOnlyLinksStatement(db)` =
  `select "e"."id" as "etf_id", "r"."source_url" from "etfs" "e" join ${FRAGMENT} "r" on "r"."etf_id" = "e"."id" where "e"."is_active" = true`
  (pre-US-030 reading; equals the full statement when no link row exists — HF-7).
- `const REPORT_LINKS_TABLE = getTableName(etfReportLinks);`
  `function isMissingReportLinksTable(error)`: `const d = describeLoadError(error); return d.code === "42P01" && d.relation === REPORT_LINKS_TABLE;`
- `createHomeTableLoader` body:
  ```ts
  let results;
  try { results = await run(homeStatements(db, buildLatestReportLinksStatement)); }
  catch (error) {
    if (!isMissingReportLinksTable(error)) throw error;
    logLoadError("home/report-links", error);
    results = await run(homeStatements(db, buildReportOnlyLinksStatement));
  }
  ```
  `homeStatements` rebuilds all five statements (fresh objects for the second batch). No other retry, no other table.
  The Neon batch is one transaction, so the failed batch left nothing behind; PGlite's `runner` likewise.
- BD-16 (`lib/ingestion/boundaries.test.ts`) stays green: `home.ts` is still the only `lib/` reader of the table.

### 2.6 Tests-only helper `test/helpers/pglite-drizzle.ts` (new)
`export function pgliteDb(pg: PGlite): Db { return drizzle(pg, { schema }) as unknown as Db; }` from `drizzle-orm/pglite`.
Used by the two health PGlite tests only (the existing `mockDb` never executes; `getHealthStatus` uses the query
builder directly). If the `drizzle-orm/pglite` driver turns out incompatible with PGlite 0.5.8, fall back to a small
shim: `select().from(t)` → `pg.query('select count(*)::int as "count" from "' + getTableName(t) + '"')`,
`execute(sqlObj)` → `pg.query(...new PgDialect().sqlToQuery(sqlObj))` — note which was used in the tests verdict.

### 2.7 Docs
- `README.md` "Deployment": insert before step 6 (deploy) the bold sentence **Migrate first, then deploy.** with a
  one-line reason (code that reads a new table fails until its migration is applied; no agent migrates Neon); add a
  paragraph with `select to_regclass('public.etf_report_links');` ("run it read-only in the Neon SQL editor; `null`
  means the migration is missing: run `pnpm db:migrate` with `DATABASE_URL` set in your shell"). "Health check": one
  paragraph on the stale-schema line and on the `[load-error] <scope> name=… code=… relation=…` line in Vercel's
  function logs (no message, no connection details).
- `dev_minions/architecture/data-model.md`, `etf_report_links` section: one line "Read side: optional enrichment for
  the home table; a missing table (42P01) falls back to report-derived links (DEC-019 §3)". No rule change.

## 3. Data model / migration
None. No table, column or index changes; `drizzle/` untouched. The fallback and the probe work against the existing
schema. Applying `0001_etf_report_links.sql` on Neon stays a user step (sprint-08 U1).

## 4. Risks and the smallest design
- **R1 PGlite error shape** — HF-1 assumes PGlite's error carries `code: "42P01"` and the standard message. If PGlite
  wraps it, the 3-level cause walk still finds it; if PGlite exposes neither, HF-1 must not be faked: report it and
  keep HF-3..HF-5 (stub shapes) as the logic proof. Neon's `NeonDbError` has `code` and the same message (driver
  shape, not live-verified → covered by the MANUAL-QA Vercel log check).
- **R2 Neon error wrapping** — whether drizzle 0.45 neon-http `batch` wraps the driver error is not verified offline;
  `describeLoadError` accepts both flat and wrapped (LE-1, HF-5).
- **R3 health probe on Neon** — `to_regclass(text)` and `string_to_array` exist on every supported Postgres; the
  `public.` prefix matches where `drizzle-kit migrate` creates tables and the README check.
- **R4 over-broad fallback** — gated on both `code === "42P01"` and the validated relation; HF-2..HF-4 prove the
  negatives. The fallback runs at most once per load (no loop).
- **R5 noise in existing tests** — existing error-path tests will now print a sanitised line; harmless. New tests
  silence and assert it.
- **R6 load-only timeouts** (CPS-1, PGlite hooks) are US-034's; new PGlite files use 60 s hook timeouts like their
  neighbours.
- Smallest design: one pure helper module, one call per catch, one extra statement in `/health`, one fallback branch
  in one loader. Not added: a logger framework, log levels, fallbacks for other tables, `/health` exception-text
  changes (P15), a smoke-script failure key for `Health.schemaStale` (possible later: the message is placeholder-free).

## 5. Decisions needed
None open. All three design questions are DEC-019 §1–§3 (Decided, sprint-08 table #1–#3). Details settled here as
TECHNICAL within DEC-019, no DEC file needed: (a) `name` is regex-sanitised to an identifier or `"Unknown"`; (b)
scope literals as in §0; (c) `/chat` logs inside `lib/ai/chat.ts` `getChatAvailability` (its only catch), with the
`lib/ai` import allowlist extended by `lib/log/load-error`; (d) the probe runs after the counts inside the same race;
(e) action-path catches are out of scope. No PRODUCT question; P15 unchanged.

## 6. Files changed (expected)
- new: `lib/log/load-error.ts`, `lib/log/load-error.test.ts`, `lib/health.pglite.test.ts`,
  `lib/monitoring/home-fallback.pglite.test.ts`, `app/health/page.schema.pglite.test.tsx`,
  `app/chat/page.load-error.test.tsx`, `app/load-error.boundary.test.ts`, `test/helpers/pglite-drizzle.ts`,
  `test/readme-deployment.test.ts`
- changed (source): `lib/health.ts`, `lib/monitoring/home.ts`, `lib/ai/chat.ts`, `app/page.tsx`,
  `app/etf/[symbol]/page.tsx`, `app/health/page.tsx`, `app/admin/etfs/page.tsx`,
  `app/admin/etfs/[symbol]/fields/page.tsx`, `app/admin/ai/page.tsx`, `app/admin/cron/page.tsx`,
  `app/admin/operations/page.tsx`, `messages/en.json`, `messages/ro.json`, `README.md`,
  `dev_minions/architecture/data-model.md`
- changed (tests): `lib/health.test.ts`, `lib/ai/chat.test.ts`, `lib/ai/boundaries.test.ts` (allowlist only),
  `app/health/page.test.tsx`, `app/health/page.failure.test.tsx` (+HP-F4 only), `app/page.test.tsx`,
  `app/etf/[symbol]/page.test.tsx`, `app/admin/etfs/page.test.tsx`, `app/admin/etfs/[symbol]/fields/page.test.tsx`,
  `app/admin/ai/page.test.tsx`, `app/admin/cron/page.test.tsx`, `app/admin/operations/page.test.tsx`
- unchanged and must stay green: `lib/monitoring/home-links.pglite.test.ts`, `home.pglite.test.ts`,
  `home-delta.pglite.test.ts`, `lib/ingestion/boundaries.test.ts` (BD-16), `i18n/messages.test.ts`, HP-F1..HP-F3.
