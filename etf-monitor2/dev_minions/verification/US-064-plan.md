# US-064 plan — Daily job time applied by Vercel itself (no GitHub ping)

Planner: story-planner, 2026-10-12. Binding inputs: `backlog/stories/US-064.md`, DEC-031 (Decided,
conditional on spike S1), DEC-030 §1–4/§6/§7 (gate, claim, bearer first — unchanged), DEC-023
(build needs `DATABASE_URL`, production detection by `VERCEL_ENV=production`), DEC-015 (secrets),
DEC-007/FR8.1 (strings through next-intl, ro + en).

Not blocked. DEC-031 settles every design choice. The plan-level points below (PL-1..PL-8) only turn
DEC-031 into code. The two PRODUCT items (D-1, D-2) ship isolated defaults in files named here.

---

## 0. Scope in one paragraph

The saved hour (`settings.cron_hour_utc`, unchanged) becomes the source of the Vercel cron schedule.
A new root `vercel.ts` (which replaces `vercel.json`) reads it at Vercel build time through a pure
`lib/config/cron-build.ts`. After a save that changes the hour, the `/admin/cron` action POSTs a
Vercel Deploy Hook through `lib/config/cron-apply.ts`. The GitHub Actions ping, its test, its README
section and the ping/safety-net UI text are removed. The route, the handler, the gate
(`not_scheduled_hour`), the atomic claim (`claimScheduledRun`) and `job_runs` stay exactly as they are.

---

## 1. Acceptance criteria → tests

