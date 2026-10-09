# US-013 plan: daily cron endpoint and Vercel Cron configuration

Planner: `story-planner` (opus, high), 2026-09-24. Mode: `plan US-013`.
Sources read: `backlog/stories/US-013.md` (plus US-014 and US-015 for forward compatibility), `sprints/sprint-03.md`, `verification/SPRINT-03-review.md`, `verification/US-012-{plan,review,qa}.md`, ADR-001, the data model schema (`lib/db/schema.ts`), `lib/db/{index,seed-data}.ts`, `lib/ingestion/{ingest-etf,default-deps,store,boundaries.test,default-deps.test}.ts`, `test/helpers/pglite.ts`, `lib/extraction/{http,pdf}.ts` (timeouts), `next.config.ts`, `package.json`, `vitest.config.ts`, `README.md`, and `node_modules/unpdf/dist/index.mjs` (its only dynamic import is the static string `'unpdf/pdfjs'`; `canvas` is used only on the page-render path, which this app never calls).

**Decisions needed: none.** The schedule is already Decided (`0 10 * * *`, SPRINT-03-review). The story leaves the `maxDuration` value and the timeout budget to the plan (Notes, "Duration budget"). §4 R1 settles them. No product choice is open.

---

## 0. Shape in one paragraph

`GET /api/cron/daily` → thin route file → `handleDailyCron(request, deps)` in `lib/cron/daily-handler.ts`. The handler reads the env through an injected `readEnv()`, checks the bearer, and only then calls `deps.run()`. The default `run` (in `lib/cron/default-deps.ts`) does `runDailyIngestion(createDailyRunDeps())`. `createDailyRunDeps()` (in `lib/ingestion/default-deps.ts`) calls `getDb()` **when it is called**, builds the ETF loader and an `ingest` function bound to US-012's `ingestEtf` with shorter fetch timeouts. `runDailyIngestion` (in `lib/ingestion/run-daily.ts`) is pure orchestration: load, skip inactive, run each ETF sequentially, catch throws per ETF. So a `401` or a `500 not configured` never reaches `getDb`, the loader or `ingestEtf`.

---

## 1. Acceptance criteria, each with the test that proves it

Test files (all offline, Vitest):
- `lib/ingestion/run-daily.test.ts` (RD): the runner with a fake loader and a fake `ingest`
- `lib/ingestion/load-etfs.test.ts` (LQ): the loader's statement via `drizzle.mock` and a recording runner
- `lib/ingestion/load-etfs.pglite.test.ts` (LP): the shipped loader SQL executed on PGlite (`test/helpers/pglite.ts`)
- `lib/ingestion/default-deps.test.ts` (DD): **add** a `describe("createDailyRunDeps")` block. The existing `createDefaultIngestDeps` test stays byte-for-byte unchanged.
- `lib/cron/daily-handler.test.ts` (H): the handler with `Request` objects and fake deps
- `app/api/cron/daily/route.test.ts` (RT): the real route module (exports, env read at request time, the 401/500 paths without any DB)
- `vercel.test.ts` at the repo root, or `lib/cron/vercel-config.test.ts` (VC): reads `vercel.json` from disk

In RD, H and RT, `globalThis.fetch` is stubbed with `vi.stubGlobal` to throw `real network forbidden`, and each describe asserts it was never called (Sprint 2 audit W2, non-vacuous). No test sets a real-looking `DATABASE_URL` without also mocking `@neondatabase/serverless` (as in `lib/db/index.test.ts`).

