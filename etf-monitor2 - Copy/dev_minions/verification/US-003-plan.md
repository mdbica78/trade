# US-003 plan — Database schema and Drizzle/Neon setup

BLOCKED ON DECISION — two TECHNICAL clarifications (section 5). Both have a recommendation that
is cheap to reverse. Under DEC-009, `tech-lead` can decide them in a single DEC without the user.
Implement once that DEC is Decided, following whatever it says.

Planned by story-planner (opus), 2026-09-23. Complex story (DB schema + migrations tooling).

Sources read: story US-003, `architecture/data-model.md`, ADR-001, DEC-001/002/008,
US-005/US-006 (downstream consumers), `package.json`, `tsconfig.json`, `vitest.config.ts`,
`eslint.config.mjs`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`.

Environment facts that affect this story:
- Commands run in WSL1 "Ubuntu" (node v20.20.2, pnpm 12.5.1). Export
  `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` in every non-interactive shell (DEC-002, DEC-008).
- `pnpm-workspace.yaml` already has `allowBuilds: esbuild: true`, which drizzle-kit needs. pnpm 12's
  minimum-release-age policy may resolve slightly older versions. That is fine. Do not add exclusions
  unless install fails.
- `.gitignore` already covers `.env` and `.env.*` except `.env.example` (US-002 reviewer warning is resolved).

---

## 1. Acceptance criteria → proving test

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | All seven tables (`etfs`, `field_catalog`, `tracked_fields`, `reports`, `report_values`, `job_runs`, `settings`) exist in `lib/db/schema.ts` with the exact column names, SQL types, nullability and defaults from `data-model.md`. | `lib/db/schema.test.ts` › "tables and columns". It uses `getTableConfig()` from `drizzle-orm/pg-core` and compares each table with a literal expectation map copied from data-model.md: `{ name, sqlType: column.getSQLType(), notNull, hasDefault, primary }`. It also checks that the exported table set is exactly those seven SQL names. Expected SQL types are `serial`, `text`, `boolean`, `timestamp with time zone`, `date`, `numeric`, `integer`. The test also checks column-level `UNIQUE` on `etfs.symbol` (`column.isUnique`), `UNIQUE (adapter_key, field_key)` on `field_catalog`, `UNIQUE (etf_id, field_key)` on `tracked_fields`, and the named check on `settings` (`checks[].name`). |
| AC1 (FKs) | FKs `tracked_fields.etf_id → etfs.id`, `reports.etf_id → etfs.id` and `report_values.report_id → reports.id`, all `ON DELETE CASCADE`. No other FKs exist. In particular, `field_key` is **not** an FK (data-model "Notes"). | `schema.test.ts` › "foreign keys". For every table it reads `foreignKeys[i].reference()` (columns, foreignColumns, foreignTable) and `.onDelete === "cascade"`. It asserts exactly those three FKs across all tables. |
| AC2 | `UNIQUE (etf_id, report_date)` on `reports` and `UNIQUE (report_id, field_key)` on `report_values`. | `schema.test.ts` › "duplicate-ingestion guards". It reads `getTableConfig(t).uniqueConstraints` and checks that a constraint exists whose column SQL names are exactly `["etf_id","report_date"]` / `["report_id","field_key"]`. It also checks the committed SQL (next row). |
| AC3 | `pnpm db:generate` produces migration SQL, and the SQL is on disk for the user to commit. | (a) `schema.test.ts` › "committed migration". This offline test reads the `drizzle/` folder from disk. It asserts: `drizzle/meta/_journal.json` exists and lists ≥1 entry; its `.sql` file exists; the SQL contains `CREATE TABLE "<name>"` for all 7 tables; it contains both AC2 unique constraints; `ON DELETE cascade` appears 3 times; and `CHECK` with `"settings"."id" = 1` is present. Use case-insensitive, whitespace-tolerant regexes. (b) Verification command for tester/reviewer: `env -u DATABASE_URL pnpm db:generate` must print "No schema changes" / "nothing to migrate" and must create no new file under `drizzle/`. This proves there is no drift between schema.ts and the committed SQL, and that generate needs no DB. If a new file appears, that is a FAIL: report it, do not delete it silently. (c) Committing is the user's git step. It goes in the QA checklist. |
| AC4 | The DB client throws a clear, **named** error when `DATABASE_URL` is missing. | `lib/db/index.test.ts`: (1) `createDb(undefined)` and `createDb("")` / `"   "` throw `MissingDatabaseUrlError` (`instanceof` and `.name === "MissingDatabaseUrlError"`), and the message mentions `DATABASE_URL` plus where to set it (`.env.local` locally, Vercel project env in production). (2) With `vi.stubEnv("DATABASE_URL", "")` and a fresh module (`vi.resetModules()` + dynamic import), `getDb()` throws the same error. (3) `vi.mock("@neondatabase/serverless")` so no network is possible. With a fake Neon-shaped URL, `getDb()` returns a client, `neon` was called once with that URL, and a second `getDb()` call returns the same instance (lazy singleton). |
| AC5 | `pnpm test` passes, including the new tests, with no database reachable. | Tester runs `env -u DATABASE_URL pnpm test`. Every test above is offline by construction: schema tests import only `schema.ts` and read files, and the client test mocks the driver. |
| AC6 | `pnpm build` still succeeds. | Tester runs `env -u DATABASE_URL pnpm build`, plus `pnpm typecheck` and `pnpm lint`. No page imports `lib/db` yet. Even when one does (US-006), the lazy client means a missing env var cannot break the build at import time. |
| Notes | `report_date` is the date the report is **for**, not the publication date. Column comments must say so. | Reviewer check (not automated): JSDoc comment on `reportDate` in `schema.ts` states "date the report is FOR, not publication/fetch date; see US-001 FINDINGS (footer date vs filing stamp)". |
| — (optional, deferred) | Migration applies cleanly on a real Neon DB. | **MANUAL-QA, belongs to US-006** (the story says so). QA checklist mentions it as "not required for this story". Exact check when done: `export DATABASE_URL=<neon url>; pnpm db:migrate`. Then in the Neon SQL editor, `\dt` / `select table_name from information_schema.tables where table_schema='public'` lists the 7 tables plus drizzle's migrations table. `insert into settings(id) values (2)` must fail with a check violation. |

Offline smoke check for `db:migrate` driver resolution (verification command, not an AC). Run
`DATABASE_URL=postgresql://u:p@127.0.0.1:9/x pnpm db:migrate`. It must fail with a *connection*
error (ECONNREFUSED / websocket error), **not** with drizzle-kit's "no driver found / please
install" message. This proves the migrate script will work in US-006 without touching Neon.
Agents run it **only** with that literal localhost URL, never with an inherited `DATABASE_URL`.

