# US-058 plan: Assistant reliability (confirm before big changes, self-correction, structured output)

> Planned by `story-planner`, 2026-10-07. Binding inputs: `backlog/stories/US-058.md` (PO requirements 1-5, AC1-AC6),
> **DEC-027** §2 (native structured output and downgrade), §3 (one correction round, call cap), §4 (signed plan token);
> DEC-027 §1/§5/§6 as built by US-055; DEC-022 (closed operation set, validate-all-first, in-order execution); DEC-025 §2
> (max 5 model actions), §7 (normalisation); DEC-017 §4 / DEC-021 §2 (key boundary, key-source rule); DEC-015.
> **Not blocked.** No TECHNICAL item is open: T-1..T-19 (§5) are settled by DEC-027 and DEC-028. T-1 uses the
> Decided bounded exception in DEC-028: `strict: false` with the envelope-only schema. D-1..D-3 are
> PRODUCT items that ship isolated defaults.

## 0. What exists today (read before coding)
- `lib/ai/chat.ts` `handleChatMessage(raw, depsFactory, { history })`: trim → empty/too_long → key-request refusal →
  `prepareHistory` → provider → context + widgets → **one** model call via `interpretConfigurationRequest` → key guard →
  `answered` | `interpreted` | normalise (US-054) → `*` expansion (US-053) → validate all (first failure returns
  `invalid_action`) → `executeActions` → `executed_actions` (+ `reply`). `ValidatedAction` is private to chat.ts.
- `lib/ai/providers/types.ts`: `GenerateRequest = { system, messages, format: "json_object" | "none", maxOutputTokens }`;
  `PROVIDER_ERROR_CODES` = 7 codes (PT-1 pins them). `http.ts` `sendProviderRequest` maps non-2xx through the adapter's
  `errorBodyRule` (Gemini 400 `API_KEY_INVALID` → `auth_failed`; Groq 400 `json_validate_failed` → `bad_response`), then
  `mapHttpStatus`. `openai-compatible.ts` serves Groq, the six presets and custom providers; `gemini.ts` merges turns.
- `runGeneration` owns a 20 s timeout per call; `/chat` has `maxDuration = 60`.
- `lib/ai/provider-catalog.ts` (zero imports, LB-1): eight descriptors; nothing outside it constructs `ProviderDescriptor`.
- `lib/ai/key-store.ts`: HKDF-SHA256 (`KEY_DERIVATION_SALT`, info `ai-provider-keys/v1`); `key-status.ts`
  `getEncryptionKeyMaterial(env)` (master first, else `CRON_SECRET` ≥ 24 chars). Boundary tests pin the importers:
  key-status ← {key-store, provider-deps, settings-deps} (LB-4); key-store ← {provider-deps, lib/config/ai-keys} (LB-10);
  `node:crypto` allowed only in key-store.ts (LB-2).
- Client: `components/chat/transcript.ts` `chatTurn(prev, formData, action, hiddenLabel, historyMessages?)`;
  `components/chat/*` never imports `lib/ai` (CV-4). No DOM test environment (static render only).
- Test fakes: `createFakeProvider(id, steps)` repeats its **last** step when exhausted; most chat tests register it as
  `"gemini"`.

