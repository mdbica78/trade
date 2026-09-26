# US-023 plan — Admin: cron hour setting

Planner: story-planner (opus), 2026-09-26. Mode: `plan US-023`.
Inputs read: `backlog/stories/US-023.md`, `backlog/sprints/sprint-05.md` (Decisions needed #11, manual step 5),
`backlog/sprints/sprint-03.md` (decision 3 and the FR12 carry-forward), requirements FR12 and §4 ("once per day"),
`architecture/data-model.md` (`settings`, "Write rules"), `decisions/README.md`, DEC-015, DEC-016,
`verification/US-022-plan.md` (the closest pattern), and the code: `vercel.json`, `tsconfig.json`
(`resolveJsonModule: true`), `eslint.config.mjs` (`react/jsx-no-literals`), `vitest.config.ts`,
`lib/cron/vercel-config.test.ts`, `app/api/cron/daily/route.ts`, `lib/config/{ai-settings,default-deps}.ts`,
`lib/config/{boundaries.test,ai-settings.pglite.test}.ts`, `lib/ai/settings-deps.ts`, `test/helpers/{pglite,module-specifiers}.ts`,
`components/admin/{sections,AdminNav,ActionForm,ActionMessage,action-state,AiSettingsAdmin}.ts(x)`,
`app/admin/ai/{page,actions,result-messages}.ts(x)` and their tests, `app/admin/layout.test.tsx`,
`i18n/messages.test.ts`, `messages/en.json` (`Admin`), `README.md` ("Daily ingestion (cron)", "Administration").

**No decision is open. Nothing here is BLOCKED.** Sprint decision #11: the technical part is Decided (effective
schedule = `vercel.json` imported at build time; the cron route never reads `cron_hour_utc`); the product part ships
its isolated default in `lib/config/cron.ts` + `app/admin/cron/` + `components/admin/CronAdmin.tsx`.

---

## 1. Acceptance criteria → tests

Test ids are the names of the `it(...)` blocks (prefix per file), so the tester can map them. Render tests use
`renderToStaticMarkup`, which escapes `"` as `&quot;`: assertions on the `vercel.json` line compare against the
HTML-escaped string (a small `escapeHtml` helper in the test), never a loosened regex.

