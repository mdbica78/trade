# US-056 plan — More provider presets, stronger model suggestions, test connection
_Planner: story-planner, 2026-10-06. Sources: `backlog/stories/US-056.md` (ACs confirmed by the PO 2026-10-05),
`decisions/DEC-026-more-ai-providers.md` §1/§3/§4/§5, `backlog/sprints/sprint-13.md` (PO review: roster confirmed,
Test connection confirmed), DEC-017 §2-§4, DEC-021 §5/§8 (amended by DEC-026), DEC-015, DEC-023, AGENTS.md._

**Not blocked.** Every TECHNICAL choice is settled below (§5, T-1..T-7). The two PRODUCT items ship their isolated
defaults (literal reading) in code named here. No schema change, no migration, no new dependency.

---

## 0. What exists today (read before coding)
- `lib/ai/provider-catalog.ts` — zero-import catalogue (LB-1), 2 entries (gemini, groq). Drives the key table
  (`key-status.ts` `getKeyStatuses`), env-key lookup (`readApiKey`), stored-key reads (`provider-deps.ts`
  `loadStoredProviderKeys` loops the catalogue), the allowed ids for settings (`settings-deps.ts`), the key-save
  config (`createProviderKeyConfigDeps`), the `/admin/ai` selector and `.env.example`/README guard tests.
- `lib/ai/providers/openai-compatible.ts` — `createOpenAiCompatibleProvider({ id, chatCompletionsUrl, errorBodyRule? })`;
  body `{ model, messages, max_tokens, response_format? }`; `groq.ts` uses it with a fixed URL constant.
