# US-026 — Plan: two concrete free providers behind that interface
_Planned by story-planner (opus, high), 2026-09-27. Round 1._

Sources read: `backlog/stories/US-026.md` (including "Tech-lead review 2026-09-26"), `backlog/sprints/sprint-06.md`
(Decisions needed #1, #5, #6; Sprint DoD; manual QA; carry-forward notes), `decisions/DEC-017-ai-provider-layer.md`,
DEC-015, DEC-016 §1, `verification/US-025-plan.md` and `US-025-review.md` (W1), the shipped US-025 code
(`lib/ai/providers/{types,run-generation,registry,default-registry,resolve}.ts`, `lib/ai/provider-deps.ts`,
`lib/ai/key-status.ts`), `lib/ai/provider-catalog.ts`, `lib/ai/settings-deps.ts`, every `lib/ai/**/*.test.ts`,
`test/helpers/ai-fakes.ts`, `app/admin/ai/{page.tsx,actions.ts,page.test.tsx,actions.test.ts}`,
`components/admin/AiSettingsAdmin.tsx` (unknown-provider notice), `messages/en.json` (`Admin.ai`), `.env.example`,
README "Environment variables" and "Administration", `test/fixtures/README.md`, `lib/extraction/fixtures.test.ts`
(it lists only top-level `*.pdf`, so a `test/fixtures/ai/` folder does not disturb it), `vitest.config.ts`.

**Not blocked.** No TECHNICAL item is open (#1 and #6 are Decided; the plan-level items P-1..P-6 below are settled
here within DEC-017). The one PRODUCT item (#5) ships its isolated default, as the tech-lead confirmed.

---

## 0. Module layout (names fixed by this plan)

| File | Kind | Role |
|---|---|---|
| `lib/ai/providers/http.ts` | new | The shared HTTP step for every adapter: `mapHttpStatus(status)`, `sendProviderRequest(call, ctx)`. The **only** file with a `ctx.fetch(` call. Imports only `./types`. |
| `lib/ai/providers/gemini.ts` | new | `GEMINI_MODELS_BASE_URL` constant and `geminiProvider: AiProvider` (id `"gemini"`). Builds the Gemini request, the Gemini error-body rule and the text extractor. Imports `./types`, `./http`. |
| `lib/ai/providers/openai-compatible.ts` | new | `createOpenAiCompatibleProvider({ id, chatCompletionsUrl, errorBodyRule? })`: request body, Bearer header and `choices[0].message.content` extractor for any OpenAI-compatible chat-completions API. Imports `./types`, `./http`. |
| `lib/ai/providers/groq.ts` | new | `GROQ_CHAT_COMPLETIONS_URL` constant, the Groq error-body rule (`json_validate_failed`), `groqProvider = createOpenAiCompatibleProvider({ id: "groq", ... })`. The "one more small entry" of Task 2. Imports `./types`, `./http` (type only), `./openai-compatible`. |
| `lib/ai/providers/default-registry.ts` | changed | `SHIPPED_PROVIDER_ADAPTERS = [geminiProvider, groqProvider]` (catalogue order). |
| `lib/ai/provider-catalog.ts` | changed | Trimmed to `gemini`, `groq` (**isolated default of PRODUCT #5**, together with the registry above). Comment updated to cite sprint-06 decision 5. Still zero imports (LB-1). |
| `test/helpers/ai-http.ts` | new | Test helpers: `loadAiFixture(provider, name)`, `respondWith(status, body)` (a recording `ProviderFetch` mock), `rejectingFetch(error)`, `hangingFetch({ honoursAbort })`, `callCtx(overrides)` (a `ProviderCallContext` with a fresh signal and a sentinel key). Never imported by shipped code. |
| `test/fixtures/ai/` | new | Hand-written JSON bodies + `README.md` (section 3). |
| tests | new / changed | See section 1 and section 7. |

Not touched: `app/admin/ai/page.tsx`, `app/admin/ai/actions.ts`, `components/**`, `messages/*.json` (no new UI string:
the unknown-provider notice and the "chat not available yet" note already exist in both locales), `lib/config/**`,
`lib/ai/key-status.ts`, `lib/ai/provider-deps.ts`, `lib/ai/providers/{types,run-generation,registry,resolve}.ts`,
`package.json`, `pnpm-lock.yaml`, `lib/db/schema.ts`, `drizzle/**`.

### Dependency direction
```
default-registry ──> gemini ──> http ──> types
                 └─> groq ──> openai-compatible ──> http ──> types
provider-deps (unchanged) ──> default-registry          (the only place the global fetch is bound, US-025)
```
- `lib/ai/providers/*` still imports neither `key-status`, `provider-deps` nor `lib/db` (LB-6 unchanged).
- A capability (US-027) never imports `gemini.ts`/`groq.ts` (DEC-017 §5); only `default-registry.ts` does.
- `app/admin/ai/page.tsx` reads `PROVIDER_CATALOG` only; it never imports an adapter, so the build and the page are
  unaffected by adapter code.

---

## 1. Acceptance criteria and the tests that prove them

Test ids are fixed here so the reviewer and tester can map them. Every new AI test file stubs the global `fetch` in
`beforeEach` with a spy that throws `"real network forbidden"` and asserts at the end of the file's suite that it was
never called (AC9); adapters only ever receive the injected mock.

### Shared design: `lib/ai/providers/http.ts`
```ts
/** A provider-specific rule for a non-2xx answer; null falls through to mapHttpStatus. Reads code fields only. */
export type ErrorBodyRule = (status: number, errorBody: unknown) => ProviderErrorCode | null;

export type ProviderHttpCall = {
  url: string;                              // built only from the adapter's base-URL constant (+ encoded model for Gemini)
  headers: Record<string, string>;
  body: unknown;                            // JSON-serialised here
  errorBodyRule: ErrorBodyRule | null;
  extractText: (json: unknown) => string | null;   // null → bad_response
};

export function mapHttpStatus(status: number): ProviderErrorCode;
// 401, 403 → auth_failed; 404 → model_not_found; 429 → rate_limited; any other → provider_error

export async function sendProviderRequest(call: ProviderHttpCall, ctx: ProviderCallContext): Promise<GenerateResult>;
```
`sendProviderRequest`, in order (never throws; the whole body also sits in an outer `try` whose `catch` returns
`provider_error`, so a throwing `extractText`/rule cannot escape):
1. `response = await ctx.fetch(call.url, { method: "POST", headers: call.headers, body: JSON.stringify(call.body),
   signal: ctx.signal, redirect: "error" })` — **exactly one call**, no retry (sprint decision 6).
   Rejection → `ctx.signal.aborted ? "timeout" : "network"`. The caught value is discarded, never read.
2. `!response.ok` → read the body with `response.text()` (a read failure gives `null`), `JSON.parse` in a `try`
   (failure gives `null`), then `call.errorBodyRule?.(response.status, parsed) ?? mapHttpStatus(response.status)`.
   Nothing from the body except the code field the rule compares is ever used.
3. `response.ok` → `text()`; a read failure → `ctx.signal.aborted ? "timeout" : "network"`. `JSON.parse` failure →
   `bad_response`. `extractText(json)` returning `null`, or a string that is blank after `trim()` → `bad_response`.
   Otherwise `{ ok: true, text }` (the text as returned, untrimmed).
4. Results are always built as fresh literals (`{ ok: false, error: <code> }` / `{ ok: true, text }`): no key, URL,
   status text or body fragment can reach a result (DEC-017 §1).

Each adapter checks `ctx.apiKey === null` first and returns `auth_failed` **without** a request (both catalogue
entries require a key; the resolver already reports `no_api_key` before this, so this branch is defensive — P-4).

### AC1 — Gemini request (FR6; AGENTS.md secrets; sprint decisions 1, 5)
Design (`gemini.ts`):
- `GEMINI_MODELS_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/"`; URL =
  `` `${GEMINI_MODELS_BASE_URL}${encodeURIComponent(ctx.model)}:generateContent` ``. No query string, ever.
- Headers: `{ "content-type": "application/json", "x-goog-api-key": ctx.apiKey }`. The key goes nowhere else.
- Body: `{ systemInstruction: { parts: [{ text: request.system }] }, contents: [{ role: "user", parts: [{ text:
  request.user }] }], generationConfig: { maxOutputTokens: request.maxOutputTokens, ...(request.json ? {
  responseMimeType: "application/json" } : {}) } }`.
- Error-body rule: `status === 400` and `errorBody.error.details` is an array with an element whose
  `reason === "API_KEY_INVALID"` → `auth_failed`; otherwise `null`.
- Text extractor: `candidates[0].content.parts`, keep the parts whose `text` is a string **and** `thought !== true`,
  join with `""`. Any missing level → `null`. (Thought-summary parts appear only with `includeThoughts`, which we never
  set; skipping them is defensive so a thought text can never be mistaken for the JSON answer — P-5.)

Tests (`lib/ai/providers/gemini.test.ts`, sentinel key `SENTINEL-GEMINI-KEY-4b2a`, model `gemini-test-model`):
- **GM-1** one call; `init.method === "POST"`; URL equals
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent`; `new URL(url).search === ""`;
  the URL does not contain the sentinel.
- **GM-2** key placement: `init.headers["x-goog-api-key"]` equals the sentinel; no other header value and not
  `init.body` contains the sentinel; `init.signal` is `ctx.signal`; `init.redirect === "error"`.
- **GM-3** body (`JSON.parse(init.body)`): `systemInstruction.parts[0].text` = request.system;
  `contents` = `[{ role: "user", parts: [{ text: request.user }] }]`; `generationConfig.maxOutputTokens` = the limit;
  with `json: false` there is **no** `responseMimeType`.
- **GM-4** JSON mode: `json: true` → `generationConfig.responseMimeType === "application/json"`.
- **GM-5** model encoding (story "Notes for verification"): model `../x?key=y` → URL equals
  `GEMINI_MODELS_BASE_URL + "..%2Fx%3Fkey%3Dy:generateContent"`; `new URL(url)` has `search === ""`, `hostname ===
  "generativelanguage.googleapis.com"` and a pathname starting with `/v1beta/models/`. Also `a/b#c` → no `#`
  fragment, no extra path segment.
- **GM-6** `apiKey: null` → `{ ok: false, error: "auth_failed" }`, zero fetch calls.

### AC2 — Groq request (FR6; sprint decisions 1, 5)
Design (`openai-compatible.ts` + `groq.ts`):
- `GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"`.
- Headers: `{ "content-type": "application/json", authorization: `Bearer ${ctx.apiKey}` }`.
- Body: `{ model: ctx.model, messages: [{ role: "system", content: request.system }, { role: "user", content:
  request.user }], max_tokens: request.maxOutputTokens, ...(request.json ? { response_format: { type: "json_object" } }
  : {}) }` (field name `max_tokens`: P-3).
- Text extractor: `choices[0].message.content` if a string, else `null`.
- Groq error-body rule (in `groq.ts`, not in the generic factory): `status === 400` and `errorBody.error.code ===
  "json_validate_failed"` → `bad_response`; otherwise `null`.

Tests (`lib/ai/providers/groq.test.ts`, sentinel `SENTINEL-GROQ-KEY-4b2a`, model `llama-test-model`):
- **GQ-1** one `POST` to exactly `https://api.groq.com/openai/v1/chat/completions`; `new URL(url).search === ""`; URL
  has no sentinel; `init.signal` is `ctx.signal`; `init.redirect === "error"`.
- **GQ-2** `init.headers.authorization === "Bearer SENTINEL-GROQ-KEY-4b2a"`; no other header and not the body contains
  the sentinel.
- **GQ-3** body: `model` = ctx.model; `messages` deep-equals `[{ role: "system", content }, { role: "user", content }]`;
  `max_tokens` = the limit; no `response_format` with `json: false`.
- **GQ-4** JSON mode: `response_format` deep-equals `{ type: "json_object" }`.
- **GQ-5** `apiKey: null` → `auth_failed`, zero fetch calls.
- **OC-1** (`openai-compatible.test.ts`, "one more small entry"): `createOpenAiCompatibleProvider({ id: "groq",
  chatCompletionsUrl: "https://example.test/v1/chat/completions" })` (no error rule) posts to that URL with the same body
  shape, and a 400 `json_validate_failed` body gives `provider_error` (the rule is Groq's, not the factory's). The
  factory is exercised directly; the registry is not involved (its ids are pinned to the catalogue).

### AC3 — Responses (FR6; sprint decision 1)
Fixtures (section 3). Tests, one `describe.each` over both adapters in `lib/ai/providers/responses.test.ts` (or split
into GM/GQ files; ids are what matter):
- **RS-1** success fixture, status 200 → `{ ok: true, text }` where `text` equals the text written in the fixture
  (Gemini: the joined parts; Groq: `choices[0].message.content`). Exact deep-equal, keys `ok`, `text` only.
- **RS-2** no-candidates / no-choices fixture, 200 → `{ ok: false, error: "bad_response" }`.
- **RS-3** non-JSON 200 body (`"<html>upstream error</html>"`) → `bad_response`.
- **RS-4** extra no-text cases → `bad_response`: Gemini candidate with `parts: []`, a part with only `thought: true`
  text (P-5), empty-string text; Groq `content: null`, `content: ""`, `content: "   "`.
- **RS-5** Gemini multi-part: two text parts `"{\"a\":"` and `"1}"` → `text === "{\"a\":1}"` (joined, story Task 1).
- **RS-6** 2xx whose body read rejects (a hand-made response object whose `text()` rejects), signal not aborted →
  `network`; same with the signal already aborted → `timeout`.

### AC4 — Errors never leak (AGENTS.md secrets; DEC-015 §1; sprint decision 1; tech-lead amendment 2026-09-26)
Tests in `lib/ai/providers/errors.test.ts`, `describe.each([gemini, groq])`:
- **HE-1** status table, body `{"error":{"message":"x"}}`: 401 → `auth_failed`, 403 → `auth_failed`, 404 →
  `model_not_found`, 429 → `rate_limited`, 500 → `provider_error`; also 400 with that body, 502 and 503 →
  `provider_error`; a non-JSON error body with 401 still → `auth_failed` (body parse failure falls through to the table).
- **HE-2** committed fixtures: each provider's 429 fixture → `rate_limited`; each provider's 404 unknown-model fixture
  (status 404) → `model_not_found`; Groq 401 invalid-key fixture → `auth_failed`.
- **HE-3** `fetch` rejects with `new TypeError("fetch failed: https://…?key=SENTINEL")` → `network`.
- **HE-4** aborted: controller aborted **before** `generate`, fetch mock rejects with
  `new DOMException("The operation was aborted.", "AbortError")` when `init.signal.aborted` → `timeout` (one call).
- **HE-5 (Gemini)** the committed 400 `API_KEY_INVALID` fixture → `auth_failed`; the committed 400
  `INVALID_ARGUMENT` fixture without that reason → `provider_error`; a 400 whose `details` is not an array → 
  `provider_error`.
- **HE-6 (Groq)** the committed 400 `json_validate_failed` fixture → `bad_response`; a 400 with another `error.code`
  → `provider_error`.
- **HE-7** no case throws: every call in HE-1..HE-6 and RS-* is awaited with `await expect(p).resolves` style (a
  rejection fails the test); additionally an `extractText`-level surprise: a 200 body `"null"` and `"[]"` →
  `bad_response`, not an exception.
- **HE-8** sentinel echo (tech-lead point 1): for every error fixture of the provider, the test loads the fixture, sets
  `error.message` to `"echo SENTINEL-<P>-KEY-4b2a <request url> BODY-MARKER-77"` (and, for the Groq
  `json_validate_failed` fixture, `failed_generation` to the same string) and serves it with the fixture's status;
  plus HE-3's rejecting fetch with the same string. For every result: `JSON.stringify(result)` contains neither the
  sentinel, nor the request URL, nor the host name, nor `BODY-MARKER-77`; `Object.keys(result)` ⊆ `{ ok, error }`.
  This includes the Gemini invalid-key fixture (the branch that reads a body field).

### AC5 — One request, no retry (FR6; sprint decision 6)
- **OR-1** every test in GM/GQ/RS/HE asserts `fetchMock.mock.calls.length === 1` (GM-6/GQ-5: `0`, the null-key
  guard, which is outside AC1–AC4's cases). Implemented once in the helper: `respondWith` returns a mock and each
  `it` ends with `expectOneCall(mock)`.
- **OR-2** (`lib/ai/providers/timeout.test.ts`, fake timers, `vi.advanceTimersByTimeAsync`) for each adapter, through
  `runGeneration`: a fetch that never settles and ignores the signal → still pending at `AI_PROVIDER_TIMEOUT_MS - 1`,
  `{ ok: false, error: "timeout" }` at `AI_PROVIDER_TIMEOUT_MS` (imported constant, never a literal), exactly one fetch
  call, and the `init.signal` passed to fetch is aborted. Second case: a fetch that rejects with `AbortError` on abort
  → the same result and still one call (the adapter's late `timeout` result is ignored by the race).

### AC6 — Catalogue equals the implemented providers (FR6; FR11; sprint-05 decision 10; sprint decision 5)
- **PC-1** (`provider-catalog.test.ts`, changed) `PROVIDER_IDS` equals `["gemini", "groq"]`. This is the one
  hard-coded pin (the isolated default of PRODUCT #5). The other PC tests stay.
- **PR-5** (`registry.test.ts`, replaced as US-025's own title says: "US-026 replaces this with: registry ids equal
  PROVIDER_IDS, DEC-017 §3") `createDefaultProviderRegistry().list().map(p => p.id)` equals `PROVIDER_IDS` (same order),
  and `SHIPPED_PROVIDER_ADAPTERS` has the same length. **PR-6** each shipped adapter's `generate` is a function and
  `registry.get(id)` returns the adapter for every catalogue id.
- **EX-1** (`env-example.test.ts`, unchanged) every catalogue `apiKeyEnvVar=` line is preceded by a comment line.
- **EX-2** (new) the set of `^([A-Z][A-Z0-9_]*_API_KEY)=` lines in `.env.example` equals the set of catalogue
  `apiKeyEnvVar`s (so no stale `OPENROUTER_API_KEY`/`MISTRAL_API_KEY`), and each comment line above one names a
  `https://` URL (where to create the key, Task 6).
- **RM-1** (new, same file) the README's `## Environment variables` section (text up to the next `## `) mentions every
  catalogue `apiKeyEnvVar`, and every `\b[A-Z][A-Z0-9_]*_API_KEY\b` token in the whole README is a catalogue variable.
- `lib/ai/key-status.test.ts` KS-2 and `lib/ai/provider-deps.test.ts` PD-7 stub "every key variable" by looping over
  `PROVIDER_CATALOG` instead of four literal names (same assertions, catalogue-driven, per "Notes for verification").

### AC7 — `/admin/ai` follows the catalogue (FR11; sprint-05 decision 10; Sprint 5 audit W3; AGENTS.md secrets)
`page.tsx` and `actions.ts` need no code change; the tests change. In `app/admin/ai/page.test.tsx`, the `@/lib/db`
and `@/lib/ai/settings-deps` mocks become mutable (`let mockGetDb`, `let mockCreateDeps`, reset in `afterEach`), like
the existing `mockGetAiSettings`.
- **PA-1** (changed) option count = `PROVIDER_CATALOG.length + 1`; the set of `<option value="…">` values equals
  `{"", ...PROVIDER_IDS}`; stored `groq` is selected.
- **PA-2/PA-3** (changed) sentinels and unset stubs built from `PROVIDER_CATALOG`; `data-key-status` counts equal
  `PROVIDER_CATALOG.length`.
- **PA-5** (changed) for `ro` and `en`: every catalogue `name` appears (in the select and in the key table: assert
  twice per name, or scope by the table markup); `chatUnavailableNote` present in **both** locales (the note stays until
  US-028).
- **PA-7b** (new) stored `mistral`, and separately `openrouter`, render in `en` and `ro` without throwing; the none
  option is selected; the page contains the locale's `unknownStoredProvider` text with the id filled in.
- **PA-6b** (new, W3) with a secret-shaped message (`"connection refused: postgres://user:secret@db.example.com/etfs"`):
  (i) `getDb()` throws synchronously; (ii) `createAiSettingsDeps` throws. Each: the page renders `loadError`, contains
  neither `connection refused`, `postgres://` nor `secret`, and still renders the key table heading.
- **AA-7b** (new, `actions.test.ts`, W3) the same two throwers (mutable mocks as above): the action returns exactly
  `{ status: "error", messageKey: "genericError" }`, `setAiSettings` and `revalidatePath` are not called, and the
  serialised state has no secret text. The existing **AA-7** keeps its assertions but its title is corrected to what it
  does ("`setAiSettings` rejecting with a database-shaped error …"); that is the mislabel W3 names.

### AC8 — Interchangeable by settings alone (FR6 "easy to swap"; EPIC-06)
Test `lib/ai/provider-deps.interchange.test.ts` (`vi.mock("../db/index")` as PD-7 does; `vi.stubEnv` both key
variables with sentinels; `vi.stubGlobal("fetch", spy)` where the spy answers by URL host with the matching
committed success fixture):
- **IC-1** `deps = { ...createProviderDeps(), loadSettings: async () => ({ provider: "gemini", model: "gemini-test-model" }) }`
  — the real shipped registry, the real `readApiKey`, the real global-fetch binding. `loadActiveProvider(deps)` → ok;
  `runGeneration(call.provider, req, call.input)` → `{ ok: true, text: <gemini fixture text> }`; the spy was called
  once, with a URL starting with `GEMINI_MODELS_BASE_URL`.
- **IC-2** same, `loadSettings` now returns `{ provider: "groq", model: "llama-test-model" }` → one call to
  `GROQ_CHAT_COMPLETIONS_URL`, the Groq fixture text. Between IC-1 and IC-2 only the `loadSettings` value differs (the
  test builds both from one helper taking the settings object; no adapter is referenced directly).
- **IC-3** the key each call carried is its own provider's sentinel (Gemini's in `x-goog-api-key`, Groq's in
  `authorization`), never the other's.

### AC9 — Offline and gates (AGENTS.md tests/commands; sprint decision 1)
- Global `fetch` stubbed with a throwing spy in every new test file; the adapters use only the injected mock (OR-1
  counts calls on that mock). IC-* is the only place the global stub answers, and it serves committed fixtures.
- **LB-7** (unchanged) no SDK in `package.json`; `package.json`/lockfile not in "Files changed".
- Boundary test changes (section 2) keep adapters on `ctx.fetch(` only.
- Gates (the tester runs and quotes them): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`.

---

## 2. `lib/ai/boundaries.test.ts` changes (no assertion removed)
- **LB-0** expected files gain `providers/http.ts`, `providers/gemini.ts`, `providers/groq.ts`,
  `providers/openai-compatible.ts`; minimum count raised from 9 to 13.
- **LB-2(a)** `ALLOWED_TARGETS` gains exactly `lib/ai/providers/http`, `lib/ai/providers/gemini`,
  `lib/ai/providers/groq`, `lib/ai/providers/openai-compatible` (all `lib/ai`-internal, relative; same kind of addition
  as US-025's). The SDK denylist, re-export ban, network-primitive ban and fetch-token rules are unchanged; they now
  also cover the four new files, so in `providers/*` every fetch call must still be exactly `ctx.fetch(`.
- **LB-4** (widened, US-025 review **W1**): `candidateDirs` becomes `app/`, `components/` and the **whole `lib/`**
  (not only `lib/ai`), so "exactly `app/admin/ai/page.tsx` and `lib/ai/provider-deps.ts` import `key-status`" holds
  for the whole tree, as the US-025 tech-lead note required. The `readApiKey` text ban extends from `app/`+`components/`
  to every non-test file outside `lib/ai/`.
- **LB-8** (new) in `lib/ai/providers/*`: no `[?&]key=` text, no `URLSearchParams`, no `searchParams` (the key never
  goes in a URL, story "Key placement"); `gemini.ts` and `groq.ts` each contain exactly one `https://` literal, and it
  is the value of their exported base-URL constant (base URLs fixed in code, DEC-017 §3). Keep the words out of
  comments too.
- **LB-9** (new) no `console.` in any non-test `lib/ai` file (no key, URL or body can reach a log line; sprint manual
  step 8).
- LB-1, LB-3, LB-5, LB-6, LB-7 byte-identical.

## 3. Fixtures (`test/fixtures/ai/`, Task 7) and their documentary sources

No agent can use a real key and this session had no network access, so the shapes below come from the providers'
public API references as the planner knows them. The implementer writes the fixtures from these shapes; if it can
open the pages it compares and, where a page disagrees, the page wins and the plan/README says why (tech-lead point 4).
The fixture `README.md` states: hand-written from the documentation below, not recorded with a key; what a live
provider returns is proven only by sprint-06.md manual QA.

| Source | URL | Used for |
|---|---|---|
| Gemini `models.generateContent` reference | https://ai.google.dev/api/generate-content | endpoint `POST …/v1beta/{model=models/*}:generateContent`; request `contents[]`, `systemInstruction`, `generationConfig`; response `candidates[].content.parts[].text`, `finishReason`, `promptFeedback`, `usageMetadata`, `modelVersion` |
| Gemini `GenerationConfig` | https://ai.google.dev/api/generate-content#generationconfig | `maxOutputTokens`, `responseMimeType: "application/json"` |
| Gemini API keys | https://ai.google.dev/gemini-api/docs/api-key | REST examples send the key in the `x-goog-api-key` header; key creation in Google AI Studio (https://aistudio.google.com/apikey) |
| Gemini troubleshooting / error codes | https://ai.google.dev/gemini-api/docs/troubleshooting | 400 `INVALID_ARGUMENT`, 403 `PERMISSION_DENIED`, 404 `NOT_FOUND`, 429 `RESOURCE_EXHAUSTED`, 500 `INTERNAL`, 503 `UNAVAILABLE` |
| Google API error model | https://cloud.google.com/apis/design/errors | error JSON `{ error: { code, message, status, details[] } }`; `google.rpc.ErrorInfo` with `reason` (`API_KEY_INVALID` for a wrong key, returned with HTTP 400) |
| Groq chat completions reference | https://console.groq.com/docs/api-reference#chat-create | `POST https://api.groq.com/openai/v1/chat/completions`, `Authorization: Bearer`, `model`, `messages`, `max_tokens` (documented as deprecated in favour of `max_completion_tokens`, still accepted — P-3), `response_format`; response `choices[].message.content`, `finish_reason`, `usage`, `x_groq` |
| Groq JSON mode | https://console.groq.com/docs/structured-outputs (JSON Object Mode; formerly https://console.groq.com/docs/text-chat) | `response_format: { type: "json_object" }`; failure → 400 with `error.code: "json_validate_failed"` and `failed_generation` |
| Groq errors | https://console.groq.com/docs/errors | status table (400, 401, 404, 413, 422, 429, 498, 500, 502, 503) and error object `{ error: { message, type, code? } }`; 401 `invalid_api_key`, 404 `model_not_found`, 429 `rate_limit_exceeded` |
| Groq keys | https://console.groq.com/keys | where the user creates the key (`.env.example` comment) |

Files (bodies only; the status is set by the test):
- `gemini/success.json` — one candidate, `content.role: "model"`, one text part with a small JSON string, `finishReason:
  "STOP"`, `usageMetadata`, `modelVersion`.
- `gemini/no-candidates.json` — `promptFeedback: { blockReason: "SAFETY" }`, no `candidates`, `usageMetadata`.
- `gemini/error-429.json` — `{ error: { code: 429, message: "Resource has been exhausted (e.g. check quota).", status: "RESOURCE_EXHAUSTED" } }`.
- `gemini/error-400-api-key-invalid.json` — `{ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID", domain: "googleapis.com", metadata: { service: "generativelanguage.googleapis.com" } }] } }`.
- `gemini/error-400-invalid-argument.json` — `{ error: { code: 400, message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" } }`.
- `gemini/error-404-model.json` — `{ error: { code: 404, message: "models/<name> is not found for API version v1beta, or is not supported for generateContent. …", status: "NOT_FOUND" } }`.
- `groq/success.json` — `id`, `object: "chat.completion"`, `created`, `model`, `choices: [{ index: 0, message: { role: "assistant", content: "<small JSON string>" }, logprobs: null, finish_reason: "stop" }]`, `usage`, `system_fingerprint`, `x_groq: { id }`.
- `groq/no-choices.json` — the same envelope with `choices: []`.
- `groq/error-429.json` — `{ error: { message: "Rate limit reached for model … on requests per minute (RPM) …", type: "requests", code: "rate_limit_exceeded" } }`.
- `groq/error-401-invalid-key.json` — `{ error: { message: "Invalid API Key", type: "invalid_request_error", code: "invalid_api_key" } }`.
- `groq/error-404-model.json` — `{ error: { message: "The model `<name>` does not exist or you do not have access to it.", type: "invalid_request_error", code: "model_not_found" } }`.
- `groq/error-400-json-validate-failed.json` — `{ error: { message: "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.", type: "invalid_request_error", code: "json_validate_failed", failed_generation: "…" } }`.
- `README.md` as described above; `test/fixtures/README.md` gets one line pointing to `ai/README.md` (as it does for `bvb/`).

The "error body" the story asks for per provider is the 429 fixture (HE-2); the extra tech-lead fixtures are the
invalid-key (Gemini 400, Groq 401), 404 unknown-model and Groq `json_validate_failed` bodies.

## 4. `.env.example` and README (Task 6)
- `.env.example`: remove the OpenRouter and Mistral blocks; `GEMINI_API_KEY=` and `GROQ_API_KEY=` each preceded by one
  comment line naming where to create the key, e.g.
  `# Google Gemini API key for the configuration chat: create it at https://aistudio.google.com/apikey; set it in Vercel, never commit it.`
  and the Groq line with `https://console.groq.com/keys`. (EX-1/EX-2.)
- README "Environment variables": `GEMINI_API_KEY`, `GROQ_API_KEY` — keys for the two supported AI providers (FR6),
  needed for the configuration chat (US-028), set in the Vercel project's environment variables and redeployed, never
  entered in the app; `/admin/ai` shows only set/not set. README "Administration": "which of the four provider API
  keys" → "which of the provider API keys". (RM-1.)

## 5. Data model / migrations
None. No schema change, no write (the catalogue is code). A stored `settings.ai_provider` of `openrouter`/`mistral`
stays in the database untouched and shows the existing unknown-provider notice (sprint-05 decision 10); saving it again
is now rejected by `setAiSettings` as `unknown_provider`, which is the existing behaviour for any non-catalogue id.
No `pnpm db:generate`.

## 6. Risks and the smallest design
- **Shapes not proven live.** Mitigation: section 3 cites each page; the live proof is the user's (sprint-06.md steps
  1, 2, 6, 7). If a provider's live answer differs, the fix is a fixture + mapping change, not an interface change.
- **Key leaking through a redirect.** `x-goog-api-key` is a custom header, and a cross-origin redirect would carry it.
  `redirect: "error"` makes any redirect a `network` failure instead (P-2). Both APIs answer directly; no redirect is
  expected.
- **Model text in the Gemini path.** `encodeURIComponent` (GM-5). A user who types `models/gemini-…` (the form Google's
  model list uses) gets `%2F` in the path and a 404 → `model_not_found`, which US-028 words as "the provider does not
  know this model". Not stripped here (no requirement; would be guessing).
- **Groq 413 on free tier.** Groq can answer an over-large request with 413 (`rate_limit_exceeded`, tokens per
  minute). It maps to `provider_error` by the story's table. Our requests are small (500-char message, sprint decision
  13), so this is noted, not handled.
- **Gemini thinking tokens** (tech-lead point 5): `finishReason: "MAX_TOKENS"` with no text → `bad_response` (RS-4);
  no workaround here, US-027 sets the limit.
- **Source-scan false positives** (LB-2 fetch token, LB-8 `key=`/`https://`): keep those words out of comments in
  `lib/ai/providers/*`.
- **`Response` in tests.** Node's global `Response` is used for mocked answers (`new Response(body, { status })`);
  RS-6 uses a hand-made object for the rejecting `text()`.
- **Deliberately not built:** a third provider, per-provider default models, temperature or other generation knobs
  (the DEC-017 request has none), streaming, retries, logging, a model-name normaliser, any UI or message change.
- **Extensible only where required:** a new OpenAI-compatible provider = one `createOpenAiCompatibleProvider` entry +
  one catalogue entry (OC-1 proves the factory is provider-neutral); a different wire format = one adapter file using
  `sendProviderRequest`.

## 7. Files changed (expected)
- new: `lib/ai/providers/http.ts`, `lib/ai/providers/gemini.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/providers/groq.ts`, `test/helpers/ai-http.ts`, `test/fixtures/ai/README.md`, `test/fixtures/ai/gemini/*.json`
  (6), `test/fixtures/ai/groq/*.json` (6)
- new tests: `lib/ai/providers/gemini.test.ts`, `lib/ai/providers/groq.test.ts`,
  `lib/ai/providers/openai-compatible.test.ts`, `lib/ai/providers/responses.test.ts`, `lib/ai/providers/errors.test.ts`,
  `lib/ai/providers/timeout.test.ts`, `lib/ai/provider-deps.interchange.test.ts` (merging some of these is fine; the
  test ids are what the verifiers map)
- changed: `lib/ai/providers/default-registry.ts`, `lib/ai/provider-catalog.ts`, `lib/ai/provider-catalog.test.ts`
  (PC-1), `lib/ai/providers/registry.test.ts` (PR-5 replaced, PR-6), `lib/ai/boundaries.test.ts` (LB-0, LB-2(a), LB-4
  widened; LB-8, LB-9 new), `lib/ai/env-example.test.ts` (EX-2, RM-1), `lib/ai/key-status.test.ts` (KS-2 catalogue
  loop), `lib/ai/provider-deps.test.ts` (PD-7 catalogue loop), `app/admin/ai/page.test.tsx` (PA-1/2/3/5 follow the
  catalogue; PA-6b, PA-7b new), `app/admin/ai/actions.test.ts` (AA-7 title, AA-7b new), `.env.example`, `README.md`,
  `test/fixtures/README.md`
- unchanged on purpose: `lib/config/ai-settings.test.ts` and `lib/config/ai-settings.pglite.test.ts` still use
  `mistral`/`openrouter` in their **injected** `providerIds` (DEC-016 §1: `lib/config` never reads the catalogue), so
  they test the config layer, not the catalogue.
- this file: `dev_minions/verification/US-026-plan.md`

## 8. Manual QA (for `US-026-qa.md`)
- Offline (Codex QA can run): the gates in AC9; `/admin/ai` served locally in `ro` and `en` lists exactly Google
  Gemini and Groq, shows the two key variables as not set, and no key value.
- Live, user (sprint-06.md step 1): create keys in Google AI Studio and the Groq console; add `GEMINI_API_KEY` and
  `GROQ_API_KEY` in Vercel (Production); redeploy; `/admin/ai` lists only Gemini and Groq, both "set", no value shown.
  If the database already stores `openrouter` or `mistral`, `/admin/ai` shows the unknown-provider notice and no error.
- Live, user, **after US-028 ships** (the chat is the only surface that calls a provider): sprint-06.md step 2
  (Gemini with a current model; unknown model → `model_not_found` reply), step 6 (switch to Groq, same commands work),
  step 7 (wrong key → "the AI provider rejected the key" for each provider; for Gemini this exercises the 400
  `API_KEY_INVALID` branch). The US-026 checklist lists them and says they run with US-028's checklist.

## 9. Decisions needed
| # | Type | Question | Status |
|---|---|---|---|
| Sprint #5 | PRODUCT | Which two providers? | **NEEDS USER; isolated default ships** (tech-lead: yes). Gemini + Groq, confined to `lib/ai/provider-catalog.ts` (PC-1), `lib/ai/providers/default-registry.ts` (+ the two adapter files), `.env.example` and README. `/admin/ai` follows the catalogue with no code change. Another pair = replace those entries (an OpenAI-compatible one is one factory entry). |
| Sprint #1 | TECHNICAL | Interface, closed codes incl. `model_not_found`, no SDK | Decided (DEC-017). Applied. |
| Sprint #6 | TECHNICAL | One request, no retry, 20 s | Decided. `AI_PROVIDER_TIMEOUT_MS` (US-025) used, never a literal (OR-2). |
| P-1 | TECHNICAL (settled here, within DEC-017 §1) | Where does the shared HTTP/error logic live? | `lib/ai/providers/http.ts`, the only `ctx.fetch(` call site; adapters supply URL, headers, body, an error-body rule and a text extractor. |
| P-2 | TECHNICAL (settled here) | Follow redirects? | No: `redirect: "error"` (a redirect would carry the custom key header to another origin); a redirect becomes `network`. |
| P-3 | TECHNICAL (settled here) | Groq token-limit field: `max_tokens` (AC2) or `max_completion_tokens` (Groq's current name)? | `max_tokens`, as AC2 says: Groq's reference still accepts it (marked deprecated, not removed), and it is the field every OpenAI-compatible provider accepts (Mistral accepts only `max_tokens`), which serves Task 2's "one more small entry". If Groq ever rejects it, the change is one field in `openai-compatible.ts` plus GQ-3; the live check is sprint-06.md step 6. |
| P-4 | TECHNICAL (settled here) | Adapter given `apiKey: null`? | `auth_failed`, no request (defensive; the resolver reports `no_api_key` first). |
| P-5 | TECHNICAL (settled here) | Gemini parts with `thought: true`? | Skipped when joining text (never requested; keeps thought text out of the JSON answer). |
| P-6 | TECHNICAL (settled here) | Does a whitespace-only answer count as text? | No: blank after trim → `bad_response` ("no text", Task 3). |

No open TECHNICAL item; the PRODUCT item has an isolated default → **not blocked**.