| AC | What proves it | File / test ids |
|---|---|---|
| **AC1** View the effective time | **VJ-1** reads the repository's `vercel.json` with `node:fs`, `JSON.parse`, finds the entry whose `path === "/api/cron/daily"`, and asserts `effectiveSchedule()` `===` that entry's `schedule`, and `parseDailySchedule(effectiveSchedule())` equals `{minute: Number(M), hour: Number(H)}` from the file's own fields. **CP-1** `parseDailySchedule` accepts `"0 10 * * *"`→`{0,10}`, `"0 0 * * *"`→`{0,0}`, `"59 23 * * *"`→`{59,23}`, `" 5  7 * * * "`→`{5,7}` (whitespace-tolerant). **CP-2** returns `null` for `"*/5 * * * *"`, `"0 */2 * * *"`, `"0 10 * * 1"`, `"0 10 1 * *"`, `"0 10 * 1 *"`, `"0 10,22 * * *"`, `"0 10-12 * * *"`, `"0 24 * * *"`, `"60 10 * * *"`, `"-1 10 * * *"`, `"0 1.5 * * *"`, `"0 10 * *"`, `"0 10 * * * *"`, `""`, `"@daily"`, and non-strings (`null`, `undefined`, `10`). **CP-3** `findDailySchedule(config)`: picks the `/api/cron/daily` entry among several; returns `null` when `crons` is missing, not an array, has no matching path, or the schedule is not a string; `null`/non-object config → `null`. **CP-5** `formatHourWindow(10)` → `{start:"10:00", end:"10:59"}`, `0` → `00:00/00:59`, `23` → `23:00/23:59`. **CG-1** (ro, en) page with the real `effectiveSchedule()` (`0 10 * * *`): the element marked `data-cron-effective="ok"` contains `10:00–10:59 UTC` inside the locale's `effectiveWindow` sentence. **CG-4** `effectiveSchedule` mocked to `"*/30 * * * *"` → `data-cron-effective="unrecognised"`, the translated `unrecognisedSchedule` text, the raw string shown verbatim in `<code>`, and **no** `HH:00–HH:59` window inside the effective element. **CG-4b** mocked `null` (no entry) → same unrecognised message, no `<code>`. | `lib/config/cron.test.ts`, `app/admin/cron/page.test.tsx` |
| **AC2** Adjust the desired hour | PGlite (`createEmptyTestDatabase`). **CS-1** insert `settings (id, ai_provider, ai_model, cron_hour_utc, default_locale) = (1,'groq','m',NULL,'en')`; `setCronHour("7")` → `{ok:true, hour:7}`; row is `(1,'groq','m',7,'en')`, still exactly 1 row. **CS-2** no `settings` row → `setCronHour("7")` creates `id = 1` with `cron_hour_utc = 7`, `default_locale = 'ro'` (column default), AI columns NULL. **CS-3** from CS-1's state, `setCronHour("")` → `{ok:true, hour:null}`, `cron_hour_utc` NULL, the other three columns unchanged. **CS-3b** `setCronHour("0")` stores `0`, not NULL (falsy trap). **CS-4** each invalid input (below) leaves the row equal to its snapshot; with no row, an invalid save still leaves the table empty. **CS-5** `getCronHour`: no row → `null`; after saving 7 → `7`; after saving 0 → `0`. **CS-6** a row inserted by hand with `cron_hour_utc = 30` (the column has no CHECK) → `getCronHour` returns `null` (never an out-of-range hour on the page). **CS-7** a successful save is exactly one runner call holding one statement (spy on the PGlite runner). Unit, fake runner: **CV-1** valid → `0`, `23`, `"0"`, `"23"`, `"07"` (→7), `" 7 "` (→7); `null`, `undefined`, `""`, `"  "` → `hour:null`. **CV-2** invalid → `{ok:false, error:"invalid_hour"}` for `"abc"`, `"24"`, `"-1"`, `"7.5"`, `"1e1"`, `"+7"`, `"0x7"`, `"７"` (full-width digit), `24`, `-1`, `7.5`, `NaN`, `Infinity`, `true`, `{}`, `[]`. **CV-3** zero runner calls on every CV-2 input. | `lib/config/cron.pglite.test.ts`, `lib/config/cron.test.ts` |
| **AC3** How the change reaches Vercel is stated | **CP-4** `suggestedScheduleLine(7)` `===` `"schedule": "0 7 * * *"` (exact, including quotes and one space after the colon); `(0)` → `"schedule": "0 0 * * *"`; for every h in 0–23, `JSON.parse("{" + line + "}").schedule` parses with `parseDailySchedule` to `{minute:0, hour:h}` and satisfies the same shape rule as `vercel-config.test.ts`; `24`, `-1`, `1.5` throw `RangeError` (programming error, never reached from validated input). **CP-6** `scheduleChangeNeeded(effectiveHour, desiredHour)`: `(10,null)`→false, `(10,10)`→false, `(10,7)`→true, `(10,0)`→true, `(null,7)`→true, `(null,null)`→false. Render (ro, en): **CG-1** match (effective 10, desired 10) → no element `data-cron-notice`, no `changeNotice` text. **CG-2** mismatch (desired 7) → `data-cron-notice` present, contains `<code>` with the escaped line `"schedule": "0 7 * * *"`, the translated `changeNotice` (naming the new window `07:00–07:59 UTC`) and `changeNoticeSteps` (commit, push, Production deployment). **CG-3** not set → no notice. **CG-5** desired 0 → notice with `"schedule": "0 0 * * *"`. **CG-4c** unrecognised effective + desired 7 → notice shown (the line is what makes the file readable again); unrecognised + not set → no notice. | `lib/config/cron.test.ts`, `app/admin/cron/page.test.tsx` |
| **AC4** Nothing else changes at runtime | **BC-7** `lib/config/cron.ts`: every import specifier is in the allowlist `drizzle-orm`, `../db/index`, `../ingestion/store`, `../../vercel.json`; so no `fs`, `node:fs`, `fs/promises`, `path`, `node:*`, `http`, `https`, `undici`, `@vercel/*`; the source contains no `fetch(`, `readFile`, `writeFile`, `process.env`. **BC-8** every non-test `.ts` file under `app/api/cron/`, `lib/cron/`, `lib/ingestion/` (asserted ≥ 5 files, not vacuous) contains neither `cron_hour_utc` nor `cronHourUtc`, and no import specifier ending in `config/cron`. **CS-8** PGlite: `fetch` stubbed with a spy during `setCronHour`/`getCronHour` → never called; `effectiveSchedule()` after a save equals its value before. **CA-5** the Server Action with a `fetch` spy → never called. **CG-10** page render with a `fetch` spy → never called. Existing BC-1 loop covers the new file too (no `next`/React/app/AI import, no `process.env`). | `lib/config/boundaries.test.ts`, `lib/config/cron.pglite.test.ts`, `app/admin/cron/actions.test.ts`, `app/admin/cron/page.test.tsx` |
| **AC5** Still one daily job | `lib/cron/vercel-config.test.ts`: the value-pin test "schedule is the Decided default (SPRINT-03-review #3) — change together with README" is **removed**, nothing else in the file changes. Kept untouched: "has exactly one cron entry for /api/cron/daily", "the schedule is a once-a-day schedule…", "has no other top-level key except the optional $schema", and both README tests. Justification (for the reviewer): Sprint 3 decision 3 reads "Initial cron schedule (UTC) **before US-023 makes the hour adjustable (FR12)**", and FR12 requires the hour to be adjustable; the shape test still fails on any non-daily schedule. `vercel.json` itself is **not** edited by this story. | `lib/cron/vercel-config.test.ts` |
| **AC6** README | **RD-1** (new `describe`, appended to `lib/cron/vercel-config.test.ts`): README contains `/admin/cron`, does not contain `Until US-023`. Existing README tests (`/api/cron/daily`, `vercel.json`, `Authorization: Bearer`, `Production`, no "Reserved" near `CRON_SECRET`) still pass unchanged. The reviewer checks the text: procedure (set the hour in `/admin/cron`, copy the shown line into `vercel.json`, commit, push, Production deployment), the 10:00 UTC default's reason kept, the Hobby precision note kept, `0 10 * * *` presented as the shipped default, not as the only schedule. | `lib/cron/vercel-config.test.ts` |
| **AC7** Bilingual | **I18N** existing key-parity test (`i18n/messages.test.ts`) passes with the new keys. **CG-8** ro vs en renders (mismatch case): heading, `effectiveWindow`, `hourLabel`, `notSetOption`, `changeNotice`, `changeNoticeSteps`, `hobbyNote` in the locale's text; ro HTML contains none of the en strings that differ between catalogues and vice versa; the `vercel.json` line appears identically (escaped) in both. **CG-7** the select `name="hour"` has exactly 25 `<option>`s: `""` (translated `notSetOption`) then `"0"`…`"23"` in order, each labelled by `hourOption` (`HH:00–HH:59 UTC`); the only named form control is `hour`. **AL-4** admin layout (ro, en): `Admin.nav.cron` with `href="/admin/cron"`. **CR-1** every result variant maps to a key present in both catalogues. **AM-4** `ActionMessage` renders `cronSaved` / `invalidHour` translated in ro and en. **Lint** `react/jsx-no-literals` passes on the new `.tsx` files (no bare text; the `–`/`UTC` live in messages). | `app/admin/cron/page.test.tsx`, `app/admin/layout.test.tsx` (one added test), `app/admin/cron/result-messages.test.ts`, `components/admin/ActionMessage.test.tsx` (one added case) |
| **AC8** Failure states | **CG-6** `getCronHour` throws `Error("connection refused: postgres://user:secret@db.example.com/etfs")` → the effective element still shows `10:00–10:59 UTC`, the translated `Admin.cron.loadError` replaces the form, no notice, and the HTML contains no `connection refused`, `postgres://`, `secret`. **CG-6b** `createCronConfigDeps` (or `getDb`) throws `MissingDatabaseUrlError` → same. **CA-4** `vi.stubEnv("DATABASE_URL", "postgres://user:secret@h/db")`; `setCronHour` rejects with the error above → `{status:"error", messageKey:"genericError"}`; `JSON.stringify(state)` contains neither the message, `postgres://`, nor `secret`; `revalidatePath` not called. **CA-4b** deps factory throws → same generic state. | `app/admin/cron/page.test.tsx`, `app/admin/cron/actions.test.ts` |
| **AC9** Gates | Every new test mocks `@/lib/db` / `@/lib/config/default-deps` or uses PGlite; none connects to Neon or Vercel. **CG-9** `app/admin/cron/page.tsx` exports `dynamic = "force-dynamic"` (the desired hour is read per request). Build-time embedding: **BC-7** above asserts `vercel.json` is reached only through one **static** `import` (not `import()`, not `require`, not `fs`), so the bundler inlines it; `env -u DATABASE_URL pnpm build` passing is the gate. Command checks by the tester, locally with `NODE_EXTRA_CA_CERTS` exported (DEC-008): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `env -u DATABASE_URL pnpm build`. Supporting evidence only (not a gate): after the build, `grep -rlF '/api/cron/daily' .next/server` lists at least one chunk besides the route itself. | commands in `US-023-tests.md` |

