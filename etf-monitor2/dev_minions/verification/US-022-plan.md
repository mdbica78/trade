# US-022 plan — Admin: AI provider and API key settings

Planner: story-planner (opus), 2026-09-26. Mode: `plan US-022`.
Inputs read: `backlog/stories/US-022.md`, `backlog/sprints/sprint-05.md` (Decisions needed #9, #10 and the Sprint 6
notes), DEC-015, DEC-016, `decisions/README.md`, `architecture/data-model.md` (incl. "Write rules"), requirements
FR5/FR6/FR11/§6, `verification/US-020-plan.md`, and the code: `lib/config/{etfs,tracked-fields,default-deps}.ts`,
`lib/config/boundaries.test.ts`, `lib/db/schema.ts` (`settings`), `test/helpers/pglite.ts`,
`components/admin/{sections,AdminNav,ActionForm,ActionMessage,action-state}.ts(x)`,
`app/admin/etfs/{page,actions}.ts(x)`, `app/admin/etfs/page.test.tsx`, `app/admin/layout.test.tsx`,
`messages/en.json` (`Admin`), `.env.example`, `README.md`, `package.json`, `vitest.config.ts`.

**No decision is open.** Nothing here is BLOCKED. #9 ships its isolated (partial) default; #10 is Decided.

---

## 1. Acceptance criteria → tests

Test ids are the names of the `it(...)` blocks (prefix per file), so the tester can map them.