- `lib/ai/providers/default-registry.ts` — `SHIPPED_PROVIDER_ADAPTERS = [gemini, groq]`; registry construction throws
  on an id missing from the catalogue; PR-5 pins `SHIPPED_PROVIDER_ADAPTERS ids === PROVIDER_IDS` (the "existing pin
  test" of AC2).
- `lib/ai/provider-deps.ts` — `loadActiveProvider(deps)` (key-carrying, stored key wins over env, PD-8),
  `getAiAvailability` (key-free). `runGeneration` owns timeout (20 s), never throws, closed codes only.
- Because everything is catalogue-driven, **stored-key precedence, key status rows, key save/clear forms and the
  settings allow-list extend to the new presets automatically** once they are catalogue entries (AC4). No change to
  `key-status.ts`, `key-store.ts`, `lib/config/ai-keys.ts`, `provider-deps.ts`, `settings-deps.ts`, `resolve.ts`,
  `run-generation.ts`, `http.ts`, `gemini.ts`, `groq.ts`.

## 1. Acceptance criteria → proving tests

| AC | Restated | Proof |
|---|---|---|
| AC1 | `pnpm typecheck`, `pnpm lint`, `pnpm build` (offline), full `pnpm test`, `bash scripts/claude/predeploy-check.sh` pass; no behaviour test loosened; deliberate test changes listed in HANDOVER with reason | Gate runs by implementer and independent tester, with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/every `*_API_KEY` unset. §3 lists every deliberate test change; implementer copies it into HANDOVER. |
| AC2 | Catalogue and registry ids match (PR-5); each new preset's endpoint is a constant in code; no URL field in the form | **PR-5** (unchanged, now over 8 ids). **PC-1/PC-3** (deliberately updated, §3). New **PS-1** (each preset's URL constant: `https:`, no credentials, no query/fragment, hostname not an IP literal/localhost, path ends `/chat/completions`). **PS-2** (source scan: every `https://` literal in `openai-compatible.ts` is the value of an exported `*_CHAT_COMPLETIONS_URL` constant, exactly 6). **PS-3** (each preset adapter posts exactly once, to exactly its constant; a context carrying injected `baseUrl`/`url` members cannot redirect it — GQ-6 pattern). **IC-4** (settings alone select each preset's URL through the real registry). Form: **PA-4** unchanged (input names stay exactly `provider, model, providerId, key` — the new Test-connection form adds none), **PMF-5** unchanged, new **TC-1** (the action ignores every form field, including `baseUrl`). |
| AC3 | Test connection shows OK / the closed code with a fake fetch; never raw provider text or a key | New **CT-1..CT-8** (`lib/ai/connection-test.test.ts`, real default registry + real adapters + fake fetch; sentinel raw text and sentinel keys never appear in the result, result keys are exactly `ok`/`ok,code`). **TC-1..TC-3** (action → state). **RM-C1/RM-C2** (every closed code → `connectionFailed` + `values.code`). **AM-5** (ActionMessage renders OK / code in RO and EN). **TF-1/TF-2** (`app/admin/ai/test-connection.flow.test.tsx`: action → real `connection-test` → real adapter with fake fetch → rendered message in RO/EN; HTML contains the code, never the raw body sentinel or the key sentinel). **PA-14** (button + hint render RO/EN). **PA-13** (`maxDuration = 60` and `AI_PROVIDER_TIMEOUT_MS < maxDuration*1000`). |
| AC4 | Key boundary tests unchanged and green; stored-key precedence works for the new presets | `lib/ai/boundaries.test.ts` (LB-0..LB-11), `lib/ai/capabilities/boundaries.test.ts`, `lib/config/boundaries.test.ts`, `key-status.test.ts`, `key-store*.test.ts`, `lib/config/ai-keys*.test.ts`, `provider-deps*.test.ts` existing cases — **byte-identical** and green (design T-1/T-3 keeps them so). New **PP-1..PP-3** (`lib/ai/provider-presets.pglite.test.ts`): for each of the six new ids a stored encrypted fake key wins over a different env fake key in `loadActiveProvider` with the real default registry, and the adapter's request carries the stored key; `getProviderKeyStatusViews` shows `source: "stored"` for it and `environment` for the others; `saveProviderKey` accepts each new id through `createAiKeyConfigDeps(db, PROVIDER_CATALOG, true, fakeOps)`. **CT-5** (Test connection uses the stored key). |

MANUAL-QA (live provider, needs a real key the user enters himself in `/admin/ai`; never in a chat or test):
- **M-1** On the deployed app, save a real key for one new preset (e.g. OpenRouter or Cerebras free tier), select the
  preset and a suggested model, Save, click **Test connection** → "Connection OK". Change the model to a nonsense
  name, Save, Test → `model_not_found` (or `provider_error` for providers that answer 400). Replace the key with a
  wrong one → `auth_failed`. Page shows only these codes, never provider text.
- **M-2** Groq: select `openai/gpt-oss-120b` (first suggestion), Test connection → OK; then `/chat` with a US-053
  transcript phrase works (sanity only, not a criterion).
- **M-3** (optional, per preset the user has a key for) each of the six endpoints answers OK. Endpoint constants and
  model names are from vendor documentation and cannot be proven offline.

## 2. Files and boundaries

Implementation order (each step keeps typecheck green):

1. **`lib/ai/provider-catalog.ts`** (changed) — append six descriptors after gemini, groq, in this order (sprint-13 PO
   review order): `openai` "OpenAI" `OPENAI_API_KEY`; `openrouter` "OpenRouter" `OPENROUTER_API_KEY`; `mistral`
   "Mistral" `MISTRAL_API_KEY`; `deepseek` "DeepSeek" `DEEPSEEK_API_KEY`; `cerebras` "Cerebras" `CEREBRAS_API_KEY`;
   `together` "Together AI" `TOGETHER_API_KEY`. All `requiresApiKey: true`. Groq `modelSuggestions` reordered
   strongest-first: `["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"]`
   (DEC-026 §3). New presets' suggestions (D-1 isolated default, strongest-first, all static strings):
   - openai: `["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"]`
   - openrouter: `["openai/gpt-oss-120b", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat"]`
   - mistral: `["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"]`
   - deepseek: `["deepseek-chat"]`
   - cerebras: `["gpt-oss-120b", "llama-3.3-70b", "llama3.1-8b"]`
   - together: `["openai/gpt-oss-120b", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"]`
   Update the header comment: roster per DEC-026 §1 (replaces the US-041 D-1 note). No URL in this file (it reaches
   the client through the page props; endpoints stay in adapters). Still zero imports (LB-1).
2. **`lib/ai/providers/openai-compatible.ts`** (changed) —
   - Factory gains optional `tokenLimitField?: "max_tokens" | "max_completion_tokens"` (default `"max_tokens"`, so the
     Groq body and GQ-3/GQ-4 stay identical). `buildRequestBody` writes the limit under that key only (T-2).
   - Six exported constants (T-1):
     `OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"`,
     `OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"`,
     `MISTRAL_CHAT_COMPLETIONS_URL = "https://api.mistral.ai/v1/chat/completions"`,
     `DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions"`,
     `CEREBRAS_CHAT_COMPLETIONS_URL = "https://api.cerebras.ai/v1/chat/completions"`,
     `TOGETHER_CHAT_COMPLETIONS_URL = "https://api.together.xyz/v1/chat/completions"`.
   - `export const OPENAI_COMPATIBLE_PRESETS` — readonly table `{ id, chatCompletionsUrl, tokenLimitField? }`, one entry
     per preset in catalogue order; `openai` uses `"max_completion_tokens"`, the rest the default. No error-body rule
     (status mapping in `http.ts` applies: 401/403 auth_failed, 404 model_not_found, 429 rate_limited, else
     provider_error).
   - `export const OPENAI_COMPATIBLE_PRESET_ADAPTERS: readonly AiProvider[] = OPENAI_COMPATIBLE_PRESETS.map(...)`.
     Adding a preset later = one catalogue entry + one table row (DEC-026 §1).
   - Must keep: no direct fetch call (LB-2-fetch: only `ctx.fetch(` under providers — this file calls none), no
     `key=`/`URLSearchParams`/`searchParams` (LB-8), no import of key-status/provider-deps/db (LB-6), no capabilities
     import (CB-2).
3. **`lib/ai/providers/default-registry.ts`** (changed) — `SHIPPED_PROVIDER_ADAPTERS = [geminiProvider, groqProvider,
   ...OPENAI_COMPATIBLE_PRESET_ADAPTERS]`; comment cites DEC-026 §1. PR-5 proves the order matches the catalogue.
4. **`lib/ai/connection-test.ts`** (new, key-carrying internally, key-free output) —
   ```ts
   export const CONNECTION_TEST_CODES = [...ACTIVE_PROVIDER_FAILURE_REASONS, ...PROVIDER_ERROR_CODES] as const;
   export type ConnectionTestCode = (typeof CONNECTION_TEST_CODES)[number];
   export type ConnectionTestResult = { ok: true } | { ok: false; code: ConnectionTestCode };
   export const CONNECTION_TEST_MAX_OUTPUT_TOKENS = 512;
   export async function testProviderConnection(
     deps: ProviderDeps = createProviderDeps(),
     options: { timeoutMs?: number } = {},
   ): Promise<ConnectionTestResult>
   ```
   Body: `const call = await loadActiveProvider(deps)`; not ok → `{ ok: false, code: call.reason }`; else one
   `runGeneration(call.provider, PING_REQUEST, call.input, options)`; ok → `{ ok: true }`; else
   `{ ok: false, code: result.error }`. Results are built field by field — never spread the call or the generation
   result (the text and the key must never reach the shape). A `loadSettings`/`loadStoredKeys` rejection propagates
   (the action turns it into `genericError`, as every admin action does).
   `PING_REQUEST = { system: 'Connection check. Reply with exactly this JSON object: {"ok":true}', user: "ping",
   json: true, maxOutputTokens: CONNECTION_TEST_MAX_OUTPUT_TOKENS }` (T-4). The returned text is never parsed or shown.
   Imports only allowed targets: `./provider-deps`, `./providers/run-generation`, `./providers/resolve`,
   `./providers/types` (LB-2 passes with the allowlist unchanged — it checks import *targets*, and nothing in
   `lib/ai` imports this new file). **Constraint: the word `fetch` must not appear anywhere in this file, comments
   included** (LB-2-fetch: non-provider, non-provider-deps files may not mention it). No `console.` (LB-9), no
   `process.env` (LB-3).
5. **`components/admin/action-state.ts`** (changed) — `values?: { symbol?: string; adapter?: string; code?: string }`
   (additive).
6. **`messages/en.json`, `messages/ro.json`** (changed, both locales, same keys):
   - `Admin.ai.modelStrengthHint` — EN "Larger models understand chat requests better. Small models (for example
     openai/gpt-oss-20b or llama-3.1-8b-instant) often misunderstand requests." RO "Modelele mari înțeleg mai bine
     cererile din chat. Modelele mici (de exemplu openai/gpt-oss-20b sau llama-3.1-8b-instant) înțeleg adesea greșit
     cererile."
   - `Admin.ai.testConnectionSubmit` — EN "Test connection" / RO "Testează conexiunea".
   - `Admin.ai.testConnectionHint` — EN "Sends one short request with the saved provider and model." RO "Trimite o
     singură cerere scurtă cu furnizorul și modelul salvate."
   - `Admin.messages.connectionOk` — EN "Connection OK: the provider answered." RO "Conexiune reușită: furnizorul a
     răspuns."
   - `Admin.messages.connectionFailed` — EN "Connection failed: {code}." RO "Conexiunea a eșuat: {code}." (D-2.)