Other action/result tests: **CA-1** `saveCronHourAction` with a `FormData` also carrying `ai_provider`, `ai_model`,
`default_locale`, `schedule` calls `setCronHour` with exactly the `hour` string and the deps; on `ok`,
`revalidatePath("/admin/cron")`. **CA-2** missing `hour` field, or a `File` value → `invalidRequest`, no config
call, no revalidate. **CA-3** `{ok:false, error:"invalid_hour"}` → `{status:"error", messageKey:"invalidHour"}`,
no revalidate. **CR-1** `cronHourResultToState`: ok with a number → `cronSaved`; ok with `null` → `cronCleared`;
`invalid_hour` → `invalidHour`.

**MANUAL-QA** (goes into `US-023-qa.md`):
- **MQ-1 (user, deployed app + Neon + Vercel)** = sprint-05.md step 5: in `/admin/cron` the effective line reads
  `10:00–10:59 UTC`. Choose an hour other than 10, save → success message and the notice with the exact line.
  Neon SQL editor: `select ai_provider, ai_model, cron_hour_utc, default_locale from settings;` → only
  `cron_hour_utc` changed. Edit `vercel.json` with the shown line, commit, push, wait for the Production deployment.
  Vercel → project → Settings → Cron Jobs shows the new schedule; `/admin/cron` shows the new window and no notice;
  the next `job_runs.started_at` falls inside the new UTC hour. Also proves the build embedded `vercel.json` on
  Vercel (the page follows the deployed file).
