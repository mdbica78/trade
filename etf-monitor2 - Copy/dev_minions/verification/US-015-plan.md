# US-015 plan: job run logging

Planner: `story-planner` (opus, high), 2026-09-25. Mode: `plan US-015`.
Sources read: `backlog/stories/US-015.md`, `sprints/sprint-03.md`, `verification/SPRINT-03-review.md` (US-015 section), `verification/US-013-plan.md`, `verification/US-014-plan.md`, `architecture/data-model.md` (`job_runs`), requirements FR4.1 / FR8.1 / FR13 / section 5. Code: `lib/db/schema.ts`, `lib/ingestion/{run-daily,default-deps,store,load-etfs,outcome,ingest-etf}.ts`, `lib/ingestion/{boundaries,ingest-etf,run-daily,default-deps,default-deps.cron}.test.ts`, `lib/cron/{daily-handler,default-deps}.ts`, `lib/cron/daily-handler.test.ts`, `app/api/cron/daily/route{,.test}.ts`, `test/helpers/pglite.ts`.

**Decisions needed: none.** The story, the sprint review fixes and US-013's contract settle every product question. Three implementation choices the story leaves open are settled in §4 (R1 where the orchestration lives, R2 what happens when `finishRun` itself fails, R3 the response shape) and flagged for the reviewer. None of them is a product choice.

---

## 0. Shape in one paragraph

`handleDailyCron` (US-013) keeps auth and HTTP mapping. After auth it calls `deps.run({ secrets })`. The production `run` (in `lib/cron/default-deps.ts`) builds a Drizzle job-run store and calls a new `runDailyJob` (in `lib/cron/daily-job.ts`). `runDailyJob` does, in order:
1. take `startedAt = now()`;
2. `failStaleRuns(startedAt - STALE_RUN_THRESHOLD_MS)`;
3. `startRun(startedAt)`;
4. `runIngestion()`, which is US-013's unchanged `runDailyIngestion(createDailyRunDeps())`;
5. compute status, counts and log with the pure helpers in `lib/ingestion/job-run-summary.ts`;
6. `finishRun`.

If step 2 or 3 throws, `runDailyJob` rejects, and the handler's existing catch returns `500 run could not start`. A throw in step 4 or 5 is caught, and the row is finished as `failed` with the error in its log. The handler maps the result to `200` (finished) or `500` (aborted), and both carry `jobRunId` and `status`.

---

## 1. Acceptance criteria, each with the test that proves it

Test files (all offline, Vitest). In every non-PGlite file, `globalThis.fetch` is stubbed with `vi.stubGlobal` to throw `real network forbidden`, and each describe asserts it was never called (Sprint 2 audit W2):
- `lib/ingestion/job-run-summary.test.ts` (JS): pure status, count and log rules.
- `lib/ingestion/job-runs.test.ts` (JR): the store's statements via `drizzle.mock` and a recording `BatchRunner` (the same pattern as `load-etfs.test.ts` / `store.test.ts`).
- `lib/ingestion/job-runs.pglite.test.ts` (JP): the shipped job-run SQL executed on PGlite (`test/helpers/pglite.ts`), plus one composed run through `runDailyJob`.
- `lib/cron/daily-job.test.ts` (DJ): orchestration with a fake store, a fixed clock and fake ingestion.
- `lib/cron/daily-handler.test.ts` (H): existing, edited and extended (the edit table is below).
- `app/api/cron/daily/route.test.ts` (RT): existing, one test added.
- `lib/ingestion/default-deps.test.ts` (DD): existing, one describe block added.
- Shared fake: new `test/helpers/job-run-fakes.ts`. `FakeJobRunStore` has in-memory rows, a `calls` list of `{ method, args }`, an optional per-method failure (`failOn: 'failStaleRuns' | 'startRun' | 'finishRun'`), and an optional shared `events: string[]` recorder so that DJ can assert ordering across store, loader and ingest.

Fixed clock in DJ: `now` returns `T0 = new Date("2026-09-25T10:00:05.000Z")` on the first call and `T1 = new Date("2026-09-25T10:00:41.000Z")` on the second, from a list built in the test. There are no fake timers.