| AC | What proves it | File / test ids |
|---|---|---|
| **AC1** Choice from the supported list | **PC-1** `PROVIDER_CATALOG` has exactly the ids `gemini`, `groq`, `openrouter`, `mistral` (FR6 order), unique ids, unique `apiKeyEnvVar` matching `/^[A-Z][A-Z0-9_]*_API_KEY$/`, `requiresApiKey === true` for all four, non-empty `name`. **PA-1** (ro, en) page with `getAiSettings` → `{provider:'groq', model:'llama-3.3-70b-versatile'}`: the provider `<select name="provider">` has exactly 5 `<option>`s, values `""` + the catalogue ids **in catalogue order** (derived from `PROVIDER_CATALOG`, not hard-coded), the `""` option shows the translated `Admin.ai.noneOption`, the `groq` option is the selected one, and `<input name="model">` carries `value="llama-3.3-70b-versatile"`. **PA-7** stored provider `openai` (not in the catalogue, decision 10 precision): renders without throwing, `""` is selected, and the translated `Admin.ai.unknownStoredProvider` notice names `openai`. **PA-1b** stored `{null, null}` → `""` selected, empty model field. | `lib/ai/provider-catalog.test.ts`, `app/admin/ai/page.test.tsx` |
| **AC2** Save writes only its columns | PGlite (`createEmptyTestDatabase`). **AS-2** insert `settings (id, ai_provider, ai_model, cron_hour_utc, default_locale) = (1, null, null, 7, 'en')`; `setAiSettings({provider:'groq', model:'  llama-3.3-70b-versatile '})` → `{ok:true, provider:'groq', model:'llama-3.3-70b-versatile'}`; the row is `(1, 'groq', 'llama-3.3-70b-versatile', 7, 'en')`, still exactly 1 row. **AS-3** no `settings` row → save creates `id = 1` with `default_locale = 'ro'` (column default) and `cron_hour_utc` NULL. **AS-4** from AS-2's state, `setAiSettings({provider:'', model:'kept?'})` → both columns NULL, `cron_hour_utc`/`default_locale` still `7`/`'en'`, result `{ok:true, provider:null, model:null}`. **AS-4b** `provider: null` / `undefined` behaves like `''`. **AS-5** provider set, model `'   '` → `ai_model` NULL. **AS-8** `getAiSettings` returns what was saved; with no row → `{provider:null, model:null}`. **AS-11** the success path is exactly **one** runner call holding **one** statement (spy on the PGlite runner). | `lib/config/ai-settings.pglite.test.ts` |
| **AC3** Validation | Unit, fake runner that records calls. **AV-1** provider `'openai'`, `'GROQ'` (case-sensitive), `42`, `{}` → `{ok:false, error:'unknown_provider'}`; **AV-2** model of 201 characters (after trimming) → `{ok:false, error:'invalid_model'}`; exactly 200 → accepted (PGlite **AS-6**, stored as is); a non-string model (`42`) → `invalid_model`; **AV-3** in every error case zero runner calls. **AS-7** PGlite: after an error the row equals its snapshot. **AV-4** provider `' groq '` (surrounding space) is trimmed and accepted. **AV-5** provider cleared + a 500-char model → `{ok:true, provider:null, model:null}` (the model is ignored when the provider is cleared, story Task 2). **AA-3/AA-4** action maps `unknown_provider` → `{status:'error', messageKey:'unknownProvider'}`, `invalid_model` → `invalidModel`, no `revalidatePath`. **RM-1** every result variant maps to a key present in `messages/ro.json` and `messages/en.json`; **RM-2** `Admin.messages.invalidModel` contains `String(AI_MODEL_MAX_LENGTH)` in both catalogues. **AM-3** `ActionMessage` renders `unknownProvider` / `invalidModel` translated in ro and en. | `lib/config/ai-settings.test.ts`, `lib/config/ai-settings.pglite.test.ts`, `app/admin/ai/actions.test.ts`, `app/admin/ai/result-messages.test.ts`, `components/admin/ActionMessage.test.tsx` (one added case) |
| **AC4** Keys stay in the environment | **KS-1** `vi.stubEnv` each catalogue variable to `SENTINEL-<ID>-9f3c` → `getKeyStatuses()` has one entry per catalogue provider in catalogue order, every `isSet === true` and `typeof boolean`, each entry's own keys are exactly `id, name, requiresApiKey, apiKeyEnvVar, isSet`, and `JSON.stringify(result)` contains no `SENTINEL`. **KS-2** `""` and `"   "` → `false`; `vi.stubEnv(name, undefined)` (unset) → `false`. **PA-2** (ro, en) page render with the real `lib/ai/key-status.ts` and all four sentinels: the HTML contains no `SENTINEL` and no `9f3c`; exactly 4 cells carry `data-key-status="set"`; each variable name (`GEMINI_API_KEY`, …) appears; the translated `keySet` text appears. **PA-3** two stubbed blank, two unset → 4 × `data-key-status="not-set"` with the translated `keyNotSet`. **PA-4** the page has no `<input>` whose `name` matches `/key/i`, no `type="password"`, and the only named form controls are `provider` and `model`. **AA-1** `saveAiSettingsAction` with a `FormData` that also carries `apiKey=SENTINEL-X`, `GEMINI_API_KEY=SENTINEL-X`, `cron_hour_utc=3`, `default_locale=en` calls `setAiSettings` with exactly `{provider, model}`. **AS-10** PGlite: with the four sentinels stubbed, save a provider, then `select row_to_json(s)::text from settings s` contains no `SENTINEL`. **LB-4** (server-only, story "Notes for verification"): among non-test files under `app/`, `components/`, `lib/` (outside `lib/ai/`), the only one whose import specifiers end in `ai/key-status` is `app/admin/ai/page.tsx`, and no file starting with `"use client"` imports it. | `lib/ai/key-status.test.ts`, `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts`, `lib/config/ai-settings.pglite.test.ts`, `lib/ai/boundaries.test.ts` |
| **AC5** No AI call, no network | **LB-1** `lib/ai/provider-catalog.ts` has zero import specifiers, no `process.env`, no `fetch`. **LB-2** every non-test `.ts` in `lib/ai/`: every import specifier is in the allowlist `./provider-catalog`, `../db/index`, `../ingestion/store`, `../config/ai-settings` (so no SDK — `openai`, `@google/*`, `groq-sdk`, `@mistralai/*`, `@openrouter/*`, `ai`, `@ai-sdk/*` — and no `http`/`https`/`node:net`/`undici`); the source contains no `fetch(`. Not vacuous (≥ 3 files). **LB-3** `process.env` appears in `lib/ai/` only in `key-status.ts`. **BC-1** (existing loop in `lib/config/boundaries.test.ts`) already covers the new `lib/config/ai-settings.ts`: no `/ai/` specifier, no AI-looking name, no `process.env`, no `next`/React. **BC-6** (new) `ai-settings.ts` imports no `unpdf`, `@neondatabase/serverless`, `./default-deps`, `extraction/*`. **AS-9 / PA-9 / AA-8** global `fetch` stubbed with a spy (`vi.stubGlobal`) during the PGlite saves, the page render and the action → spy never called. | `lib/ai/boundaries.test.ts`, `lib/config/boundaries.test.ts`, `lib/config/ai-settings.pglite.test.ts`, `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts` |
| **AC6** Bilingual | **I18N** existing `i18n/messages.test.ts` key parity (unchanged; passes with the new keys). **PA-5** ro vs en render: heading, labels, `noneOption`, the four table headers, `keyRequired`, `keySet`/`keyNotSet`, `keysNote`, `chatUnavailableNote` in the locale's text; the ro HTML contains none of en's differing strings and vice versa (compare only strings that differ between catalogues). **PA-5b** the provider display names (`Google Gemini`, `Groq`, `OpenRouter`, `Mistral`) appear identically in both renders. **AL-3** admin layout (ro, en): `Admin.nav.ai` with `href="/admin/ai"`. **RM-1** above. **Lint**: `react/jsx-no-literals` passes on the new `app/**`/`components/**` files. | `app/admin/ai/page.test.tsx`, `app/admin/layout.test.tsx` (one added test), `app/admin/ai/result-messages.test.ts` |
| **AC7** Failure states | **PA-6** `getAiSettings` throws `Error('connection refused: postgres://user:secret@db.example.com/etfs')` → the translated `Admin.ai.loadError` replaces the form; the HTML has no `connection refused`, `postgres://`, `secret`; the key table and both notes still render (they need no database). **PA-6b** `getDb` throws (as with `DATABASE_URL` unset) → same `loadError`. **AA-6** `vi.stubEnv('DATABASE_URL','postgres://user:secret@h/db')` and the four key sentinels; `setAiSettings` throws the error above → `{status:'error', messageKey:'genericError'}`, `JSON.stringify(state)` contains neither the message, `secret`, nor `SENTINEL`; `revalidatePath` not called. **AA-7** `getDb` throws `MissingDatabaseUrlError` → same generic state. | `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts` |
| **AC8** Documentation and gates | **EX-1** reads `.env.example` (explicitly allowed by DEC-015) and asserts, for each catalogue entry, a line exactly `<apiKeyEnvVar>=` (empty value) preceded by a `#` comment line. **PA-8** `app/admin/ai/page.tsx` exports `dynamic = "force-dynamic"` (key status is read per request, never frozen at build). Every new test mocks `@/lib/db` or uses PGlite; none imports `getDb` unmocked. Command checks by the tester, locally: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `env -u DATABASE_URL pnpm build` (with `NODE_EXTRA_CA_CERTS` exported, DEC-008). README change is checked by the reviewer (text). | `lib/ai/env-example.test.ts`, `app/admin/ai/page.test.tsx`; command output in `US-022-tests.md` |

