# US-025 — Plan: pluggable LLM provider adapter interface
_Planned by story-planner (opus, high), 2026-09-26. Round 1._

Sources read: `backlog/stories/US-025.md` (incl. "Tech-lead review 2026-09-26"), `backlog/sprints/sprint-06.md`
(Decisions needed #1–#6), `decisions/DEC-017-ai-provider-layer.md`, DEC-016 §1 (via BC-1), DEC-015,
`lib/ai/*` (catalogue, key-status, settings-deps, boundaries test, key-status test), `lib/config/ai-settings.ts`,
`lib/config/boundaries.test.ts`, `app/admin/ai/page.tsx`, `lib/db/index.ts`, `test/helpers/*`,
`lib/extraction/adapters/{registry,default-registry}.ts` (naming precedent), `vitest.config.ts`, `tsconfig.json`.

No open TECHNICAL item; the one PRODUCT item (#4) ships its isolated default. **Not blocked.**

---

## 0. Module layout (names fixed by this plan)

| File | Kind | Role |
|---|---|---|
| `lib/ai/providers/types.ts` | new | `AiProvider`, `GenerateRequest`, `ProviderFetch`, `ProviderCallContext`, `ProviderCallInput`, `GenerateResult`, `PROVIDER_ERROR_CODES`, `ProviderErrorCode`. Types + one const array. No imports. |
| `lib/ai/providers/run-generation.ts` | new | `AI_PROVIDER_TIMEOUT_MS = 20_000` (sprint decision 6, the one constant) and `runGeneration(provider, request, input, options?)`. Imports only `./types`. |
| `lib/ai/providers/registry.ts` | new | `createProviderRegistry(adapters)` → `ProviderRegistry { get(id); list() }`. Imports `./types`, `../provider-catalog`. |
| `lib/ai/providers/default-registry.ts` | new | `SHIPPED_PROVIDER_ADAPTERS: readonly AiProvider[] = []` and `createDefaultProviderRegistry()`. **Empty in this story**; US-026 adds its two adapters here (mirrors `lib/extraction/adapters/default-registry.ts`). |
| `lib/ai/providers/resolve.ts` | new | Pure `resolveActiveProvider({ settings, registry, readApiKey })`, `ActiveProviderFailureReason`, `ActiveProviderResolution`, pure `toAvailability(resolution)` → `AiAvailability`. **Holds the `no_model` branch = isolated default of sprint decision #4.** Imports `./types`, `./registry` (type), `../provider-catalog`, `../../config/ai-settings` (type `AiSettings` only). |
| `lib/ai/provider-deps.ts` | new | **The one wiring module** (sprint decision 2 / DEC-017 §4). The only place that combines `getAiSettings`, `readApiKey`, the default registry and the global `fetch`. Exports `createProviderDeps()`, `loadActiveProvider(deps?)` (key-carrying, `lib/ai`-internal) and `getAiAvailability(deps?)` (key-free view for `app/`). Named `provider-deps` rather than `chat-deps` because it wires the provider layer for any capability (DEC-017 §5), following the `settings-deps.ts` / `default-deps.ts` convention. |
| `lib/ai/key-status.ts` | changed | Adds `readApiKey(providerId): string \| null`. `getKeyStatuses()` unchanged. Still the only `process.env` reader. |
| `lib/ai/boundaries.test.ts` | changed | LB-2 and LB-4 revised, LB-5..LB-7 added, LB-1/LB-3 untouched (section 1, AC5/AC6). |
| `test/helpers/ai-fakes.ts` | new | Fake provider (test double, not shipped): records calls, returns scripted outcomes. Reused by US-027/US-028. |
| tests | new | `lib/ai/providers/types.test.ts`, `run-generation.test.ts`, `registry.test.ts`, `resolve.test.ts`, `lib/ai/provider-deps.test.ts`; `lib/ai/key-status.test.ts` gets new cases appended (KS-1/KS-2 untouched). |

Not touched: `app/**` (nothing in `app/` imports the new modules in this story), `components/**`, `lib/config/**`,
`lib/ai/provider-catalog.ts`, `lib/ai/settings-deps.ts`, `messages/*.json`, `package.json`, `pnpm-lock.yaml`,
`lib/db/schema.ts`, `drizzle/**`, `.env.example`, README.

### Dependency direction (boundaries)
```
provider-deps.ts ──> key-status.ts ──> provider-catalog.ts
      │         ──> settings-deps.ts ──> ../config/ai-settings, ../db/index, ../ingestion/store
      │         ──> ../db/index (getDb), ../config/ai-settings (getAiSettings)
      │         ──> providers/default-registry ──> providers/registry ──> providers/types, provider-catalog
      └────────> providers/resolve ──> providers/types, providers/registry(type), provider-catalog, ../config/ai-settings(type)
providers/run-generation ──> providers/types        (callers: US-027 capability, US-028 entry module)
```
- Nothing in `lib/ai/providers/*` imports `key-status`, `provider-deps`, `lib/db` or `process.env`.
- `lib/config/` imports nothing from `lib/ai/` (BC-1, untouched).
- The key-carrying objects (`ActiveProviderResolution` ok branch, `ActiveProviderCall`, `ProviderCallInput`,
  `ProviderCallContext`) are used only inside `lib/ai/` (LB-5). `app/` gets `AiAvailability` only.

---

## 1. Acceptance criteria and the tests that prove them

Test ids are the ones the implementer must use, so the reviewer and tester can map them.

### AC1 — One adapter interface (FR6; sprint decision 1; DEC-017 §1)
Design (`lib/ai/providers/types.ts`):
```ts
export const PROVIDER_ERROR_CODES = ["timeout", "network", "auth_failed", "rate_limited",
  "model_not_found", "provider_error", "bad_response"] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];
export type GenerateRequest = { system: string; user: string; json: boolean; maxOutputTokens: number };
export type ProviderFetch = (url: string, init: RequestInit) => Promise<Response>;
export type ProviderCallContext = { apiKey: string | null; model: string; fetch: ProviderFetch; signal: AbortSignal };
export type ProviderCallInput = Omit<ProviderCallContext, "signal">;   // what callers hand to runGeneration
export type GenerateResult = { ok: true; text: string } | { ok: false; error: ProviderErrorCode };
export interface AiProvider { readonly id: string; generate(request: GenerateRequest, ctx: ProviderCallContext): Promise<GenerateResult>; }
```
- `ProviderFetch` is a local function type, **not** `typeof fetch` / `typeof globalThis.fetch`: `globalThis.fetch`
  is banned by LB-2 outside the wiring module, and a narrow type is easier to mock.
- `apiKey: string | null`: `null` only when the catalogue says `requiresApiKey: false` (no such entry today; PC-1
  pins every entry to `true`). Adapters that need a key return `auth_failed` on `null` (US-026).
- The adapter contract (never throw, no key/URL/body in a result, at most one request per call, network only via
  `ctx.fetch`) is written as a doc comment on `AiProvider`.

Tests:
- **PT-1** `types.test.ts`: `PROVIDER_ERROR_CODES` equals exactly the seven codes in the DEC-017 order (a change is a
  DEC-017 change); no duplicates.
- **PT-2** `types.test.ts`: the source of `types.ts` contains none of `gemini|groq|openrouter|mistral|openai|google|anthropic`
  (case-insensitive) and has zero module specifiers — "no type in the interface names a concrete provider".
- **PT-3** `types.test.ts` (type-level, enforced by `pnpm typecheck` since `tsconfig` includes `**/*.ts`):
  `expectTypeOf<Extract<keyof GenerateResult ...>>` style check that no member of the `GenerateResult` union has a key
  other than `ok | text | error` (so no `apiKey`, `message`, `detail`, `url`, `body`).
- **RG-*** (AC2): the fake provider in `test/helpers/ai-fakes.ts` is typed `AiProvider` and passes the wrapper tests —
  "a fake provider typed against them compiles and passes".

### AC2 — The wrapper never throws (FR6; AGENTS.md secrets; sprint decisions 1, 6; DEC-017 §2)
Design (`lib/ai/providers/run-generation.ts`):
```ts
export const AI_PROVIDER_TIMEOUT_MS = 20_000;
export async function runGeneration(provider: AiProvider, request: GenerateRequest, input: ProviderCallInput,
  options: { timeoutMs?: number } = {}): Promise<GenerateResult>
```
1. Creates its own `AbortController`; `ctx = { ...input, signal: controller.signal }` (it never forwards any
   caller signal, it owns the timeout).
2. Calls `provider.generate(request, ctx)` **exactly once**, inside `try` and via
   `Promise.resolve().then(() => provider.generate(...))` so a synchronous throw is caught too.
3. Races it against a `setTimeout(timeoutMs ?? AI_PROVIDER_TIMEOUT_MS)`. On timeout: `controller.abort()`, result
   `{ ok: false, error: "timeout" }`; the adapter's late result is ignored.
4. Normalises the adapter's value by **rebuilding** a fresh object: `{ ok: true, text }` only if `ok === true` and
   `typeof text === "string"`; `{ ok: false, error }` only if `error` is in `PROVIDER_ERROR_CODES`. Anything else
   (malformed object, unknown code, `undefined`) → `{ ok: false, error: "provider_error" }` (a contract breach is
   treated like a throw, DEC-017 §2). Extra fields an adapter adds are dropped.
5. A rejection / throw → `{ ok: false, error: "provider_error" }`; the caught value is discarded, never inspected
   for text, never logged.
6. `clearTimeout` in `finally` (no timer left pending after a settled call — matters on serverless).

Tests (`run-generation.test.ts`, fake timers via `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync`):
- **RG-1** ok passes through: `{ ok: true, text: "hello" }` → deep-equals `{ ok: true, text: "hello" }`; the fake
  recorded exactly one call, with the request unchanged and `ctx.model`/`ctx.apiKey`/`ctx.fetch` from the input
  and a non-aborted `ctx.signal`.
- **RG-2** async rejection with `new Error("boom SENTINEL-X")` → `{ ok: false, error: "provider_error" }`;
  `JSON.stringify(result)` contains neither `boom` nor `SENTINEL`.
- **RG-3** synchronous throw inside `generate` → `provider_error`; `runGeneration` itself resolves (use
  `await expect(...).resolves`).
- **RG-4** never-settling adapter: at `AI_PROVIDER_TIMEOUT_MS - 1` ms still pending; at `AI_PROVIDER_TIMEOUT_MS` →
  `{ ok: false, error: "timeout" }` and the recorded `ctx.signal.aborted === true`.
- **RG-5** every one of the seven codes (loop over `PROVIDER_ERROR_CODES`) passes through unchanged.
- **RG-6** malformed results → `provider_error`: `undefined`, `{ ok: true }` (no text), `{ ok: true, text: 42 }`,
  `{ ok: false, error: "weird" }`, `{ ok: false, error: "network", detail: "https://x?key=SENTINEL" }` → the last one
  becomes exactly `{ ok: false, error: "network" }` (extra field dropped).
- **RG-7** no pending timer after a settled call: `vi.getTimerCount() === 0` after RG-1's call; the signal is not
  aborted after success.
- **RG-8** `AI_PROVIDER_TIMEOUT_MS === 20000` (sprint decision 6 pin).
- Every result object in RG-1..RG-6 has keys ⊆ `{ ok, text, error }` ("never carries an exception message").

### AC3 — Registry (FR6; sprint-05 decision 10; DEC-017 §3)
Design (`lib/ai/providers/registry.ts`): `createProviderRegistry(adapters: readonly AiProvider[]): ProviderRegistry`
with `get(id: string): AiProvider | undefined` and `list(): readonly AiProvider[]` (in the given order, a frozen
copy). Construction **throws** `Error("duplicate provider id")` / `Error("provider id not in catalogue")` —
programming errors, the message names only the id (catalogue ids are not secrets). `default-registry.ts` exports
`SHIPPED_PROVIDER_ADAPTERS = []` and `createDefaultProviderRegistry()`.

Tests (`registry.test.ts`, fake providers from `ai-fakes.ts`):
- **PR-1** `get` returns the same adapter object for each registered id; `get("groq")` on a gemini-only registry and
  `get("")` return `undefined`.
- **PR-2** `list()` returns the adapters in construction order; mutating the returned array does not change the
  registry.
- **PR-3** duplicate id (`gemini` twice) throws.
- **PR-4** id not in `PROVIDER_CATALOG` (`"foo"`) throws; an empty list is valid.
- **PR-5** shipped registry is empty: `SHIPPED_PROVIDER_ADAPTERS` has length 0 and
  `createDefaultProviderRegistry().list()` is `[]`. Comment: "US-026 replaces this with: registry ids equal
  `PROVIDER_IDS` (DEC-017 §3)".

### AC4 — Resolution (FR6, FR11; sprint-05 decision 10; sprint decision 4)
Design (`lib/ai/providers/resolve.ts`), pure, no I/O, never throws:
```ts
export type ActiveProviderFailureReason = "not_configured" | "unknown_provider" | "not_implemented" | "no_api_key" | "no_model";
export type ActiveProviderResolution =
  | { ok: true; provider: AiProvider; model: string; apiKey: string | null }
  | { ok: false; reason: ActiveProviderFailureReason };
export function resolveActiveProvider(input: { settings: AiSettings; registry: ProviderRegistry;
  readApiKey: (providerId: string) => string | null }): ActiveProviderResolution
```
Order (story Task 4): 1 `settings.provider` null or blank → `not_configured`; 2 `findProvider(id)` undefined →
`unknown_provider`; 3 `registry.get(id)` undefined → `not_implemented`; 4 descriptor `requiresApiKey` and
`readApiKey(id)` is `null` → `no_api_key` (`readApiKey` is called only at this step, only for a catalogued,
implemented provider); 5 `settings.model` null or blank → `no_model` (**isolated default, PRODUCT #4**, marked
with a comment `// Sprint 6 decision #4 (NEEDS USER): no default model; the user must choose one (FR6).`);
6 ok with the trimmed model. The whole body sits in a `try`; anything unexpected (e.g. a `readApiKey` stub that
throws) returns `{ ok: false, reason: "no_api_key" }` if thrown at step 4 — simplest: wrap only step 4.
`toAvailability(resolution): AiAvailability` where
`AiAvailability = { available: true; providerId: string; model: string } | { available: false; reason: ActiveProviderFailureReason }`
— built field by field, never by spreading the resolution.

Tests (`resolve.test.ts`, a `readApiKey` spy, fake registry):
- **AR-1** `not_configured` for provider `null` and `"  "`; `readApiKey` not called.
- **AR-2** `unknown_provider` for stored `"foo"` (sprint-05 decision 10); no throw; `readApiKey` not called.
- **AR-3** `not_implemented` for `gemini` with an empty registry; `readApiKey` not called.
- **AR-4** `no_api_key` when `readApiKey` returns `null` (the "unset" and "blank" cases are proven at the source in
  KS-4 and end-to-end with `vi.stubEnv` in PD-2).
- **AR-5** `no_model` for model `null` and `"   "` with key present.
- **AR-6** ok: `{ ok: true, provider: <the fake>, model: "m-1", apiKey: "k" }`.
- **AR-7** order: settings that fail several checks at once report the earliest (e.g. unknown provider **and** no
  model → `unknown_provider`; implemented, no key **and** no model → `no_api_key`).
- **AR-8** never throws: a `readApiKey` that throws → a failure result, not an exception.
- **AR-9** `toAvailability`: ok → exactly keys `available, providerId, model`; failure → exactly `available, reason`.
- No network: resolution has no `fetch` parameter; PD-4 proves the wired path makes no request.

### AC5 — Key boundary (AGENTS.md Secrets; DEC-015 §1; sprint-05 decision 9; sprint decision 2; DEC-017 §4)
Design:
- `readApiKey(providerId)` in `key-status.ts`: `findProvider(providerId)` → undefined → `null` (so no arbitrary
  env name can be read); otherwise `process.env[descriptor.apiKeyEnvVar]`, `null` if not a string or blank after
  trim, else the **trimmed** value (consistent with `isSet`'s trim rule; a pasted trailing newline must not break
  auth).
- `lib/ai/provider-deps.ts`:
  ```ts
  export type ProviderDeps = { loadSettings: () => Promise<AiSettings>; registry: ProviderRegistry;
    readApiKey: (id: string) => string | null; fetch: ProviderFetch };
  export function createProviderDeps(): ProviderDeps      // getDb() only inside loadSettings (lazy, build-safe)
  export type ActiveProviderCall = { ok: true; provider: AiProvider; input: ProviderCallInput } | { ok: false; reason: ActiveProviderFailureReason };
  export async function loadActiveProvider(deps = createProviderDeps()): Promise<ActiveProviderCall>
  export async function getAiAvailability(deps = createProviderDeps()): Promise<AiAvailability>
  ```
  `createProviderDeps` sets `fetch: (url, init) => fetch(url, init)` (the only global `fetch` reference in
  `lib/ai`), `readApiKey` from `./key-status`, `registry: createDefaultProviderRegistry()`, `loadSettings: () =>
  getAiSettings(createAiSettingsDeps(getDb()))`. A settings-load error propagates to the caller (as `/admin/ai`
  already handles with try/catch); it happens before `readApiKey` runs, so no key is in scope. `getAiAvailability`
  = `toAvailability(resolveActiveProvider(...))` — key-free (tech-lead point 5: the view ships **in this story**,
  so the success-path sentinel test is here, not in US-028).
- Key-carrying names that must stay in `lib/ai/`: `loadActiveProvider`, `resolveActiveProvider`,
  `ActiveProviderCall`, `ActiveProviderResolution`, `ProviderCallInput`, `ProviderCallContext`, `readApiKey`.
  Key-free types for `app/`: `AiAvailability`, `GenerateResult`, `ActiveProviderFailureReason`.

Tests:
- **KS-3** (`key-status.test.ts`, appended; KS-1/KS-2 untouched) every catalogue var stubbed to a distinct sentinel
  (`SENTINEL-GEMINI-7d1e`, …); `readApiKey(id)` returns its own sentinel and no other provider's.
- **KS-4** unset (`vi.stubEnv(var, undefined)`), `""` and `"   "` → `null`; `"  SENTINEL-X \n"` → `"SENTINEL-X"`.
- **KS-5** `readApiKey("foo")`, `readApiKey("PATH")`, `readApiKey("GEMINI_API_KEY")` → `null` (only catalogue ids).
- **KS-1** (unchanged) still proves `getKeyStatuses()` returns booleans only (US-022 AC4).
- **PD-1** (`provider-deps.test.ts`, sentinels stubbed, real `readApiKey`, fake registry with a fake `gemini`,
  injected `loadSettings`/`fetch` spy): `loadActiveProvider` ok → `input.apiKey === "SENTINEL-GEMINI-7d1e"`,
  `input.model === "m-1"`, `input.fetch === deps.fetch` (proves the key does reach the adapter context).
- **PD-2** failure paths with sentinels set: `no_model`, `not_implemented`, `unknown_provider`, `not_configured`, and
  `no_api_key` (gemini var stubbed `""`, and `undefined`) → `JSON.stringify` of both `loadActiveProvider` and
  `getAiAvailability` results contains no `SENTINEL`.
- **PD-3** success-path availability: `getAiAvailability` for the ok case →
  `{ available: true, providerId: "gemini", model: "m-1" }` and `JSON.stringify` contains no `SENTINEL`.
- **PD-5** adapter error path: `runGeneration(call.provider, req, call.input)` with the fake returning
  `{ ok: false, error: "auth_failed" }`, and with a fake that throws `new Error("bad key SENTINEL-GEMINI-7d1e")` →
  serialised result contains no `SENTINEL`.
- **PD-6** type-level (typecheck-enforced): none of `AiAvailability`, `GenerateResult`, `ActiveProviderFailureReason`'s
  failure object has a key named `apiKey`/`key`/`secret`/`token` (a `HasSecretKey<T>` helper evaluated per union
  member, asserted `false` with `expectTypeOf`). Runtime mirror: PD-3/AR-9 exact key sets.
- **LB-3** unchanged (below).
- **LB-4** revised (below). **LB-5** new (below).

### AC6 — No SDK, network only by injection (ADR-001; AGENTS.md dependency and test rules; DEC-017 §3–4)
- **PD-4** `vi.stubGlobal("fetch", spy)` in `provider-deps.test.ts`; for every resolution branch (including ok),
  `loadActiveProvider` and `getAiAvailability` call neither the injected `deps.fetch` nor the global spy.
- **PD-7** `createProviderDeps()` with `DATABASE_URL` and all key vars stubbed unset does not throw and calls neither
  `getDb` nor `fetch` (spy by module mock of `../db/index` with `vi.mock`); `deps.fetch("u", {})` delegates to the
  stubbed global (proves the wiring holds the only global reference and forwards it).
- Every new test file stubs global `fetch` with a throwing spy in `beforeEach` (any accidental live call fails
  loudly); US-025 has no HTTP adapter, so no response fixtures are needed.
- `lib/ai/boundaries.test.ts` LB-2 revised, LB-6, LB-7 (below). `package.json` is not in "Files changed".

### AC7 — Nothing else changes, gates pass (DEC-016 §1; AGENTS.md Commands)
- `app/admin/ai/**` tests unchanged and passing; `app/admin/ai/page.tsx` unchanged (still imports only
  `getKeyStatuses`).
- `lib/config/boundaries.test.ts` BC-1 unchanged and passing.
- No schema, migration, message-file or UI change (reviewer: "Files changed" list; tester: `messages` key-parity test
  still passes).
- Gates (tester runs and quotes): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build`.

### Revised `lib/ai/boundaries.test.ts` (sprint decision 2, DEC-017 §4, tech-lead points 2–4)
All scans read non-test `.ts`/`.tsx` files; paths normalised to `/`. Specifiers are resolved against the importing
file's directory to a repo-relative target without extension (e.g. `../db/index` from `lib/ai/` →
`lib/db/index`); an `@/…` specifier resolves from the repo root.

- **LB-0** (non-vacuity, replaces the "≥ 3 files" check with a stronger one) `lib/ai` has ≥ 9 non-test files and
  includes `providers/types.ts`, `providers/run-generation.ts`, `providers/registry.ts`, `providers/resolve.ts`,
  `provider-deps.ts`.
- **LB-1** unchanged, verbatim.
- **LB-2** (revised; one `it` per file, as today):
  - (a) every specifier is relative (`./`, `../`) — no package at all, as today — and its resolved target is in
    `ALLOWED_TARGETS`. Today's four entries, resolved: `lib/ai/provider-catalog`, `lib/db/index`,
    `lib/ingestion/store`, `lib/config/ai-settings`. **Added (only these):** `lib/ai/key-status`,
    `lib/ai/settings-deps`, `lib/ai/providers/types`, `lib/ai/providers/run-generation`,
    `lib/ai/providers/registry`, `lib/ai/providers/default-registry`, `lib/ai/providers/resolve`.
    (`lib/ai/provider-deps` is not a target: nothing in `lib/ai` imports it in this story.)
  - (b) explicit SDK denylist on every specifier: `/^(openai|groq-sdk|ai|@ai-sdk\/|@google\/|@google-ai\/|@mistralai\/|@anthropic-ai\/|@openrouter\/|langchain|@langchain\/|ollama|cohere-ai|@huggingface\/)/`.
  - (c) no re-export bypass: no `export … from "…"` / `export * from` in `lib/ai` (the shared
    `extractModuleSpecifiers` helper does not see re-exports; the helper is not modified).
  - (d) no other network primitive anywhere in `lib/ai`: no `XMLHttpRequest`, `WebSocket`, `EventSource`,
    `sendBeacon`, `node:http`, `node:https`, `node:net`, `undici`.
  - (e) fetch rules: in every file **except** `provider-deps.ts`: no bare call (`/(^|[^.\w$])fetch\s*\(/m`) and no
    `globalThis.fetch` / `window.fetch` / `self.fetch` / `global.fetch`. In files **outside** `providers/` and
    `provider-deps.ts`: the token `\bfetch\b` does not occur at all. In `providers/*`: every
    `/[\w$.]*fetch\s*\(/g` match is exactly `ctx.fetch(`.
  - (f) positive check: `provider-deps.ts` contains a bare global `fetch(` call (the reference exists, and only
    there).
  Strictness: for every file outside `providers/*` and `provider-deps.ts`, (a)–(e) are at least as strict as the old
  "allowlist + no `fetch(`" (old: substring `fetch(` banned; new: the whole `fetch` token banned). No assertion is
  deleted.
- **LB-3** unchanged, verbatim (its file list now also covers `providers/`, which only widens it).
- **LB-4** (revised) walks `app/`, `components/` **and** `lib/`; importers of `key-status` (resolved target
  `lib/ai/key-status`, plus today's `endsWith` match kept) are exactly
  `["app/admin/ai/page.tsx", "lib/ai/provider-deps.ts"]`; no client component (`"use client"` as the first
  statement after optional comments/whitespace — stricter than today's `startsWith`) imports `key-status` or
  `provider-deps`; no file under `app/` or `components/` contains `readApiKey`.
- **LB-5** (new, tech-lead point 3) no file under `app/` or `components/` contains `loadActiveProvider`,
  `resolveActiveProvider`, `ActiveProviderCall`, `ActiveProviderResolution`, `ProviderCallInput`,
  `ProviderCallContext`, or imports `lib/ai/providers/resolve`/`lib/ai/key-status` other than LB-4's one page.
- **LB-6** (new) `lib/ai/providers/*` imports neither `key-status` nor `provider-deps` nor `lib/db` (adapters and
  capabilities never reach the key or the DB directly, DEC-017 §5).
- **LB-7** (new) `package.json` `dependencies` + `devDependencies` contain no name matching the LB-2(b) denylist.

---

## 2. Test double (`test/helpers/ai-fakes.ts`)
```ts
export type FakeStep = GenerateResult | { throws: Error } | { throwsSync: Error } | "hang" | unknown /* malformed */;
export function createFakeProvider(id: string, steps: FakeStep[] = [{ ok: true, text: "{}" }]):
  AiProvider & { calls: { request: GenerateRequest; ctx: ProviderCallContext }[] };
```
Each `generate` call consumes the next step (last one repeats); `"hang"` returns a promise that never settles and
ignores the signal (proves the wrapper does not depend on the adapter honouring abort). Also
`fakeCallInput(overrides?)` → a `ProviderCallInput` with a throwing `fetch` spy. Never imported from shipped code
(LB-2(a) forbids any `test/` target).

## 3. Data model / migrations
None. Reads `settings.ai_provider` / `settings.ai_model` through the existing `getAiSettings`; no write, so
data-model "Write rules" (DEC-010) are not engaged. No `pnpm db:generate`.

## 4. Risks and the smallest design
- **Weakening a boundary test** (AGENTS.md Never). Mitigation: section 1 lists every revised assertion with its
  strictness argument; LB-1/LB-3 are byte-identical; LB-4 is widened (scans `lib/`) not narrowed; new LB-5..LB-7.
  The reviewer diffs `lib/ai/boundaries.test.ts` against the list above.
- **Fake timers and `Promise.race`.** Use `await vi.advanceTimersByTimeAsync(...)` (flushes microtasks); call
  `vi.useRealTimers()` in `afterEach`. Do not use `AbortSignal.timeout` (not driven by fake timers).
- **Global `fetch` binding.** Pass `(url, init) => fetch(url, init)`, not the bare function object, so the adapter's
  `ctx.fetch(...)` call never has a foreign `this`.
- **Build with env unset.** `provider-deps.ts` must not call `getDb()`, `readApiKey()` or create the registry with
  side effects at import time (PD-7). Nothing in `app/` imports it yet, so the build risk is nil in this story.
- **Regex scans on source text** can false-positive on comments. Keep the word `fetch` out of comments in files where
  LB-2(e) bans the token (write "HTTP call" instead).
- **Windows paths** — `readdirSync(..., { recursive: true })` returns `\` on Windows; normalise with
  `split(path.sep).join("/")` (the repo runs under WSL, but keep it portable).
- **Deliberately not built:** concrete adapters, HTTP formats, capability registry (US-026/US-027), any UI or
  message key, retries, streaming, token accounting, a caller-supplied abort signal, logging.
- **Extensible only where required:** adapters plug in through `SHIPPED_PROVIDER_ADAPTERS` (FR6); capabilities will
  sit on `runGeneration` + `AiProvider` (DEC-017 §5). No generic plugin loader.

## 5. Decisions needed
| # | Type | Question | Status |
|---|---|---|---|
| Sprint #1 | TECHNICAL | Interface, closed codes (+`model_not_found`), no SDK, injected fetch | Decided (DEC-017). Applied as above. |
| Sprint #2 | TECHNICAL | Key path, wiring module, LB-2/LB-4 revision | Decided (DEC-017). This plan names the wiring module **`lib/ai/provider-deps.ts`**. |
| Sprint #3 | TECHNICAL | Capability system starts in US-027 | Decided (DEC-017). Nothing built here. |
| Sprint #6 | TECHNICAL | 20 s timeout, no retry | Decided. `AI_PROVIDER_TIMEOUT_MS` in `lib/ai/providers/run-generation.ts`. |
| Sprint #4 | PRODUCT | No default model vs a per-provider default | **NEEDS USER; isolated default ships** (tech-lead: yes): the `no_model` step in `resolveActiveProvider`, `lib/ai/providers/resolve.ts`, one commented `if`. A per-provider default would later be a catalogue field read at that one step. |
| P-1 | TECHNICAL (settled by this plan, within DEC-017 §2) | What does the wrapper return for a malformed adapter result or an unknown error code? | `provider_error` (a contract breach is treated like a throw); extra fields dropped by rebuilding the result. |
| P-2 | TECHNICAL (settled by this plan) | Does the wiring module swallow a settings-load (DB) error? | No: it propagates, before any key is read; callers catch it as `/admin/ai` does. Keeps the resolution vocabulary to the five story reasons. US-028's plan owns its "database unavailable" state. |
| P-3 | TECHNICAL (settled by this plan) | Does `readApiKey` trim? | Yes, same trim rule as `isSet`; blank → `null`. |

No open TECHNICAL item, and the PRODUCT item has an isolated default → **not blocked**.

## 6. Manual QA
None for this story alone (no route, no UI, no live call). It is proven live by sprint-06.md steps 2 and 6 once
US-026 and US-028 ship. The Codex QA loop can re-run the offline gates and `env -u … pnpm build`.

## 7. Files changed (expected)
- new: `lib/ai/providers/types.ts`, `lib/ai/providers/run-generation.ts`, `lib/ai/providers/registry.ts`,
  `lib/ai/providers/default-registry.ts`, `lib/ai/providers/resolve.ts`, `lib/ai/provider-deps.ts`,
  `test/helpers/ai-fakes.ts`
- new tests: `lib/ai/providers/types.test.ts`, `lib/ai/providers/run-generation.test.ts`,
  `lib/ai/providers/registry.test.ts`, `lib/ai/providers/resolve.test.ts`, `lib/ai/provider-deps.test.ts`
- changed: `lib/ai/key-status.ts` (+`readApiKey`), `lib/ai/key-status.test.ts` (+KS-3..KS-5),
  `lib/ai/boundaries.test.ts` (LB-0, LB-2, LB-4 revised; LB-5..LB-7 new; LB-1/LB-3 verbatim)
- this file: `dev_minions/verification/US-025-plan.md`