7. **`app/admin/ai/result-messages.ts`** (changed) — `connectionTestResultToState(result: ConnectionTestResult)`:
   ok → `{ status: "success", messageKey: "connectionOk" }`; else
   `{ status: "error", messageKey: "connectionFailed", values: { code: result.code } }`. Type-only import of
   `ConnectionTestResult` from `@/lib/ai/connection-test`.
8. **`app/admin/ai/actions.ts`** (changed) — `testConnectionAction(_prev, _formData)`:
   `runAdminAction(() => testProviderConnection(), connectionTestResultToState)` — no form field read, no
   revalidation (nothing is written). Imports `@/lib/ai/connection-test` (needs the T-3 allowlist line).
9. **`components/admin/AiProviderModelFields.tsx`** (changed) — one more `<p className="text-xs">` with
   `t("modelStrengthHint")` after `modelHint`. No new input.
10. **`components/admin/AiSettingsAdmin.tsx`** (changed) — new required prop `testConnectionAction: AdminAction`.
    Inside the provider card, after the settings `ActionForm` and only when `settings.status === "ok"`:
    `<ActionForm action={testConnectionAction} submitLabel={t("testConnectionSubmit")}><span className="text-xs">
    {t("testConnectionHint")}</span></ActionForm>` — a button only, no input (PA-4's name set proves it).
11. **`app/admin/ai/page.tsx`** (changed) — passes `testConnectionAction`; adds `export const maxDuration = 60;`
    (T-5, same value as `/chat` and `/admin/etfs`).
12. **`.env.example`** (changed) — six blocks in catalogue order, each `# API key for <Name>; create it at <https URL>.`
    + `# Optional environment-key fallback; /admin/ai can store an encrypted key instead.` + `<VAR>=`. URLs:
    `https://platform.openai.com/api-keys`, `https://openrouter.ai/settings/keys`,
    `https://console.mistral.ai/api-keys`, `https://platform.deepseek.com/api_keys`, `https://cloud.cerebras.ai`,
    `https://api.together.ai/settings/api-keys`. (EX-1/EX-2 are catalogue-driven and fail until this is done.)
13. **`README.md`** (changed) — "Environment variables": the provider-key bullet lists all eight variables (RM-1
    requires each in that section; no other `*_API_KEY` token anywhere); "Administration": `/admin/ai` offers eight
    presets and a Test connection button that sends one short request with the saved provider/model and shows OK or a
    closed error code. Also correct the stale sentence "keys themselves are never entered or shown in the form" to
    "keys can be entered write-only and are never shown" (US-040 behaviour, wording only).

Boundaries (unchanged rules this design respects):
- `app/` and `components/` never see a key or the key-carrying names (LB-5): the action imports only
  `testProviderConnection` and gets a closed union back.
- `lib/ai/providers/*` stay free of key-status/provider-deps/db (LB-6); endpoints stay in adapter code, never in the
  catalogue, settings, form or context (DEC-021 §8 as amended; DEC-026 §1).
- `lib/config/` still never imports `lib/ai` (BC-1).
- The custom-provider table/URL field is **US-057**, not this story.

## 3. Test changes

New test files (additions only):
- `lib/ai/providers/presets.test.ts` — PS-1..PS-6: PS-1 URL shape per preset (via `new URL()`); PS-2 source scan of
  `openai-compatible.ts` (exactly 6 `https://` literals, each the value of an exported `*_CHAT_COMPLETIONS_URL`);
  PS-3 each preset adapter: one POST to its constant, `authorization: Bearer <sentinel>` header only, body has
  `model`/`messages`, injected `baseUrl`/`url` context members ignored; PS-4 `apiKey: null` → `auth_failed`, fetch not
  called; PS-5 `openai` body has `max_completion_tokens` and no `max_tokens`, every other preset the reverse;
  PS-6 401→auth_failed, 404→model_not_found, 429→rate_limited, 500→provider_error, 200 with no choices→bad_response
  for each preset, with a raw-text sentinel in the error body never in the result.
  Also PS-0: `OPENAI_COMPATIBLE_PRESETS` ids equal `PROVIDER_IDS` minus gemini/groq, same order.
- `lib/ai/connection-test.test.ts` — CT-1 ok path (openai preset, real registry, fake fetch 200 with
  `RAW-MODEL-SENTINEL`): result `toEqual({ ok: true })`, one call to `OPENAI_CHAT_COMPLETIONS_URL`, body has
  `response_format: { type: "json_object" }` and `max_completion_tokens: 512`, the word "JSON" in the system message;
  CT-2 each HTTP failure status → exact `{ ok: false, code }`, `Object.keys` exactly `["code","ok"]`, no raw-body or
  key sentinel in `JSON.stringify(result)`; CT-3 invalid JSON / empty content → `bad_response`, rejecting fetch →
  `network`, hanging fetch with `timeoutMs: 5` → `timeout`; CT-4 `not_configured`, `unknown_provider`,
  `not_implemented` (registry `createProviderRegistry([])`), `no_api_key`, `no_model` — fetch never called; CT-5 a
  stored key (from `loadStoredKeys`) wins over `readApiKey`'s env fake in the `authorization` header; CT-6 gemini
  settings → URL starts with `GEMINI_MODELS_BASE_URL`; CT-7 exactly one fetch call for success and for every failure
  (no retry); CT-8 a rejecting `loadSettings` rejects (propagates) and calls no fetch; CT-9
  `CONNECTION_TEST_CODES` has 12 unique entries = failure reasons ∪ provider error codes.
- `lib/ai/provider-presets.pglite.test.ts` — PP-1/PP-2/PP-3 as in §1 AC4 (fake material
  `{ source: "master", key: new Uint8Array(32).fill(n) }`, obvious fake keys only, fetch fake).
- `app/admin/ai/test-connection.flow.test.tsx` — TF-1/TF-2: `vi.mock("@/lib/ai/provider-deps", importOriginal)`
  overriding only `createProviderDeps` to return fake settings/stored keys/env reader + real default registry + fake
  fetch; call the real `testConnectionAction`; render `ActionMessage` with the state in RO and EN; TF-1 success shows
  `connectionOk`; TF-2 for 401/429/404 with a body containing `RAW-PROVIDER-TEXT-SENTINEL` and the key sentinel:
  the HTML contains the closed code and neither sentinel.

Additions to existing files (no existing assertion changed):
- `lib/ai/provider-catalog.test.ts` + PC-4 (Groq suggestions start with `openai/gpt-oss-120b`,
  `llama-3.3-70b-versatile`; `openai/gpt-oss-20b` and `llama-3.1-8b-instant` come after both) + PC-5 (exact
  id → apiKeyEnvVar map of all eight).
- `lib/ai/providers/openai-compatible.test.ts` + OC-2 (default writes `max_tokens`; `tokenLimitField:
  "max_completion_tokens"` writes only that key).
- `lib/ai/provider-deps.interchange.test.ts` + IC-4 (for each new preset: stub its env var with its own sentinel,
  global fetch stub routes by URL constant, settings alone → call to that URL carrying only that sentinel).
- `app/admin/ai/actions.test.ts` + `vi.mock("@/lib/ai/connection-test", ...)` + TC-1 (form with provider/model/
  baseUrl/apiKey fields → `testProviderConnection` called with **zero** arguments; ok → `connectionOk`; no
  `revalidatePath`), TC-2 (`auth_failed` → exact error state with `values.code`), TC-3 (rejection with a
  sentinel/`postgres://` message → `genericError`, no sentinel).
- `app/admin/ai/result-messages.test.ts` + RM-C1 (ok), RM-C2 (`it.each(CONNECTION_TEST_CODES)` → exact state).
- `components/admin/ActionMessage.test.tsx` + AM-5 (RO/EN: `connectionOk` text; `connectionFailed` with
  `values: { code: "rate_limited" }` shows the template with `rate_limited`, `role="alert"`).
- `components/admin/AiProviderModelFields.test.tsx` + PMF-6 (RO/EN render the strength hint, containing both small
  model names).
- `app/admin/ai/page.test.tsx` + PA-13 (`maxDuration === 60`, `AI_PROVIDER_TIMEOUT_MS < 60_000`) + PA-14 (RO/EN:
  `testConnectionSubmit` and `testConnectionHint` render when settings load; absent on the settings load-error page)
  + PA-7c (a stored `mistral`/`openrouter` now selects that option, no unknown-provider notice — see below).

**Deliberate test changes (copy into HANDOVER with these reasons):**
1. `lib/ai/provider-catalog.test.ts` PC-1: expected ids `["gemini","groq"]` → the eight ids in catalogue order.
   Reason: DEC-026 §1 + PO review 2026-10-05 replace sprint-6 decision 5's two-provider roster.
2. `lib/ai/provider-catalog.test.ts` PC-3: "exactly 2 / no third preset until the PO names another vendor" →
   "exactly 8, the DEC-026 roster". Reason: the PO named the vendors (US-041 D-1 resolved by DEC-026).
3. `lib/ai/provider-catalog.test.ts` findProvider unknown-id case: `"openai"` → `"anthropic"` (still unknown).
   Reason: `openai` is now a catalogue id; the test's intent (an unknown id gives undefined) is kept.
4. `app/admin/ai/page.test.tsx` PA-7: stale id `"openai"` → `"anthropic"`; PA-7b: stale ids `["mistral","openrouter"]`
   → `["anthropic","cohere"]`, title reworded to "ids not in the catalogue". Reason: those ids are catalogue entries
   again (DEC-026); the behaviour under test (an unknown stored provider renders safely, none selected, notice shown,
   RO/EN) is unchanged and still asserted. PA-7c (new) covers the re-added ids positively.
5. `app/admin/ai/page.test.tsx` `vi.mock("./actions")` factory gains `testConnectionAction: vi.fn()`. Reason: the page
   now imports it; vitest throws on a missing export of a factory mock. No assertion changes.
6. `components/admin/AiSettingsAdmin.test.tsx` `props()` fixture gains `testConnectionAction: vi.fn(async () =>
   IDLE_STATE)`. Reason: new required prop (type-only fallout). No assertion changes.
7. `app/actions.boundary.test.ts` `ALLOWED_LIB_PREFIXES` gains `"lib/ai/connection-test"`. Reason: T-3 — the new
   action needs the key-free connection-test entry point, the same kind of entry as the already-allowed
   `lib/ai/chat`; the SQL checks and AB-4's forbidden examples (`lib/ai/provider-deps`, capabilities/execute) stay.

Must stay byte-identical (AC4 "key boundary tests unchanged"): `lib/ai/boundaries.test.ts`,
`lib/ai/capabilities/boundaries.test.ts`, `lib/config/boundaries.test.ts`, `lib/ai/key-status.test.ts`,
`lib/ai/key-store.test.ts`, `lib/ai/key-store.pglite.test.ts`, `lib/config/ai-keys.test.ts`,
`lib/config/ai-keys.pglite.test.ts`, `lib/ai/provider-deps.test.ts`, `lib/ai/provider-deps.pglite.test.ts`,
`lib/ai/providers/registry.test.ts`, `lib/ai/providers/groq.test.ts`, `lib/ai/providers/gemini.test.ts`,
`lib/ai/env-example.test.ts`. If the implementer finds one of these must change, stop and record why — that is a
design error in this plan, not a test to edit.

## 4. Data model
None. `ai_provider_keys.provider_id` is free text (no check constraint), `settings.ai_provider` is free text validated
in code against `PROVIDER_IDS`. No migration; `pnpm db:generate` must report no changes (implementer runs it with
`DATABASE_URL` unset as a check). The custom-provider table is US-057.

## 5. Risks and settled technical choices

Smallest design: catalogue entries + one preset table on the existing OpenAI-compatible factory + one key-free
entry point for the test. Extensible only where DEC-026 asks (a preset is one row).

- **T-1 (TECHNICAL, settled) — where preset endpoints live:** in `openai-compatible.ts`, next to the factory, as
  exported constants + one table. Rejected: a new `providers/presets.ts` (would need an `ALLOWED_TARGETS` edit in
  `lib/ai/boundaries.test.ts`, which AC4 says stays unchanged); URLs in the catalogue (the catalogue reaches the
  client as page props, and DEC-021 §8 keeps endpoints in adapter code). `gemini.ts`/`groq.ts` untouched (LB-8 pins
  their single literal).
- **T-2 (TECHNICAL, settled) — OpenAI token-limit field:** OpenAI's reasoning models (o-series, gpt-5) reject
  `max_tokens` with HTTP 400 and require `max_completion_tokens`, which every current OpenAI chat model accepts. The
  factory gains an optional `tokenLimitField`; only the `openai` preset uses `max_completion_tokens`. Other vendors
  keep `max_tokens` (Mistral/DeepSeek/Together document it; Groq's body is pinned by GQ-3). Rejected: switching every
  preset (risk of 4xx on vendors that reject unknown fields).
- **T-3 (TECHNICAL, settled) — Test connection entry point:** new `lib/ai/connection-test.ts` returning a closed
  key-free union; the server action imports it via one new `ALLOWED_LIB_PREFIXES` entry (§3 item 7). Rejected:
  putting it in `settings-deps.ts` (import cycle with `provider-deps.ts`, which imports `settings-deps`); putting it
  in `chat.ts` (wrong module); defining an inline `"use server"` function in `page.tsx` (would sidestep the action
  boundary test's purpose).
- **T-4 (TECHNICAL, settled) — ping request shape:** `json: true` so the test exercises the same JSON mode the chat
  uses (a model that rejects JSON mode fails the test rather than the chat); the system message contains "JSON"
  (OpenAI/DeepSeek require the word for JSON mode); `maxOutputTokens: 512` so reasoning models (gpt-oss, Gemini 2.5)
  have room before emitting text — a too-small cap returns empty content → false `bad_response`. Success = the
  provider returned non-empty text; content never parsed or shown. Timeout = the existing 20 s.
- **T-5 (TECHNICAL, settled) — function duration:** `/admin/ai` gets `maxDuration = 60` so a 20 s provider timeout
  cannot outlive the Vercel function (same as `/chat`). PA-13 pins the relation.
- **T-6 (TECHNICAL, settled) — stored-key reads:** `loadStoredProviderKeys` reads one row per catalogue provider,
  sequentially; with 8 presets that is 8 small queries per chat message / page load / test click. Left unchanged
  (key-handling code and its tests stay identical, AC4). Noted for the Sprint 13 audit as a possible later
  optimisation (one `select … where provider_id = selected` or `Promise.all`).
- **T-7 (TECHNICAL, settled) — OpenRouter optional headers** (`HTTP-Referer`, `X-Title`) are not sent; they are
  optional attribution headers, and the shared adapter stays vendor-neutral.

Other risks:
- **R1 Live correctness unprovable offline:** endpoint paths, auth scheme (Bearer for all six), JSON-mode support per
  model and model names come from vendor docs and age over time. Mitigation: Test connection itself (it reports the
  failure as a closed code), suggestions are free-text hints only, M-1..M-3.
- **R2 Free-tier quota:** each click is one provider request — same exposure as `/chat` (requirements §6 info item,
  already accepted). No new control.
- **R3 Unsaved selection:** the test uses the saved provider/model ("active", DEC-026 §4); the hint text says so.
- **R4 Longer admin page:** eight key rows and, with storage enabled, eight write-only key forms. Literal outcome of
  the roster; layout unchanged.
- **R5 Vendor-specific 4xx** (DeepSeek/OpenRouter 402 "insufficient balance", 400 "JSON mode unsupported") map to
  `provider_error` via `http.ts` — closed, never raw text. No vendor error-body rules added (none required).
- **R6 Existing tests that iterate the catalogue** (KS-1..3, PA-1..3, PA-11/12, ASK-1/2, EX-1/2, RM-1, PD-7) now run
  over eight entries; they are expected to pass unchanged once `.env.example`/README are updated (step 12-13).

## 6. Decisions needed
| # | Type | Question | Options | Recommendation | Isolated default? |
|---|---|---|---|---|---|
| T-1..T-7 | TECHNICAL | see §5 | — | settled in this plan | n/a (not open) |
| D-1 | PRODUCT | Which model names to suggest for the six new presets (DEC-026 says "suggested models" without naming them) | (a) the lists in §2 step 1, strongest-first; (b) PO names others | (a) | **Yes** — confined to the `modelSuggestions` arrays in `lib/ai/provider-catalog.ts`; free text still accepts any model. PO to confirm at demo. |
| D-2 | PRODUCT | How a failed test is shown | (a) literal AC3: "Connection failed: {code}" with the closed code verbatim in both locales; (b) also a translated explanation per code | (a) | **Yes** — confined to `Admin.messages.connectionFailed` (en/ro) and `connectionTestResultToState` in `app/admin/ai/result-messages.ts`. Hint/label wording (`modelStrengthHint`, `testConnection*`) is part of the same default. PO to confirm at demo. |

Neither item blocks the story; no new DEC file (nothing binds beyond this sprint).

## 7. Out of scope (story + DEC-026)
Custom OpenAI-compatible provider, `ai_custom_providers`, URL-bound keys (US-057); new widget operations; model-
generated code; keys in chat; live model discovery; per-vendor error-body rules; any login.

## 8. Files changed (expected)
- changed (source): `lib/ai/provider-catalog.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/providers/default-registry.ts`, `components/admin/action-state.ts`, `app/admin/ai/result-messages.ts`,
  `app/admin/ai/actions.ts`, `app/admin/ai/page.tsx`, `components/admin/AiProviderModelFields.tsx`,
  `components/admin/AiSettingsAdmin.tsx`, `messages/en.json`, `messages/ro.json`
- new (source): `lib/ai/connection-test.ts`
- changed (docs/config): `.env.example`, `README.md`
- new (tests): `lib/ai/providers/presets.test.ts`, `lib/ai/connection-test.test.ts`,
  `lib/ai/provider-presets.pglite.test.ts`, `app/admin/ai/test-connection.flow.test.tsx`
- changed (tests, additions): `lib/ai/provider-catalog.test.ts` (PC-4, PC-5), `lib/ai/providers/openai-compatible.test.ts`
  (OC-2), `lib/ai/provider-deps.interchange.test.ts` (IC-4), `app/admin/ai/actions.test.ts` (TC-1..3),
  `app/admin/ai/result-messages.test.ts` (RM-C1/2), `components/admin/ActionMessage.test.tsx` (AM-5),
  `components/admin/AiProviderModelFields.test.tsx` (PMF-6), `app/admin/ai/page.test.tsx` (PA-7c, PA-13, PA-14)
- deliberate test changes: §3 items 1-7
- not touched: everything listed as byte-identical in §3; `lib/db/schema.ts`, `drizzle/`, `package.json`, lockfile