**MANUAL-QA** (goes into `US-022-qa.md`):
- **MQ-1 (user, deployed app + Neon + Vercel)** = sprint-05.md step 4: in `/admin/ai` pick a provider, type a model, save → success message. Neon SQL editor: `select ai_provider, ai_model, cron_hour_utc, default_locale from settings;` shows the new provider/model and the other two columns unchanged. In the Vercel project's environment variables set the key variable named on the page (e.g. `GROQ_API_KEY`), redeploy, reload `/admin/ai` → that row shows "set"; view the page source and confirm the key value is nowhere in it. Then clear the provider → both columns NULL.
- **MQ-2 (Codex QA, local serve through `scripts/claude/qa-serve.sh`, no `DATABASE_URL`)**: `/admin/ai` returns HTTP 200 in ro and en with the translated load error, the provider key table (every row "not set" unless the QA shell has those variables — the page never shows a value either way), both notes, and no stack trace; the admin nav shows the AI link. Never print an environment value (DEC-015).
- **PO decision (not a failed criterion):** FR11's "entering an API key" is met only as "set where required, shown as set/not set" (sprint decision #9). The QA checklist lists it as the open PRODUCT question.

---

## 2. Files and boundaries

### 2.1 `lib/ai/` (new directory; static data + env status + wiring, no network, no SDK)
- **`lib/ai/provider-catalog.ts`** — no imports at all. Decision 10.
  ```ts
  export type ProviderDescriptor = { readonly id: string; readonly name: string;
    readonly requiresApiKey: boolean; readonly apiKeyEnvVar: string };
  export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
    { id: "gemini", name: "Google Gemini", requiresApiKey: true, apiKeyEnvVar: "GEMINI_API_KEY" },
    { id: "groq", name: "Groq", requiresApiKey: true, apiKeyEnvVar: "GROQ_API_KEY" },
    { id: "openrouter", name: "OpenRouter", requiresApiKey: true, apiKeyEnvVar: "OPENROUTER_API_KEY" },
    { id: "mistral", name: "Mistral", requiresApiKey: true, apiKeyEnvVar: "MISTRAL_API_KEY" },
  ];
  export const PROVIDER_IDS: readonly string[] = PROVIDER_CATALOG.map((p) => p.id);
  export function findProvider(id: string | null): ProviderDescriptor | undefined;
  ```
  Display names are proper nouns and live here, not in the message catalogues (AC6). Sprint 6 (US-025/026)
  attaches adapters to these ids and trims the list.