**AC1: Auth**
- H-1a, H-1b, H-1c: `readEnv` returns `CRON_SECRET: "s3cr3t-Token-For-Tests-42"`. Requests: (a) no `Authorization` header; (b) `Basic s3cr3t-Token-For-Tests-42`; (c) `Bearer wrong`; plus (d) `bearer s3cr3t-…` (lower-case scheme) and (e) `Bearer s3cr3t-… ` (trailing space). Each gives `401`. The `run` spy is never called. For the composed variant (H-1f), `run` is `() => runDailyIngestion({ loadEtfs, ingest })` with `vi.fn` spies, and neither `loadEtfs` nor `ingest` is called.
- H-1g: the correct `Authorization: Bearer s3cr3t-Token-For-Tests-42` → `run` is called exactly once and the status is `200`.
- H-1h: `CRON_SECRET` `undefined`, `""` and `"   "` (whitespace only), each with the header `Bearer ` and with `Bearer undefined` → status `500`, body `{ "error": "cron not configured" }`, `run` never called.
- RT-1: the real `GET` from `app/api/cron/daily/route.ts`, after `vi.resetModules()` and a dynamic import, with `vi.stubEnv("DATABASE_URL", "")`:
  - `vi.stubEnv("CRON_SECRET", "")` and header `Bearer ` → `500` `cron not configured`;
  - `vi.stubEnv("CRON_SECRET", "rt-secret-123456")`, no header → `401`;
  - the stub is changed between two requests on the **same** imported module (first `"a-secret-1111"`, then `"b-secret-2222"`) and the header for the second value is accepted only on the second request. This proves the secret is read at request time, not at module load.
  Because `DATABASE_URL` is empty in all RT cases, a `401`/`500 not configured` (rather than `500 run could not start`) is itself evidence that no DB access happened before auth.

**AC2: every active ETF once, inactive never, tracked keys in `display_order`**
- RD-2a: a fake loader returns `[A(active), B(inactive), C(active)]` with distinct `trackedFieldKeys`. `ingest` is called exactly twice, first with A then with C, each with that ETF's `id`, `symbol`, `bvbUrl`, `adapterKey` and `trackedFieldKeys` exactly as the loader gave them. B's symbol never appears in any call or in the summary. The summary lists `[A, C]` in that order.
- LP-2b (loader, real SQL on PGlite): on top of the helper's seeded `BTBETRETF` (active), the test inserts:
  - `tracked_fields` for BTBETRETF: `(nav_per_unit, 1)`, `(units_in_circulation, 0)`, `(net_asset, 1)`. Expected keys: `["units_in_circulation", "nav_per_unit", "net_asset"]` (order 0, then order 1 tie broken by `field_key`: `nav_per_unit` < `net_asset`);
  - an active `AAAETF` with **no** tracked fields → `trackedFieldKeys: []`;
  - an inactive `ZZZETF` (`is_active = false`) **with** tracked fields → absent from the result.
  Asserts the full result: `[AAAETF, BTBETRETF]` (ordered by `symbol`), each with `isActive: true`, correct `id`, `bvbUrl`, `adapterKey` (`null` stays `null`).
- LQ-2c: `createDrizzleEtfLoader(mockDb, recordingRunner)` calls the runner **exactly once** with one statement. Its `getQuery().sql` contains `"is_active" = true`, `left join "tracked_fields"` and `order by` with `"display_order"` before `"field_key"`.
- RD-2d: an empty loader result → `{ etfs: [] }`, `ingest` never called.

**AC3: isolation**
- RD-3a: A's `ingest` resolves a US-012 `failed` outcome, B's **throws** `new Error("boom")`, C resolves `ok`. All three are called. The summary has three entries in order: A `failed` (outcome object unchanged, `toBe` the returned object), B `{ code: "internal_error", symbol: "B", detail: "boom" }`, C `ok`.
- RD-3b: a thrown non-`Error` (`throw "plain string"`) → `internal_error` with `detail: "plain string"`. A rejected promise behaves like a throw.
- H-3c: through the handler, the RD-3a mix gives `200` and a JSON body whose `etfs` has all three entries (AC6 first bullet).

**AC4: no retries**
- RD-4: in RD-2a, RD-3a and RD-3b, `expect(ingest).toHaveBeenCalledTimes(<number of active ETFs>)`, and for each active symbol exactly one call carries it (count calls by `symbol`).
- RD-4b, sequential: `ingest` returns deferred promises. The test asserts the second call has not started while the first is unresolved (the in-flight counter never exceeds 1). This pins the story's "sequentially" and the duration budget in §4 R1.