- **MQ-2 (Codex QA, local serve through `scripts/claude/qa-serve.sh`, no `DATABASE_URL`)**: `/admin/cron` returns
  HTTP 200 in ro and en with the effective window `10:00–10:59 UTC`, the translated load error in place of the form,
  the Hobby note, no stack trace; the admin nav shows the cron link. Never print an environment value (DEC-015).
- **PO decision (not a failed criterion):** FR12 "adjust" is met as "store the desired hour + show the exact
  `vercel.json` edit, effective after your commit and Production deployment" (sprint decision #11).

---

## 2. Files and boundaries

### 2.1 `lib/config/cron.ts` (new; DEC-016 rules, same shape as `ai-settings.ts`)
Imports exactly: `sql` from `drizzle-orm`; `type Db` from `../db/index`; `rowsOf`, `type BatchRunner` from
`../ingestion/store`; `vercelConfig` (default import) from `../../vercel.json` (static; `resolveJsonModule` and
`esModuleInterop` are on; webpack and Vite both inline JSON). No `fs`, no network, no `process.env`.
```ts
export const DAILY_CRON_PATH = "/api/cron/daily";
export type DailySchedule = { minute: number; hour: number };
export type CronConfigDeps = { db: Db; run: BatchRunner };
export type SetCronHourResult = { ok: true; hour: number | null } | { ok: false; error: "invalid_hour" };

export function parseDailySchedule(schedule: unknown): DailySchedule | null;
export function findDailySchedule(config: unknown): string | null;       // pure, testable with odd shapes
export function effectiveSchedule(): string | null;                      // = findDailySchedule(vercelConfig)
export function formatHourWindow(hour: number): { start: string; end: string }; // "07:00" / "07:59"
export function suggestedScheduleLine(hour: number): string;            // `"schedule": "0 ${hour} * * *"`
export function scheduleChangeNeeded(effectiveHour: number | null, desiredHour: number | null): boolean;
export async function getCronHour(deps: CronConfigDeps): Promise<number | null>;
export async function setCronHour(input: unknown, deps: CronConfigDeps): Promise<SetCronHourResult>;
```
- `parseDailySchedule`: string only; `trim().split(/\s+/)`; exactly 5 fields; minute and hour each `^\d{1,2}$`
  with minute 0–59 and hour 0–23; the other three exactly `*`. Anything else → `null` (never a guessed hour).