- **`lib/ai/key-status.ts`** — the only file in the repo that reads a provider key variable. Imports only
  `./provider-catalog`.
  ```ts
  export type ProviderKeyStatus = { id: string; name: string; requiresApiKey: boolean;
    apiKeyEnvVar: string; isSet: boolean };
  export function getKeyStatuses(): ProviderKeyStatus[]
  ```
  Body: for each catalogue entry, `const value = process.env[p.apiKeyEnvVar]; isSet = typeof value === "string" &&
  value.trim() !== ""`; builds the entry from the **catalogue** fields plus the boolean. The value is never
  returned, logged, compared to anything else or stored in a variable that outlives the loop iteration. Dynamic
  `process.env[...]` access is read at request time on the server (Next inlines only `NEXT_PUBLIC_*` and literal
  `process.env.X` accesses).
  "Server-only" is enforced by **LB-4** (only `app/admin/ai/page.tsx` imports it; no `"use client"` importer) —
  the `server-only` npm package is not installed and is not added (no new dependency needed).
- **`lib/ai/settings-deps.ts`** — the wiring for AI settings (Sprint 6 chat reuses it):
  `export function createAiSettingsDeps(db: Db): AiSettingsDeps` →
  `{ db, run: neonBatchRunner(db), providerIds: PROVIDER_IDS }`. Imports `type Db` from `../db/index`,
  `neonBatchRunner` from `../ingestion/store`, `type AiSettingsDeps` from `../config/ai-settings`,
  `PROVIDER_IDS` from `./provider-catalog`. Takes `db` as a parameter (no `getDb()` here).
  Why here and not in `lib/config/default-deps.ts`: `lib/config/` may not import AI code (DEC-016 §1, enforced by
  the existing BC-1 test, which rejects any specifier with an `/ai/` segment). The dependency direction is
  `lib/ai → lib/config`, never the reverse.

### 2.2 `lib/config/ai-settings.ts` (new; same rules as `etfs.ts`, DEC-016)
Imports: `sql` from `drizzle-orm`, `type Db` from `../db/index`, `rowsOf`, `type BatchRunner` from
`../ingestion/store`. Nothing from `lib/ai` (the allowed ids are **injected**).
```ts
export const AI_MODEL_MAX_LENGTH = 200;
export type AiSettings = { provider: string | null; model: string | null };
export type AiSettingsDeps = { db: Db; run: BatchRunner; providerIds: readonly string[] };
export type SetAiSettingsResult =
  | { ok: true; provider: string | null; model: string | null }
  | { ok: false; error: "unknown_provider" | "invalid_model" };
export async function getAiSettings(deps: Pick<AiSettingsDeps, "db" | "run">): Promise<AiSettings>;
export async function setAiSettings(input: { provider: unknown; model: unknown }, deps: AiSettingsDeps):
  Promise<SetAiSettingsResult>;
```
- `getAiSettings`: one runner call, `select "ai_provider", "ai_model" from "settings" where "id" = 1`; no row →
  `{null, null}`; returns the stored strings as they are (the page decides how to show an id that is no longer in
  the catalogue). May throw on a DB error (caller catches).
