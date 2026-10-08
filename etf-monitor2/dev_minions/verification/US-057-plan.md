# US-057 plan: Custom OpenAI-compatible provider with a URL-bound key
_Planner: story-planner, 2026-10-06. Sources: `backlog/stories/US-057.md` (ACs confirmed by the PO 2026-10-05),
`decisions/DEC-026-more-ai-providers.md` §2/§5 (binding), `backlog/sprints/sprint-13.md` (PO review: "up to 5 of your
own OpenAI-compatible providers (name + https address); the saved key is bound to the address and deleted if the address
changes"), DEC-021 §2/§4/§5/§6/§7 (amended by DEC-026 §2 for §8), DEC-017 §1-§4, DEC-016 §1, DEC-019 §3, DEC-023,
DEC-015, `architecture/data-model.md` "Write rules", the US-056 plan/code now in place, AGENTS.md._

**Not blocked.** Every TECHNICAL choice is settled below (§5, T-1..T-11). The three PRODUCT items ship isolated
defaults in code named here (§6). There is one new table (expand-only migration, generated locally, applied by the
deploy) and no new dependency.

---

## 0. What exists today (read before coding)
- `lib/ai/key-store.ts` is the only module that encrypts, decrypts, reads or writes `ai_provider_keys` (LB-10, LB-11, CB-3).
  `encryptProviderKeyWithMaterial(providerId, …)`/`decryptProviderKeyWithMaterial(providerId, …)` use their first
  argument **only** as the GCM AAD. `writeStoredProviderKey`/`readStoredProviderKey`/`clearStoredProviderKey` each await
  their own `db.execute`. There is no batch support yet.
- `lib/config/ai-keys.ts` is the only `lib/config` file allowed to import `lib/ai` (and only `../ai/key-store`, per
  config boundary BC-1 and LB-10). `saveProviderKey`/`clearProviderKey` validate against `deps.providers` (the static
  catalogue, wired in `lib/ai/settings-deps.ts` `createProviderKeyConfigDeps`).
- `lib/config/ai-settings.ts` `setAiSettings` accepts only `deps.providerIds` (= `PROVIDER_IDS`, wired in `settings-deps.ts`).
- `lib/ai/provider-deps.ts` `resolveFromDeps`: `loadSettings` → `loadStoredKeys` → pure `resolveActiveProvider`
  (`providers/resolve.ts`), which rejects any id not in `PROVIDER_CATALOG` (`unknown_provider`) and takes the adapter
  from the registry (`createProviderRegistry` throws on a non-catalogue id). A stored key wins over the env key (PD-8).
- `lib/ai/providers/openai-compatible.ts` `createOpenAiCompatibleProvider({ id, chatCompletionsUrl, … })` builds an
  adapter for any URL. `http.ts` sends with `redirect: "error"`, and every failure is a closed code.
- `testProviderConnection` (US-056) and `handleChatMessage` both go through `loadActiveProvider`. If resolution handles
  custom providers, both work with no change.
- Boundary tests that constrain this design (all must stay green): `lib/ai/boundaries.test.ts` LB-2 (import allowlist),
  LB-2-fetch (the word `fetch` is banned in lib/ai outside providers/ and provider-deps), LB-3, LB-4, LB-8 (no
  `searchParams`/`URLSearchParams` in providers/), LB-9, **LB-10** (key-store importers are exactly provider-deps and
  config/ai-keys), **LB-11** (outside schema.ts, only key-store.ts may even *mention* the string `ai_provider_keys`, comments
  included); `lib/ai/capabilities/boundaries.test.ts` **CB-3** (no `sql\``/`db.execute`/drizzle-orm under lib/ai except
  key-store); `lib/config/boundaries.test.ts` (no lib/config specifier may contain an `ai` word or an `/ai/` segment except
  ai-keys.ts → `../ai/key-store`); `app/actions.boundary.test.ts` (actions import only `lib/config/`, `lib/db`,
  `lib/ai/settings-deps`, `lib/ai/chat`, `lib/ai/connection-test`, `lib/log/load-error`, and contain no SQL text);
  `lib/ai/providers/presets.test.ts` PS-2 (exactly 6 `https://` literals in `openai-compatible.ts`, comments included).

## 1. Acceptance criteria → proving tests

| AC | Restated | Proof |
|---|---|---|
| AC1 | `pnpm typecheck`, `pnpm lint`, `pnpm build` (offline), full `pnpm test` and `bash scripts/claude/predeploy-check.sh` pass; no existing behaviour test is loosened; deliberate test changes are listed in HANDOVER with their reason | Gate runs by the implementer and by the independent tester, with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/every `*_API_KEY` unset. §3 lists the five deliberate test changes; the implementer copies them into HANDOVER. |
| AC2 | URL validation table: accepts a normal https URL; rejects http, credentials, query, IPs, localhost, private names, too long | New **CPV-1** (`lib/config/custom-providers.test.ts`, `it.each` table over `validateCustomProviderBaseUrl`, exact rows in §3) + **CPV-2** (normalised output: trimmed, lower-case host, trailing slashes removed, default port dropped) + **CPV-3** (exactly 200 chars accepted, 201 rejected, measured on the normalised value too) + **CPV-4** (name table: 1–40 chars after trim, no control chars) + **CPC-5** (add/update with an invalid URL or name never calls `run`). Server-side only: the form's `type="url"`/`maxLength` are convenience, not the check. |
| AC3 | Changing the URL deletes the key in the same batch; a key encrypted for URL A fails to decrypt for URL B | **KB-1..KB-4** (`lib/ai/key-binding.test.ts`): `providerKeyAad(id, null) === id` (old preset ciphertexts still decrypt); encrypt with `providerKeyAad("custom-1", A)` → decrypt with `providerKeyAad("custom-1", B)` throws `ProviderKeyUnavailableError`; same URL round-trips; preset AAD ≠ any custom AAD. **KB-P1** (`lib/ai/key-binding.pglite.test.ts`): `writeStoredProviderKey(…, A)` then `readStoredProviderKey(…, B)` throws, `(…, A)` returns the fake key. **CPC-2/CPC-3/CPC-4** (fake runner): URL change → `run` called **once** with exactly 2 statements, the first being key-store's delete statement for that id; name-only edit → 1 statement, no key delete; delete → one `run` with 2 statements. **CPP-3** (PGlite): add provider, save key, change URL → key row gone and URL updated. **CPP-4** (PGlite atomicity): the same update with a runner that appends a failing statement → the whole transaction rolls back (URL unchanged **and** key still readable), so the delete and the update are one batch. **CPP-5**: name-only edit keeps the key, which still decrypts. **CPP-6**: delete removes row and key together. |
| AC4 | Chat works end to end with a custom provider and a fake fetch; the request goes only to the configured URL | **CPE-1** (`lib/ai/custom-provider.pglite.test.ts`): PGlite seeded DB, `ai_custom_providers` row `https://llm.example.com/v1`, settings provider `custom-<id>` + model, key saved through the real `saveProviderKey` path (URL-bound, fake material), `ProviderDeps` built from the real `getAiSettings`/`listCustomProviders`/`loadStoredProviderKeys` over PGlite + real default registry + a fake `fetch` returning a chat-completions body with a valid `add_etf` action; `handleChatMessage("add ETF XYZ")` → `executed_actions` with `done`, the XYZ row exists, the fake fetch was called **exactly once** with URL exactly `https://llm.example.com/v1/chat/completions`, `redirect: "error"`, `authorization: Bearer <fake key>`, and the stubbed global `fetch` was never called. **CPE-2**: after `updateCustomProvider` changes the URL, the chat returns `unavailable`/`no_api_key` and makes no request. **CPE-3**: `testProviderConnection` with the custom provider → `{ ok: true }`, one request to the same URL. **CPE-4**: the row's `base_url` changed directly in SQL (bypassing config) → the stored key fails AAD → `no_api_key`, no request, one sanitised log line without the key. **PDX-1..PDX-7** (unit, fake deps) cover the resolution branches. |
| AC5 | No key in any output; boundary tests green; the migration is expand-only (guard test green) | **AC5 no key:** CPE-1..CPE-4, PDX-6, CPA-1..CPA-6, CPU-1..CPU-6 and PA-C1 put the fake key sentinel `test-key-0000-custom-SENTINEL` in, then assert it is absent from: every outcome/result/state object (`JSON.stringify`), `getCustomProviderViews` output, rendered HTML, every `console.error` spy call, and every thrown message. **Boundaries:** all existing boundary tests green (one allowlist line added, §3 item 3) + new **CPB-1/CPB-2** (`lib/config/custom-providers.boundary.test.ts`: only `lib/config/custom-providers.ts` and `lib/db/schema.ts` mention `ai_custom_providers` in app/components/lib; `custom-providers.ts` imports no `lib/ai` module and no `next`/`react`). **Migration:** existing **MD-G10** (`guardAllMigrations(drizzle/)` returns `[]`) stays green with the new file; new **MG-3** (`lib/db/schema.test.ts` addition): `0005_ai_custom_providers.sql` has exactly one `CREATE TABLE "ai_custom_providers"`, no `drop`/`rename`/`alter column … type`, no `ALTER TABLE` on any other table, and `guardMigrationStatements` on it returns `[]`; **PM-6** (`test/helpers/pglite.migrations.test.ts` addition): table exists after migration, its check constraints reject an `http://` URL, a 201-char URL and a 41-char name. |

MANUAL-QA (live; needs the deployed app and a real key the user enters in `/admin/ai` himself, never in a chat or test):
- **M-1** After the push, `/health` shows no missing-table line (the deploy applied `0005_ai_custom_providers`, DEC-023).
  This is an observation, not a step.
- **M-2** On `/admin/ai` → "Your own providers": add `Groq via custom` with address `https://api.groq.com/openai/v1`.
  Save a real Groq key in that provider's key form. In the provider selector choose `Groq via custom`, model
  `openai/gpt-oss-120b`, Save, then **Test connection** → "Connection OK". Then `/chat` "add ETF XYZ" works (sanity check).
- **M-3** Edit the address to `https://api.groq.com/openai/v2`. The page says the stored key was removed, the key status
  shows "No key", and Test connection gives `no_api_key`. Put the address back: the key is still gone (enter it again).
- **M-4** Try addresses `http://…`, `https://127.0.0.1`, `https://localhost`, `https://x.internal`, and one with `?a=1`:
  each is refused with the "invalid address" message. Add five providers; the sixth is refused (limit message) and the add
  form is replaced by the limit note.
- **M-5** Delete the provider: its row and key disappear. If it was the active provider, the provider card shows the
  existing "stored provider is no longer in the supported list" notice and the chat says no provider is configured
  correctly (D-2 default).

## 2. Files and boundaries

Implementation order (each step keeps typecheck green):

1. **`lib/db/schema.ts`** (changed): append
   ```ts
   export const aiCustomProviders = pgTable("ai_custom_providers", {
     id: serial("id").primaryKey(),
     name: text("name").notNull(),
     baseUrl: text("base_url").notNull(),
     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
   }, (t) => [
     check("ai_custom_providers_name_length", sql`char_length(${t.name}) between 1 and 40`),
     check("ai_custom_providers_base_url_https", sql`${t.baseUrl} like 'https://%' and char_length(${t.baseUrl}) <= 200`),
   ]);
   ```
   No FK to `ai_provider_keys` (that table's `provider_id` stays free text). Then **migration** (§4).
2. **`lib/ai/key-store.ts`** (changed; still the only owner of `ai_provider_keys`):
   - `export function providerKeyAad(providerId: string, baseUrl: string | null = null): string`, which returns
     `providerId` when `baseUrl === null` (byte-identical to today's AAD, so every existing preset ciphertext still
     decrypts) and otherwise `` `${providerId}\n${baseUrl}` `` (T-3).
   - `writeStoredProviderKey(db, providerId, plaintext, material = …, updatedAt = new Date(), baseUrl: string | null = null)`,
     which encrypts with `providerKeyAad(providerId, baseUrl)`. The row stays keyed by `providerId`.
   - `readStoredProviderKey(db, providerId, materialForSource = …, baseUrl: string | null = null)`, which decrypts with the same AAD.
   - `export function buildClearStoredProviderKeyStatement(db: Db, providerId: string)` returns the **unawaited**
     `db.execute(sql\`delete from "ai_provider_keys" where "provider_id" = ${providerId}\`)` (type `ReturnType<Db["execute"]>`,
     usable in a `BatchRunner`). `clearStoredProviderKey` becomes `await buildClearStoredProviderKeyStatement(db, providerId)`
     with identical behaviour.
   - Encrypt/decrypt function signatures do not change; callers pass `providerKeyAad(...)` as the first argument.
3. **`lib/config/custom-providers.ts`** (new; the only module that reads or writes `ai_custom_providers`; DEC-016 pattern; imports
   only `drizzle-orm`, `../db/index` (type), `../ingestion/store` (`rowsOf`, `BatchRunner`), `../log/load-error`
   (`describeLoadError`). It never imports `lib/ai` and **must not contain the string `ai_provider_keys`**, comments included (LB-11)):
   ```ts
   export const CUSTOM_PROVIDER_MAX = 5;
   export const CUSTOM_PROVIDER_NAME_MAX_LENGTH = 40;
   export const CUSTOM_PROVIDER_URL_MAX_LENGTH = 200;
   export type CustomProvider = { id: string; name: string; baseUrl: string };          // id = "custom-<serial>"
   export type CustomProviderReadDeps = { db: Db; run: BatchRunner };
   export type CustomProviderConfigDeps = CustomProviderReadDeps & {
     clearKeyStatement: (providerId: string) => ReturnType<Db["execute"]>;              // injected; built by key-store
   };
   export type CustomProviderResult =
     | { ok: true; id: string; keyRemoved: boolean }
     | { ok: false; error: "invalid_name" | "invalid_url" | "limit_reached" | "not_found" };
   export function customProviderId(rowId: number): string;              // "custom-" + rowId
   export function isCustomProviderId(id: unknown): id is string;        // /^custom-[1-9]\d{0,9}$/
   export function validateCustomProviderName(raw: unknown): { ok: true; name: string } | { ok: false };
   export function validateCustomProviderBaseUrl(raw: unknown): { ok: true; url: string } | { ok: false };
   export async function listCustomProviders(deps: CustomProviderReadDeps): Promise<readonly CustomProvider[]>;
   export async function addCustomProvider(input: { name: unknown; baseUrl: unknown }, deps: CustomProviderReadDeps): Promise<CustomProviderResult>;
   export async function updateCustomProvider(input: { id: unknown; name: unknown; baseUrl: unknown }, deps: CustomProviderConfigDeps): Promise<CustomProviderResult>;
   export async function deleteCustomProvider(id: unknown, deps: CustomProviderConfigDeps): Promise<CustomProviderResult>;
   ```
   - **Validation** (T-4): a string, trimmed, non-empty, no whitespace or control character inside, ≤ 200 chars; no `?` or
     `#` anywhere in the raw text (this catches an empty query or fragment, which the URL parser drops); parsed with
     `new URL()` (a parse failure is invalid); `protocol === "https:"`; empty `username` and `password`; hostname not ending
     in `.`; hostname not an IP literal (the WHATWG parser canonicalises every IPv4 form, including `2130706433` and
     `0x7f.1`, to dotted decimal, so reject `/^\d{1,3}(\.\d{1,3}){3}$/` and any `[`…`]` IPv6 host); at least one dot; the
     last label contains a letter; the hostname is not, and does not end with `.` + any of, the closed list
     `localhost, local, localdomain, internal, intranet, lan, home, home.arpa, corp, private`. Normalised value:
     `` `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}` `` (lower-case host, punycode, default port
     dropped). The ≤ 200 check is applied again to the normalised value. A path is allowed (e.g. `/v1`) and an explicit
     non-default port is allowed.
   - **list:** `run([select "id","name","base_url" from "ai_custom_providers" order by "id"])`. A row is returned only if
     its name passes validation **and** `validateCustomProviderBaseUrl(base_url)` passes and equals the stored value
     (defence in depth against a row edited by hand). On `describeLoadError(error).code === "42P01"` return `[]` without
     logging (same as `ai_provider_keys`, DEC-019 §3; `/health` already names the missing table because `schemaTableNames`
     reads schema.ts). Any other error propagates.
   - **add:** validate (invalid → no `run`), then one statement
     `insert into "ai_custom_providers" ("name","base_url") select ${name}::text, ${url}::text where (select count(*) from "ai_custom_providers") < ${CUSTOM_PROVIDER_MAX}::int returning "id"`.
     No row returned → `limit_reached`; otherwise `{ ok: true, id: customProviderId(id), keyRemoved: false }`.
   - **update:** parse id (invalid → `not_found`, no `run`), validate name and URL, then read the current `base_url`
     (`run([select … where "id" = $n])`; none → `not_found`). `urlChanged = current !== url` compares normalised values.
     Then **one** `run` call: `urlChanged ? [deps.clearKeyStatement(id), update] : [update]`, where `update` is
     `update "ai_custom_providers" set "name" = …, "base_url" = … where "id" = … returning "id"` (no row → `not_found`).
     Result `{ ok: true, id, keyRemoved: urlChanged }`.
   - **delete:** parse id, then one `run([deps.clearKeyStatement(id), delete from "ai_custom_providers" where "id" = … returning "id"])`;
     no row → `not_found`. Settings are not touched (D-2).
4. **`lib/config/ai-keys.ts`** (changed; still the only `lib/config` importer of key-store):
   - `AiKeyProvider` gains `readonly baseUrl?: string`. `AiKeyConfigDeps.writeEncrypted` becomes
     `(providerId: string, plaintext: string, baseUrl?: string) => Promise<void>`. It gains an optional
     `loadCustomProviders?: () => Promise<readonly { id: string; baseUrl: string }[]>`.
   - `findKeyProvider` becomes async: static `deps.providers` first (unchanged); otherwise, if `isCustomProviderId(id)` and
     `deps.loadCustomProviders` is set, the matching custom → `{ id, requiresApiKey: true, baseUrl }`; otherwise `unknown_provider`.
   - `saveProviderKey` calls `deps.writeEncrypted(id, key)` (**two arguments**, so AK-1 stays byte-identical) for a preset
     and `deps.writeEncrypted(id, key, baseUrl)` for a custom provider. `clearProviderKey` is unchanged apart from the async lookup.
   - The default `writeEncrypted` in `createAiKeyConfigDeps` becomes
     `(id, plaintext, baseUrl) => writeStoredProviderKey(db, id, plaintext, undefined, undefined, baseUrl ?? null)`.
   - New `export function createCustomProviderConfigDeps(db: Db): CustomProviderConfigDeps` returns
     `{ db, run: neonBatchRunner(db), clearKeyStatement: (id) => buildClearStoredProviderKeyStatement(db, id) }`. This is
     the only place the key-delete statement is wired into the custom-provider config (T-1). It imports `./custom-providers`
     (allowed by config BC-1) and `../ingestion/store`.
5. **`lib/config/ai-settings.ts`** (changed): `AiSettingsDeps` gains an optional
   `loadCustomProviderIds?: () => Promise<readonly string[]>`. `setAiSettings` normalises the provider as today. A
   non-null value not in `providerIds` is accepted only if `deps.loadCustomProviderIds` exists and its result includes it;
   otherwise `unknown_provider`. Non-string input still gives `unknown_provider`. The lookup is called only for a
   non-preset id.
6. **`lib/ai/providers/resolve.ts`** (changed, still pure and synchronous): the input gains an optional
   `customProvider?: AiProvider | null`. When the trimmed `settings.provider` equals `customProvider.id`, the descriptor is
   `{ requiresApiKey: true }` and the adapter is `customProvider`, and the rest of the check order is unchanged
   (`no_api_key`, then `no_model`). Otherwise the behaviour is byte-identical to today.
7. **`lib/ai/providers/openai-compatible.ts`** (changed): `export function customChatCompletionsUrl(baseUrl: string): string`
   returns `` `${baseUrl.replace(/\/+$/, "")}/chat/completions` ``. It adds **no** `https://` literal, comments included (PS-2), and
   no `searchParams` (LB-8). The custom adapter uses the default `max_tokens` field and JSON mode (T-10).
8. **`lib/ai/provider-deps.ts`** (changed; still the only wiring module):
   - `ProviderDeps` gains an optional `loadCustomProviders?: () => Promise<readonly CustomProvider[]>`. `loadStoredKeys`
     becomes `(customProviders?: readonly CustomProvider[]) => Promise<ReadonlyMap<string, StoredProviderKey>>`, which
     still accepts the existing `async () => …` fakes.
   - `loadStoredProviderKeys(db, reader = readStoredProviderKey, customProviders: readonly CustomProvider[] = [])`:
     the catalogue loop is unchanged, then a private `readCustomProviderKeys` loop calls `reader(db, c.id, undefined, c.baseUrl)`,
     with the same per-provider catch, 42P01 silence and `logLoadError(\`ai/provider-key/${id}\`, error)`.
   - `resolveFromDeps`: `loadSettings`. If `isCustomProviderId(settings.provider?.trim())` and `deps.loadCustomProviders`
     is set, it loads the list and finds the match (`custom`). It then calls `deps.loadStoredKeys()` with **no argument**
     when there is no custom (so PD-8's order and call shape stay as they are) or `deps.loadStoredKeys([custom])` when
     there is one. `customProvider = custom && createOpenAiCompatibleProvider({ id: custom.id, chatCompletionsUrl: customChatCompletionsUrl(custom.baseUrl) })`.
     `readApiKey: (id) => storedKeys.get(id)?.key ?? (isCustomProviderId(id) ? null : deps.readApiKey(id))`: a custom
     provider uses stored keys only (DEC-026 §2) and never gets an env or preset key.
   - New key-free projection
     `export type CustomProviderView = { id: string; name: string; baseUrl: string; keySet: boolean; updatedAt: string | null }`
     and `export async function getCustomProviderViews(options?: { db?: Db; list?: () => Promise<readonly CustomProvider[]>; reader?: StoredProviderKeyReader }): Promise<{ status: "ok"; providers: readonly CustomProviderView[] } | { status: "error" }>`.
     It lists the providers, reads only their keys (URL-bound), and builds each view field by field (never spreading a
     stored key). A failure gives `logLoadError("ai/custom-providers", error)` and `{ status: "error" }`. Its defaults are
     `getDb()` and `listCustomProviders(createCustomProviderConfigDeps(db))`.
   - `createProviderDeps()` gains `loadCustomProviders: () => listCustomProviders(createCustomProviderConfigDeps(getDb()))`
     and `loadStoredKeys: (customs) => loadStoredProviderKeys(getDb(), readStoredProviderKey, customs ?? [])`.
   - New imports: `../config/custom-providers` (needs the one LB-2 allowlist line, §3 item 3) and
     `./providers/openai-compatible` (already allowed). The existing `../config/ai-keys` and `./key-store` imports are allowed.
9. **`lib/ai/settings-deps.ts`** (changed): `createAiSettingsDeps(db)` adds
   `loadCustomProviderIds: async () => (await listCustomProviders({ db, run })).map((c) => c.id)`.
   `createProviderKeyConfigDeps(db)` adds `loadCustomProviders: () => listCustomProviders({ db, run: neonBatchRunner(db) })`.
   This file adds no key-store import (LB-10) and does not mention `fetch` (LB-2-fetch).
10. **`app/admin/ai/result-messages.ts`** (changed): `customProviderResultToState(result, operation: "add" | "update" | "delete")`.
    ok → `customProviderAdded` / (`keyRemoved` ? `customProviderUpdatedKeyRemoved` : `customProviderUpdated`) /
    `customProviderDeleted`. Errors → `customProviderInvalidName`, `customProviderInvalidUrl`,
    `customProviderLimitReached`, `customProviderNotFound`.
11. **`app/admin/ai/actions.ts`** (changed): `addCustomProviderAction` (reads `name`, `baseUrl`),
    `updateCustomProviderAction` (reads `id`, `name`, `baseUrl`) and `deleteCustomProviderAction` (reads `id`). A missing or
    non-string field → `INVALID_REQUEST` with no deps built. Each calls `runAdminAction(() => …(input, createCustomProviderConfigDeps(getDb())), toState, ok ? ["/admin/ai"] : [])`.
    The add action calls `addCustomProvider`, which needs only `db`/`run`, from the same deps. Imports come only from
    `@/lib/config/custom-providers`, `@/lib/config/ai-keys` and `@/lib/db` (all allowed). No SQL text. The existing
    `saveProviderKeyAction`/`clearProviderKeyAction` serve custom ids unchanged, through the new `loadCustomProviders` in
    `createProviderKeyConfigDeps`.
12. **`components/admin/CustomProvidersAdmin.tsx`** (new, server component like `AiSettingsAdmin`). Props:
    `{ customProviders: { status: "ok"; providers: readonly CustomProviderView[] } | { status: "error" }; storageEnabled: boolean; addAction; updateAction; deleteAction; saveProviderKeyAction; clearProviderKeyAction }`
    (all `AdminAction`; `CustomProviderView` is a **type-only** import from `@/lib/ai/provider-deps`, the same as
    `AiSettingsAdmin`'s `ProviderKeyStatusView`). It renders:
    - a heading and intro: OpenAI-compatible only; https address without `/chat/completions`; stored key only, never an
      environment variable; the key is bound to the address; at most 5;
    - per provider: the name, the address in `<code>`, the key status (`data-custom-key-status="set|not-set"`), an edit
      `ActionForm` (hidden `id`, `name` text `maxLength` 40, `baseUrl` `type="url"` `maxLength` 200, both prefilled with
      `defaultValue`) with the warning "Changing the address deletes this provider's stored key", and a delete
      `ActionForm` (hidden `id`). When `storageEnabled`: `ProviderKeySaveForm` (providerId = custom id) and, if
      `keySet`, a "Clear stored key" `ActionForm`. Otherwise a note that custom providers need stored keys, which are not enabled;
    - an add `ActionForm` (`name`, `baseUrl`, the same limits) while `providers.length < CUSTOM_PROVIDER_MAX`, otherwise the limit note;
    - on `status: "error"`, `role="alert"` load-error text and no forms.
    Constants come from `@/lib/config/custom-providers` (the same pattern as `AiProviderModelFields` importing
    `AI_MODEL_MAX_LENGTH` from `@/lib/config/ai-settings`).
13. **`app/admin/ai/page.tsx`** (changed): add `getCustomProviderViews()` to the `Promise.all`. The selector gets
    `providers = [...presets, ...(custom ok ? custom.providers.map(({ id, name }) => ({ id, name, modelSuggestions: [] })) : [])]`
    (D-3: name as typed, no suggestions). Render `<div className="flex flex-col gap-6"><AiSettingsAdmin …/><CustomProvidersAdmin …/></div>`.
    `AiSettingsAdmin.tsx` and its test stay **unchanged**. A stored custom id now resolves to a selectable option. If the
    list fails to load, the existing `unknownStoredProvider` notice shows.
14. **`messages/en.json`, `messages/ro.json`** (both locales, same keys). `Admin.ai.custom*` keys are: `customHeading`,
    `customIntro`, `customNameLabel`, `customUrlLabel`, `customUrlHint`, `customAddSubmit`, `customUpdateSubmit`,
    `customDeleteSubmit`, `customUrlChangeWarning`, `customLimitNote`, `customLoadError`, `customKeySet`,
    `customKeyNotSet`, `customStorageDisabled`, `customEmpty`. `Admin.messages.customProvider*` keys are the 8 from
    step 10. The wording is the D-3 default. EN examples: warning "Changing the address deletes this provider's stored
    key; you will need to enter it again."; `customProviderUpdatedKeyRemoved` "Saved. The address changed, so the stored
    key for this provider was deleted."; `customProviderInvalidUrl` "Enter an https address with no user name, password,
    query or fragment, not an IP address or a local/private host name, at most 200 characters."; `customProviderLimitReached`
    "You can add at most 5 providers of your own." The RO texts are translations of the same.
15. **`dev_minions/architecture/data-model.md`** (changed): add an `ai_custom_providers` table section. Add write rules:
    `lib/config/custom-providers.ts` alone reads and writes it; changing or deleting a provider's address deletes that
    provider's stored key in the same atomic batch (the statement is built by `lib/ai/key-store.ts`); a custom provider's
    key AAD binds the provider id and the base URL; a missing table (`42P01`) reads as no custom providers. Add a new
    **DM-CP-1** to `test/data-model-doc.test.ts` pinning these phrases (an addition).
16. **`README.md`** (changed): one "Administration" sentence: `/admin/ai` can add up to 5 of your own OpenAI-compatible
    providers (name + https address). Their keys are stored only in the app, bound to the address, and deleted when the
    address changes. Add no new `*_API_KEY` token (RM-1).

**Boundaries this design keeps:**
- All `ai_custom_providers` SQL lives in `lib/config/custom-providers.ts`, and all SQL about stored keys lives in key-store
  (CB-3, LB-11). The one cross-table batch is put together in config from an injected statement built by key-store. The
  only wiring that touches key-store is `lib/config/ai-keys.ts` (an approved importer, LB-10).
- `lib/config/*` never imports `lib/ai` except the existing `ai-keys.ts → ../ai/key-store` (DEC-016 §1).
- `app/` and `components/` get key-free views only (`CustomProviderView` has `keySet`/`updatedAt`, never a key). Actions
  import only allowed prefixes and contain no SQL.
- A custom endpoint is chosen only from a validated stored row. The provider settings form (`provider`/`model`) still
  accepts no URL (AA-2, PMF-5 and TC-1 unchanged). The URL is entered only in the custom-provider forms, whose key cannot
  outlive a URL change (DEC-026 §2 amends DEC-021 §8).

## 3. Test changes

**New test files (additions only):**
- `lib/config/custom-providers.test.ts`
  - **CPV-1** `it.each` over `validateCustomProviderBaseUrl`.
    - Accept: `https://api.example.com/v1`; `https://api.example.com/v1/`; `  https://API.Example.com/openai/v1  `;
      `https://llm.example.co.uk`; `https://api.example.com:8443/v1`.
    - Reject (scheme/form): `http://api.example.com/v1`; `ftp://api.example.com`; `javascript:alert(1)`;
      `api.example.com/v1`; `https:///v1`; `https://api.exa mple.com`; `""`; `"   "`; `null`; `42`.
    - Reject (credentials): `https://user:pass@api.example.com/v1`; `https://user@api.example.com`.
    - Reject (query/fragment): `https://api.example.com/v1?x=1`; `https://api.example.com/v1?`;
      `https://api.example.com/v1#f`; `https://api.example.com/v1#`.
    - Reject (IP literals): `https://127.0.0.1/v1`; `https://10.0.0.5`; `https://192.168.1.10`; `https://169.254.169.254`;
      `https://2130706433/`; `https://0x7f.0.0.1/`; `https://[::1]/v1`; `https://[2001:db8::1]/`.
    - Reject (private names): `https://localhost/v1`; `https://localhost./v1`; `https://api.localhost`;
      `https://printer.local`; `https://llm.internal/v1`; `https://router.lan`; `https://nas.home.arpa`;
      `https://box.corp`; `https://intranet/v1`; `https://api.example.com./v1`.
    - Reject (length): 201 chars.
  - **CPV-2** normalised outputs, e.g. `https://API.Example.com:443/v1//` → `https://api.example.com/v1`.
  - **CPV-3** exactly 200 chars accepted and 201 rejected.
  - **CPV-4** name table: `"Groq"` ok; `"  My LLM  "` → `"My LLM"`; `""`, 41 chars, `"a\u0007b"` and non-string rejected.
  - **CPV-5** `isCustomProviderId`/`customProviderId`: `custom-1` ok; `custom-0`, `custom-`, `custom-1x`, `gemini` and
    `Custom-1` rejected; no `PROVIDER_IDS` entry matches (imported in the test only).
  - **CPC-1** add over a fake runner (statement count 1; `limit_reached` when the runner returns no row).
  - **CPC-2** a URL change gives one `run` call with 2 statements: the first is `deps.clearKeyStatement("custom-3")`'s
    return value (identity check), the second the update.
  - **CPC-3** a name-only edit, or a URL differing only by case/trailing slash, gives 1 statement and `keyRemoved: false`.
  - **CPC-4** delete gives one `run` with 2 statements, the first the key delete.
  - **CPC-5** invalid id/name/url never calls `run` or `clearKeyStatement`.
  - **CPC-6** a non-42P01 list failure propagates, and a 42P01 failure returns `[]` with no console output.
- `lib/config/custom-providers.pglite.test.ts`: uses `mockDb`/`runner` and `pgliteDb(pg)` for key-store reads/writes with
  fake material `{ source: "master", key: new Uint8Array(32).fill(57) }`.
  - **CPP-1** add then list (order, ids `custom-<n>`, normalised URL).
  - **CPP-2** the 6th add → `limit_reached` and the count stays 5; after one delete, an add succeeds.
  - **CPP-3** URL change deletes the key row.
  - **CPP-4** atomic rollback with a failing appended statement.
  - **CPP-5** name-only edit keeps the key and it decrypts.
  - **CPP-6** delete removes row and key.
  - **CPP-7** `drop table "ai_custom_providers"` → `listCustomProviders` returns `[]` and `addCustomProvider` rejects.
  - **CPP-8** a row with `base_url` set by hand to `https://localhost/v1` is not listed.
  - **CPP-9** update/delete of an unknown id → `not_found`, other rows untouched.
- `lib/config/custom-providers.boundary.test.ts` **CPB-1/CPB-2** (§1 AC5).
- `lib/config/ai-keys.custom.test.ts`
  - **AKC-1** a custom id found by `loadCustomProviders` → `writeEncrypted(id, key, baseUrl)`.
  - **AKC-2** a custom id not in the list → `unknown_provider`, no write.
  - **AKC-3** without `loadCustomProviders` → `unknown_provider`.
  - **AKC-4** a preset is still called with exactly 2 arguments.
  - **AKC-5** clear works for an existing custom id.
  - **AKC-6** the sentinel key is absent from every result.
  - **AKC-P1** (PGlite, same file or `.pglite.test.ts`): `createAiKeyConfigDeps` with a URL-bound fake write and
    `loadCustomProviders` saves a key that `readStoredProviderKey(…, baseUrl)` returns.
- `lib/config/ai-settings.custom.test.ts`
  - **ASC-1** a custom id is accepted when `loadCustomProviderIds` includes it.
  - **ASC-2** otherwise `unknown_provider` and no `run`.
  - **ASC-3** a preset id never calls `loadCustomProviderIds`.
- `lib/ai/key-binding.test.ts` **KB-1..KB-4** and `lib/ai/key-binding.pglite.test.ts` **KB-P1** (§1 AC3).
- `lib/ai/providers/resolve.custom.test.ts`
  - **RSC-1** a matching `customProvider` → ok with that adapter.
  - **RSC-2** no key → `no_api_key`.
  - **RSC-3** no model → `no_model`.
  - **RSC-4** settings name a custom id but `customProvider` is null or has a different id → `unknown_provider`.
  - **RSC-5** preset resolution is identical with `customProvider` set.
- `lib/ai/provider-deps.custom.test.ts`
  - **PDX-1** custom selected: `loadCustomProviders` called once, `loadStoredKeys` called with `[custom]`, the adapter
    posts once to `<base>/chat/completions`.
  - **PDX-2** a preset is selected: `loadCustomProviders` is never called and `loadStoredKeys` gets no argument.
  - **PDX-3** custom with no stored key but `readApiKey` returning an env sentinel → `no_api_key`, sentinel never used.
  - **PDX-4** a custom id that is not listed → `unknown_provider`.
  - **PDX-5** a `loadCustomProviders` rejection propagates and no request is made.
  - **PDX-6** `getCustomProviderViews` builds key-free views (sentinel absent from the JSON); a failure →
    `{ status: "error" }` plus one sanitised log line without the sentinel.
  - **PDX-7** `loadStoredProviderKeys` with customs reads a custom key only with its URL (a fake reader records the 4th argument).
- `lib/ai/custom-provider.pglite.test.ts` **CPE-1..CPE-4** (§1 AC4).
- `app/admin/ai/custom-provider-actions.test.ts` (its own `vi.mock`s of `@/lib/db`, `@/lib/config/custom-providers` and
  `@/lib/config/ai-keys` `createCustomProviderConfigDeps`, `next/cache`):
  - **CPA-1** add passes exactly `{ name, baseUrl }` and revalidates `/admin/ai` on ok.
  - **CPA-2** update passes `{ id, name, baseUrl }`; `keyRemoved` → `customProviderUpdatedKeyRemoved`.
  - **CPA-3** delete passes the id only.
  - **CPA-4** a missing field → `invalidRequest`, no deps built.
  - **CPA-5** a rejection with a `postgres://…SENTINEL` message → `genericError`, sentinel absent.
  - **CPA-6** an extra `key`/`apiKey` form field is never forwarded.
- `components/admin/CustomProvidersAdmin.test.tsx`
  - **CPU-1** RO/EN render of the heading, a provider's name/URL/key status, and the edit/delete/add forms with
    `maxLength`s and `type="url"`.
  - **CPU-2** storage disabled → no password input, note shown.
  - **CPU-3** 5 providers → no add form, limit note.
  - **CPU-4** error → alert, no forms.
  - **CPU-5** the warning text is present on each edit form.
  - **CPU-6** no `value=` on any password input and no key text.

**Additions to existing test files (no existing assertion changed):**
- `lib/ai/providers/openai-compatible.test.ts` **OC-3**: `customChatCompletionsUrl("https://a.example.com/v1")` and
  `("https://a.example.com/v1/")` both → `…/v1/chat/completions`.
- `app/admin/ai/result-messages.test.ts` **RM-CP1/RM-CP2**: every result → its exact state.
- `components/admin/ActionMessage.test.tsx` **AM-6**: RO/EN render `customProviderUpdatedKeyRemoved` and `customProviderInvalidUrl`.
- `app/admin/ai/page.test.tsx`:
  - **PA-C1** RO/EN: a custom view renders in the selector (as an option) and in the custom section, with no key text.
  - **PA-C2** custom load error → alert in the section, rest of page intact.
  - **PA-C3** a stored custom provider id selects that option with no unknown-provider notice.
- `lib/db/schema.test.ts` **SC-CP** (columns and both checks) and **MG-3** (§1 AC5).
- `test/helpers/pglite.migrations.test.ts` **PM-6**.
- `test/data-model-doc.test.ts` **DM-CP-1**.

**Deliberate test changes (copy into HANDOVER with these reasons):**
1. `lib/db/schema.test.ts` "exposes exactly the thirteen table exports": → fourteen, adding `aiCustomProviders`.
   Reason: DEC-026 §2 adds the table. The exactness of the check is kept.
2. `lib/db/schema.test.ts` MG-1: `toHaveLength(5)` → `6`, plus `entries[5].tag === "0005_ai_custom_providers"`. Reason:
   the new migration. Order and file-existence checks are kept.
3. `lib/ai/boundaries.test.ts` LB-2 `ALLOWED_TARGETS` gains `"lib/config/custom-providers"`. Reason: `provider-deps.ts`
   and `settings-deps.ts` must list custom providers to resolve and validate them (DEC-026 §2). It is a `lib/config` module
   with no key material, the same kind of target as the already-allowed `lib/config/ai-settings`/`ai-keys`. Every other
   LB rule is unchanged.
4. `app/admin/ai/page.test.tsx` mock factories: `vi.mock("@/lib/ai/provider-deps")` gains
   `getCustomProviderViews: async () => mockCustomViews` (default `{ status: "ok", providers: [] }`), and `vi.mock("./actions")`
   gains `addCustomProviderAction`, `updateCustomProviderAction` and `deleteCustomProviderAction: vi.fn()`. Reason: the
   page now uses them, and vitest throws on access to an export missing from a factory mock. No assertion changes.
5. `app/admin/ai/page.test.tsx` PA-4: the expected input-name set `{provider, model, providerId, key}` →
   `{provider, model, providerId, key, name, baseUrl}`, **plus** a new scoped assertion that the `<form>` containing
   `name="provider"` contains no `baseUrl`/`url`/`endpoint` input. Reason: DEC-026 §2 (amending DEC-021 §8) adds the
   custom-provider add form, which is outside the provider/model form. The protection PA-4 stood for (no URL on the form
   that selects which key is sent) is kept, more precisely, by the scoped assertion, AA-2 and PMF-5 (unchanged). The
   password/autocomplete/no-value checks are unchanged.

**Must stay byte-identical** (if one must change, stop and record why; that is a design error here, not a test to edit):
`lib/ai/key-store.test.ts`, `lib/ai/key-store.pglite.test.ts`, `lib/config/ai-keys.test.ts`,
`lib/config/ai-keys.pglite.test.ts`, `lib/config/ai-settings.test.ts`, `lib/config/ai-settings.pglite.test.ts`,
`lib/ai/provider-deps.test.ts`, `lib/ai/provider-deps.pglite.test.ts`, `lib/ai/provider-deps.interchange.test.ts`,
`lib/ai/providers/resolve.test.ts`, `lib/ai/providers/registry.test.ts`, `lib/ai/providers/presets.test.ts`,
`lib/ai/provider-presets.pglite.test.ts`, `lib/ai/connection-test.test.ts`, `lib/ai/chat*.test.ts`,
`lib/ai/capabilities/boundaries.test.ts`, `lib/config/boundaries.test.ts`, `app/actions.boundary.test.ts`,
`app/admin/ai/actions.test.ts`, `components/admin/AiSettingsAdmin.test.tsx`,
`components/admin/AiProviderModelFields.test.tsx`, `lib/deploy/migrate.test.ts`, `lib/health*.test.ts`.

## 4. Data model change and migration
- New table `ai_custom_providers` (`id` serial PK, `name` text NOT NULL, `base_url` text NOT NULL, `created_at` timestamptz
  NOT NULL default now(), checks `ai_custom_providers_name_length` and `ai_custom_providers_base_url_https`).
  `ai_provider_keys` is unchanged; a custom provider's key row uses `provider_id = 'custom-<id>'`.
- Generate locally with `DATABASE_URL` unset: `pnpm db:generate --name ai_custom_providers` gives
  `drizzle/0005_ai_custom_providers.sql`, `drizzle/meta/0005_snapshot.json` and an updated `_journal.json`. If the
  `--name` flag is not passed through, rename the generated tag consistently in the file name and journal, as was done
  for `0004_etf_widgets`. Then rerun `pnpm db:generate` to confirm "No schema changes". The SQL must be one
  `CREATE TABLE` with its two `CHECK`s and nothing else (expand-only, DEC-023 §4; MD-G10/MG-3 prove it).
- **Never** run `db:migrate`, `drizzle-kit migrate` or `scripts/migrate-on-deploy.ts` against a real database. The
  production build applies the migration (DEC-023). Until then, a missing table reads as "no custom providers" (42P01),
  writes fail closed (`genericError`), and `/health` names the table (automatic through `schemaTableNames`).

## 5. Risks and settled technical choices
Smallest design: one table plus one config module, one AAD helper and one statement builder in key-store, one optional
resolution input, and one UI section. It is extensible only where DEC-026 asks for it (more custom rows, up to 5).

- **T-1 (settled) Module placement and the "same batch".** CB-3/LB-11 allow `ai_provider_keys` SQL only in key-store,
  and the config boundary allows a `lib/ai` import only from `ai-keys.ts`. So key-store exposes
  `buildClearStoredProviderKeyStatement`, `lib/config/custom-providers.ts` takes it as the injected `clearKeyStatement`,
  and `lib/config/ai-keys.ts` `createCustomProviderConfigDeps` wires the two together. One `deps.run([...])` call makes
  one Neon `db.batch` transaction. Rejected: custom SQL in key-store (it would widen the key-material module);
  `ai_custom_providers` SQL in lib/ai (breaks CB-3); a second key-store importer (breaks LB-10).
- **T-2 (settled) Ids** are `custom-<serial>`. A serial id is never reused, so a deleted provider's id still left in
  `settings` can never silently point at a later provider. The prefix cannot collide with catalogue ids (CPV-5).
- **T-3 (settled) AAD** is `providerId` for presets (unchanged, so existing rows decrypt) and `` `${providerId}\n${baseUrl}` ``
  for custom providers. A validated URL cannot contain a newline, and preset ids contain none, so the two forms never collide.
- **T-4 (settled) URL rules**, exactly as in §2 step 3. Checks are lexical, on the WHATWG-normalised URL. IP literals of
  every form are rejected, and any host that is not a public domain name is refused. The private-name suffix list is
  closed and lives in code.
- **T-5 (settled) Detecting a change:** read, then batch, comparing normalised values. A concurrent change between the
  read and the batch cannot leak a key, because the AAD binds the key to the URL it was saved for (CPE-4 proves this).
  The same AAD argument covers a key saved concurrently with a URL change.
- **T-6 (settled) Resolution:** custom providers are loaded only when the saved provider is a custom id, so preset users
  never touch the new table and PD-8's order and call shape are unchanged. The custom adapter is built per resolution
  from the validated row. Custom providers use stored keys only.
- **T-7 (settled) Max 5:** a conditional single-statement insert. Two exactly simultaneous adds could, in theory, both
  pass at 4. This is not guarded (one admin, no login, no harm beyond a 6th row, which `list` still returns). It is noted
  for the audit.
- **T-8 (settled) Missing table:** reads give `[]` silently, the same as `ai_provider_keys`. `/health` reports the table.
  Writes fail closed through `runAdminAction`.
- **T-9 (settled) Migration naming:** `0005_ai_custom_providers`, generated by drizzle-kit, with CHECK constraints for
  name length, https and URL length as defence in depth.
- **T-10 (settled) Request shape:** the custom adapter uses the shared factory defaults (`max_tokens`, JSON mode with
  `response_format: json_object`) and `redirect: "error"` from `http.ts`. A server that rejects JSON mode shows up as
  `provider_error` in Test connection (closed code, no raw text).
- **T-11 (settled) UI placement:** a separate `CustomProvidersAdmin` section rendered by the page, so `AiSettingsAdmin`
  and its tests stay unchanged.

**Other risks:**
- **R1 SSRF / DNS:** hostname checks are lexical. A public name that resolves to a private IP is not detected
  (DNS rebinding). Mitigations: Vercel functions have no route to the user's private network; `redirect: "error"` blocks
  redirect-based bypasses; only https; the only data sent is the prompt (ETF configuration context) and the custom
  provider's own key. DEC-026 accepted the residual risk.
- **R2 Quota and abuse** are the same exposure as presets (accepted, requirements §6, DEC-021).
- **R3 Live correctness:** whether a given vendor's base URL plus `/chat/completions` and JSON mode work can only be
  shown live (M-2). Test connection reports a closed code.
- **R4 Number of stored-key reads:** unchanged for presets. A custom resolution adds one list query and one key read.
- **R5 Name confusion:** a custom provider can be named like a preset (D-1 default). Keys are bound per id and URL, so a
  preset key is never sent to a custom URL (PDX-3).
- **R6 LB-11/PS-2 tripwires:** no new non-test file may contain the text `ai_provider_keys` (except key-store), and
  `openai-compatible.ts` may gain no `https://` text. Implementers must check comments too.

## 6. Decisions needed
| # | Type | Question | Options | Recommendation | Isolated default? |
|---|---|---|---|---|---|
| T-1..T-11 | TECHNICAL | see §5 | — | settled in this plan | n/a (not open) |
| D-1 | PRODUCT | Must custom-provider names be unique, or differ from preset names? (DEC-026 sets only ≤ 40 chars) | (a) no uniqueness rule (literal reading); (b) reject a name equal (case-insensitive) to a preset or another custom provider | (a) | **Yes.** Confined to `validateCustomProviderName` in `lib/config/custom-providers.ts`: no uniqueness check. PO to confirm at demo. |
| D-2 | PRODUCT | Deleting the custom provider that is currently selected: also clear the selection? | (a) leave `settings` as they are; the existing "stored provider is no longer in the supported list" notice and the chat's `unknown_provider` reply apply (literal reading: the story deletes the row and its key only); (b) clear `ai_provider`/`ai_model` in the same batch | (a) | **Yes.** Confined to `deleteCustomProvider` (no settings statement). PO to confirm at demo. |
| D-3 | PRODUCT | Wording and placement: section "Your own providers" below the key table; the custom name shown as typed in the selector, with no model suggestions; RO/EN texts of §2 step 14 | (a) as in §2; (b) PO wording | (a) | **Yes.** Confined to `CustomProvidersAdmin.tsx`, the `Admin.ai.custom*`/`Admin.messages.customProvider*` keys, and the `providers` mapping in `app/admin/ai/page.tsx`. PO to confirm at demo. |

None blocks the story. No new DEC file is needed: DEC-026 §2 is the binding decision, and the choices above do not bind
beyond this story.

## 7. Out of scope (story + DEC-026)
New widget operations; model-generated code; keys in chat (the refusal is unchanged); environment-variable keys for
custom providers; model discovery or suggestions for custom providers; non-OpenAI-compatible custom APIs (Gemini-style);
custom request headers; per-vendor error-body rules; re-encrypting old keys; any login.

## 8. Files changed (expected)
- **New (source):** `lib/config/custom-providers.ts`, `components/admin/CustomProvidersAdmin.tsx`
- **New (migration, generated):** `drizzle/0005_ai_custom_providers.sql`, `drizzle/meta/0005_snapshot.json`
- **Changed (source):** `lib/db/schema.ts`, `drizzle/meta/_journal.json`, `lib/ai/key-store.ts`, `lib/config/ai-keys.ts`,
  `lib/config/ai-settings.ts`, `lib/ai/providers/resolve.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/provider-deps.ts`, `lib/ai/settings-deps.ts`, `app/admin/ai/result-messages.ts`, `app/admin/ai/actions.ts`,
  `app/admin/ai/page.tsx`, `messages/en.json`, `messages/ro.json`
- **Changed (docs):** `dev_minions/architecture/data-model.md`, `README.md`
- **New (tests):** `lib/config/custom-providers.test.ts`, `lib/config/custom-providers.pglite.test.ts`,
  `lib/config/custom-providers.boundary.test.ts`, `lib/config/ai-keys.custom.test.ts`, `lib/config/ai-settings.custom.test.ts`,
  `lib/ai/key-binding.test.ts`, `lib/ai/key-binding.pglite.test.ts`, `lib/ai/providers/resolve.custom.test.ts`,
  `lib/ai/provider-deps.custom.test.ts`, `lib/ai/custom-provider.pglite.test.ts`,
  `app/admin/ai/custom-provider-actions.test.ts`, `components/admin/CustomProvidersAdmin.test.tsx`
- **Changed (tests, additions):** `lib/ai/providers/openai-compatible.test.ts` (OC-3), `app/admin/ai/result-messages.test.ts`
  (RM-CP1/2), `components/admin/ActionMessage.test.tsx` (AM-6), `app/admin/ai/page.test.tsx` (PA-C1..C3),
  `lib/db/schema.test.ts` (SC-CP, MG-3), `test/helpers/pglite.migrations.test.ts` (PM-6), `test/data-model-doc.test.ts` (DM-CP-1)
- **Deliberate test changes:** §3 items 1-5
- **Not touched:** every file listed as byte-identical in §3; `components/admin/AiSettingsAdmin.tsx`,
  `components/admin/AiProviderModelFields.tsx`, `lib/ai/key-status.ts`, `lib/ai/provider-catalog.ts`,
  `lib/ai/providers/default-registry.ts`, `lib/ai/providers/http.ts`, `lib/ai/connection-test.ts`, `lib/ai/chat.ts`,
  `.env.example`, `package.json`, lockfile