**AC1: one row per authorized run, unauthorized writes none**
- DJ-1a, ordering: shared `events` recorder, fake loader with two active ETFs, fake `ingest`. Expected `events` is exactly `['failStaleRuns', 'startRun', 'loadEtfs', 'ingest:A', 'ingest:B', 'finishRun']`. `startRun` is called once with `T0`.
- DJ-1b, finish contents: `finishRun` is called once, with the id `startRun` returned (the fake returns `42`), and with `{ finishedAt: T1, status, etfsProcessed, errorsCount, log }`. After the call the `FakeJobRunStore` row 42 has `status !== 'running'` and a non-null `finishedAt`.
- H-15a, the composed 401: `handleDailyCron` with `run: (ctx) => runDailyJob({ ...fakeDeps, secrets: ctx.secrets })` and a wrong bearer → `401`, and `FakeJobRunStore.calls` is empty (no `failStaleRuns`, no `startRun`). The same holds for a missing header and for `500 cron not configured`. This replaces H-1f's composition (see the edit table): the old assertions stay, plus `store.calls.length === 0`.
- JP-1, real SQL: `startRun(T0)` returns a numeric id. The row has `status 'running'`, `started_at = T0`, `finished_at` null, `etfs_processed 0`, `errors_count 0`, `log` null. Then `finishRun(id, {...})` gives exactly the given values on that row. `select count(*) from job_runs` is 1.