- `setAiSettings` validation (before any runner call; never throws for invalid input):
  1. provider: `null`/`undefined` → none; a string → trimmed, `""` → none; otherwise it must be in
     `deps.providerIds` (exact, case-sensitive) else `unknown_provider`; a non-string, non-nullish value →
     `unknown_provider`.
  2. provider none → model is forced to `null` and **not validated** (Task 2: "Clearing the provider also clears
     the model").
  3. otherwise model: `null`/`undefined` → `null`; a string → trimmed, `""` → `null`, `length >
     AI_MODEL_MAX_LENGTH` → `invalid_model`; any other type → `invalid_model`. Free text otherwise (story: no
     per-provider model list; FR6 "free-tier offerings change frequently").
  4. one runner call, one statement:
     ```sql
     insert into "settings" ("id", "ai_provider", "ai_model") values (1, $provider, $model)
     on conflict ("id") do update set "ai_provider" = excluded."ai_provider", "ai_model" = excluded."ai_model"
     ```
     Only the two columns are named in the update, so `cron_hour_utc` and `default_locale` are untouched; a
     missing row is created with the column defaults (`default_locale = 'ro'`, `cron_hour_utc` NULL).
     Returns `{ok:true, provider, model}` (normalised).
- Length limit rationale: 200 characters comfortably holds real free-tier model ids (e.g.
  `meta-llama/llama-3.3-70b-instruct:free`, ~40 chars) and bounds what an open (§6) form can store.

### 2.3 Admin UI
- **`components/admin/sections.ts`**: append `{ href: "/admin/ai", labelKey: "ai" }`.
- **`components/admin/AiSettingsAdmin.tsx`** (new, presentational, sync server component,
  `useTranslations("Admin.ai")`). It defines its own prop types and imports nothing from `lib/ai/key-status`:
  ```ts
  type ProviderOption = { id: string; name: string };
  type KeyRow = { id: string; name: string; requiresApiKey: boolean; apiKeyEnvVar: string; isSet: boolean };
  export type AiSettingsAdminProps = {
    settings: { status: "ok"; provider: string | null; model: string | null } | { status: "error" };
    providers: readonly ProviderOption[]; keyRows: readonly KeyRow[];
    action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  };
  ```
  Renders: `<h2>{t("heading")}</h2>`; if `status === "error"` → `<p role="alert">{t("loadError")}</p>` in place
  of the form; else the `ActionForm` (US-020) with `<select name="provider" defaultValue={selected}>` (`""` =
  `noneOption`, then one `<option value={id}>{name}</option>` per provider) where `selected` = stored id if it is
  in `providers`, else `""`; when the stored id is non-null and unknown, a `<p>` with
  `t("unknownStoredProvider", { provider })` (decision 10 precision); `<input name="model" type="text"
  maxLength={AI_MODEL_MAX_LENGTH} defaultValue={model ?? ""}>` with `modelLabel` and `modelHint`; submit
  `saveSubmit`. Then, always: `<h3>{t("keysHeading")}</h3>`, a table (`providerColumn`, `keyRequiredColumn`,
  `variableColumn`, `statusColumn`) with one row per `keyRows` entry: name, `keyRequired`/`keyNotRequired`,
  `<code>{apiKeyEnvVar}</code>`, and a cell `data-key-status={isSet ? "set" : "not-set"}` showing
  `keySet`/`keyNotSet`; then `<p>{t("keysNote")}</p>` and `<p>{t("chatUnavailableNote")}</p>`.
  `maxLength` imports the constant from `@/lib/config/ai-settings` (a plain constant; the server still validates).
- **`app/admin/ai/page.tsx`** (new): `export const dynamic = "force-dynamic";` (no `maxDuration`: no network).
  ```ts
  const keyRows = getKeyStatuses();                           // no DB, never throws
  const providers = PROVIDER_CATALOG.map(({ id, name }) => ({ id, name }));
  let settings; try { settings = { status: "ok", ...(await getAiSettings(createAiSettingsDeps(getDb()))) } }
  catch { settings = { status: "error" } }                    // never render the exception
  return <AiSettingsAdmin settings={settings} providers={providers} keyRows={keyRows} action={saveAiSettingsAction} />;
  ```
- **`app/admin/ai/actions.ts`** (`"use server"`, exports only async functions):
  `saveAiSettingsAction(prev: AdminActionState, formData: FormData): Promise<AdminActionState>`. Reads only
  `provider` and `model`; either not a string → `invalidRequest` without calling the config layer.
  `try { result = await setAiSettings({ provider, model }, createAiSettingsDeps(getDb())) } catch { return
  genericError }`; on `ok` → `revalidatePath("/admin/ai")`; returns `aiSettingsResultToState(result)`. No SQL, no
  `process.env`, no exception text, no import of `key-status`.
- **`app/admin/ai/result-messages.ts`** (new, pure): `aiSettingsResultToState(result)` →
  ok with provider → `{success, 'aiSaved'}`; ok with `null` → `{success, 'aiCleared'}`;
  `unknown_provider` → `{error, 'unknownProvider'}`; `invalid_model` → `{error, 'invalidModel'}`.
  `values` is not used (no shared-type change to `AdminActionState`).
- **`messages/ro.json`, `messages/en.json`** (same keys in both):
  `Admin.nav.ai`;
  `Admin.ai.{heading, loadError, providerLabel, noneOption, unknownStoredProvider ({provider}), modelLabel,
  modelHint, saveSubmit, keysHeading, providerColumn, keyRequiredColumn, variableColumn, statusColumn,
  keyRequired, keyNotRequired, keySet, keyNotSet, keysNote, chatUnavailableNote}`;
  `Admin.messages.{aiSaved, aiCleared, unknownProvider, invalidModel}` (`invalidModel` states the limit, "200").
  `keysNote` says: keys are set as environment variables in the Vercel project, then redeploy; never in this
  form; the page only shows whether each is set. `chatUnavailableNote`: the configuration chat is not available
  yet. `modelHint`: optional, free text (the model name as the provider writes it).
- **`.env.example`**: append the four variables, each `NAME=` preceded by a one-line `#` comment ("API key for
  <provider>; optional until the configuration chat ships (Sprint 6); set it in the Vercel project, never
  commit it").
- **`README.md`**: "Environment variables" gets `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`,
  `MISTRAL_API_KEY` — optional until Sprint 6, set in the Vercel project and redeploy, `/admin/ai` shows only
  set/not set. "Administration" gets one sentence on `/admin/ai`.

### 2.4 Tests (new unless marked)
`lib/ai/provider-catalog.test.ts`, `lib/ai/key-status.test.ts` (with `afterEach(vi.unstubAllEnvs)`),
`lib/ai/boundaries.test.ts` (LB-1..LB-4; reuses `test/helpers/module-specifiers.ts`), `lib/ai/env-example.test.ts`,
`lib/config/ai-settings.test.ts`, `lib/config/ai-settings.pglite.test.ts`, `lib/config/boundaries.test.ts`
(**modified**: add BC-6, nothing removed or relaxed), `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts`,
`app/admin/ai/result-messages.test.ts`, `app/admin/layout.test.tsx` (**modified**: add AL-3),
`components/admin/ActionMessage.test.tsx` (**modified**: add AM-3).
Page tests: `renderToStaticMarkup` inside `NextIntlClientProvider` (pattern of `app/admin/etfs/page.test.tsx`);
mock `@/lib/db`, `@/lib/ai/settings-deps`, `@/lib/config/ai-settings` (`getAiSettings` only — keep the real
`AI_MODEL_MAX_LENGTH` via `importOriginal`), `./actions`; do **not** mock `@/lib/ai/key-status` or
`@/lib/ai/provider-catalog`. Action tests mock `next/cache`, `@/lib/db`, `@/lib/ai/settings-deps`,
`@/lib/config/ai-settings`. Sentinels only ever come from `vi.stubEnv`; no test reads or prints the real
environment (DEC-015).

### 2.5 Boundaries (who may call whom)
`app/admin/ai/page.tsx` → `lib/ai/{key-status,provider-catalog,settings-deps}`, `lib/config/ai-settings`
(`getAiSettings`), `lib/db` (`getDb`), `components/admin/AiSettingsAdmin`, `./actions`.
`app/admin/ai/actions.ts` → `lib/config/ai-settings` (`setAiSettings`), `lib/ai/settings-deps`, `lib/db`,
`./result-messages`, `next/cache`. Never SQL, never `key-status`.
`lib/ai/*` → `lib/config/ai-settings` (types), `lib/ingestion/store`, `lib/db` (type). No network, no SDK.
`lib/config/ai-settings.ts` → `drizzle-orm`, `lib/ingestion/store`, `lib/db` (type). Never `lib/ai`.
`components/admin/AiSettingsAdmin.tsx` → `next-intl`, `./ActionForm`, `./action-state` (type),
`lib/config/ai-settings` (constant). Never `key-status`.
`lib/ingestion`, `lib/monitoring`, `lib/extraction`, the cron route, and US-020/US-021 behaviour: unchanged.

---

## 3. Data model and migrations
None. `settings.ai_provider` and `settings.ai_model` exist (nullable text); `id = 1` is enforced by the existing
CHECK. No `pnpm db:generate`. The upsert names only its two columns, so US-023's `cron_hour_utc` and the seed's
`default_locale` are never touched (AC2), and the seed's `on conflict do nothing` (US-020) never overwrites the
admin's choice. No `reports` write rule is involved. No secret is ever written to any table (AC4, AS-10).

---

## 4. Risks and the smallest design

| # | Risk | Mitigation |
|---|---|---|
| R1 | A key value reaches HTML, a log, a Server Action result or the DB | Only `key-status.ts` reads the variables and returns booleans + catalogue strings (KS-1); the page render test uses the real module with sentinels (PA-2); the form has no key input and the action reads two named fields (PA-4, AA-1); the DB dump has no sentinel (AS-10); errors map to fixed keys (AA-6, PA-6). |
| R2 | `key-status.ts` imported from a client component would ship `process.env` reads to the browser bundle | LB-4 (only `app/admin/ai/page.tsx` imports it; no `"use client"` importer); the component takes plain booleans. No `server-only` dependency added. |
| R3 | Key status frozen at build time (static render) | `dynamic = "force-dynamic"` (PA-8); dynamic `process.env[name]` access. MQ-1 confirms "set" after a Vercel redeploy. |
| R4 | `lib/config/` importing the catalogue would break DEC-016 §1 and the existing BC-1 test | Allowed ids are injected (`AiSettingsDeps.providerIds`); wiring lives in `lib/ai/settings-deps.ts`. BC-1 is not edited. |
| R5 | Sprint 6 trims the catalogue and a stored id disappears | `getAiSettings` returns the raw id; the page preselects "none" and shows `unknownStoredProvider` (PA-7), no crash (decision 10 precision). |
| R6 | Open admin (§6): anyone with the URL can change the provider and see which key variables are set | Only booleans are exposed; the provider id must be a catalogue id; the model is length-bounded. Same exposure as US-020's open admin, noted for the PO, no new rule. |
| R7 | Shared typecheck blocked by other in-flight work (Codex log: US-021 test type errors) | The implementer runs `pnpm typecheck` first; a pre-existing failure outside US-022 files is reported in HANDOVER, not fixed here unless it is in files this story changes. |
| R8 | `vi.stubEnv(name, undefined)` leaks between tests | `afterEach(() => vi.unstubAllEnvs())` in every file that stubs. |

Smallest design: one static list, one boolean function, one two-column upsert, one form reusing US-020's
`ActionForm`/`ActionMessage`. No provider adapter, no model list, no key storage, no new dependency, no schema
change. Extensible only where FR6 asks: the catalogue is the list Sprint 6's single provider adapter plugs into.

Implementation order: `provider-catalog.ts` → `key-status.ts` → `lib/config/ai-settings.ts` + tests (unit, PGlite)
→ `settings-deps.ts` → messages → `AiSettingsAdmin.tsx` → page/actions/result-messages + tests → nav + layout test
→ `.env.example` + README → boundary tests → `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`env -u DATABASE_URL pnpm build`. Add every created/modified file to HANDOVER.md "Files changed" as you go.

---

## 5. Decisions needed

| # | Type | Question | Status |
|---|---|---|---|
| S5-9 | PRODUCT (credentials) | FR11 "entering an API key": store a typed key, or keep keys as environment variables? | NEEDS USER — isolated default ships (partial): provider/model selection in full; the key part is the set/not-set status in `lib/ai/key-status.ts` + `app/admin/ai/` + `components/admin/AiSettingsAdmin.tsx`, storing nothing. In-app key entry would need a credentials DEC and its own story. |
| S5-10 | TECHNICAL | Provider list before Sprint 6 | Decided (sprint-05.md #10): static `lib/ai/provider-catalog.ts`. Applied in §2.1; unknown stored id handled per the tech-lead precision (PA-7). |

Implementation choices settled inside existing decisions (no new item): model limit 200 characters (the story
asks the plan to name it); ids injected into `lib/config/ai-settings.ts` (DEC-016 §1 + BC-1); wiring in
`lib/ai/settings-deps.ts`; server-only enforced by a boundary test instead of the `server-only` package; the key
table still renders when the settings read fails (it needs no database).