- `findDailySchedule`: `config.crons` must be an array; the first element that is an object with
  `path === DAILY_CRON_PATH` and a string `schedule` → that string; otherwise `null`.
- `formatHourWindow` / `suggestedScheduleLine`: throw `RangeError` unless `Number.isInteger(hour) && 0 <= hour <= 23`.
  The window ignores the schedule's minute on purpose: Hobby may fire anywhere within the hour (README), and the
  suggested line always uses minute 0 (choosing the minute is out of scope).
- `scheduleChangeNeeded`: `desiredHour !== null && desiredHour !== effectiveHour` (so an unrecognised effective
  schedule with a desired hour shows the notice; hour 0 is a real hour).
- `getCronHour`: one runner call, `select "cron_hour_utc" from "settings" where "id" = 1`; no row or NULL → `null`;
  otherwise `Number(value)`, and anything that is not an integer 0–23 → `null` (the column has no CHECK; only
  hand-written SQL could store it). May throw on a DB error (the page catches).
- `setCronHour` validation, before any runner call, never throws for invalid input:
  `null`/`undefined` → `null`; a number → must be an integer 0–23; a string → trimmed, `""` → `null`, otherwise
  must match `^\d{1,2}$` (ASCII digits only) and be 0–23; any other type → `invalid_hour`. Then one runner call,
  one statement:
  ```sql
  insert into "settings" ("id", "cron_hour_utc") values (1, $hour)
  on conflict ("id") do update set "cron_hour_utc" = excluded."cron_hour_utc"
  ```
  Only `cron_hour_utc` is named in the update, so `ai_provider`, `ai_model`, `default_locale` are untouched; a
  missing row is created with the column defaults.

### 2.2 `lib/config/default-deps.ts` (modified)
Add `export function createCronConfigDeps(db: Db): CronConfigDeps { return { db, run: neonBatchRunner(db) }; }`
(`import type { CronConfigDeps } from "./cron"`). This file stays the only `lib/config` file wiring concrete I/O.
`createEtfConfigDeps` unchanged.