**AC5: `vercel.json`**
- VC-5: `JSON.parse(readFileSync(<repo root>/vercel.json))`. `crons` is an array of length **1**. Its `path` is `/api/cron/daily`. Its `schedule` split on single spaces has 5 fields: fields 1 and 2 match `/^\d{1,2}$/` (minute 0–59, hour 0–23 checked numerically), fields 3–5 are `*`. The test also pins the Decided value `0 10 * * *` in a separate `it` named `schedule is the Decided default (SPRINT-03-review #3) — change together with README`. No other top-level key except an optional `$schema` (keeps the file minimal, so nothing else is silently configured).

**AC6: responses**
- H-6a: completed run with mixed outcomes → `200`, `content-type` includes `application/json`, `cache-control: no-store`, body `{ etfs: [{ symbol, outcome }, ...] }` with every processed ETF.
- H-6b: `run` rejects with `new MissingDatabaseUrlError()` → `500`, body `{ "error": "run could not start" }`. `run` rejecting with `new Error("relation \"etfs\" does not exist")` (ETF query rejected) → the same `500` body. The error's message is **not** in the body (it is logged server-side with `console.error`, which the test spies on and silences).
- H-6c, secrets: `readEnv` returns `CRON_SECRET: "s3cr3t-Token-For-Tests-42"` and `DATABASE_URL: "postgresql://user:pw-XYZ@ep-fake.neon.tech/db"`. A fake outcome's `message` (and an `internal_error` detail) deliberately contain both values. The `200` body text contains neither string and contains `[redacted]`. Also the `401` body, the `500 not configured` body and the `500 run could not start` body (with an error whose message contains both values) contain neither.
- RT-6: real route, correct bearer, `DATABASE_URL` stubbed to `""` → `500 run could not start` (the real `MissingDatabaseUrlError` from `getDb()` is caught, not left unhandled).

**AC7: route exports, build**
- RT-7a: `Object.keys(await import(".../route")).sort()` equals `["GET", "dynamic", "maxDuration", "runtime"]`. `runtime === "nodejs"`, `dynamic === "force-dynamic"`, `typeof maxDuration === "number"` and `maxDuration === 60`.
- RT-7b, budget: `seedEtfs.length * 2 * CRON_FETCH_TIMEOUT_MS + NON_FETCH_ALLOWANCE_MS <= maxDuration * 1000`, where `NON_FETCH_ALLOWANCE_MS = 15_000` is a named constant in the test (parse + Neon wake/queries). With the values in §4 R1: `3 * 2 * 7000 + 15000 = 57000 <= 60000`.
- Gate: `pnpm build` passes with the route importing the real chain. The plan's `next.config.ts` change is `serverExternalPackages: ["unpdf"]` (§4 R2). The implementer records in HANDOVER.md whether the build passed before the change as well (useful evidence, one extra build).

**AC8: README** — review check (reviewer reads the section), plus VC-8: a test reads `README.md` and asserts it no longer contains `Reserved` next to `CRON_SECRET`, and does contain `/api/cron/daily`, `vercel.json`, `Authorization: Bearer` and `Production`. This is a guard against regressions, not a substitute for reading it.