**AC2: status and counts** (one test per case, DJ through `runDailyJob`, each asserting `status`, `etfsProcessed`, `errorsCount` in the `finishRun` input and in the returned result)
- DJ-2a: all `ok` (3 ETFs) → `success`, 3, 0.
- DJ-2b: all `already_ingested` (3) → `success`, 3, 0.
- DJ-2c: zero active ETFs (loader returns `[]`, or only inactive ones) → `success`, 0, 0. `ingest` is never called. The log is exactly `success: 0 processed, 0 errors`.
- DJ-2d: `ok`, `fetch_error`, `already_ingested` → `partial`, 3, 1.
- DJ-2e: `missing`, `no_adapter`, a thrown `ingest` (so the runner's `internal_error`) → `failed`, 3, 3. The handler still answers `200` for this finished run (R3).
- JS-2: `summarizeRun` gets the same five cases as a pure table, plus the boundary `1 of 1 failed` → `failed` and `1 of 2 failed` → `partial`.

**AC3: every failure code counts, success codes do not, unknown counts**
- JS-3a: a table over `INGEST_OUTCOME_CODES` plus `'internal_error'`. Each code is `isErrorOutcome` true, except `ok` and `already_ingested`. The expected set is written literally in the test (`['missing', 'fetch_error', 'no_adapter', 'parse_error', 'persist_error', 'internal_error']`). A second assertion checks that every code in `INGEST_OUTCOME_CODES` appears in either the literal success list or the literal failure list. A code added later without updating this test then fails the test, not the count.
- JS-3b: `isErrorOutcome('some_future_code')` is true, and `summarizeRun` with one `ok` and one `{ code: 'some_future_code' }` (cast through `unknown`) gives `partial`, 2, 1.
- JS-3c, by exclusion in the source: `job-run-summary.ts` exports `SUCCESS_OUTCOME_CODES = ['ok', 'already_ingested'] as const`, and `isErrorOutcome` is `!SUCCESS_OUTCOME_CODES.includes(code)`. The behaviour is proven by JS-3b. The reviewer reads the source for the rest.

**AC4: log format and secrets**
- JS-4a, exact log: three outcomes: `ok` (`reportDate '2026-09-22'`, detail `stored 8 values`), `fetch_error` (detail `download http_error 404: https://…`), `parse_error` (`reportDate '2026-09-22'`, detail `missing fields: nav_per_unit`). The log equals exactly
  ```
  partial: 3 processed, 2 errors
  AAA ok 2026-09-22 stored 8 values
  BBB fetch_error download http_error 404: https://…
  CCC parse_error 2026-09-22 missing fields: nav_per_unit
  ```
  joined with `\n`, in processing order. There is no trailing newline.
- JS-4b, the date only when known: `already_ingested` shows its `reportDate`, `no_adapter` and `missing` have none, and `persist_error` shows `reportDate` only when present.
- JS-4c, truncation: a 1000-character detail becomes exactly `MAX_LOG_DETAIL_LENGTH` (300) characters and ends with `...`. A detail of exactly 300 characters is unchanged, and one of 301 is cut. The limit applies to the detail part (date plus detail), not to symbol or code.
- JS-4d, one line per ETF: an `internal_error` detail containing `\n` and tabs (the runner does not collapse whitespace, see `run-daily.ts`) is still one line. `log.split('\n').length === 1 + etfCount`.
- JS-4e, secrets in pure form: with `secrets = [SECRET, DB_URL]`, details containing both, including one where the secret sits across position 300 (so truncating first would leave part of it), give a log with neither value and with `[redacted]`. Redaction runs **before** whitespace collapsing and truncation (R4).
- H-15b, the AC4 end-to-end test "with the secret and the database URL set in the environment": `vi.stubEnv('CRON_SECRET', SECRET)` and `vi.stubEnv('DATABASE_URL', 'postgresql://user:pw-XYZ@ep-fake.neon.tech/db')`. `readEnv` is the **real** `defaultDailyCronDeps.readEnv` (so the values come from `process.env`). `run` is `(ctx) => runDailyJob({ jobRuns: fakeStore, now, runIngestion: fake, secrets: ctx.secrets })`, with outcome details and an `internal_error` detail containing both values. It asserts that the stored `finishRun` log and the response text contain neither value. A second case has `runIngestion` throw `new Error(\`connect failed: ${DB_URL}\`)`: the aborted log and the `500` body contain neither.
- The log is plain English and holds only codes, symbols, dates and details. No UI string is added, so there is no `messages/*` change (FR8.1 is carried by the stable codes, story step 5).

**AC5: abort handling**
- DJ-5a, the ETF query throws after the row exists: the real `runDailyIngestion` with a `loadEtfs` that rejects `new Error('relation "etfs" does not exist')`. `finishRun` is called once with `status 'failed'`, `etfsProcessed 0`, `errorsCount 0`, and the log `failed: 0 processed, 0 errors\nrun aborted: relation "etfs" does not exist`. The result is `{ kind: 'aborted', jobRunId: 42, status: 'failed' }`, and `ingest` is never called.
- DJ-5b, `runIngestion` rejects with a non-Error (`'plain'`): same shape, and the log ends with `run aborted: plain` (through US-014's `errorText`, which never throws).
- DJ-5c, `failStaleRuns` rejects: `runDailyJob` rejects. `startRun`, `loadEtfs`, `ingest` and `finishRun` are never called.
- DJ-5d, `startRun` rejects: `runDailyJob` rejects. `failStaleRuns` was called once, and `loadEtfs`, `ingest` and `finishRun` never.
- DJ-5e, `finishRun` rejects after a normal run (R2): `runDailyJob` resolves `{ kind: 'aborted', jobRunId: 42, status: 'failed' }` and does not throw. `finishRun` was called **exactly once** (no second attempt).
- H-15c, HTTP mapping: `run` resolving an aborted result → `500`, body `{ error: 'run failed', jobRunId: 42, status: 'failed' }`, `console.error` spied and silenced. `run` rejecting (DJ-5c/5d composed through the handler with a fake store) → `500`, body exactly `{ error: 'run could not start' }` (unchanged from US-013), and `ingest` never called.

**AC6: stale runs**
- JP-6a, real SQL: seed four rows by direct `pg.query`:
  - (i) `running`, `started_at = T0 - 20 min`, `log` null;
  - (ii) `running`, `T0 - 16 min`, `log 'partial text'`;
  - (iii) `running`, `T0 - 5 min`;
  - (iv) `success`, `T0 - 2 days`, `finished_at` set, `log 'success: 3 processed, 0 errors'`.
  
  `failStaleRuns(T0 - 15 min)` returns 2. Then:
  - (i) is `failed`, `log = 'did not finish (timed out or crashed)'`, `finished_at` null;
  - (ii) is `failed`, `log = 'partial text\ndid not finish (timed out or crashed)'`, `finished_at` null;
  - (iii) and (iv) are byte-for-byte unchanged (compare the full rows).
- JP-6b, the boundary: a `running` row with `started_at` exactly equal to the cutoff is **not** swept (`<`, not `<=`).
- JP-6c, idempotence: a second `failStaleRuns` call with the same cutoff returns 0, and no log line is appended twice.
- DJ-6a: `failStaleRuns` is called once, with exactly `new Date(T0.getTime() - STALE_RUN_THRESHOLD_MS)`, before `startRun`.
- JP-15, composed: `runDailyJob` with the **real** `createDrizzleJobRunStore(mockDb, runner)` on PGlite, a pre-seeded stale `running` row, and a fake `runIngestion` returning two `ok` outcomes. Afterwards the old row is `failed` with the stale line, and exactly one new row exists with `success`, 2, 0, `finished_at` set and the expected log.
- RT-15, the threshold relation: in `route.test.ts`, `STALE_RUN_THRESHOLD_MS` (imported from `lib/cron/daily-job`) `> route.maxDuration * 1000`. It is also asserted `>= 5 * 60_000`, so that a later `maxDuration` raise to Vercel's 300 s ceiling (US-013 R1 forward note) still leaves margin. The value is `15 * 60_000`. RT-7a (exact route exports) stays unchanged, which proves the constant does not live in the route file.

**AC7: the response carries the job run id and final status**
- H-15d: `run` resolving `{ kind: 'finished', jobRunId: 7, status: 'partial', etfs: [...] }` → `200`, body `{ jobRunId: 7, status: 'partial', etfs: [...] }`.
- H-15c (above): aborted → `500` with `jobRunId` and `status: 'failed'`.
- The `500 run could not start` body has no `jobRunId` because no row was created. This is the story's "(when one was created)". H-6b and RT-6 keep asserting the exact `{ error: 'run could not start' }` body, unchanged.
- DJ-7: in DJ-2a..e the returned `jobRunId` equals the id `startRun` returned, and `status` equals the `finishRun` status.

**AC8: offline.** All new files follow the pattern above: `fetch` is stubbed and asserted uncalled, and no test sets a real-looking `DATABASE_URL` without `vi.mock('@neondatabase/serverless')` (DD follows `default-deps.test.ts`). JP uses in-process PGlite only. The reviewer greps the new test files for `neon(`, `getDb(` without a mock, and real URLs.
- DD-15: new describe `createDefaultJobRunStore`:
  - with `DATABASE_URL` `""` it throws `MissingDatabaseUrlError`;
  - with the fake URL (neon mocked) it returns `failStaleRuns`/`startRun`/`finishRun` functions and makes no call.
- RT-6 (existing, unchanged) now also proves that the job-run store's `getDb()` failure is caught as `500 run could not start`.

**AC9: MANUAL-QA** (goes into `US-015-qa.md`, sprint-03.md steps 4–6, plus the steps below):
1. Deploy to Production (user pushes). No migration: `job_runs` already exists from `0000_init.sql`.
2. `curl -s -H "Authorization: Bearer <CRON_SECRET>" https://etf-monitor2.vercel.app/api/cron/daily` → `200`, and the JSON has `jobRunId` (a number), `status` and one `etfs` entry per active ETF.
3. Neon SQL editor: `select id, started_at, finished_at, status, etfs_processed, errors_count, log from job_runs order by id desc limit 5;`. The newest row has the response's `jobRunId`, `finished_at` set, `etfs_processed = 3`, `errors_count` equal to the number of non-`ok`/non-`already_ingested` outcomes in the response, and a log whose first line is `<status>: 3 processed, <n> errors`, followed by one `<SYMBOL> <code> <date> <detail>` line per ETF.
4. Trigger again the same day. The new row is `success`, `3 processed, 0 errors`, and all three lines read `already_ingested <date> report already stored`.
5. Search the newest rows' `log` for the `CRON_SECRET` value and for the Neon host/password: nothing is found (`select id from job_runs where log like '%<first 8 chars of the secret>%';` returns no rows).
6. The next day, without any manual action, a new row appears with `started_at` between 10:00 and 10:59 UTC.
7. Optional stale-sweep check (writes one test row, which the user may skip): `insert into job_runs (started_at, status) values (now() - interval '1 hour', 'running');`, then trigger once. That row is now `failed` with log `did not finish (timed out or crashed)` and `finished_at` still null.
8. Known limit, written in the QA file: when Neon is unreachable, `startRun` fails, so **no** row can be written. The only trace is the `500 run could not start` response and Vercel's function log (story Notes).

**AC10: gates.** `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && pnpm typecheck && pnpm lint && pnpm test && pnpm build`. `package.json` is not expected to change. If it does, also run `rm -rf node_modules && pnpm install --frozen-lockfile` (US-008 lesson).

### Edited US-013 tests (vocabulary and composition only, no behaviour weakened)

| File / test | Change | Why |
|---|---|---|
| `daily-handler.test.ts` H-1e, H-1g | The `run` mock returns `{ kind: 'finished', jobRunId: 1, status: 'success', etfs: [] }` instead of `{ etfs: [] }`. The status and call-count assertions are unchanged. | `DailyCronDeps.run` now returns `DailyJobResult`. |
| `daily-handler.test.ts` H-1f | The composition changes from `run: () => runDailyIngestion({ loadEtfs, ingest })` to `run: (ctx) => runDailyJob({ jobRuns: fakeStore, now, secrets: ctx.secrets, runIngestion: () => runDailyIngestion({ loadEtfs, ingest }) })`. Keeps `loadEtfs`/`ingest` not called, and **adds** `fakeStore.calls.length === 0`. | It is the same test made stricter, and it becomes H-15a. |
| `daily-handler.test.ts` H-3c/H-6a, H-6c | The summary fixtures are wrapped as `{ kind: 'finished', jobRunId: 1, status: 'partial', etfs: [...] }`. Every existing `etfs` assertion and redaction assertion is unchanged, and H-3c adds `body.jobRunId === 1`. | Type follows the new union. |
| `daily-handler.test.ts` H-1a..d, H-1h, H-6b | Unchanged (`vi.fn()` with no return type still type-checks, and the error bodies are unchanged). | — |
| `route.test.ts` | Only RT-15 is added. RT-1a..c, RT-6, RT-7a/b are unchanged. | — |
| `run-daily.test.ts`, `default-deps.cron.test.ts` | Unchanged (`runDailyIngestion` and `createDailyRunDeps` are not modified). | — |

No test is deleted.

---

## 2. Files and boundaries

Create:
- `lib/ingestion/job-runs.ts`: the store, SQL only, with no clock and no env.
  ```ts
  export type JobRunStatus = 'running' | 'success' | 'partial' | 'failed';
  export type FinalJobRunStatus = Exclude<JobRunStatus, 'running'>;
  export const STALE_RUN_LOG_LINE = 'did not finish (timed out or crashed)';
  export type FinishRunInput = { finishedAt: Date; status: FinalJobRunStatus; etfsProcessed: number; errorsCount: number; log: string };
  export interface JobRunStore {
    failStaleRuns(startedBefore: Date): Promise<number>;   // rows swept
    startRun(startedAt: Date): Promise<number>;             // new id
    finishRun(id: number, input: FinishRunInput): Promise<void>;
  }
  export function buildFailStaleRunsStatement(db: Db, startedBefore: Date);
  export function buildStartRunStatement(db: Db, startedAt: Date);
  export function buildFinishRunStatement(db: Db, id: number, input: FinishRunInput);
  export function createDrizzleJobRunStore(db: Db, run: BatchRunner = neonBatchRunner(db)): JobRunStore;
  ```
  - The SQL goes through the same `BatchRunner` seam and `rowsOf` as `store.ts`/`load-etfs.ts`, with one statement per call, so PGlite runs the shipped SQL:
    - sweep: `update "job_runs" set "status" = 'failed', "log" = case when "log" is null or "log" = '' then ${STALE_RUN_LOG_LINE} else "log" || E'\n' || ${STALE_RUN_LOG_LINE} end where "status" = 'running' and "started_at" < ${startedBefore} returning "id"`. `finished_at` is not in the `set` list. Pass the line as a `::text` parameter.
    - start: `insert into "job_runs" ("started_at", "status") values (${startedAt}, 'running') returning "id"`.
    - finish: `update "job_runs" set "finished_at" = …, "status" = …, "etfs_processed" = …, "errors_count" = …, "log" = … where "id" = ${id} returning "id"`. With zero rows returned it throws `Error('job run <id> not found')`. There is deliberately no `status = 'running'` guard (R2).
  - JR tests: each builder's `getQuery()`. The sweep SQL contains `"status" = 'running'` and `"started_at" <` and does **not** contain `finished_at`. The start SQL contains `'running'`. The finish SQL is keyed on `"id"`. Each store method calls the runner exactly once with one statement. `startRun` returns `Number(rows[0].id)`, and `finishRun` rejects on an empty result. There is also a type check: `expectTypeOf<JobRunStatus>().toEqualTypeOf<(typeof jobRuns.$inferSelect)['status']>()` ties the union to `lib/db/schema.ts`.
- `lib/ingestion/job-run-summary.ts`: pure, imports only `./outcome` and types from `./run-daily`.
  ```ts
  export const SUCCESS_OUTCOME_CODES = ['ok', 'already_ingested'] as const;
  export const MAX_LOG_DETAIL_LENGTH = 300;
  export function isErrorOutcome(code: string): boolean;
  export function summarizeRun(etfs: DailyRunSummary['etfs']): { status: FinalJobRunStatus; etfsProcessed: number; errorsCount: number };
  export function redactSecrets(text: string, secrets: readonly string[]): string;   // exact non-empty values → '[redacted]', split/join
  export function truncateDetail(text: string, max = MAX_LOG_DETAIL_LENGTH): string; // > max → first (max-3) chars + '...'
  export function formatRunLog(etfs: DailyRunSummary['etfs'], result: ReturnType<typeof summarizeRun>, secrets: readonly string[]): string;
  export function formatAbortedRunLog(error: unknown, secrets: readonly string[]): string; // 'failed: 0 processed, 0 errors\nrun aborted: <msg>'
  ```
  - Each ETF line is `${clean(symbol)} ${clean(code)} ${truncateDetail(clean(detailWithDate))}`, where `clean = s => oneLine(redactSecrets(s, secrets))` and `detailWithDate = reportDate ? \`${reportDate} ${detail}\` : detail`. `reportDate` is read only when it is a string on the outcome (`'reportDate' in outcome`).
  - The summary line is `${status}: ${etfsProcessed} processed, ${errorsCount} errors`. The abort message is `truncateDetail(clean(errorText(error)))`.
  - `redactSecrets` is local to this module on purpose (the handler's `redact` works on JSON values). Its only rule is to replace exact non-empty values, the same rule as the handler.
- `lib/cron/daily-job.ts`: orchestration, with no DB import and no `process.env`.
  ```ts
  export const STALE_RUN_THRESHOLD_MS = 15 * 60_000;
  export type DailyJobResult =
    | { kind: 'finished'; jobRunId: number; status: FinalJobRunStatus; etfs: DailyRunSummary['etfs'] }
    | { kind: 'aborted'; jobRunId: number; status: 'failed'; reason: 'run_threw' | 'finish_failed' };
  export type DailyJobDeps = {
    now: () => Date;
    jobRuns: JobRunStore;
    runIngestion: () => Promise<DailyRunSummary>;
    secrets: readonly string[];
  };
  export async function runDailyJob(deps: DailyJobDeps): Promise<DailyJobResult>;
  ```
  The body follows §0. Steps 2–3 are **not** wrapped in a try, so their errors reject. Steps 4–5 are in one try/catch that produces either the finished `FinishRunInput` or the aborted one. Then there is exactly one `await jobRuns.finishRun(...)` inside its own try/catch, which on failure returns `aborted` / `finish_failed` (R2).
- `lib/cron/daily-job.test.ts`, `lib/ingestion/job-runs.test.ts`, `lib/ingestion/job-runs.pglite.test.ts`, `lib/ingestion/job-run-summary.test.ts`, `test/helpers/job-run-fakes.ts`.

Modify:
- `lib/cron/daily-handler.ts`:
  - `DailyCronDeps.run` becomes `(ctx: { secrets: readonly string[] }) => Promise<DailyJobResult>`;
  - the handler calls `deps.run({ secrets })` with the same `secrets` array it already builds for redaction;
  - `finished` → `200 { jobRunId, status, etfs }`;
  - `aborted` → `console.error('[cron/daily] run failed:', reason)` and `500 { error: 'run failed', jobRunId, status: 'failed' }`;
  - a rejection → unchanged `500 { error: 'run could not start' }`.
  
  Auth order and redaction are unchanged.
- `lib/cron/default-deps.ts`: `run: async ({ secrets }) => runDailyJob({ now: () => new Date(), jobRuns: createDefaultJobRunStore(), runIngestion: () => runDailyIngestion(createDailyRunDeps()), secrets })`. `createDefaultJobRunStore()` is evaluated inside the async arrow, so a missing `DATABASE_URL` becomes a rejection, and RT-6 stays green. This is the only place the job clock is wired.
- `lib/ingestion/default-deps.ts`: add `createDefaultJobRunStore(): JobRunStore` (`createDrizzleJobRunStore(getDb())`). The existing functions are unchanged.
- `lib/cron/daily-handler.test.ts`, `app/api/cron/daily/route.test.ts`, `lib/ingestion/default-deps.test.ts`: as in §1.
- `lib/ingestion/boundaries.test.ts`: add BD-15. Among non-test files under `lib/`, scanned recursively, only `lib/ingestion/job-runs.ts` contains `insert into "job_runs"` or `update "job_runs"`. It is a positive check, so it fails if the file is renamed and the statement moves. Also, `lib/cron/daily-job.ts` does not contain `process.env` and does not import `../db`.

Do not change: `lib/ingestion/{run-daily,ingest-etf,outcome,store,load-etfs,select-values}.ts`, `lib/db/**`, `drizzle/**`, `app/api/cron/daily/route.ts` (its exports are pinned by RT-7a), `vercel.json`, `next.config.ts`, `messages/*`, `package.json`, `README.md`. One optional README line is allowed: under "Daily ingestion (cron)", "each run is recorded in `job_runs`; the response includes `jobRunId` and `status`". The implementer decides, and the reviewer does not require it.

Boundaries: `route.ts` → `lib/cron/default-deps.ts` (env, clock, concrete wiring) → `lib/cron/daily-handler.ts` (auth, HTTP mapping, response redaction) → `lib/cron/daily-job.ts` (job-run lifecycle, pure with injected deps) → `lib/ingestion/job-run-summary.ts` (pure rules) + `lib/ingestion/job-runs.ts` (SQL) + `lib/ingestion/run-daily.ts` (unchanged). The existing `boundaries.test.ts` scans pick up both new `lib/ingestion` files automatically (no Next/UI/AI, no `process.env`). BD-3 in `ingest-etf.test.ts` (no `new Date(` / `Date.now(` in `lib/ingestion`) also covers them. That is why the clock and the cutoff arithmetic live in `lib/cron` (R1).

---

## 3. Data model and migration

None. `job_runs` exists in `lib/db/schema.ts` and `drizzle/0000_init.sql` with exactly the columns the story uses (`started_at` NOT NULL, `finished_at` nullable, `status` text, the two int counters defaulting to 0, and `log` text nullable). There is no new column, no index (one row per day), no `drizzle-kit generate`, and nothing touches Neon.

---

## 4. Risks and the smallest design

- **R1: where the orchestration lives.** The story suggests wiring into `runDailyIngestion` "or its handler". Putting it in `lib/ingestion` would need `new Date(...)` for the cutoff, and BD-3 forbids `new Date(` in `lib/ingestion` (it guards "no guessed report date"). Weakening BD-3 is not allowed. So the lifecycle goes in `lib/cron/daily-job.ts` with an injected `now`, the SQL store and the pure rules stay in `lib/ingestion`, and `runDailyIngestion` is untouched (its RD tests stay byte-for-byte). Reviewer: check that no `lib/ingestion` file gained a clock read.
- **R2: `finishRun` fails** (for example Neon drops mid-run). There is no second attempt: a retry is not needed, and the data is safe because the row stays `running`. The next run's sweep turns it into `failed` with `did not finish`. That is exactly Task 4's "never reaches finishRun" case. The response is `500` with `jobRunId` and `status: 'failed'`, the status the row will end with. `finishRun` has no `status = 'running'` guard: if a sweep ever raced a still-living run (impossible while the threshold is 15 min and `maxDuration` is 60 s, pinned by RT-15), the run that actually finished writes the true result, which is more accurate than "did not finish". `finishRun` throws when the id matches no row, so a vanished row is not silently ignored.
- **R3: response codes.** A **finished** run is `200` whatever its status, including `failed` when every ETF failed (US-013 AC6: a completed run with outcomes is `200`, and the per-ETF failures are in the body and the row). `500` is only for "could not start" (no row) and "aborted" (a row finished as `failed` by the abort path, or left for the sweep). This follows Task 2 ("anything throws after `startRun` … `500`") and keeps US-013's error bodies exactly as they are. Vercel therefore flags a cron invocation as failed only when the machinery broke, not when bvb.ro had no report.
- **R4: secrets in the log.** The log is built from outcome details, which include DB driver messages under `persist_error` and raw error messages under `internal_error` and aborts (US-014 R3 forward note). `redactSecrets` replaces exact values of `CRON_SECRET` and `DATABASE_URL`, passed from the handler's request-time env read. `lib/cron/daily-job.ts` never reads `process.env`. Redaction runs before `oneLine` (collapsing whitespace could otherwise break a match) and before truncation (a secret cut at position 300 would otherwise leave a prefix that no longer matches). JS-4e covers both orderings. Residual risk, recorded in the QA file: a driver message quoting only part of the URL (for example host or user) is not redacted. The host and user are not secrets, the password is, and Neon/pg errors do not echo passwords. QA step 5 checks this live.
- **R5: overlapping triggers.** The sweep and the insert are separate statements (story Notes). Two overlapping runs each insert their own row and never sweep each other (both rows are younger than 15 min). Per-ETF writes are already guarded (US-012/US-014). This is argued, not tested.
- **R6: `started_at` semantics.** It is the clock value taken **before** the sweep, not the insert time. The difference is one DB round trip, and it lets `staleBefore` and `started_at` share one clock read (DJ-6a asserts the exact cutoff). `finished_at` is a second `now()` call after ingestion.
- **R7: `etfs_processed` on abort is 0.** `runDailyIngestion` catches every per-ETF throw, so the only way it rejects is `loadEtfs` (before any ETF). If a future change made it throw mid-loop, the abort row would under-count, but it would still be `failed` with the error. That is acceptable, and there is no progress callback (smallest design).
- **R8: `no_adapter` / `missing` make runs `partial`.** This is intended (story Notes, sprint review). Nothing to build.
- **Deliberately not built:** retries, alerts, pruning, a per-ETF runs table, any UI, reading `settings`, a `job_runs` index.

Implementation order:
1. `job-run-summary.ts` + JS;
2. `job-runs.ts` + JR + JP-1/JP-6;
3. `createDefaultJobRunStore` + DD-15;
4. `daily-job.ts` + `job-run-fakes.ts` + DJ;
5. handler type change, then run `pnpm typecheck` to list the H fixtures to edit (edit table), then H-15a..d;
6. `lib/cron/default-deps.ts` wiring + RT-15 + JP-15;
7. BD-15;
8. the four gates.

## 5. Decisions needed

None.