### 2.3 Admin UI
- **`components/admin/sections.ts`**: append `{ href: "/admin/cron", labelKey: "cron" }`.
- **`components/admin/CronAdmin.tsx`** (new, presentational, sync server component, `useTranslations("Admin.cron")`;
  imports `formatHourWindow`, `suggestedScheduleLine`, `scheduleChangeNeeded` from `@/lib/config/cron` — pure
  functions — and `ActionForm`, `type AdminActionState`):
  ```ts
  export type CronAdminProps = {
    effective: { status: "ok"; hour: number } | { status: "unrecognised"; schedule: string | null };
    desired: { status: "ok"; hour: number | null } | { status: "error" };
    action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  };
  ```
  Renders `<h2>{t("heading")}</h2>`; an effective block `<p data-cron-effective="ok">` with
  `t("effectiveWindow", formatHourWindow(hour))`, or `data-cron-effective="unrecognised"` with
  `t("unrecognisedSchedule")` and, when `schedule` is a string, `<code>{schedule}</code>`. Then the desired part:
  on `error` → `<p role="alert">{t("loadError")}</p>` (no form, no notice); on `ok` → `ActionForm` with
  `<label>{t("hourLabel")}<select name="hour" defaultValue={hour === null ? "" : String(hour)}>` — option `""` =
  `t("notSetOption")`, then `0…23`, each labelled `t("hourOption", formatHourWindow(h))`; submit `t("saveSubmit")`.
  When `desired.status === "ok"` and `scheduleChangeNeeded(effectiveHour, desired.hour)` (effectiveHour = `null`
  when unrecognised): `<div data-cron-notice>` with `t("changeNotice", formatHourWindow(desired.hour))`,
  `<code>{suggestedScheduleLine(desired.hour)}</code>`, `t("changeNoticeSteps")`. Always, last: `<p>{t("hobbyNote")}</p>`.
- **`app/admin/cron/page.tsx`** (new): `export const dynamic = "force-dynamic";` (no `maxDuration`: no network).
  `const schedule = effectiveSchedule(); const parsed = parseDailySchedule(schedule);` → `effective` prop (needs no
  DB, never throws). `try { desired = { status: "ok", hour: await getCronHour(createCronConfigDeps(getDb())) } }
  catch { desired = { status: "error" } }` — the exception is never rendered. Renders `<CronAdmin … action={saveCronHourAction} />`.
- **`app/admin/cron/actions.ts`** (`"use server"`, only async exports): `saveCronHourAction(prev, formData)`. Reads
  only `hour`; not a string → `invalidRequest` without calling the config layer. `try { result = await
  setCronHour(hour, createCronConfigDeps(getDb())) } catch { return genericError }`; on `ok` →
  `revalidatePath("/admin/cron")`; returns `cronHourResultToState(result)`. No SQL, no `process.env`, no exception
  text, no network, no file write.
- **`app/admin/cron/result-messages.ts`** (new, pure): `cronHourResultToState(result)` → `cronSaved` / `cronCleared`
  / `invalidHour`. `values` unused (no change to `AdminActionState`).
- **`messages/ro.json`, `messages/en.json`** (same keys in both; en wording shown, ro translated):
  - `Admin.nav.cron`: "Daily job".
  - `Admin.cron.heading`: "Daily job schedule".
  - `Admin.cron.effectiveWindow`: "The daily job currently runs once a day, {start}–{end} UTC."
  - `Admin.cron.unrecognisedSchedule`: "The schedule in vercel.json is not a once-a-day schedule this page can read."
  - `Admin.cron.loadError`: "Could not load the data. Please try again later."
  - `Admin.cron.hourLabel`: "Desired hour (UTC)"; `Admin.cron.notSetOption`: "(not set)";
    `Admin.cron.hourOption`: "{start}–{end} UTC"; `Admin.cron.saveSubmit`: "Save".
  - `Admin.cron.changeNotice`: "To run the job at {start}–{end} UTC, change the schedule line in vercel.json to:"
  - `Admin.cron.changeNoticeSteps`: "Then commit, push and wait for the Production deployment. The job keeps its
    current hour until then."
  - `Admin.cron.hobbyNote`: "On the Vercel Hobby plan the job runs once per day and only its hour can be chosen.
    Hours are in UTC, and Vercel may start the job at any minute within the hour. A change applies from the next
    Production deployment."
  - `Admin.messages.cronSaved`: "The desired hour was saved."; `Admin.messages.cronCleared`: "The desired hour was
    cleared."; `Admin.messages.invalidHour`: "The hour must be a whole number from 0 to 23."