| AC | What proves it | Where |
|---|---|---|
| **AC0** (spike S1) | **MANUAL-QA, user only, after the first push.** (1) The Vercel build log contains `[vercel.ts] daily cron hour <h> UTC (source: db)`, where `<h>` is the hour saved in `/admin/cron`. (2) Vercel → Settings → Cron Jobs lists `/api/cron/daily` with `0 <h> * * *`. (3) Save a different hour in `/admin/cron`, see the "redeploy started" message, wait for that deployment to finish, and check that (1) and (2) now show the new hour. If (1) shows `source: default` while a valid hour is saved, or the deployment rejects `vercel.ts`: story **BLOCKED**, and the Technical Lead picks Plan B (option E) or C (DEC-031). **No agent claims this criterion passed**; the review and test verdicts mark it `MANUAL-QA`. | `US-064-qa.md` (written at close-out) |
| **AC1** | VC-1: `buildDailyCron(0/10/23)` returns exactly `{ path: "/api/cron/daily", schedule: "0 <h> * * *" }`. VC-2: `RangeError` for `-1, 24, 7.5, NaN, Infinity` and for non-numbers (`"7"`, `null`, cast). VC-1b: `buildDailyCron(h).path === DAILY_CRON_PATH`, imported both from `lib/config/cron` and from `lib/config/cron-build`, and both are the same value. | `lib/cron/vercel-config.test.ts` (rewritten) |
| **AC2** | CBH-1..CBH-10, see §3.1. Table: valid hour → `{hour, source:"db"}`; row with NULL / invalid (24, -3, 7.5, `"x"`) / no row → `{10,"default"}`; 42P01 → `{10,"default"}` after exactly 1 query, no retry, no throw; production + query failing every time → rejects after exactly 3 query calls (2 sleeps); fails twice then succeeds → db hour after 3 calls; non-production (`undefined`, `"preview"`, `"development"`) with a `DATABASE_URL` → 10, query never called, global `fetch` never called; production with no/blank `DATABASE_URL` → 10, query never called; the default (non-injected) query calls the mocked `neon(url)` once with `select "cron_hour_utc" from "settings" where "id" = 1`; no thrown message and no log line contains the URL, its password or its host (sentinel scan). Source scan: `cron-build.ts` imports only `@neondatabase/serverless` (no `@/`, no `drizzle-orm`, no `../db`). | `lib/config/cron-build.test.ts` (new), `lib/config/boundaries.test.ts` BC-13 (new) |
| **AC3** | VC-3: `createVercelConfig(resolver, log)` with an injected resolver `{hour:14, source:"db"}` gives exactly `{ crons: [{ path:"/api/cron/daily", schedule:"0 14 * * *" }] }` (one entry, once-a-day shape `^0 \d{1,2} \* \* \*$`), and logs exactly `[vercel.ts] daily cron hour 14 UTC (source: db)` once; `source:"default"` gives the matching line. VC-4: a rejecting resolver makes `createVercelConfig` reject (build fails), with no "daily cron hour" line logged. VC-5: the module's exported `config` (top-level `await`, imported after `vi.resetModules()` with `VERCEL_ENV`/`DATABASE_URL` stubbed to `""` and `fetch` stubbed to throw) equals `{ crons: [{ path:"/api/cron/daily", schedule:"0 10 * * *" }] }`, logs `(source: default)`, and makes no fetch call. VC-6: `vercel.ts` exists at the project root; `vercel.json`, `vercel.js/.mjs/.cjs/.mts/.cts` do not. VC-7: `vercel.ts`'s module specifiers are exactly `["./lib/config/cron-build"]` (relative, no `@/`, no new package). `package.json` dependencies are unchanged (no `@vercel/config`): VC-7b asserts no `@vercel/*` key in `dependencies`/`devDependencies`. `lib/config/cron.ts` no longer imports `vercel.json` and no longer exports `effectiveSchedule`/`findDailySchedule`/`parseDailySchedule`: BC-7 (allowlist updated) and CE-6 (`"effectiveSchedule" in mod === false`, etc.). README contract: VC-R1, VC-R2 (§3.1). | `lib/cron/vercel-config.test.ts`, `lib/config/boundaries.test.ts` BC-7, `lib/config/cron.test.ts` CE-6 |
| **AC4** | RR-1..RR-7 (§3.1): blank/undefined/whitespace URL → `not_configured`, fetch never called; 200 and 201 → `applying`, fetch called once as `POST`, no body, with an `AbortSignal`; 400/404/429/500 → `failed`; fetch rejecting with a `TypeError` whose message contains the URL → `failed`; a hanging fetch → `failed` exactly at the timeout (fake timers: still pending at 9 999 ms, `failed` at 10 000 ms); `DEPLOY_HOOK_TIMEOUT_MS === 10_000`; result always one of the three strings; no `console.*` call, no return value and no thrown error contains the URL or its unique token. "Called only when the saved hour changed": SA-2 (same hour → `redeploy` never called), SA-1/SA-7 (changed → called once). | `lib/config/cron-apply.test.ts` (new), `lib/config/cron-apply.pglite.test.ts` (new) |
| **AC5** | SA-3: the hook returns `failed` → the row holds the new hour (no rollback), and the result is `ok` with `apply:"failed"`. SA-4: a `redeploy` that throws (defensive) → still `ok`, `apply:"failed"`, row saved. SA-6: inside the fake `redeploy`, a PGlite query already sees the new hour (save happens first). CA-7..CA-10: the action returns `cronSavedApplying` / `cronSavedNotConfigured` / `cronSavedApplyFailed`, `setCronHour` resolves before `fetch` is called, and `JSON.stringify(state)` never contains the hook URL. CR-2..CR-4: result-messages mapping. AM-7: all three keys render translated text in ro and en. `i18n/messages.test.ts` (existing ro/en key parity) stays green. | `cron-apply.pglite.test.ts`, `app/admin/cron/actions.test.ts`, `app/admin/cron/result-messages.test.ts`, `components/admin/ActionMessage.test.tsx` |
| **AC6** | CG-5 (rewritten): for a saved hour 7, both locales show the saved-hour line with UTC and Bucharest, the window sentence with `07:00`/`07:59` UTC and the Bucharest bounds from `bucharestWindowOfUtcHour(7)`, `applyNote` and `earlierHourNote`. CG-6 (rewritten): neither locale's page contains `ping`, `GitHub`, `ETF_MONITOR_BASE_URL`, `safety net` / `plasă de siguranță`; neither catalogue has `pingHeading`, `pingText`, `pingRule`, `safetyNet`. CG-7 (last run) is unchanged. CG-10 compares `heading`/`window` instead of `pingHeading`. CG-13: `maxDuration === 30` (PL-6). CE-4: `bucharestWindowOfUtcHour` gives summer `13:00–13:59` and winter `12:00–12:59` for hour 10, and `RangeError` outside 0–23. DEC-020 §10 does not apply (no design reference cited). | `app/admin/cron/page.test.tsx`, `lib/config/cron.test.ts` |
| **AC7** | VC-W1: `.github/workflows/daily-ping.yml` does not exist. It deliberately does **not** assert anything about the repo-root copy (the user deletes that copy; an agent must not touch it). VC-R1/VC-R2: the README contains no `Setting up the hourly ping`, `ETF_MONITOR_BASE_URL`, `daily-ping`, `GitHub Actions` or `vercel.json`, and it does contain `Deploy Hook`, `VERCEL_DEPLOY_HOOK_URL`, `vercel.ts`, `/admin/cron`, `not_scheduled_hour` and `already_ran`. EX-4: `.env.example` has the line `VERCEL_DEPLOY_HOOK_URL=` (empty), with a comment block directly above it that mentions `Deploy Hook` and `/admin/cron`. | `lib/cron/vercel-config.test.ts`, `lib/ai/env-example.test.ts` |
| **AC8** | All existing route/handler/gate/claim tests run **unchanged** and pass: `app/api/cron/daily/route.test.ts`, `lib/cron/daily-handler.test.ts` (GT-1..7 included), `lib/cron/daily-job.test.ts`, `lib/ingestion/job-runs*.test.ts` (CL-0..10 included), `lib/cron/default-deps*.test.ts`, `lib/cron/fetch-detail.test.ts`, `lib/cron/deadline.pglite.test.ts`, BC-8, and DP-0..DP-4 in the e2e file. New: **DP-5** in `test/e2e/daily-pipeline.pglite.test.ts` (§3.1). | `test/e2e/daily-pipeline.pglite.test.ts` |
| **AC9** | Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test` (full), and offline `pnpm build`, all with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `VERCEL_DEPLOY_HOOK_URL` and every `*_API_KEY` removed from the process environment. "Offline `next build` does not import or run `vercel.ts`" is proven in two ways. (a) **VC-8** (static): no non-test `.ts/.tsx/.mts/.mjs` under `app/`, `components/`, `lib/`, `i18n/`, `scripts/`, nor `next.config.ts`, `drizzle.config.ts` or `proxy.ts`/`middleware.ts` (if present), has a specifier resolving to the root `vercel` module (`../vercel`, `../../vercel`, `@/vercel`, `./vercel`, …), and the `package.json` `build` script does not mention `vercel.ts`. (b) **Runtime evidence**: the implementer captures the offline build output and records in HANDOVER that it contains zero `[vercel.ts]` lines, for example `pnpm build 2>&1 \| tee /tmp/build.log; grep -c '\[vercel.ts\]' /tmp/build.log` → `0`. Note: `next build` type-checks every `**/*.ts` from `tsconfig.json`, `vercel.ts` included. That is compile only, never execution, and it is wanted, because it is what catches a type error in `vercel.ts`. | `lib/cron/vercel-config.test.ts` VC-8 + HANDOVER |

---

## 2. Files: create / change / delete, and boundaries

### 2.1 New

**`lib/config/cron-build.ts`** — the build-time hour reader (DEC-031 §2). Its only import is
`@neondatabase/serverless` (`neon`). No `@/`, no `drizzle-orm`, no `../db`, no `process.env`
(the env is injected, BC loop). It owns the constants shared with the app (PL-5):
```ts
export const DAILY_CRON_PATH = "/api/cron/daily";
export const DEFAULT_CRON_HOUR_UTC = 10;
export const CRON_HOUR_QUERY_ATTEMPTS = 3;          // PL-1
export const CRON_HOUR_RETRY_DELAY_MS = 1_000;
export function isHour(value: unknown): value is number;   // moved verbatim from cron.ts
export type BuildEnv = { VERCEL_ENV?: string; DATABASE_URL?: string };
export type CronHourQuery = (databaseUrl: string) => Promise<readonly Record<string, unknown>[]>;
export type BuildCronHour = { hour: number; source: "db" | "default" };   // PL-2
export function neonCronHourQuery(databaseUrl: string): Promise<readonly Record<string, unknown>[]>;
  // neon(databaseUrl)`select "cron_hour_utc" from "settings" where "id" = 1`
export async function resolveBuildCronHour(input: {
  env: BuildEnv; query?: CronHourQuery; sleep?: (ms: number) => Promise<void>; log?: (line: string) => void;
}): Promise<BuildCronHour>;
```
Rules (AC2, DEC-031 §2):
- `env.VERCEL_ENV !== "production"`, or `DATABASE_URL` undefined/blank → `{10,"default"}`, query not called.
- Row parsing mirrors `getCronHour`. No row, or `cron_hour_utc` `null`/`undefined`, → default.
  Otherwise `Number(v)` is used if `isHour`, else default. The null check comes before `Number`
  (the `Number(null) === 0` trap).
- Error with `code === "42P01"` → `{10,"default"}` at once, no retry.
- Any other error: log `[vercel.ts] cron hour query failed (attempt n/3) name=<Name>[ code=<SQLSTATE>]`,
  then sleep `CRON_HOUR_RETRY_DELAY_MS` while attempts remain. After the 3rd failure, throw
  `new Error("[vercel.ts] could not read the daily cron hour after 3 attempts[ (code=XXXXX)]")`.
  Sanitising: `name` only if it matches `/^[A-Za-z]\w{0,40}$/`, otherwise `Error`; `code` only if it
  matches `/^[0-9A-Z]{5}$/`. The driver's `message`, `cause` and `stack` are never read into a log
  or thrown text (same rule as `sanitizeMigrationOutput`, DEC-023).

**`vercel.ts`** (project root) — Vercel's build-time config (DEC-031 §1). Its only import is
`./lib/config/cron-build`. It holds the local structural type, so no `@vercel/config` dependency:
```ts
type CronJob = { path: string; schedule: string };
export type VercelConfig = { crons: CronJob[] };
export function buildDailyCron(hour: number): CronJob;          // AC1; RangeError unless isHour
export async function createVercelConfig(
  resolve: () => Promise<BuildCronHour> = () =>
    resolveBuildCronHour({ env: { VERCEL_ENV: process.env.VERCEL_ENV, DATABASE_URL: process.env.DATABASE_URL } }),
  log: (line: string) => void = console.log,
): Promise<VercelConfig>;    // logs `[vercel.ts] daily cron hour ${hour} UTC (source: ${source})`
export const config: VercelConfig = await createVercelConfig();
```
`vercel.ts` is the only place that reads `process.env` for the build hour. It is not under
`lib/config`, so the "no `process.env`" boundary loop still holds. Top-level `await` typechecks under
the current `tsconfig.json` (`module: esnext`, `target: ES2017`). No tsconfig change.

**`lib/config/cron-apply.ts`** — the apply-on-save step (DEC-031 §3). Imports: `./cron` only. No
`process.env`: the hook URL is injected.
```ts
export const DEPLOY_HOOK_TIMEOUT_MS = 10_000;
export type RedeployResult = "applying" | "not_configured" | "failed";
export async function requestRedeploy(deps: {
  hookUrl: string | undefined; fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<RedeployResult>;
export type SaveCronHourResult =
  | { ok: false; error: "invalid_hour" }
  | { ok: true; hour: number; apply: "unchanged" | RedeployResult };
export async function saveCronHourAndApply(input: unknown, deps: {
  config: CronConfigDeps; redeploy: () => Promise<RedeployResult>;
}): Promise<SaveCronHourResult>;
```
- `requestRedeploy` behaviour:
  - Blank or undefined URL → `not_configured`, no fetch.
  - Otherwise: `fetchImpl(hookUrl, { method: "POST", signal, cache: "no-store" })`. The signal comes
    from an `AbortController` plus a `setTimeout(timeoutMs)` that is always cleared. The body is not
    read.
  - `response.ok` → `applying`. Any other status → `failed`, with one log line
    `[admin/cron] deploy hook failed status=<n>`.
  - Any throw or abort → `failed`, with one log line `[admin/cron] deploy hook failed name=<sanitised name>`.
  - It never re-throws. The URL is never logged, returned or thrown, and the fetch error's message is
    never read.
- `saveCronHourAndApply` behaviour (PL-3, PL-4):
  - `previous = await getCronHour(config)`, then `result = await setCronHour(input, config)`.
  - Invalid input → return it as is; `redeploy` not called.
  - `previous === result.hour` → `apply:"unchanged"`, `redeploy` not called.
  - Otherwise `apply = await redeploy()`, with a defensive `try/catch` that maps any throw to `"failed"`.
  - Once the write has resolved, nothing after it can throw out of this function (AC5).

### 2.2 Changed

| File | Change |
|---|---|
| `lib/config/cron.ts` | Remove `import vercelConfig from "../../vercel.json"`, `findDailySchedule`, `effectiveSchedule`, `parseDailySchedule` and the `DailySchedule` type. After the page change, `parseDailySchedule` has no production caller, so it goes (PL-7). Replace the local `DAILY_CRON_PATH`, `DEFAULT_CRON_HOUR_UTC` and `isHour` with `export { DAILY_CRON_PATH, DEFAULT_CRON_HOUR_UTC, isHour } from "./cron-build";` (one source; existing importers unchanged). Add `bucharestWindowOfUtcHour(hour, on = new Date()): { start; end }` (start = `bucharestTimeOfUtcHour`, end = the same hour at `:59`; Bucharest offsets are whole hours). `getCronHour`, `getEffectiveCronHour`, `setCronHour`, `formatHourWindow` and `bucharestTimeOfUtcHour` are unchanged. |
| `app/admin/cron/actions.ts` | Calls `saveCronHourAndApply(hour, { config: createDbDeps(getDb()), redeploy: () => requestRedeploy({ hookUrl: process.env.VERCEL_DEPLOY_HOOK_URL }) })` inside the existing `runAdminAction`. Revalidation paths are unchanged. No SQL, and the import is under `lib/config/` (passes `app/actions.boundary.test.ts`). |
| `app/admin/cron/result-messages.ts` | Takes `SaveCronHourResult`. Mapping: `unchanged` → `success`/`cronSaved` (existing); `applying` → `success`/`cronSavedApplying`; `not_configured` → `success`/`cronSavedNotConfigured`; `failed` → `success`/`cronSavedApplyFailed` (D-1); invalid → `error`/`invalidHour`. |
| `app/admin/cron/page.tsx` | Drop the `effectiveSchedule`/`parseDailySchedule` imports and the `safetyNetHour` prop. Add `export const maxDuration = 30` (PL-6). |
| `components/admin/CronAdmin.tsx` | Drop the `safetyNetHour` prop and the ping section. Render, in order: heading; saved-hour line (`effective`, keeps `data-cron-effective`); `defaultNote` when not saved; hour form (unchanged); `window` sentence (`data-cron-window`); `applyNote`; `earlierHourNote`; last-run section (unchanged). |
| `messages/en.json`, `messages/ro.json` | `Admin.cron`: **remove** `pingHeading`, `pingText`, `pingRule`, `safetyNet`; **reword** `effective` (no ping wording); **add** `window`, `applyNote`, `earlierHourNote`. `Admin.messages`: **add** `cronSavedApplying`, `cronSavedNotConfigured`, `cronSavedApplyFailed`. Draft text in §5. |
| `README.md` | **"Environment variables"**: add a `VERCEL_DEPLOY_HOOK_URL` bullet (secret, server-side, Production; what it does; optional, and without it a new hour applies at the next deploy). **"Daily ingestion (cron)"**: the first paragraph says the route is called **once a day by Vercel Cron** at the saved hour (Hobby: anywhere in `HH:00–HH:59`), and keeps the gate/claim text (`not_scheduled_hour`, `already_ran`). Replace "### Setting up the hourly ping" with "### Applying a new hour (one-time setup, by you)", which carries the DEC-031 §7 step (Vercel → Settings → Git → Deploy Hooks → create "schedule" on the production branch → add its URL as Production env var `VERCEL_DEPLOY_HOOK_URL`; no GitHub secrets) and explains that `vercel.ts` reads the saved hour at build time. Update the "To change the hour" bullet (save → redeploy → active about 2 minutes later; earlier hour → first run tomorrow). **"Administration"**: the last sentence on `/admin/cron` matches. Keep the "Deployment" numbered list unchanged (RD-D1 pins the push step and the script order). |
| `.env.example` | Append a comment block and an empty `VERCEL_DEPLOY_HOOK_URL=` line: Deploy Hook from Vercel → Settings → Git → Deploy Hooks (production branch); secret, server-side only; `/admin/cron` POSTs it after a changed hour so `vercel.ts` rebuilds the schedule; optional. No sample URL. |
| `dev_minions/architecture/data-model.md` | `cron_hour_utc` row: "read at build time by `vercel.ts` into the single daily cron (DEC-031); the DEC-030 gate still admits a run only at/after this hour, one per UTC day". Line 97: "pings" → "calls". Doc only, no rule change. |

### 2.3 Deleted (all inside the project)

- `vercel.json` (AC3; only one of `vercel.json`/`vercel.ts` may exist).
- `.github/workflows/daily-ping.yml` (AC7). The rest of `.github/` (prompts, copilot-instructions) stays.
- `test/e2e/daily-ping-workflow.test.ts`: it guards the deleted workflow and `vercel.json`. Its
  replacement guards are VC-W1/VC-R1/VC-R2. This is a deliberate removal because the artefact it
  tests is removed by AC7, not a test deleted to make code pass. Listed in §4.
- **Not touched by any agent:** `../.github/workflows/etf-monitor2-daily-ping.yml` (repo root, outside
  the project). The implementer lists it in HANDOVER "Waiting on the user" as **user deletes**,
  together with "the GitHub secrets `ETF_MONITOR_BASE_URL`/`CRON_SECRET` can be removed". No test
  reads or asserts that file any more.

### 2.4 Boundaries (who may do what)

- **Build path:** `vercel.ts` → `lib/config/cron-build.ts` → `@neondatabase/serverless`. Nothing in the
  app imports `vercel.ts` (VC-8). `cron-build.ts` imports nothing of the app (BC-13).
- **App path:** `/admin/cron` action → `lib/config/cron-apply.ts` → `lib/config/cron.ts` →
  `./cron-build` (constants only, at the value level) + `drizzle-orm`/`../db`/`../ingestion/store`
  (unchanged).
- **Cron path (unchanged):** route → `lib/cron/daily-handler.ts` / `default-deps.ts` →
  `getEffectiveCronHour`. BC-8 is unchanged and still passes: no file in `app/api/cron`, `lib/cron` or
  `lib/ingestion` imports `cron-build`/`cron-apply`.
- **Secrets:** `VERCEL_DEPLOY_HOOK_URL` is read only in `app/admin/cron/actions.ts` (server action) and
  passed in; `DATABASE_URL` only in `vercel.ts` (build). Neither value reaches a log, a returned state,
  an error or rendered HTML.

---

## 3. Tests

### 3.1 New tests (ids are binding for the verdicts)

`lib/config/cron-build.test.ts` (fake query, fake sleep, fake log; `fetch` stubbed to throw;
`vi.mock("@neondatabase/serverless")` only in CBH-9):
- CBH-1 `it.each` production rows: `[{cron_hour_utc:7}]`→`{7,db}`, `0`→`{0,db}`, `23`→`{23,db}`, `"7"`→`{7,db}`, `[]`, `null`, `undefined`, `24`, `-3`, `7.5`, `"x"` → `{10,default}`.
- CBH-2 42P01 → `{10,default}`, query called once, sleep never.
- CBH-3 always failing → rejects; query called 3×; sleep called 2× with 1000.
- CBH-4 fail, fail, succeed(9) → `{9,db}`, 3 calls.
- CBH-5 `VERCEL_ENV` ∈ {undefined, "", "preview", "development"} with a URL → `{10,default}`, query and fetch never called.
- CBH-6 production with `DATABASE_URL` ∈ {undefined, "", "   "} → `{10,default}`, query never called.
- CBH-7 secret hygiene: URL `postgresql://u:SENTINELPW@ep-sentinel-host.neon.tech/db`; the query throws `Object.assign(new Error(\`connect to ${url}\`), {name:"NeonDbError", code:"08006"})`. The rejection message and every logged line contain none of the URL, `SENTINELPW` or `ep-sentinel-host`; the message contains `code=08006`.
- CBH-8 an unsafe `name` (contains `://`) or a non-SQLSTATE `code` is not echoed.
- CBH-9 default query: `neon` is called once with the URL, and the executed SQL text contains `select "cron_hour_utc" from "settings" where "id" = 1`.
- CBH-10 the query receives exactly `env.DATABASE_URL`. Constants: `DEFAULT_CRON_HOUR_UTC === 10`, `CRON_HOUR_QUERY_ATTEMPTS === 3`.

`lib/cron/vercel-config.test.ts` (rewritten): VC-1, VC-1b, VC-2, VC-3, VC-4, VC-5, VC-6, VC-7,
VC-7b, VC-8 (as in §1); VC-W1 (no `.github/workflows/daily-ping.yml`); VC-R1 (README cron contract:
contains `/api/cron/daily`, `vercel.ts`, `Authorization: Bearer`, `Production`, `/admin/cron`,
`not_scheduled_hour`, `already_ran`, `Deploy Hook`, `VERCEL_DEPLOY_HOOK_URL`); VC-R2 (README does not
contain `vercel.json`, `Setting up the hourly ping`, `ETF_MONITOR_BASE_URL`, `daily-ping`,
`GitHub Actions`). The two existing README checks are kept: "CRON_SECRET not called Reserved" and
RD-1 (`/admin/cron`, no "Until US-023").

`lib/config/cron-apply.test.ts`: RR-1..RR-7 (§1 AC4), each with a fake `fetchImpl`, hook URL
`https://hooks.example.test/deploy/prj_FAKE/HOOKSENTINEL`, and a `console.error` spy scanned for
`HOOKSENTINEL`. RR-5 uses `vi.useFakeTimers()`. Also SA-U1: `saveCronHourAndApply` with mocked
config deps never calls `redeploy` when `setCronHour` rejects (the error propagates; nothing was saved).

`lib/config/cron-apply.pglite.test.ts` (real `getCronHour`/`setCronHour` on PGlite, fake `redeploy`):
SA-1 no row → save "7" → `redeploy` ×1, row 7, `apply` = fake result. SA-2 saved 7 → save "7" →
`unchanged`, `redeploy` ×0. SA-3 saved 7 → save "9", `redeploy` → `"failed"` → row 9, `{ok:true,
hour:9, apply:"failed"}`. SA-4 `redeploy` throws → `apply:"failed"`, row saved. SA-5 "24" →
`invalid_hour`, `redeploy` ×0, row unchanged. SA-6 the fake `redeploy` reads the row and sees the new
hour. SA-7 stored NULL → save "10" → `redeploy` ×1 (PL-3).

`test/e2e/daily-pipeline.pglite.test.ts` — **add only** this test:
**DP-5 (US-064, DEC-031 §4): "after saving a later hour, the old schedule's call in the redeploy
window is skipped with no fetch and no job_runs row; at the new hour one run starts".**
`await setCronHour("14", { db: db.mockDb, run: db.runner })` (import from `../../lib/config/cron`);
`vi.setSystemTime("2026-09-23T10:05:00Z")` (the old `0 10 * * *` firing) → `callCron` → 200, `no-store`,
`{skipped:"not_scheduled_hour"}`, `guard.calls` `[]`, `job_runs` 0 rows. Then
`vi.setSystemTime("2026-09-23T14:00:00Z")` → `jobRunId` number, `job_runs` 1 row. It uses the real
`createDailyCronDeps` + `handleDailyCron`, so it proves the unchanged gate reads the saved hour.
DP-0..DP-4 are not edited.

Additions to existing files:
- `lib/config/cron.test.ts`: CE-4 (`bucharestWindowOfUtcHour`), CE-5 (re-exported
  `DAILY_CRON_PATH`/`DEFAULT_CRON_HOUR_UTC`/`isHour` are the `cron-build` exports), CE-6 (removed
  exports absent).
- `lib/config/boundaries.test.ts`: BC-13 (`cron-build.ts` specifiers ⊆ `{"@neondatabase/serverless"}`,
  no `fetch(` call outside the neon driver, no `readFile`), BC-14 (`cron-apply.ts` specifiers ⊆
  `{"./cron"}`, no `@neondatabase/serverless`, no `drizzle-orm`). Both files are also covered by the
  existing generic loop (no next/react/app/components/AI, no `process.env`).
- `app/admin/cron/actions.test.ts`: CA-6..CA-10 (§1 AC5).
- `app/admin/cron/result-messages.test.ts`: CR-2..CR-4 (three new states).
- `components/admin/ActionMessage.test.tsx`: AM-7 (three new keys, ro + en).
- `app/admin/cron/page.test.tsx`: CG-13.
- `lib/ai/env-example.test.ts`: EX-4.

### 3.2 Deliberate test changes (each must be listed in HANDOVER "Files changed")

1. `lib/cron/vercel-config.test.ts`: fully rewritten. It tested the `vercel.json` file that AC3
   deletes; it now tests `vercel.ts` (AC3 wording). The README check `toContain("vercel.json")`
   becomes `toContain("vercel.ts")`.
2. `test/e2e/daily-ping-workflow.test.ts`: **deleted**. WF-1..WF-8 guard the workflow, its root copy
   and `vercel.json`, all removed by AC3/AC7 (WF-6 would otherwise demand that the root copy still
   exists). Replaced by VC-W1/VC-R1/VC-R2.
3. `lib/config/cron.test.ts`: remove CP-1, CP-2 (`parseDailySchedule`), CP-3 (`findDailySchedule`)
   and VJ-1 (`effectiveSchedule` vs `vercel.json`). The functions are removed by AC3. CP-5, CV-*,
   CE-1..3 are unchanged.
4. `lib/config/cron.pglite.test.ts` CS-8: drop the two `effectiveSchedule()` lines (the function no
   longer exists) and keep the no-network assertion. Rename the title to "no network call".
5. `lib/config/boundaries.test.ts` BC-7: the allowlist changes from `"../../vercel.json"` to
   `"./cron-build"`. The other BC-7 assertions are kept.
6. `app/admin/cron/actions.test.ts`:
   - The `@/lib/config/cron` mock factory gains `getCronHour` (default `mockResolvedValue(null)`),
     because the action now goes through the real `saveCronHourAndApply`, which reads the previous
     hour.
   - `beforeEach` adds `vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", "")`, so the default path is
     deterministic.
   - CA-1..CA-5 keep their assertions. CA-5 ("no network call") still holds because the hook URL is
     blank in it.
7. `app/admin/cron/result-messages.test.ts` CR-1: input `{ok:true, hour:7}` → `{ok:true, hour:7,
   apply:"unchanged"}` (type change), same expected state.
8. `app/admin/cron/page.test.tsx`:
   - Remove the `effectiveSchedule` mock and the `schedule` setup option.
   - CG-5: ping explanation → window/apply/earlier-hour notes.
   - CG-6: safety-net → "no ping/safety-net text, keys removed".
   - CG-10: `pingHeading` → `window`/`heading`.
   - CG-1..4, CG-7..9, LE-P9, CG-11, CG-12 are unchanged.
9. No golden snapshot covers `CronAdmin` (checked: none references it), so none is regenerated.

No route, handler, daily-job, job-runs, default-deps, fetch-detail, deadline or BC-8 test is touched
(AC8).

---

## 4. Data model / migration

None. `settings.cron_hour_utc` already exists (DEC-030). No `pnpm db:generate`. Only the prose of
`data-model.md` changes (§2.2).

---

## 5. Draft strings (isolated defaults D-1/D-2, confined to `messages/*.json`)

`Admin.cron` (en / ro):
- `effective`: "Saved hour: {utc} UTC ({bucharest} Bucharest time)." / "Ora salvată: {utc} UTC ({bucharest}, ora României)."
- `window` (DEC-031 §6): "Vercel runs the job once a day at some point between {utcStart} and {utcEnd} UTC ({bucharestStart}–{bucharestEnd} Bucharest)." / "Vercel rulează jobul o dată pe zi, la un moment dat între {utcStart} și {utcEnd} UTC ({bucharestStart}–{bucharestEnd}, ora României)."
- `applyNote`: "Saving a different hour starts a redeploy; the new schedule is active about 2 minutes after the redeploy." / "Salvarea unei alte ore pornește un redeploy; noul program este activ la circa 2 minute după redeploy."
- `earlierHourNote`: "If the new hour is earlier than the current UTC time, the first run is tomorrow. To run today, use Run on the job in Vercel → Settings → Cron Jobs." / "Dacă noua oră este mai devreme decât ora UTC curentă, prima rulare este mâine. Pentru o rulare azi, folosește Run la job în Vercel → Settings → Cron Jobs."

`Admin.messages` (en / ro):
- `cronSavedApplying`: "The hour was saved. A redeploy has started; the new schedule is active in about 2 minutes." / "Ora a fost salvată. A pornit un redeploy; noul program este activ în circa 2 minute."
- `cronSavedNotConfigured`: "The hour was saved. Automatic redeploy is not set up (VERCEL_DEPLOY_HOOK_URL is missing), so the new schedule applies at the next deploy." / "Ora a fost salvată. Redeploy-ul automat nu este configurat (lipsește VERCEL_DEPLOY_HOOK_URL), deci noul program se aplică la următorul deploy."
- `cronSavedApplyFailed`: "The hour was saved, but the redeploy could not be started; the new schedule applies at the next deploy." / "Ora a fost salvată, dar redeploy-ul nu a putut fi pornit; noul program se aplică la următorul deploy."

Number display: hours are `HH:MM` strings (existing helpers). No decimals, so DEC-007 does not apply.

---

## 6. Risks and the smallest design

| Risk | Mitigation |
|---|---|
| S1 fails: Vercel rejects top-level `await`, or `vercel.ts` cannot see `DATABASE_URL`/`VERCEL_ENV` at evaluation time (it would then always print `source: default`). | Cannot be proven offline. AC0 is user-run, and the build-log line names the source, so a silent fallback is visible. Plan B/C belong to the Technical Lead (DEC-031). |
| Vercel's `vercel.ts` loader cannot resolve `@/` aliases or Drizzle. | `vercel.ts` and `cron-build.ts` use relative imports and the raw Neon driver only (VC-7, BC-13). |
| Importing `vercel.ts` in Vitest runs its top-level query. | VC-5 stubs `VERCEL_ENV`/`DATABASE_URL` to `""` before a fresh dynamic import, so the non-production branch returns 10 before any I/O, and `fetch` is stubbed to throw. Every other VC test uses `createVercelConfig` with an injected resolver. |
| The hook URL leaks through a fetch error message (undici puts the URL in parse errors). | `requestRedeploy` never reads `error.message`; it logs only a sanitised name/status (RR-4). |
| The server action hangs on the hook. | 10 s abort (RR-5), plus `maxDuration = 30` on the page segment (PL-6). |
| An old-schedule call fires between save and redeploy. | The unchanged gate handles it (DP-5). |
| A failed build keeps the old schedule (DEC-031 §2). | Intended; documented in README. |
| A Deploy Hook redeploys the newest branch commit. | DEC-031 Consequences; one sentence in the README. |
| Hook rate limit (60/h). | Only a *changed* hour triggers it (SA-2). |

The smallest design is three small modules (`cron-build`, `cron-apply`, `vercel.ts`), with no new
dependency, no schema change, and no change to the cron path. No plugin/adapter extensibility is
needed here.

---

## 7. Plan-level points (settled here; none needs a DEC)

- **PL-1** DEC-031's "retry 3 times" is read as **3 attempts in total** (`CRON_HOUR_QUERY_ATTEMPTS = 3`).
  This matches DEC-023's `runMigrateOnDeploy` `MAX_ATTEMPTS = 3`, which runs in the same build. If the
  Technical Lead prefers 1 + 3 retries, it is a one-constant change plus CBH-3/CBH-4 counts.
- **PL-2** `resolveBuildCronHour` returns `{ hour, source }` rather than a bare number, because the
  required log line needs the source. The hour semantics are exactly AC2.
- **PL-3** "the stored hour actually changed" compares the stored value (`getCronHour`, `null` when
  NULL or invalid) with the new hour, so NULL → 10 counts as a change and redeploys once (the literal
  reading; harmless).
- **PL-4** The read-previous / save / redeploy sequence lives in `saveCronHourAndApply`
  (`lib/config/cron-apply.ts`), so it is PGlite-testable and the action stays thin. `setCronHour` and
  its tests are unchanged. Read-then-write is not atomic. With a single admin, the worst case of a
  concurrent double save is one extra or one missing redeploy. Accepted, because the next deploy
  converges anyway.
- **PL-5** `DAILY_CRON_PATH`, `DEFAULT_CRON_HOUR_UTC` and `isHour` move to `cron-build.ts` (the only
  module `vercel.ts` may import), and `cron.ts` re-exports them. This keeps one source of truth.
- **PL-6** `export const maxDuration = 30` on `app/admin/cron/page.tsx`, so the action's ≤10 s hook
  call cannot hit a short default. Precedent: `/admin/ai` `maxDuration = 60` (US-056).
- **PL-7** `parseDailySchedule` is removed. Its only production caller was the safety-net line that
  AC6 removes.
- **PL-8** Retry delay is 1 000 ms between attempts, injected `sleep` (tests never wait).

## 8. Decisions needed

| # | Type | Question | Recommendation / isolated default |
|---|---|---|---|
| D-1 | PRODUCT | Wording and tone of the three new result messages. In particular, should `failed` use the success style (the save worked) or the error style? | Ship the §5 text, all `status:"success"`, because AC5 says the save is never hidden. Confined to `messages/*.json` and `app/admin/cron/result-messages.ts`. Isolated default: yes. |
| D-2 | PRODUCT | DEC-031 §6 says "Run now covers today", but the app has no Run-now button. | Ship the literal-safe reading: the note points to Vercel's own Run button (Settings → Cron Jobs). No in-app button (out of scope). Confined to `Admin.cron.earlierHourNote`. Isolated default: yes. |

No TECHNICAL item is open, so this plan is not blocked.

## 9. Implementation order

1. `lib/config/cron-build.ts` + `cron-build.test.ts` (CBH-*) + BC-13.
2. `lib/config/cron.ts` refactor (re-exports, removals, `bucharestWindowOfUtcHour`) +
   `cron.test.ts`/`cron.pglite.test.ts`/BC-7 deliberate changes + CE-4..6. Run typecheck here: the
   page still imports the removed functions, so do step 5's page edit in the same sitting.
3. `vercel.ts`, delete `vercel.json`, rewrite `lib/cron/vercel-config.test.ts` (VC-1..8, VC-W1; the
   README checks come in step 7).
4. `lib/config/cron-apply.ts` + `cron-apply.test.ts` (RR-*, SA-U1) + `cron-apply.pglite.test.ts`
   (SA-*) + BC-14.
5. `app/admin/cron/{actions,result-messages,page}.ts(x)`, `components/admin/CronAdmin.tsx`, both
   message catalogues, and their tests (CA-*, CR-*, CG-*, AM-7).
6. DP-5 in `test/e2e/daily-pipeline.pglite.test.ts`. Then run the AC8 regression set unchanged:
   `app/api/cron/daily/route.test.ts lib/cron lib/ingestion/job-runs*.test.ts test/e2e`.
7. Delete `.github/workflows/daily-ping.yml` and `test/e2e/daily-ping-workflow.test.ts`; update the
   README, `.env.example` (+EX-4) and `data-model.md`; finish VC-R1/VC-R2.
8. Gates (AC9), with the secret/env variables removed: typecheck, lint, full suite, offline build. Grep
   the build output for `[vercel.ts]` (expect 0) and record it in HANDOVER. In HANDOVER "Waiting on
   the user", list: the Deploy Hook + `VERCEL_DEPLOY_HOOK_URL` setup, push, the AC0/S1 check,
   deleting `../.github/workflows/etf-monitor2-daily-ping.yml`, and the optional removal of the
   GitHub secrets. The QA checklist `US-064-qa.md` carries AC0 and the live save → redeploy →
   Settings → Cron Jobs check as MANUAL-QA.