**AC9: MANUAL-QA** (goes into `US-013-qa.md`, sprint-03.md steps 1–4 and 6, plus two steps specific to this plan):
1. Vercel → project → Settings → Functions: note whether **Fluid compute** is on. The deploy must succeed with `maxDuration = 60` either way (60 is within both limits, §4 R1). If the deploy is rejected over `maxDuration`, that is a FAIL to report.
2. Vercel → Settings → Cron Jobs: exactly one job, path `/api/cron/daily`, schedule `0 10 * * *`.
3. `curl -s -o /dev/null -w "%{http_code}\n" https://<app>.vercel.app/api/cron/daily` → `401`; the same with `-H "Authorization: Bearer wrong"` → `401`.
4. `curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<app>.vercel.app/api/cron/daily` → `200` with one `etfs` entry per seeded ETF (`ok` the first time, `already_ingested` on a second call the same day). The Neon queries from sprint-03.md step 4 show the new `reports` / `report_values` rows; open each `source_url` and compare the date and values with the PDF. This is also the live proof of US-012's atomic Neon `db.batch` write (US-012 QA pointer) and of `unpdf` running inside the deployed function.
5. Vercel → project → Logs (or the function's invocation log): the manual run's duration is well under 60 s.
6. On a following day, without any manual action: a new invocation of `/api/cron/daily` appears in Vercel's logs between 10:00 and 10:59 UTC, and on a business day new `reports` rows appear. (`job_runs` rows arrive with US-015.)
- Optional local variant (sprint-03.md step 1): `pnpm dev` + curl with the bearer against `http://localhost:3000/api/cron/daily`, with `DATABASE_URL`/`CRON_SECRET` in the user's own `.env.local`.

**AC10: gates** — `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && pnpm typecheck && pnpm lint && pnpm test && pnpm build`. `package.json` is **not** expected to change (no new dependency; `unpdf` is already pinned `0.11.0`, so Sprint 2 audit N1 is already satisfied). If it does change for any reason, also run `rm -rf node_modules && pnpm install --frozen-lockfile` (US-008 lesson).

---

## 2. Files and boundaries

Create:
- `lib/ingestion/run-daily.ts` — pure orchestration, no I/O imports.
  ```ts
  export const CRON_FETCH_TIMEOUT_MS = 7_000;
  export type DailyEtf = IngestEtfInput & { isActive: boolean };
  export type InternalErrorOutcome = { code: "internal_error"; symbol: string; detail: string };
  export type DailyEtfOutcome = IngestOutcome | InternalErrorOutcome;
  export type DailyRunSummary = { etfs: { symbol: string; outcome: DailyEtfOutcome }[] };
  export type DailyRunDeps = {
    loadEtfs: () => Promise<readonly DailyEtf[]>;
    ingest: (etf: IngestEtfInput) => Promise<IngestOutcome>;
  };
  export async function runDailyIngestion(deps: DailyRunDeps): Promise<DailyRunSummary>;
  ```
  - `loadEtfs` is awaited **outside** any per-ETF try, so a loader failure rejects the whole run (→ handler `500`).
  - Skips `isActive !== true`. Passes `{ id, symbol, bvbUrl, adapterKey, trackedFieldKeys }` (no `isActive`) to `ingest`.
  - Per ETF: `try { outcome = await deps.ingest(etf) } catch (e) { outcome = { code: "internal_error", symbol, detail: e instanceof Error ? e.message : String(e) } }`. Plain `for … of`, no `Promise.all`.
  - The outcome object from `ingest` is stored **as returned** (US-014 will change its `failed` shape to its own codes with `detail`; the runner must not reshape it, so US-014 needs no runner change). `DailyEtfOutcome` is a union type only.
  - `internal_error` uses `detail` (the story's word, and US-014's field name), not US-012's `message`.
- `lib/ingestion/load-etfs.ts`
  ```ts
  export function buildLoadActiveEtfsStatement(db: Db): ReturnType<Db["execute"]>;
  export function createDrizzleEtfLoader(db: Db, run: BatchRunner = neonBatchRunner(db)): () => Promise<DailyEtf[]>;
  ```
  - One raw statement through the **same `BatchRunner` seam as US-012's store** (so PGlite executes the shipped SQL, R3):
    ```sql
    select "e"."id", "e"."symbol", "e"."bvb_url", "e"."adapter_key", "e"."is_active", "t"."field_key"
    from "etfs" "e" left join "tracked_fields" "t" on "t"."etf_id" = "e"."id"
    where "e"."is_active" = true
    order by "e"."symbol", "e"."id", "t"."display_order", "t"."field_key"
    ```
  - Groups rows by `id` in first-seen order; `field_key` NULL (no tracked fields) adds nothing. Maps `bvb_url`→`bvbUrl`, `adapter_key`→`adapterKey` (`null` kept), `id` via `Number()`, and `is_active` through a tiny `parsePgBoolean` (`true`/`"t"`/`"true"` → true, `false`/`"f"`/`"false"` → false, anything else throws → the run fails loudly as `500` instead of silently skipping every ETF). Reads rows with `rowsOf` from `./store`.
  - Imports: `drizzle-orm` (`sql`), the `Db` **type**, `./store` (`BatchRunner`, `neonBatchRunner`, `rowsOf`), `./run-daily` (types). No `getDb`, no `process.env`.
- `lib/cron/daily-handler.ts`
  ```ts
  export type CronEnv = { cronSecret: string | undefined; databaseUrl: string | undefined };
  export type DailyCronDeps = { readEnv: () => CronEnv; run: () => Promise<DailyRunSummary> };
  export async function handleDailyCron(request: Request, deps: DailyCronDeps): Promise<Response>;
  ```
  Order inside: `readEnv()` → if `cronSecret` is undefined or `trim() === ""` → `500 {error:"cron not configured"}` → compare `request.headers.get("authorization") ?? ""` with `` `Bearer ${cronSecret}` `` using `timingSafeEqual` on the two **SHA-256 digests** (`node:crypto`; equal length always, no length leak) → mismatch `401 {error:"unauthorized"}` → `try { summary = await deps.run() } catch (e) { console.error("[cron/daily] run could not start:", e instanceof Error ? e.name : "error"); return 500 {error:"run could not start"} }` → `200 { etfs }`.
  - Every JSON response goes through one `jsonResponse(status, body, secrets)` helper: `JSON.stringify(body, replacer)` where the replacer replaces every non-empty secret (`cronSecret`, `databaseUrl`) inside **string values** with `[redacted]` (split/join, so no regex escaping and no broken JSON). Header `cache-control: no-store`.
  - Only `node:crypto` and types are imported. Uses the global `Request`/`Response` (no `next/server`).
  - The logged error is its **name** only, so even Vercel's function log never gets a message that could echo a connection string. (US-015 will put richer detail into `job_runs.log` under its own redaction AC.)
- `lib/cron/default-deps.ts`
  ```ts
  export const defaultDailyCronDeps: DailyCronDeps = {
    readEnv: () => ({ cronSecret: process.env.CRON_SECRET, databaseUrl: process.env.DATABASE_URL }),
    run: async () => runDailyIngestion(createDailyRunDeps()),
  };
  ```
  `process.env` is read inside the arrow, i.e. per request. `lib/cron/` is outside `lib/ingestion/`, so the existing no-`process.env` boundary test still holds.
- `app/api/cron/daily/route.ts` — the only exports:
  ```ts
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  export const maxDuration = 60;   // literal: Next reads segment config statically
  export async function GET(request: Request) { return handleDailyCron(request, defaultDailyCronDeps); }
  ```
- `vercel.json`: `{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [{ "path": "/api/cron/daily", "schedule": "0 10 * * *" }] }`.
- Tests listed in §1.

Modify:
- `lib/ingestion/default-deps.ts`: **add** `createDailyRunDeps(options = { fetchTimeoutMs: CRON_FETCH_TIMEOUT_MS }): DailyRunDeps`. It calls `getDb()` once, builds `IngestDeps` with `discover: (etf) => discoverLatestReport(etf, { timeoutMs })`, `download: (url) => downloadReportPdf(url, { timeoutMs })`, `extractText: extractPdfText`, `registry: defaultAdapterRegistry`, `store: createDrizzleReportStore(db)`, and returns `{ loadEtfs: createDrizzleEtfLoader(db), ingest: (etf) => ingestEtf(etf, ingestDeps) }`. `createDefaultIngestDeps()` stays **unchanged** (its identity test must keep passing untouched).
  - DD tests (new block, same `vi.mock("@neondatabase/serverless")` + `vi.resetModules()` pattern): (1) with `DATABASE_URL` stubbed to `""` → `createDailyRunDeps()` throws `MissingDatabaseUrlError`; (2) with the fake URL → returns two functions, no network; (3) with `vi.mock("../extraction/discovery", …)` partially mocking `discoverLatestReport` to resolve `{ status: "not_found", reason: "list_not_found" }`, calling `deps.ingest({ …, adapterKey: "brd-depositary" })` shows `discoverLatestReport` was called with `(…, { timeoutMs: 7000 })` and the outcome is US-012's discovery failure — the shorter timeout really reaches the fetch layer. (Put (3) in its own file `lib/ingestion/default-deps.cron.test.ts` if the module mock would disturb the existing identity test.)
- `next.config.ts`: `serverExternalPackages: ["unpdf"]` inside the existing `nextConfig` object (still wrapped by `withNextIntl`). See §4 R2.
- `README.md`:
  - `CRON_SECRET`: replace "Reserved for Sprint 3 (ingestion); not used yet" with its real contract: required in production; the route answers `500` when it is unset and `401` without `Authorization: Bearer <CRON_SECRET>`; Vercel Cron sends that header automatically when the variable is set.
  - Deployment step 3: drop "unused until Sprint 3".
  - New section `## Daily ingestion (cron)`: schedule `0 10 * * *` UTC (10:00–10:59 UTC, because Vercel Hobby may fire anywhere within the hour), set in `vercel.json`; why that hour (BVB filings 09:09–09:34 Bucharest time; a report filed after the run is not retried, FR4.1); manual trigger locally (`pnpm dev`, then `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily`) and on the deployment (same with the Vercel URL); Vercel runs cron jobs **only on Production deployments**; until US-023, change the hour by editing `vercel.json` and redeploying; the response is a JSON per-ETF outcome summary; route `maxDuration` is 60 s and each bvb.ro request times out after 7 s.

Do not change:
- `lib/ingestion/{ingest-etf,select-values,store}.ts` and every existing test file (the US-012 tests are not touched; DD tests are **added** only);
- `lib/extraction/**`, `lib/db/**`, `drizzle/**`, any UI, `messages/*` (the JSON summary is not UI, story Notes);
- `.env.example` (and never open any `.env*` file). README is the documentation target.
- `package.json` / lockfile (nothing to add).

Boundary summary: `app/api/cron/daily/route.ts` (config + one line) → `lib/cron/default-deps.ts` (env + production wiring) → `lib/cron/daily-handler.ts` (auth, HTTP mapping, redaction; pure with injected deps) → `lib/ingestion/run-daily.ts` (pure orchestration) → `ingestEtf` (US-012) and `lib/ingestion/load-etfs.ts` (SQL + injected runner). `lib/ingestion/**` still never imports Next, UI, AI or `process.env` — the existing `boundaries.test.ts` now also scans `run-daily.ts` and `load-etfs.ts` automatically (its count check goes from ≥4 to a larger actual count, still valid).

---

## 3. Data model and migration

None. Reads `etfs` (`id`, `symbol`, `bvb_url`, `adapter_key`, `is_active`) and `tracked_fields` (`etf_id`, `field_key`, `display_order`); writes only through US-012's store. No `drizzle-kit generate`, nothing touches Neon.

---

## 4. Risks and the smallest design

- **R1: duration budget → `maxDuration = 60`, fetch timeout 7 s, sequential.**
  - Vercel Hobby limits, from the Vercel functions documentation as I know it (the implementer re-checks the current "Configuring Maximum Duration" page if reachable, and records what it said in HANDOVER.md): with **Fluid compute** (the default for projects created since 2025) Hobby allows up to 300 s; without it, up to 60 s (default 10 s). Whether this project has Fluid compute on is a Vercel setting agents cannot see. `60` is valid under both, so the deploy cannot be rejected over it; it is also a real ceiling rather than the legacy 10 s default.
  - Worst case at the default 15 s timeouts: 3 ETFs × (15 + 15) = 90 s > 60 s. Per the story Notes, reduce the timeouts through the existing `timeoutMs` injection rather than add concurrency: 7 s each → 42 s of network worst case, plus parse (under 1 s per PDF on the fixtures) and Neon wake + queries, within 60 s. RT-7b pins that arithmetic. A normal bvb.ro page/PDF answers in about a second, so 7 s is a timeout, not a squeeze. A bvb.ro slower than 7 s gives a visible `failed`/`fetch_error` for that ETF that day (FR4.1: blank, no retry).
  - Forward note (not this story): the budget grows by 14 s per active ETF. Once admins can add ETFs (Sprint 5), a fourth active ETF breaks the 60 s worst case. Options then: confirm Fluid compute and raise `maxDuration` to 300, or bounded concurrency. The implementer copies this line into the QA file's notes so the Sprint 5 planner sees it. A run killed by the limit is still visible via US-015's stale-run sweep.
- **R2: `unpdf` inside a Next.js server bundle.** The only code path that actually loads pdf.js (`extractText` → `await import('unpdf/pdfjs')`) runs after a live DB read and a live bvb.ro download, so a webpack-bundling defect would first show up **in production, in the unattended cron run**, where nobody watches. No offline test can exercise that path inside the built server. Therefore the plan adds `serverExternalPackages: ["unpdf"]` **proactively**: Node then loads unpdf from `node_modules` exactly as Vitest and the `tsx` scripts already do (proven by the fixture tests and `report:latest`). The dynamic import is a static string, so Vercel's file tracing includes `unpdf/dist/pdfjs.mjs`. `canvas` is only referenced on the render path we never call, and stays `allowBuilds.canvas: false`. This slightly front-runs the story's "if build or route fails, add it first" wording; the reason is recorded here and the implementer notes it in HANDOVER.md. Live proof: AC9 step 4.
- **R3: result shapes, neon-http vs PGlite.** Handled exactly as US-012: raw `db.execute(sql…)` through a `BatchRunner`, rows read with `rowsOf`, snake_case column keys mapped explicitly. A single-statement `db.batch` on neon-http is a one-query transaction, which is harmless for a read. Live proof of the neon shape: AC9 step 4 (an empty `etfs` result there would mean mapping broke — the implementer adds this to the QA checklist as "expect three entries, not zero").
- **R4: `getDb()` caching across tests.** `cachedDb` is module-level. RT and DD tests use `vi.resetModules()` plus dynamic imports and never leave a real-looking `DATABASE_URL` without the neon mock.
- **R5: Vitest must not pick up the user's `.env.local`.** Vitest does not load `.env.local` into `process.env`, but RT stubs `DATABASE_URL`/`CRON_SECRET` explicitly in every case anyway, so the tests are deterministic on any machine.
- **R6: `HEAD` / other methods.** Only `GET` is exported; Next returns `405` for others. A `HEAD` is answered from `GET` by Next and passes through the same auth, so no bypass.
- **R7: overlapping runs** (a manual trigger during the scheduled one): each ETF write is guarded in SQL by US-012's `status <> 'ok'` rule, so the worst case is `already_ingested`. Nothing extra here.
- **Deliberately not built:** a run deadline / skip-remaining logic, concurrency, retries, a CLI runner, `job_runs` (US-015), reading `settings.cron_hour_utc` (US-023).

Implementation order: 1 `run-daily` + RD → 2 `load-etfs` + LQ/LP → 3 `createDailyRunDeps` + DD → 4 `daily-handler` + H → 5 `lib/cron/default-deps` + route + RT → 6 `vercel.json` + VC → 7 `next.config.ts` → 8 README + VC-8 → 9 the four gates (note in HANDOVER.md whether `pnpm build` passed before step 7 too, if you ran it).

## 5. Decisions needed

None. The cron schedule is Decided (SPRINT-03-review #3). `maxDuration`, the fetch timeout and the proactive `serverExternalPackages` entry are implementation choices the story explicitly delegates to the plan (Notes "Duration budget", Task 4), justified in §4 R1/R2 and reversible by editing one constant or one config line.