- **`README.md`**, "Daily ingestion (cron)": the schedule sentence becomes "The shipped default is `0 10 * * *`
  (10:00–10:59 UTC); the schedule in force is the one in `vercel.json`, shown on `/admin/cron`." Keep the
  Hobby-precision sentence and the reason for 10:00 UTC. Replace the "Until US-023 ships…" bullet with: "To change
  the hour: choose it in `/admin/cron` (stored in `settings.cron_hour_utc`), copy the line the page shows into
  `vercel.json`, commit and push; Vercel applies it with the next **Production** deployment. Saving in the admin
  page alone does not move the job." "Administration" gets one sentence on `/admin/cron`.
- **`dev_minions/architecture/data-model.md`**: in the `cron_hour_utc` row, replace "how this column reaches Vercel is
  US-023's open question (…)" with "the admin's desired hour; the effective schedule stays in `vercel.json` and
  changes when the user commits the line `/admin/cron` shows and redeploys (US-023, sprint-05 decision 11)". A
  note, not a rule change; nothing else in the file is touched.

### 2.4 Tests (new unless marked)
`lib/config/cron.test.ts` (CP-1…CP-6, CV-1…CV-3, VJ-1; VJ-1 is the only place that reads `vercel.json` with
`fs`), `lib/config/cron.pglite.test.ts` (CS-1…CS-8), `lib/config/boundaries.test.ts` (**modified**: add BC-7,
BC-8; nothing removed or relaxed), `lib/cron/vercel-config.test.ts` (**modified**: remove the value-pin test only;
append RD-1), `app/admin/cron/page.test.tsx` (CG-1…CG-10), `app/admin/cron/actions.test.ts` (CA-1…CA-5),
`app/admin/cron/result-messages.test.ts` (CR-1), `app/admin/layout.test.tsx` (**modified**: add AL-4),
`components/admin/ActionMessage.test.tsx` (**modified**: add AM-4).
Page tests: pattern of `app/admin/ai/page.test.tsx`. Mock `@/lib/db` (`getDb: () => ({})`),
`@/lib/config/default-deps` (`createCronConfigDeps: () => ({})`, so no adapter registry or `unpdf` loads),
`@/lib/config/cron` via `importOriginal` overriding only `getCronHour` and (per test) `effectiveSchedule`, and
`./actions`. Action tests mock `next/cache`, `@/lib/db`, `@/lib/config/default-deps`, `@/lib/config/cron`
(`setCronHour`). `afterEach(vi.unstubAllEnvs / vi.unstubAllGlobals)` wherever a test stubs.

### 2.5 Boundaries (who may call whom)
`app/admin/cron/page.tsx` → `lib/config/cron` (`effectiveSchedule`, `parseDailySchedule`, `getCronHour`),
`lib/config/default-deps` (`createCronConfigDeps`), `lib/db` (`getDb`), `components/admin/CronAdmin`, `./actions`.
`app/admin/cron/actions.ts` → `lib/config/cron` (`setCronHour`), `lib/config/default-deps`, `lib/db`,
`./result-messages`, `next/cache`. Never SQL.
`components/admin/CronAdmin.tsx` → `next-intl`, `./ActionForm`, `./action-state` (type), `lib/config/cron` (pure
functions only).
`lib/config/cron.ts` → `drizzle-orm`, `lib/ingestion/store`, `lib/db` (type), `vercel.json`. Nothing else.
Unchanged: `vercel.json`, `app/api/cron/daily/route.ts`, `lib/cron/*` (except the test), `lib/ingestion/*`,
`lib/db/schema.ts`, the seed, US-020/021/022 behaviour. The cron route never reads `cron_hour_utc` (BC-8).

---

## 3. Data model and migrations
None. `settings.cron_hour_utc int NULL` exists (`drizzle/0000_init.sql`); `id = 1` is enforced by the existing CHECK.
No `pnpm db:generate`. The upsert names only `cron_hour_utc`, so US-022's `ai_provider`/`ai_model` and the seed's
`default_locale` are never touched (AC2), and the seed's `on conflict do nothing` (US-020) never overwrites the
admin's hour. No `reports` write rule is involved. No range CHECK is added (it would be a migration for a value only
the admin form writes, and the form validates); out-of-range stored values read as `null` (CS-6).

---

## 4. Risks and the smallest design