---

## 2. Files and boundaries

| File | New/changed | Responsibility, and what it must NOT do |
|---|---|---|
| `package.json` | changed | deps: `drizzle-orm`, `@neondatabase/serverless`. devDeps: `drizzle-kit`. Scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`. Use compatible versions (check drizzle-orm's peer range for `@neondatabase/serverless`). Lockfile updates accordingly. |
| `pnpm-lock.yaml` | changed | via `pnpm add`. |
| `drizzle.config.ts` | new | `defineConfig({ dialect: "postgresql", schema: "./lib/db/schema.ts", out: "./drizzle", strict: true, verbose: true, ...dbCredentials only when DATABASE_URL is set })`. It must not load `.env` files (no `dotenv`). The user exports `DATABASE_URL` before `db:migrate`. `db:generate` must work with the variable unset. |
| `lib/db/schema.ts` | new | Pure table definitions. It imports only `drizzle-orm` / `drizzle-orm/pg-core`, never `./index` or `process.env`, because drizzle-kit loads this file standalone. TS property names are camelCase and SQL names are explicit snake_case strings, e.g. `bvbUrl: text("bvb_url").notNull()`. Exports: `etfs, fieldCatalog, trackedFields, reports, reportValues, jobRuns, settings`. No `relations()`, no query helpers, no seed data (out of scope). |
| `lib/db/index.ts` | new | `export class MissingDatabaseUrlError extends Error` (sets `name`). `export function createDb(url = process.env.DATABASE_URL)` treats empty or whitespace-only as missing, then returns `drizzle(neon(url), { schema })`. `export function getDb()` is a lazy module-level singleton over `createDb()`. `export type Db`. It does **not** connect at import time and runs no queries. |
| `lib/db/schema.test.ts` | new | AC1, AC2, AC3(a). |
| `lib/db/index.test.ts` | new | AC4. |
| `drizzle/0000_init.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json` | new, generated | `pnpm db:generate --name init`. Never hand-edited. All three files must be committed (snapshot + journal are needed for future diffs and for migrate). |
| `lib/db/.gitkeep` | delete | The folder is no longer empty. |
| `.env.example` | changed | Only the comment line "(filled in by US-003)" becomes a real description (Neon connection string, used by the app client and by `pnpm db:migrate`). The value stays empty. |

No changes to `vitest.config.ts` (it already picks up `**/*.test.ts`), `tsconfig.json`, `eslint.config.mjs`,
`next.config.ts` or `app/`. README env/migration docs are US-006 (AC5 there). Do not pre-empt them.

Boundary: later stories import tables from `@/lib/db/schema` and the client from `@/lib/db`.
Only `lib/db/index.ts` knows which Neon driver is used, so D2 below is a one-file change either way.

---

## 3. Data model and migration approach

Column-by-column mapping (Drizzle pg-core → SQL), exactly as data-model.md:
- `serial("id").primaryKey()` for every `serial PK`. `settings.id` = `integer("id").primaryKey()` +
  table check `check("settings_single_row", sql\`${t.id} = 1\`)`. No default on `settings.id`
  (the doc gives none; US-005 inserts `id = 1` explicitly).
- `text` / `boolean` / `integer` map directly. `.notNull()` only where the doc says NOT NULL. Defaults:
  `is_active` true, `display_order` 0, `etfs_processed` 0, `errors_count` 0, `default_locale` `'ro'`,
  `created_at` `defaultNow()`. `job_runs.started_at` is NOT NULL with **no** default (per doc).
- `timestamptz` → `timestamp("…", { withTimezone: true })`.
- `reports.report_date` → `date("report_date", { mode: "string" })`. The string mode (`YYYY-MM-DD`) is
  deliberate: a JS `Date` round-trip through UTC can shift a calendar date by one day, which is exactly the
  history misalignment the story's verification note warns about. JSDoc on the column says "for, not published".
- `report_values.numeric_value` → `numeric("numeric_value")` with no precision/scale (the doc says plain
  `numeric`). Default string mode in TS, so no float rounding. Consumers convert when displaying (DEC-007 formatter).
- `reports.status` / `job_runs.status` → `text("status", { enum: [...] }).notNull()`. The `enum` option
  only narrows the TS type. It emits **no** SQL CHECK, which matches data-model.md: type `text`, no CHECK listed.
  The reviewer should not flag the missing CHECK as a gap.
- Unique constraints get explicit names so the SQL is readable and the tests are stable:
  `etfs_symbol_unique` (column `.unique("etfs_symbol_unique")`), `field_catalog_adapter_key_field_key_unique`,
  `tracked_fields_etf_id_field_key_unique`, `reports_etf_id_report_date_unique`,
  `report_values_report_id_field_key_unique`. Use the array-returning third argument of `pgTable`
  (`(t) => [ ... ]`). The object form is deprecated.
- FKs: `.references(() => etfs.id, { onDelete: "cascade" })` etc. Nullability of the FK columns is D1 below.

Migration approach: drizzle-kit SQL migrations in `drizzle/`, generated locally with `pnpm db:generate --name init`,
never applied by an agent. Only the user applies them to Neon, in US-006 (`pnpm db:migrate` with
`DATABASE_URL` exported in their shell).

---

## 4. Risks and the smallest design

1. **drizzle-kit migrate driver resolution.** drizzle-kit chooses its driver from installed packages. With only
   `@neondatabase/serverless` installed it uses the WebSocket Pool, which may want `ws` on Node 20 (no global
   WebSocket). Mitigation: the offline localhost smoke check in section 1. If it reports a missing `ws`, add `ws`
   as a devDependency (small, justified here). Do **not** write a custom migrator script or add `tsx`/`dotenv`.
2. **`generate` requiring credentials.** Credentials go into `dbCredentials` only when `DATABASE_URL` is set, so
   `db:generate` stays offline and deterministic. Verify with `env -u DATABASE_URL pnpm db:generate`.
3. **Eager client breaking the build.** An `export const db = drizzle(neon(process.env.DATABASE_URL!))` would throw
   (or give an opaque error) at import time during `next build` in any env without the variable. The lazy
   `getDb()` plus the named error satisfies AC4 and protects AC6 and US-006.
4. **Drizzle API/version drift.** If the resolved drizzle-orm is a 1.x release where `getTableConfig`,
   `unique().on()`, `check()` or `fk.reference()` differ, adapt the tests to the equivalent introspection API.
   Do **not** weaken what they assert: column names, types, nullability, defaults, the two guards, cascade, check.
5. **`server-only`.** Do not add `import "server-only"` to `lib/db/index.ts` in this story. It throws under Vitest
   without the react-server condition and adds nothing until a client component exists.
6. **Committing generated files.** The agent does not run git. The HANDOVER "Files changed" list must name all three
   `drizzle/` files, and the QA checklist asks the user to commit them.

Extensibility: none beyond the data model. No repositories, relations or seed. US-005 and US-006 build on the exports above.

---

## 5. Decisions needed

**D1 — FK columns: NOT NULL or nullable? — `TECHNICAL`**
data-model.md writes `etf_id int FK → etfs.id ON DELETE CASCADE` (tracked_fields, reports) and
`report_id int FK → reports.id ON DELETE CASCADE` (report_values) **without** stating NULL/NOT NULL, while
every other column states it. The story says "implement exactly".
- Option A — nullable (literal reading). Risk: Postgres treats NULLs as distinct in UNIQUE, so
  `UNIQUE (etf_id, report_date)` would **not** prevent duplicate rows with a NULL `etf_id`. That undermines AC2's
  stated purpose ("prevent duplicate ingestion"), and an orphan report or value is meaningless.
- Option B — NOT NULL on all three FK columns.
- **Recommendation: B.** It matches the intent of the doc (one row *per ETF* per date; CASCADE implies the child
  cannot outlive the parent). tech-lead should record it in a DEC and add "NOT NULL" to those three rows of
  data-model.md, so the doc stays the source of truth.

**D2 — Neon driver for the app client: HTTP (`drizzle-orm/neon-http` + `neon()`) or WebSocket
(`drizzle-orm/neon-serverless` + `Pool`)? — `TECHNICAL`**
ADR-001 fixes the package (`@neondatabase/serverless`), not the mode.
- Option A — HTTP. Stateless, lowest latency for one-shot queries from Vercel functions, no `ws` dependency and no
  pool lifecycle. It has no interactive transactions, but `db.batch([...])` runs non-interactive statements
  atomically. Sprint 3 ingestion (upsert report, then values) stays idempotent thanks to the unique keys.
- Option B — WebSocket Pool. Full interactive transactions. Needs `ws` on Node 20 and pool connect/close
  handling per invocation in serverless.
- **Recommendation: A (HTTP)** for now. Only `lib/db/index.ts` knows the driver, so switching to B later
  (if Sprint 3 genuinely needs interactive transactions) is a one-file change. drizzle-kit's `migrate` uses its own
  driver regardless (risk 1).

Non-blocking design choices made in this plan (reviewer: these are intentional, not gaps). Lazy `getDb()` instead of an
eager `db` const; `date` in string mode; `numeric` in string mode; TS-only `enum` on status columns; explicit
constraint names; no `.env` loading in `drizzle.config.ts`; JSDoc (not SQL `COMMENT ON`) for the `report_date` note.