## 1. Acceptance criteria → proving tests
| AC | Criterion (short) | Proof |
|---|---|---|
| AC1 | Gates green; no behaviour test loosened; deliberate changes listed in HANDOVER | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` (offline; `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/every `*_API_KEY` unset), `bash scripts/claude/predeploy-check.sh`. Deliberate test changes = §3.2, copied into HANDOVER with the reasons given there. |
| AC2 | Confirm-category not executed on first turn; plan shown; "da"/"yes" executes; "nu"/"no" executes nothing; single-ETF clear and any add run at once | `lib/ai/chat-plan.test.ts` NC-1..NC-8 (`needsConfirmation` table: remove_etf, untrack_field, widget_clear on 2 ETFs, widget_replace on 2 ETFs, clear on A + replace on B, mixed add + remove → true; single-ETF clear (slot/`all`/match), single-ETF replace, every add/track/widget_add/widget_update incl. on `*` → false). `lib/ai/chat.confirm.test.ts` CF-1..CF-6 (mocked execute): each category → `proposed`, execute spies **not** called, `results` all `status: "proposed"` listing every expanded ETF, `token` set, model `reply` kept; single-ETF clear and add → `executed_actions` at once. `lib/ai/chat.confirm.pglite.test.ts` CP-1..CP-4 (real DB): propose leaves DB unchanged; `confirmChatPlan(token)` changes it. `components/chat/transcript.confirm.test.ts` TC-1..TC-7: pending plan + "da"/"Yes"/"DA!"/"confirmă" → `confirmAction` called once with a FormData holding **only** `token`, `action` not called; "nu"/"no" → plan discarded (token removed), sent as a new request; with the fake server returning `{"reply":"OK","actions":[]}` nothing executes (conversation dialogue D13). Dialogue D14: the model answers "nu" with the same `remove_etf` again → `proposed` again, still nothing executed (safety does not depend on the model). |
| AC3 | After "yes", executed = shown plan even if the model would answer differently; tampered/expired/no-longer-valid plan refused with a specific reason | `chat.conversation.test.ts` CF-7/CF-8: confirmation executes the exact signed plan with no second model call; CF-3/CF-4: changed state → `state_changed`, no execution; CF-9/CF-10: service refuses a tampered/expired token before loading state or executing, with provider calls unchanged. `chat.pglite.test.ts` CEP-C1: first confirmation removes the ETF; replaying the same token returns `state_changed`, preserves the post-confirm DB snapshot, and makes no provider call. `chat-plan.test.ts` PT-1..PT-9: sign/verify round trip; tampered payload/signature/wrong key/malformed payload/over-long token refused; expired token → `expired`; signature checked before expiry; payload never contains the key. `reply-messages.confirm.test.ts` RF-1: each refusal reason → its own message key. |
| AC4 | Recorded invalid first answer + valid corrected answer → correct actions, one reply; calls never exceed the cap; second failure ends with the specific reason — fake fetch | `lib/ai/chat.correction.test.ts` (real Groq/Gemini adapters, fake `fetch`, mocked execute) SC-1 (action 2 `unknown_field` → corrected → `executed_actions`, one outcome, `fetch` called 2×; second request body: messages = history + user + assistant(previous output) + user(correction text with `action 2: unknown_field (BTBETRETF)`)); SC-2 (unparseable first answer → corrected); SC-3 (invalid twice → `invalid_action` with the **second** answer's reason, exactly 2 calls, nothing executed); SC-4 (correction call returns `rate_limited`/`timeout`/`provider_error` → the **first** answer's `invalid_action`, 2 calls); SC-5 (`rate_limited` on the first call → no retry, 1 call); SC-6 (legacy `{"kind":"unsupported"}`, `too_many`, an `answer` → no correction, 1 call); SC-7 (downgrade then invalid then correction → 3 calls, never 4; a 4th would-be call is not made); SC-8 (time budget: fake clock leaves < 5 s → no correction call, first outcome); SC-9 (correction text: only closed codes and data-block values; a model-invented symbol, field key, title or free text from the first answer never appears in it; grounding still uses only history + the user's message — `symbol_not_in_message` cannot be cured by the correction turn); SC-10 (first answer containing key material → no correction, first outcome). `lib/ai/correction.test.ts` CR-1..CR-5 for the text builder. |
| AC5 | Per provider family the request uses DEC-027's mode; fallback works when rejected — fake fetch | `lib/ai/model-call.test.ts` MC-1 (for each `PROVIDER_CATALOG` id through the default registry + a custom provider: request body shape — gemini `responseMimeType` + `responseSchema`; groq/openai/mistral/cerebras `response_format.type === "json_schema"`, `json_schema.name === "chat_answer"`, `strict: false`, `schema` = `ANSWER_JSON_SCHEMA`; openrouter/deepseek/together/custom `response_format.type === "json_object"`), MC-2 (json_schema → HTTP 400 → same request retried once as json_object → parsed; 2 calls), MC-3 (422 same), MC-4 (after a successful downgrade the next message for the same provider+model goes straight to json_object, 1 call; another model still tries json_schema), MC-5 (downgrade retry also fails → no caching, outcome `provider_error`, never `unsupported_format`), MC-6 (Gemini 400 `API_KEY_INVALID` → `auth_failed`, Groq 400 `json_validate_failed` → `bad_response`: no downgrade), MC-7 (json_object/none requests never produce `unsupported_format`). `gemini.test.ts` GM-S1 asserts the converted `slot` schema is nullable `STRING` (supports `"all"`; numeric strings are normalized server-side) and checks the same property in the actual request body, plus uppercase types, `nullable`, no `additionalProperties`, and non-empty OBJECT properties. `openai-compatible.test.ts` OC-S1, `http.test`/`errors.test.ts` ER-UF1 (`unsupportedFormatStatuses`). `chat.correction.test.ts` SC-11: a json_schema answer with `null` optional keys (`"slot":null,"match":null`) is accepted (T-5). |
| AC6 | Key boundary, sanitised logs, closed operation set unchanged; boundary tests green | `lib/ai/boundaries.test.ts` green with additions only (§3.2 item 9): LB-4 and LB-10 importer lists **unchanged** (the signing key reaches chat.ts through `ChatDeps.planKey`, built in provider-deps.ts); LB-9 (no `console.`) covers the new files; LB-3 (`process.env` only in key-status.ts) unchanged. `key-store.test.ts` KS-P1..KS-P3 (`derivePlanSigningKey`: 32 bytes, differs from the AES key for the same material, master vs cron sources differ, `null` material → `null`). `chat.confirm.test.ts` CF-9 (no `console.*` output during propose/confirm/refuse contains the token, reply, message or a fake key sentinel), CF-10 (key request while a plan is pending → still refused before any deps call). Closed operation set: `registry.test.ts`, `action-list.test.ts`, `widgets/intent.test.ts` unchanged and green; `confirmChatPlan` runs only intents that `executeActions` already accepts (CP-9: a validly signed payload whose plan holds an unknown action/capability → `tampered`, nothing runs). |

**MANUAL-QA** (live provider + Neon; goes into `US-058-qa.md` and the demo file):
- M-1 (story check 1) "șterge valoarea maximă pe 30 de zile la toate ETF-urile" → plan listing every active ETF and
  "Continui?"; answer "nu" → nothing changes on `/etf/<symbol>`; repeat, answer "da" → cleared.
- M-2 (story check 2) "remove PTENGETF" → asks first; answer "no" → PTENGETF still listed on the home page.
- M-3 Ask for a removal, wait more than 10 minutes, press "Confirm" → the "expired" message, nothing changes.
- M-4 Ask for a removal in two browser tabs, confirm in tab 1, then in tab 2 → "Things changed…", nothing runs twice.
- M-5 Structured output live: Groq `openai/gpt-oss-120b`, Gemini `gemini-2.5-flash`, and (if keys exist) OpenAI,
  Mistral, Cerebras → normal answers, no provider error; Groq `llama-3.3-70b-versatile` → the first message may take one
  extra call (downgrade), later messages work normally.
- M-6 A normal 6-turn conversation on the Groq free tier does not hit `rate_limited` more often than before.

## 2. Files and boundaries (implementation order)
1. **`lib/ai/providers/types.ts`**: `PROVIDER_ERROR_CODES` gains `"unsupported_format"` (last); `export type JsonSchema =
   { readonly [key: string]: unknown }`; `GenerateRequest.format: "json_schema" | "json_object" | "none"`, `schema?:
   JsonSchema` (required by the adapters only when `format === "json_schema"`; missing → treated as `json_object`).
2. **`lib/ai/providers/http.ts`**: `ProviderHttpCall` gains optional `unsupportedFormatStatuses?: readonly number[]`.
   Non-2xx order: `errorBodyRule` first (keeps `auth_failed`/`bad_response`), then `unsupported_format` if the status is
   listed, then `mapHttpStatus`.
3. **`lib/ai/providers/openai-compatible.ts`**: `json_schema` → `response_format: { type: "json_schema", json_schema:
   { name: "chat_answer", strict: false, schema } }` and `unsupportedFormatStatuses: [400, 422]`; `json_object` → today's
   body; `none` → no `response_format`. Still one request per call.
4. **`lib/ai/providers/gemini.ts`**: exported pure `toGeminiSchema(schema)` (T-3); `json_schema` → `responseMimeType:
   "application/json"` + `responseSchema`, `unsupportedFormatStatuses: [400, 422]`. The `API_KEY_INVALID` rule runs first.
5. **`lib/ai/provider-catalog.ts`**: `export type StructuredOutputMode = "json_schema" | "json_object" | "none"`;
   `ProviderDescriptor.structuredOutput` (required): gemini, groq, openai, mistral, cerebras → `"json_schema"`;
   openrouter, deepseek, together → `"json_object"` (T-2). `structuredOutputFor(id): StructuredOutputMode` → the
   descriptor's value, else `"json_object"` (custom providers, DEC-027 §2). Still zero imports (LB-1).
6. **`lib/ai/capabilities/action-list.ts`**: `export const ANSWER_JSON_SCHEMA: JsonSchema` (T-3): object with `reply`
   (`["string","null"]`), `actions` (array, `maxItems: 5`, items = object with optional properties `capability` (enum
   configuration/widgets), `action`, `symbol`, `etf`, `field`, `name` (`["string","null"]`), `slot` (`["integer","string"]`),
   `definition` / `changes` (object: operation, fieldKey, periodUnit, periodAmount integer, title), `match` (object:
   operation, fieldKey, periodUnit, periodAmount), `definitions` (array of the definition object)), `question`
   (`["string","null"]`); envelope `required: ["reply","actions","question"]`, `additionalProperties: false` on the
   envelope only. Also `export function stripSchemaNulls(action: Record<string, unknown>): Record<string, unknown>`
   (T-5): returns a copy without top-level keys whose value is `null` **except `name`**, and without `null` keys inside
   `definition`/`changes`/`match`/each `definitions[]` entry. Pure, never mutates. Parser unchanged.
7. **`lib/ai/capabilities/configuration/interpret.ts`**: new `runConfigurationTurn(request, generate):
   Promise<{ outcome: ActionListOutcome; text: string | null }>` (one `generate` call, `text` = the raw model text when
   the call succeeded). `interpretConfigurationRequest` becomes `buildConfigurationRequest` + `runConfigurationTurn` →
   `.outcome` (same behaviour; its tests stay unchanged).
8. **`lib/ai/capabilities/configuration/prompt.ts`** (T-17): one sentence, e.g. `The app itself asks the user to
   confirm remove_etf, untrack_field and widget_clear/widget_replace on several ETFs: still put them in "actions" and
   never ask for that confirmation in "question".` CP-12 (≤ 8000 chars, empty context; currently 7761) must stay green
   **unchanged**: shorten other prose without touching any pinned substring; if impossible, stop and escalate.
   `buildConfigurationRequest` still returns `format: "json_object"` (CX-1 unchanged; the model-call layer chooses the
   final format).
9. **`lib/ai/key-store.ts`**: `export const PLAN_SIGNING_INFO = "chat-plan/v1"`; `export function
   derivePlanSigningKey(material: EncryptionKeyMaterial | null): Uint8Array | null` — HKDF-SHA256, salt
   `KEY_DERIVATION_SALT`, info `PLAN_SIGNING_INFO`, 32 bytes; input key material = the 32 master bytes (master) or the
   UTF-8 secret (cron_derived); `null` → `null`. Never logs.
10. **`lib/ai/provider-deps.ts`**: `export function getChatPlanSigningKey(env?: KeyEnvironment): Uint8Array | null` =
    `derivePlanSigningKey(getEncryptionKeyMaterial(env))` (both modules already imported here: LB-4/LB-10 unchanged).
11. **`lib/ai/model-call.ts`** (new; T-4, T-8):
    - `MAX_MODEL_CALLS_PER_MESSAGE = 2`, `MAX_MODEL_CALLS_WITH_DOWNGRADE = 3`, `CHAT_MODEL_TIME_BUDGET_MS = 45_000`,
      `MIN_MODEL_CALL_MS = 5_000`.
    - `createFormatCache()` → `{ isDowngraded(key), markDowngraded(key) }` (an in-memory `Set`); module singleton
      `DEFAULT_FORMAT_CACHE`; key = `${providerId}\n${model}`.
    - `createModelCaller({ provider, input, mode, cache, now })` → `{ call(request): Promise<GenerateResult>;
      remaining(): number }`. `call` sets `format`/`schema` from `mode` (`json_schema` unless cached-downgraded;
      `json_object`; `none`) and calls `runGeneration(provider, request, input, { timeoutMs: min(AI_PROVIDER_TIMEOUT_MS,
      budget left) })`. On `unsupported_format` (only possible for json_schema) and if the cap allows: retry once with
      `json_object`, raise the cap to 3, and `markDowngraded` only if the retry is `ok`. A final `unsupported_format` is
      returned as `provider_error`. No call is made when the cap is reached or less than `MIN_MODEL_CALL_MS` is left —
      it returns `{ ok: false, error: "timeout" }` and the caller treats it as "no correction". `remaining()` = calls
      still allowed under the current cap and budget.
12. **`lib/ai/chat-plan.ts`** (new; T-9..T-13; imports `node:crypto`, `node:buffer`, type-only intents/contexts):
    - `export type PlannedAction = { index: number } & ({ capability: "configuration"; intent: ConfigurationIntent } |
      { capability: "widgets"; intent: WidgetIntent })` (chat.ts's `ValidatedAction` becomes this type).
    - `needsConfirmation(plan)`: any `remove_etf` or `untrack_field`, or the **distinct** symbols over all
      `widget_clear` + `widget_replace` intents number more than one.
    - `canonicalJson(value)` (keys sorted recursively, arrays in order).
    - `planFingerprint(plan, configuration, widgets)`: SHA-256 hex of `canonicalJson({ active: sorted active symbols,
      etfs: { <each distinct plan symbol, sorted>: null | { active, tracked: sorted field keys, widgets: [{ slot,
      operation, fieldKey, periodUnit, periodAmount, title? }] by slot } } })`.
    - `PLAN_TOKEN_VERSION = 1`, `PLAN_TOKEN_TTL_MS = 600_000`, `PLAN_TOKEN_MAX_CHARS = 64_000`.
    - `signPlanToken({ plan, fp, exp, n }, key)` → `base64url(utf8(canonicalJson({ v: 1, plan, fp, exp, n }))) + "." +
      base64url(HMAC-SHA256(key, <that first segment's bytes>))`; `n` = 16 random bytes base64url (injectable).
    - `verifyPlanToken(token, key, nowMs)` → `{ ok: true; plan; fp } | { ok: false; reason: "tampered" | "expired" }`.
      Order: type/length → exactly two base64url segments → HMAC compare with `timingSafeEqual` (length check first) →
      JSON parse → `v === 1`, `fp` 64-hex, `exp` finite number, `n` string, `plan` a non-empty array whose items pass a
      shape guard (`index` positive integer, `capability` configuration/widgets, `intent.action` in that capability's
      closed action list, `intent.symbol` string) → only then `exp > nowMs` else `expired`. Any failure → `tampered`.
13. **`lib/ai/correction.ts`** (new; T-6, T-7): `CORRECTION_PREVIOUS_MAX_CHARS = 4000`, `CORRECTION_MAX_LINES = 10`.
    `describeFailure(index, reason, raw, configuration)` → one line `action <n>: <reason>[ (<parts>)]`, parts only from:
    the symbol if it is a context ETF symbol; field key if it is in that ETF's catalogue; operation if in
    `WIDGET_OPERATIONS`; periodUnit if in the closed set; periodAmount if an integer 1–365 (from the normalised action's
    `definition`/`match`/`changes`); `slot` if an integer 1–6 or `"all"`. Never a name, title, label or free text.
    Parse failure → `answer: unparseable (one JSON object {"reply","actions","question"} expected)`.
    `buildCorrectionMessages(history, message, previousText, lines)` → `[...history, user(message),
    assistant(middleCut(previousText, 4000)), user(header + lines + footer)]` with fixed English header
    `Your previous answer could not be used:` and footer `Answer the user's latest message again with one corrected
    JSON object only. If a detail is missing, ask in "question" with "actions":[].`
14. **`lib/ai/chat.ts`** (orchestration; T-6, T-14, T-16):
    - `ChatDeps` gains optional `planKey?: () => Uint8Array | null` and `formatCache?`; `createChatDeps` sets
      `planKey: () => getChatPlanSigningKey()`. Absent `planKey` = no key material.
    - `handleChatMessage(raw, depsFactory, options: { history?: unknown; now?: () => number } = {})`. Order up to
      `prepareHistory` unchanged. Then: caller = `createModelCaller({ mode: structuredOutputFor(active.provider.id), … })`;
      attempt 1 = `runConfigurationTurn(buildConfigurationRequest(message, promptContext, history), caller.call)`;
      a private `evaluate(text, outcome)` does key guard → (answer/interpreted return as today) → for json_schema-mode
      answers `stripSchemaNulls` → normalise → expand → validate **every** action, collecting all failures (the first
      one is the user-facing `invalid_action`, as today).
    - Correction (once) when attempt 1 is `unclear/malformed` or has ≥ 1 failure, and `caller.remaining() > 0`, and the
      previous text is non-null and has no key material (`containsKeyMaterial`). Attempt 2 uses `buildCorrectionMessages`
      with the same system prompt; its outcome replaces attempt 1's **unless** its call failed (any provider error,
      cap, budget) — then attempt 1's outcome is returned. Grounding text for both attempts = history user turns +
      `message` only.
    - Valid plan: `needsConfirmation(validated)` → no key → `{ kind: "plan_refused", reason: "unavailable" }`; widget
      context failed to load → `{ kind: "error" }`; else `{ kind: "proposed", results, token, reply? }` where `results`
      are `ChatActionResult`s with `status: "proposed"`, `changed: false`, `field` (track/untrack) and `detail` (widgets)
      built from the context exactly as executed results are. Otherwise execute at once (today's path).
    - `ChatActionResult.status` gains `"proposed"`; `ChatOutcome` gains `{ kind: "proposed"; results; token: string;
      reply?: string }` and `{ kind: "plan_refused"; reason: "tampered" | "expired" | "state_changed" | "unavailable" }`.
    - `export async function confirmChatPlan(rawToken: unknown, depsFactory = createChatDeps, options: { now?: () =>
      number } = {}): Promise<ChatOutcome>`: string ≤ `PLAN_TOKEN_MAX_CHARS` else `tampered`; `try` { deps; key (none →
      `unavailable`); `verifyPlanToken`; load configuration context + widget context (failure → `error`); recompute
      fingerprint, mismatch → `state_changed`; `executeActions(plan, deps, context)` → `executed_actions` (no reply) }
      `catch` → `error`. No provider resolution, no model call, no re-validation (DEC-027 §4).
    - Never logs; no `console.*`; the token never enters a log, a memo or the history.
15. **`lib/ai/chat-history.ts`**: `historyMemo` cases: `proposed` → `<reply>\n\n[proposed, waiting for confirmation:
    <status>: <action> — <symbol>; …]` (never the token); `plan_refused` → `[nothing done: plan_refused <reason>]`.
16. **`app/chat/reply-messages.ts`**: `proposed` → `{ tone: "info", messageKey: "planProposed", modelText?: reply,
    actions: grouped lines (status "proposed", keys `willAddEtf`, `willRemoveEtf`, `willTrackField`, `willUntrackField`,
    `willAddWidget`, `willUpdateWidget`, `willClearWidgets`, `willReplaceWidgets`, with `field`/`what` as today), plan:
    { token, status: "pending" } }` — never the single-line shortcut; `plan_refused` → `planRefusedTampered |
    planRefusedExpired | planRefusedStateChanged | planUnavailable`; `PROVIDER_ERROR_KEYS.unsupported_format =
    "providerError"` (never reached). `changedActions` unchanged (only `done`).
17. **`app/chat/actions.ts`**: new `confirmChatPlanAction(formData)`: reads **only** `token`, calls `confirmChatPlan`,
    revalidates exactly like `sendChatMessageAction` (shared helper), returns `buildChatReply`; catch →
    `GENERIC_ERROR_REPLY`.
18. **`components/chat/chat-state.ts`**: `ChatActionReplyState.status` + `"proposed"`; `ChatReplyState.plan?: { token?:
    string; status: "pending" | "confirmed" | "cancelled" | "discarded" }`.
19. **`components/chat/confirm.ts`** (new, pure, client-safe): `CONFIRM_WORDS` (D-2), `isConfirmAnswer(text)` (trim,
    lower case, strip diacritics via NFD, drop trailing `.`/`!`, exact list match), `pendingPlanToken(entries)` (the
    last entry's `reply.plan` when `status === "pending"` and a token is present, else `null`).
20. **`components/chat/transcript.ts`**: `CONFIRM_INTENT = "confirm"`, `CANCEL_INTENT = "cancel"`, `CANCELLED_MEMO =
    "[cancelled by the user: nothing done]"`, `DISCARDED_MEMO_SUFFIX = " [not confirmed: nothing done]"`. `chatTurn`
    keeps its 5 parameters and gains an optional 6th `confirm?: { action; confirmLabel; cancelLabel }`:
    - pending + (intent confirm, or a typed message where `isConfirmAnswer`) → new FormData with only `token` →
      `confirm.action`; the pending entry's plan → `{ status: "confirmed" }` (token dropped); append the user text (typed
      text, or `confirmLabel` for the button) and the reply.
    - pending + intent cancel → no server call; plan → `cancelled`; append `cancelLabel` with
      `{ tone: "info", messageKey: "planCancelled", memo: CANCELLED_MEMO }`.
    - pending + any other message → plan → `discarded`, its memo gets `DISCARDED_MEMO_SUFFIX`, then the normal send.
    - no pending plan → today's behaviour exactly (intent `new` included).
21. **`components/chat/ChatPanel.tsx`**: optional prop `confirmAction`; when `pendingPlanToken(transcript) !== null`,
    renders `ChatPlanControls` (new small component in the same folder): two `<button type="submit" name="intent"
    value="confirm|cancel" formNoValidate>` with `Chat.confirm` / `Chat.cancel`. Without `confirmAction` nothing new
    renders.
22. **`components/chat/ChatReply.tsx`**: `actionStatus.proposed` label; when `reply.plan` is set, the list heading is
    `Chat.proposedHeading` ("What the app will do" / "Ce va face aplicația") instead of `resultsHeading`, and the
    `planProposed` sentence ("Proceed? / Continui?" …) is rendered after the list even when `modelText` is set. Markup
    for replies without `plan` stays byte-identical (G-C1).
23. **`components/chat/ChatView.tsx`**, **`app/chat/page.tsx`**: pass `confirmAction={confirmChatPlanAction}`.
24. **`messages/en.json` / `ro.json`** (D-1): `Chat.replies.{planProposed, planCancelled, planRefusedTampered,
    planRefusedExpired, planRefusedStateChanged, planUnavailable, willAddEtf, willRemoveEtf, willTrackField,
    willUntrackField, willAddWidget, willUpdateWidget, willClearWidgets, willReplaceWidgets}`,
    `Chat.replies.actionStatus.proposed`, `Chat.{proposedHeading, confirm, cancel}`. Placeholder parity (CRM-3).
    DEC-027 wording for `planRefusedStateChanged` ("Things changed since this was proposed — please ask again") and
    `planUnavailable` ("Confirmation is not available; ask again").
25. **Docs**: `README.md` chat paragraph (big changes are confirmed first; one automatic correction; structured
    output where the provider supports it). No `data-model.md` change.

Boundaries: `components/chat/*` still never imports `lib/ai` (CV-4): the confirm-word matcher and plan state live in
`components/chat/confirm.ts`. Key material stays in `lib/ai` (key-store → provider-deps → `ChatDeps.planKey` →
chat-plan). `app/chat/actions.ts` imports only `@/lib/ai/chat` (+ existing). No SQL outside `lib/config`; no table.

## 3. Test changes
### 3.1 New tests (all offline; PGlite for SQL; fake `fetch` / fake provider; fake clock)
- `lib/ai/chat-plan.test.ts` NC-1..NC-8, PT-1..PT-9 (§1), FP-1..FP-4 (`canonicalJson` key order independence;
  fingerprint changes on: active set, tracked field, widget slot/definition/title of an affected ETF; does **not**
  change on an unaffected ETF's widgets).
- `lib/ai/model-call.test.ts` MC-1..MC-7, plus cap/budget unit cases (counting fake provider, fake clock).
- `lib/ai/correction.test.ts` CR-1 (exact line for each reason family), CR-2 (model-invented symbol/field/title not
  echoed), CR-3 (max 10 lines, then `… and N more`), CR-4 (previous output middle-cut to 4000), CR-5 (messages order).
- `lib/ai/chat.correction.test.ts` SC-1..SC-11 (§1).
- `lib/ai/chat.confirm.test.ts` CF-1..CF-10 (mocked execute, fixed fake `planKey`).
- `lib/ai/chat.confirm.pglite.test.ts` CP-1..CP-9 (real config/widgets/execute, mocked `detect`, fake clock).
- `lib/ai/key-store.test.ts` additions KS-P1..KS-P3; `lib/ai/provider-deps.test.ts` PD-K1 (`getChatPlanSigningKey`
  with fake env objects only: master, cron, neither → `null`).
- `lib/ai/provider-catalog.test.ts` PC-6 (`structuredOutput` per id exactly as §2 step 5; `structuredOutputFor`
  of an unknown/custom id → `json_object`).
- `lib/ai/capabilities/action-list.schema.test.ts` AS-1 (`ANSWER_JSON_SCHEMA` shape; every `CONVERSATION_EXAMPLES`
  output and every `PROMPT_EXAMPLES` action uses only properties it lists), AS-2 (`stripSchemaNulls` keeps `name: null`,
  never mutates, leaves non-null values).
- `lib/ai/providers/gemini.test.ts` GM-S1, `openai-compatible.test.ts` OC-S1, `errors.test.ts` ER-UF1 (additions).
- `app/chat/reply-messages.confirm.test.ts` RF-1 (each refusal), RF-2 (`proposed` → lines with status `proposed`,
  grouped symbols, `plan.token`, `modelText`, memo without token), RF-3 (every new key exists in both locales).
- `app/chat/actions.confirm.test.ts` CA-1 (only `token` read: `message`/`history` in the FormData are ignored), CA-2
  (revalidation for a confirmed remove), CA-3 (throw → generic reply).
- `components/chat/confirm.test.ts` CW-1..CW-3 (`da`, `DA!`, ` yes. `, `confirmă`, `confirma`, `ok`, `go`, `go ahead`,
  `sigur` → true; `nu`, `no`, `da, dar doar la X`, `yes remove PTENGETF too`, `` → false); `pendingPlanToken` cases.
- `components/chat/transcript.confirm.test.ts` TC-1..TC-7 (§1; plus: history built after a confirm/cancel/discard
  never contains a token; without the 6th parameter behaviour is identical to today).
- `components/chat/ChatReply.confirm.test.tsx` CRP-1 (RO/EN proposed markup: heading, "proposed" status label,
  `planProposed` after the list, model text as a text node), `components/chat/ChatPanel.test.tsx` addition
  (`ChatPlanControls` renders two `<button>`s with `formNoValidate`, RO/EN).
- Conversation suite (`test/fixtures/ai/chat-conversations.json` + driver): new turn fields `confirm?: true`
  (button), `cancel?: true`, and `expect.kind: "proposed"`; new dialogues D13 (ro: "șterge valoarea maximă pe 30 de
  zile la toate ETF-urile" → proposed listing 3 ETFs → "nu" → model answers, nothing changes → same request → "da" →
  cleared), D14 (en: "remove PTENGETF" → proposed → "no" → model repeats the removal → proposed again → Cancel → nothing
  changed), D15 (en: correction round inside a conversation: invalid then corrected answer → one reply, `providerCalls`
  2). The driver mirrors the page: `chatTurn` with the confirm option wired to `confirmChatPlan`.

### 3.2 Deliberate changes to existing tests (copy into HANDOVER with these reasons)
1. `lib/ai/providers/types.test.ts` PT-1: seven → eight codes (+ `unsupported_format`; DEC-027 §2 / Consequences).
2. `app/chat/__snapshots__/reply-messages.golden.test.ts.snap`: **one new** entry `G-R1 interpreted/provider_error/
   unsupported_format` (the test iterates `PROVIDER_ERROR_CODES`). Written by a normal run, not `-u`; every existing
   entry and every `chat-markup.golden` entry must match unchanged.
3. `lib/ai/chat.test.ts` CE-5: the `unsupported_format` row expects `provider_error` (DEC-027: never shown); other rows
   unchanged.
4. Call counts where the first answer is unparseable or invalid now include the one correction call (DEC-027 §3), the
   final outcome assertion unchanged: `chat.test.ts` (the two `{"action":"unsupported"}` cases near lines 150–161:
   `toHaveLength(1)` → `2`), `chat.regression.test.ts` line 176 (per row: 2 for `invalid_action` and
   `interpreted/unclear/malformed` rows, else 1), `chat.conversations.pglite.test.ts` driver/fixture `providerCalls` for
   turns whose recorded answer is invalid (e.g. D08), and any other count the full suite reveals — each listed by name.
5. Flows that executed a confirm-category plan in one turn now propose first and execute on confirm (US-058 req. 1,
   DEC-027 §4); the deps gain a fixed fake `planKey`, a `confirmChatPlan(token)` step is added, and the existing
   assertions move to the confirm outcome unchanged: `chat.test.ts` (remove_etf / untrack_field cases near lines 239,
   263, 307, 342, 439–486, 515, 536), `chat.pglite.test.ts` (near 88, 126, 176, 268, 390), `chat.conversation.test.ts`
   (near 127), `chat.regression.test.ts` (rows whose `executed` holds a confirm-category intent: assert `proposed`, then
   confirm, then `calledIntents()` equals `row.executed` — fixture rows unchanged), conversation fixture D01/D10 and any
   other dialogue with untrack/remove/multi-ETF clear (confirm turns inserted, `historySent` adjusted).
6. Request-shape assertions for a fake registered as `"gemini"`: `format` is now `json_schema` with `schema`
   (`chat.conversation.test.ts` CC-13 and any other chat-level format assertion) — DEC-027 §2. Prompt-level CX-1 stays
   `json_object` (unchanged).
7. `lib/ai/boundaries.test.ts`: `ALLOWED_TARGETS` += `lib/ai/chat-plan`, `lib/ai/model-call`, `lib/ai/correction`;
   LB-0 list += the three files; LB-2 `allowedExternal` += `chat-plan.ts` with `node:crypto`/`node:buffer` (additions
   only; LB-4/LB-10 lists unchanged).
8. Any `ChatActionResult`/`ChatOutcome` exhaustiveness fixture that enumerates outcome kinds (e.g. the outcome list in
   `reply-messages.test.ts`): additions for `proposed`/`plan_refused` only.

## 4. Data model change and migration
None. The plan token lives only in the browser transcript; the format-downgrade cache only in server memory
(DEC-027 §2, §4). No table, no migration, no `data-model.md` change.

## 5. Risks and settled technical choices
- **T-1 `strict: false`.** OpenAI-style strict mode requires every object to list all properties with
  `additionalProperties: false`; DEC-027 §2 also says the schema covers the envelope only and leaves the action shapes to
  the server ("one strict union schema is too large"). Both cannot hold, so the planner keeps the envelope-only schema
  and sends `strict: false` (best-effort schema guidance; the server validator is the gate either way). With
  `strict: true` every OpenAI call would 400 and downgrade. One literal in `openai-compatible.ts`; noted for the
  sprint audit.
- **T-2 Modes.** json_schema: gemini, groq, openai, mistral, cerebras; json_object: openrouter (support depends on the
  routed model), deepseek (json_object only), together (non-standard schema field), custom. A wrong guess costs one
  downgrade call per provider+model per server instance, never a failure.
- **T-3 Schema.** One neutral JSON-Schema constant; Gemini gets a converted OpenAPI-subset copy (uppercase types,
  `nullable`, no `additionalProperties`, `["integer","string"]` → `STRING`; Gemini rejects an OBJECT with no properties,
  so action items list their optional keys). A string `slot` is turned back into an integer by the existing normaliser.
- **T-4 Downgrade.** `unsupported_format` = HTTP 400 or 422 on a json_schema call after the provider's own body rule.
  Retry once as json_object; cache only after a successful retry; injectable cache for tests.
- **T-5 Nulls.** Schema-driven answers may emit `"slot": null`; `stripSchemaNulls` runs only on answers from a
  json_schema call, so legacy behaviour is untouched.
- **T-6 Correction triggers.** Unparseable envelope or any invalid action only. Not for provider errors (DEC-027 §3),
  legacy `unsupported`/`model_unclear`, `too_many`, an `answer`, key-guarded text, or the widget-load error. A failed
  correction call returns the first answer's outcome, never a provider error the user did not need to see.
- **T-7 Correction text** from closed codes and data-block values only; it never enters grounding (otherwise a symbol
  echoed by the server could satisfy `symbol_not_in_message`).
- **T-8 Time.** 3 × 20 s would exceed `maxDuration = 60`: model calls share a 45 s budget, each call gets
  `min(20 s, left)`, no call starts with < 5 s left.
- **T-9 Signing key path.** key-store derives (info `chat-plan/v1`), provider-deps exposes it, `ChatDeps.planKey`
  carries it to chat.ts → chat-plan. The importer boundaries (LB-4, LB-10) stay as they are.
- **T-10** `chat-plan.ts` may import `node:crypto` (HMAC, SHA-256, `timingSafeEqual`, `randomBytes`); boundary
  allowlist addition only.
- **T-11 Fingerprint** = active set + tracked fields + widgets of every plan symbol. Propose with a failed widget load
  → `error` (cannot fingerprint). A replay of a plan that changed nothing (e.g. clear with no match) re-runs a no-op:
  harmless, as DEC-027 accepts.
- **T-12 Token checks** in the order of §2 step 12; signature before expiry; refusal codes are closed.
- **T-13 needsConfirmation** counts distinct ETFs over clear + replace together ("custom values on more than one ETF").
- **T-14 Proposed results** reuse `ChatActionResult` with `status: "proposed"` so grouping, field labels and widget
  descriptions are shared with the executed list. Token never in memo, history or logs.
- **T-15 Client state.** Plan status lives on the transcript entry; only the last entry can be pending; the confirm
  FormData carries only `token`; a superseded plan's memo is marked `[not confirmed: nothing done]` so the model sees
  it did not run. `chatTurn`'s new parameter is optional, so existing callers/tests are unchanged.
- **T-16 Confirm** never resolves the provider and makes zero model calls; it works even if the provider was removed
  after the proposal.
- **T-17 Prompt** tells the model not to ask for confirmation itself (otherwise "da" → model → plan → second
  confirmation). CP-12 budget is tight (≈ 240 chars free).
- **T-18 `unsupported_format`** never reaches the user (mapped to `provider_error` in model-call; reply map entry only
  for exhaustiveness).
- **T-19 Module split**: model-call / correction / chat-plan keep chat.ts readable; `interpretConfigurationRequest`
  keeps its contract for its existing tests.
- Risk: Gemini thinking models with `responseSchema` (M-5) and Groq models without structured outputs (downgrade path,
  M-5). Risk: correction doubles token use on bad answers (free tiers, M-6). Risk: PGlite hook timeouts under full-suite
  load for the new PGlite files (DEC-019; 30 s hooks).

## 6. Decisions needed
| # | Type | Question | Options | Recommendation | Isolated default? |
|---|---|---|---|---|---|
| T-1..T-19 | TECHNICAL | see §5 | — | settled within DEC-027 (T-1 recorded as a literal deviation for the sprint audit) | n/a (not open) |
| D-1 | PRODUCT | Wording of the proposed plan ("What the app will do", per-action "Will remove …" lines, "Proceed? Confirm or cancel below." / "Continui? Confirmă sau anulează mai jos."), button labels "Confirm"/"Confirmă", "Cancel"/"Anulează", the cancelled line and the expired/tampered refusal texts (state-changed and unavailable texts are DEC-027's) | (a) as drafted; (b) PO wording | (a) | **Yes.** Confined to the new `messages/*.json` keys of §2 step 24 and the proposed rendering in `ChatReply.tsx` / `ChatPlanControls`. PO to confirm at demo. |
| D-2 | PRODUCT | Which typed answers count as "yes" | (a) DEC-027's list `da, yes, ok, confirm, confirmă, sigur, go` plus the PO's own example "go ahead"; (b) a wider list (e.g. "continuă", "sure", "yes please") | (a) | **Yes.** Confined to `CONFIRM_WORDS` in `components/chat/confirm.ts`; the Confirm button always works. |
| D-3 | PRODUCT | What "nu"/"no" does while a plan is pending | (a) literal DEC-027: discards the plan and goes to the model as a new message (a natural reply; a confirm-category action can never run without a token); (b) a local cancel list ("nu", "no", "anulează", "cancel") that never calls the model | (a) | **Yes.** Confined to `chatTurn`'s pending-plan branch in `components/chat/transcript.ts`; (b) would be one more word list there. PO to confirm at demo. |

## 7. Out of scope (story + DEC-027)
Undo/history of chat changes; questions about data values; new widget operations; keys in chat; native tool/function
calling (DEC-027 §2); storing plans or conversations on the server; prompt data-block compaction (US-055 T-15).

## 8. Files changed (expected)
- changed (source): `lib/ai/providers/types.ts`, `lib/ai/providers/http.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/providers/gemini.ts`, `lib/ai/provider-catalog.ts`, `lib/ai/capabilities/action-list.ts`,
  `lib/ai/capabilities/configuration/interpret.ts`, `lib/ai/capabilities/configuration/prompt.ts`,
  `lib/ai/key-store.ts`, `lib/ai/provider-deps.ts`, `lib/ai/chat.ts`, `lib/ai/chat-history.ts`,
  `app/chat/reply-messages.ts`, `app/chat/actions.ts`, `app/chat/page.tsx`, `components/chat/chat-state.ts`,
  `components/chat/transcript.ts`, `components/chat/ChatPanel.tsx`, `components/chat/ChatReply.tsx`,
  `components/chat/ChatView.tsx`, `messages/en.json`, `messages/ro.json`, `README.md`
- new (source): `lib/ai/model-call.ts`, `lib/ai/chat-plan.ts`, `lib/ai/correction.ts`, `components/chat/confirm.ts`,
  `components/chat/ChatPlanControls.tsx`
- new (tests): `lib/ai/chat-plan.test.ts`, `lib/ai/model-call.test.ts`, `lib/ai/correction.test.ts`,
  `lib/ai/chat.correction.test.ts`, `lib/ai/chat.confirm.test.ts`, `lib/ai/chat.confirm.pglite.test.ts`,
  `lib/ai/capabilities/action-list.schema.test.ts`, `app/chat/reply-messages.confirm.test.ts`,
  `app/chat/actions.confirm.test.ts`, `components/chat/confirm.test.ts`, `components/chat/transcript.confirm.test.ts`,
  `components/chat/ChatReply.confirm.test.tsx`
- changed (tests, additions): `lib/ai/key-store.test.ts`, `lib/ai/provider-deps.test.ts`,
  `lib/ai/provider-catalog.test.ts`, `lib/ai/providers/gemini.test.ts`, `lib/ai/providers/openai-compatible.test.ts`,
  `lib/ai/providers/errors.test.ts`, `components/chat/ChatPanel.test.tsx`, `test/fixtures/ai/chat-conversations.json`
  (D13–D15), `test/fixtures/ai/README.md`
- deliberate test changes: §3.2 items 1–8
- process: `dev_minions/verification/US-058-plan.md`, `dev_minions/HANDOVER.md`, `dev_minions/status.md`