| # | Risk | Mitigation |
|---|---|---|
| R1 | `vercel.json` read at runtime with `fs` would fail inside a Vercel function (the file is not deployed) | Static JSON import only (BC-7 forbids `fs`/`import()`/`require`); `pnpm build` with `DATABASE_URL` unset passes; MQ-1 confirms the deployed page follows the deployed file. |
| R2 | The page shows a stale or guessed hour | The effective value comes only from the bundled file (VJ-1); unparseable → translated "unrecognised", no hour (CG-4); `getCronHour` never returns an out-of-range hour (CS-6). |
| R3 | Hour 0 treated as "not set" (falsy bug) | CS-3b, CS-5, CP-6 `(10,0)`, CG-5 all pin 0 as a real hour. |
| R4 | Removing a Sprint 3 test looks like weakening a test | Only the fixed-value assertion goes, with the Sprint 3 decision 3 "before US-023" wording cited (AC5 row); the shape, one-entry, path, no-extra-key and README tests stay byte-identical; RD-1 adds coverage. |
| R5 | The user saves an hour and assumes the job moved | The notice appears on every page load until the deployed `vercel.json` matches; `changeNoticeSteps` and `hobbyNote` say the job keeps its hour until the Production deployment; README says the same. |
| R6 | The HTML-escaped `"` makes the verbatim-line assertion flaky or loosened | Tests compare against `escapeHtml(suggestedScheduleLine(h))`, exact. |
| R7 | Mocking `@/lib/config/cron` wholesale in page tests would hide the real window/notice logic | Page tests mock via `importOriginal` and override only `getCronHour` / `effectiveSchedule`; the pure functions run for real. |
| R8 | Shared typecheck/test blocked by other uncommitted in-flight work (Codex log mentions US-021 test type errors; US-022 files are uncommitted) | The implementer runs `pnpm typecheck` first; a pre-existing failure outside US-023 files is recorded in HANDOVER.md, not fixed here. |
| R9 | Open admin (§6): anyone with the URL can change the stored hour | It changes only a stored preference and a displayed notice; the running schedule changes only through the user's git push. Same exposure as the rest of the admin area. |

Smallest design: one pure parser, one bundled-file reader, one one-column upsert, one read, one form reusing
US-020's `ActionForm`/`ActionMessage`. No Vercel API, no deploy hook, no file write, no new dependency, no schema
change, no change to the cron route or to `vercel.json`.

Implementation order: `lib/config/cron.ts` + `cron.test.ts` + `cron.pglite.test.ts` → `createCronConfigDeps` →
messages → `CronAdmin.tsx` → page/actions/result-messages + tests → nav + AL-4 + AM-4 → boundaries BC-7/BC-8 →
`vercel-config.test.ts` (remove the pin, add RD-1) + README + data-model note → `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `env -u DATABASE_URL pnpm build`. Add every created/modified file to HANDOVER.md "Files changed" as you
go.

---

## 5. Decisions needed

| # | Type | Question | Status |
|---|---|---|---|
| S5-11 | PRODUCT (+ technical) | How `settings.cron_hour_utc` reaches Vercel (FR12; carry-forward note) | Technical part **Decided** (sprint-05.md #11): effective schedule from `vercel.json` imported at build time; the cron route never reads the column (BC-8). Product part **NEEDS USER — isolated default ships**: store the desired hour and show the exact `vercel.json` edit, effective after the user's commit + Production deployment. Confined to `lib/config/cron.ts`, `app/admin/cron/`, `components/admin/CronAdmin.tsx` and the README procedure. An automatic path (Vercel API / deploy hook) needs a Vercel credential, a credentials decision and its own story. |

Implementation choices settled inside the story and existing decisions (no new item): the window ignores the
schedule's minute (Hobby fires anywhere in the hour; README); the suggested line always uses minute 0 (minute is out of
scope); an unrecognised effective schedule plus a desired hour shows the notice (AC3 "differs" read literally; the line
is still correct); a stored out-of-range hour reads as not set rather than being displayed; wiring in
`lib/config/default-deps.ts` (the existing single I/O-wiring file); no DB CHECK added.
