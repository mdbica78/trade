# US-028 — Plan: chat surface wired to the configuration actions (RO and EN)
_Planned by story-planner (opus, high), 2026-09-27. Round 1._

Sources read: `backlog/stories/US-028.md` (including "Tech-lead review 2026-09-26"), `backlog/sprints/sprint-06.md`
(Decisions needed #4, #6, #10–#14; DoD; manual QA), `decisions/README.md`, `DEC-016`, `DEC-017`,
`architecture/data-model.md` ("Write rules"), `verification/US-027-plan.md`, and the shipped code:
`lib/ai/{provider-deps,settings-deps}.ts`, `lib/ai/providers/{types,resolve,registry,run-generation}.ts`,
`lib/ai/capabilities/{generate,registry,types}.ts`, `lib/ai/capabilities/configuration/{context,intent,grounding,interpret,capability}.ts`,
`lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`, `lib/config/{etfs,tracked-fields,detect-adapter,default-deps}.ts`,
`lib/config/boundaries.test.ts`, every `app/**/actions.ts`, `app/admin/etfs/{page,result-messages}.ts(x)`,
`app/admin/ai/{page.tsx,page.test.tsx,actions.test.ts}`, `components/{AppHeader,AppHeader.test}.tsx`,
`components/admin/{ActionForm,ActionMessage,action-state,AiSettingsAdmin}.tsx`, `app/layout.tsx`, `messages/en.json`,
`i18n/messages.test.ts`, `test/helpers/{ai-fakes,ai-config-context,pglite,module-specifiers}.ts`,
`lib/ai/capabilities/configuration/interpret.pglite.test.ts`, `lib/config/tracked-fields.pglite.test.ts`,
`lib/monitoring/home.ts` (`createHomeTableLoader`), `lib/ingestion/load-etfs.ts` (`createDrizzleEtfLoader`),
`lib/ingestion/run-daily.ts` (`CRON_FETCH_TIMEOUT_MS`), `vitest.config.ts`.

**Not blocked.** No TECHNICAL item is open: #6, #13, #14 are Decided (sprint-06), DEC-016/DEC-017 bind the layering.
The PRODUCT items #4, #10, #11, #12 ship their isolated defaults (tech-lead confirmed "yes" for each); their code
locations are named in section 7. The plan-level choices P-1..P-10 (section 4) are implementation choices inside
those decisions. US-027 (dependency) has review PASS and tests PASS; this plan uses only its exported API.

No schema change, no migration, no new dependency.

---

## 0. Module layout (names fixed by this plan)

| File | Status | Role | Imports (exact targets) |
|---|---|---|---|
| `lib/ai/capabilities/configuration/execute.ts` | new | `EXECUTION_CODES`, `ExecutionCode`, `ExecutionOutcome`, `executeConfigurationIntent(intent, context, deps)`. One `lib/config/` call per intent, maps the typed result to an `ExecutionOutcome`. No SQL, no catch (an exception propagates to the chat entry). **Holds the PRODUCT #10 default** (`name: intent.name ?? intent.symbol`). | `lib/config/etfs` (`addEtf`, `setEtfActive`, types `EtfConfigDeps`, `AddEtfResult`), `lib/config/tracked-fields` (`trackField`, `untrackField`), `./context` (type), `./intent` (type) |
| `lib/ai/chat.ts` | new | **The chat entry module** (sprint decision 14 allowlist entry). `CHAT_MESSAGE_MAX_LENGTH = 500`, `CHAT_INVALID_REASONS`, `CHAT_UNAVAILABLE_REASONS`, types `ChatOutcome`, `ChatAvailability`, `ChatDeps`; `createChatDeps()`, `handleChatMessage(raw, depsFactory?)`, `getChatAvailability(providerDepsFactory?)`. Never throws; no returned value carries exception text, a key or model text. **Holds the PRODUCT #11 default** (execute immediately, no confirmation step). | `./provider-deps` (`loadActiveProvider`, `getAiAvailability`, `createProviderDeps`, type `ProviderDeps`), `./providers/resolve` (type `ActiveProviderFailureReason`), `./capabilities/registry` (`getCapability`), `./capabilities/generate` (`bindGenerate`), `./capabilities/configuration/context` (`loadConfigurationContext`, types), `./capabilities/configuration/intent` (types), `./capabilities/configuration/execute`, `../config/default-deps` (`createEtfConfigDeps`), `../config/etfs` (type `EtfConfigDeps`), `../db/index` (`getDb`) |
| `app/chat/page.tsx` | new | Server component. `export const dynamic = "force-dynamic"`, `export const maxDuration = 60`. Calls `getChatAvailability()`, maps an unavailable reason to its reply key (`unavailableReplyKey`), renders `<ChatView>`. **PRODUCT #12 default** (route in the user area). | `@/lib/ai/chat`, `@/components/chat/ChatView`, `./actions`, `./reply-messages` |
| `app/chat/actions.ts` | new | `"use server"`; exports only `sendChatMessageAction(formData: FormData): Promise<ChatReplyState>`. Reads the one `message` field, calls `handleChatMessage`, revalidates after a change, maps via `chatOutcomeToReply`. No SQL. | `next/cache`, `@/lib/ai/chat`, `@/components/chat/chat-state` (type), `./reply-messages` |
| `app/chat/reply-messages.ts` | new | `chatOutcomeToReply(outcome): ChatReplyState`, `unavailableReplyKey(reason)`, `changedSymbol(outcome): string \| null`, `GENERIC_ERROR_REPLY`. Typed `Record<Code, ChatReplyKey>` maps, so a new code is a compile error. | `@/lib/ai/chat` (types + `CHAT_MESSAGE_MAX_LENGTH`), `@/components/chat/chat-state` (type) |
| `components/chat/chat-state.ts` | new | `ChatReplyKey = keyof (typeof ro)["Chat"]["replies"]`; `ChatReplyState`; `TranscriptEntry`; `ChatViewState` (the page's key-free view: `available` / `unavailable` + `messageKey` / `error`). Types only, like `components/admin/action-state.ts`. | `@/messages/ro.json` (type), `@/lib/config/detect-adapter` (type `DetectionReason`) |
| `components/chat/transcript.ts` | new | Pure `appendTranscript(prev, message, reply): TranscriptEntry[]` (id = previous length, order kept). | `./chat-state` (type) |
| `components/chat/ChatReply.tsx` | new | Renders one `ChatReplyState` with `useTranslations("Chat.replies")`, `useLocale()` (field label = `field.ro` or `field.en`), the detection reason via `Admin.detectionReason`, and a `Link` to `/admin/ai` when `adminLink` is set. | `next-intl`, `next/link`, `./chat-state` (type) |
| `components/chat/ChatPanel.tsx` | new | `"use client"`. `useActionState` over a **client** wrapper: `(prev, formData) => appendTranscript(prev, message, await action(formData))`; `<form action={formAction}>` with one `<textarea name="message" maxLength={maxLength} required>` and one submit button (disabled while pending); the transcript list (user text + `<ChatReply>`). Props: `{ action, maxLength }`. | `react`, `next-intl`, `./ChatReply`, `./transcript`, `./chat-state` (type) |
| `components/chat/ChatView.tsx` | new | Heading + intro, then by `ChatViewState`: `available` → `<ChatPanel>`; `unavailable` → `<p role="status">` with the reply text + link to `/admin/ai` (no composer); `error` → `<p role="alert">{Chat.loadError}</p>` (no composer). | `next-intl`, `next/link`, `./ChatPanel`, `./chat-state` (type) |
| `components/AppHeader.tsx` | changed | `<Link href="/chat">{t("Nav.chat")}</Link>` between Home and Administration. | unchanged |
| `components/admin/AiSettingsAdmin.tsx` | changed | `<p>{t("chatUnavailableNote")}</p>` → `<p><Link href="/chat">{t("chatLink")}</Link></p>`. | + `next/link` |
| `messages/en.json`, `messages/ro.json` | changed | `Nav.chat`; `Chat.*` (section 1.6); `Admin.ai.chatLink`; `Admin.ai.chatUnavailableNote` **removed**. | — |

Client components (`ChatPanel`, and `ChatReply`/`transcript` which it pulls in) import nothing from `lib/ai`; the max
length reaches the textarea as a prop from the server page. `ChatReply` reads `Admin.detectionReason`, it does not
duplicate it (P-5).

### Dependency direction
```
app/chat/page.tsx ──> lib/ai/chat (getChatAvailability, CHAT_MESSAGE_MAX_LENGTH) ──> provider-deps (getAiAvailability)
app/chat/actions.ts ──> lib/ai/chat (handleChatMessage)
lib/ai/chat ──> provider-deps (loadActiveProvider) ─> [settings, key-status, registry]    (key stays in lib/ai)
            ├─> capabilities/registry.getCapability("configuration").run(...)  (US-027, via bindGenerate)
            ├─> capabilities/configuration/context.loadConfigurationContext     (reads via lib/config)
            ├─> capabilities/configuration/execute ──> lib/config/{etfs,tracked-fields}   (writes via lib/config)
            └─> lib/config/default-deps.createEtfConfigDeps(getDb())              (concrete I/O wiring)
components/chat/* ──> types only (chat-state), next-intl, next/link, react
```
- `lib/config/` still imports nothing from `lib/ai/` (DEC-016 §1, BC-1 unchanged).
- `execute.ts` is a capability file: it imports neither the wiring module nor `lib/db` nor `default-deps` (CB-1).
- `app/` and `components/` never see the key-carrying resolution (LB-5 names unchanged): the page gets
  `ChatAvailability` (`available` / `unavailable` + reason / `error`), the action gets a `ChatOutcome`.
- **Source-scan gotchas for the implementer** (comments count):
  - `lib/ai/chat.ts` and `execute.ts`: the word `fetch` must not appear anywhere (LB-2-fetch); no `console.`
    (LB-9); no `process.env` (LB-3); no `` sql` ``, `db.execute`, `drizzle-orm` (CB-3).
  - `app/chat/actions.ts`: no `insert into` / `update "` / `delete from` text, even in a comment (AB-2).
  - `app/**`, `components/**` non-test files: never the names `loadActiveProvider`, `resolveActiveProvider`,
    `ActiveProviderCall`, `ActiveProviderResolution`, `ProviderCallInput`, `ProviderCallContext`, `readApiKey` (LB-4, LB-5).
  - A `"use server"` file may export only async functions: `actions.ts` exports the action and nothing else.

---

## 1. Design

### 1.1 Execute step (`execute.ts`, DEC-016 §2, sprint decision 10)
```ts
export const EXECUTION_CODES = [
  "added", "added_no_adapter", "reactivated", "already_monitored", "add_rejected",
  "removed", "already_inactive", "not_found",
  "tracked", "already_tracked", "field_not_available",
  "untracked", "not_tracked",
] as const;
export type ExecutionCode = (typeof EXECUTION_CODES)[number];
type NotDetectedReason = Exclude<Extract<AddEtfResult, { action: "added" }>["reason"], "detected">;
export type ExecutionOutcome = {
  code: ExecutionCode;
  symbol: string;                          // the intent's validated symbol
  field: ContextField | null;              // { fieldKey, labelRo, labelEn } for track/untrack, else null
  adapterKey: string | null;               // "added" only
  detectionReason: NotDetectedReason | null; // "added_no_adapter" only
  changed: boolean;                        // true only for added, added_no_adapter, reactivated, removed, tracked, untracked
};
export async function executeConfigurationIntent(
  intent: ConfigurationIntent, context: ConfigurationContext, deps: EtfConfigDeps,
): Promise<ExecutionOutcome>
```
Exactly one `lib/config/` call per intent (Task 1):

| Intent | Call | Result → code |
|---|---|---|
| `add_etf` | `addEtf({ symbol, name: intent.name ?? intent.symbol }, deps)` — **PRODUCT #10 default, this one line** | `added` + `adapterKey !== null` → `added`; `added` + `null` → `added_no_adapter` (+ reason, `"detected"` with a null key → `null`); `reactivated` → `reactivated`; `already_monitored` → `already_monitored`; `invalid_symbol` / `invalid_name` → `add_rejected` (defensive: grounding normalises the symbol and the name falls back to it, so unreachable today) |
| `remove_etf` | `setEtfActive({ symbol, active: false }, deps)` | `not_found` → `not_found`; `ok` and the context ETF had `isActive === false` → `already_inactive` (`changed: false`); `ok` otherwise → `removed` (P-1, tech-lead point 4) |
| `track_field` | `trackField({ symbol, fieldKey: field }, deps)` | `tracked` → `tracked`; `already_tracked` → `already_tracked`; `not_found` → `not_found`; `field_not_available` → `field_not_available` |
| `untrack_field` | `untrackField({ symbol, fieldKey: field }, deps)` | `ok` → `untracked`; `not_found` → `not_found`; `not_tracked` → `not_tracked` |

- `field` labels come from the context ETF's `available` or `tracked` list; if the key is in neither (the database
  changed after the context load) the labels fall back to the field key, as `listFieldsForEtf` does.
- Every result mapping is a `switch` with a `never` default, so a new `lib/config` result variant is a compile error.
- The returned object is built field by field from validated values (never a spread of a result).

### 1.2 Chat entry (`lib/ai/chat.ts`)
```ts
export const CHAT_MESSAGE_MAX_LENGTH = 500;                                  // sprint decision 13
export const CHAT_INVALID_REASONS = ["empty", "too_long"] as const;
export const CHAT_UNAVAILABLE_REASONS = ["not_configured", "unknown_provider", "not_implemented", "no_api_key", "no_model"] as const satisfies readonly ActiveProviderFailureReason[];
export type ChatUnavailableReason = (typeof CHAT_UNAVAILABLE_REASONS)[number];  // type test pins it equal to ActiveProviderFailureReason
export type InterpretedOutcome = Exclude<ConfigurationOutcome, { kind: "intent" }>;
export type ChatOutcome =
  | { kind: "invalid_message"; reason: (typeof CHAT_INVALID_REASONS)[number] }
  | { kind: "unavailable"; reason: ChatUnavailableReason }
  | { kind: "interpreted"; outcome: InterpretedOutcome; field: ContextField | null }  // field: labels for unclear already_tracked / not_tracked
  | { kind: "executed"; result: ExecutionOutcome }
  | { kind: "error" };
export type ChatAvailability = { status: "available" } | { status: "unavailable"; reason: ChatUnavailableReason } | { status: "error" };
export type ChatDeps = { provider: ProviderDeps; config: EtfConfigDeps };
export function createChatDeps(): ChatDeps  // { provider: createProviderDeps(), config: createEtfConfigDeps(getDb()) }
```
`handleChatMessage(raw: unknown, depsFactory: () => ChatDeps = createChatDeps): Promise<ChatOutcome>`, in order:
1. `message = typeof raw === "string" ? raw.trim() : ""`. Empty → `invalid_message/empty`; `message.length > 500` →
   `invalid_message/too_long`. **Before any deps factory, database or provider call** (decision 13; story notes
   "open endpoint").
2. `try { deps = depsFactory() } catch → { kind: "error" }`.
3. `try { active = await loadActiveProvider(deps.provider) } catch → error`. `!active.ok` →
   `{ kind: "unavailable", reason }` — nothing else runs (no context load, no provider call).
4. `try { context = await loadConfigurationContext(deps.config) } catch → error`.
5. `outcome = await getCapability("configuration").run({ message, context }, bindGenerate(active.provider, active.input))`
   inside `try` (defensive; US-027 never throws) → exactly one `generate` call (US-027 AC8).
6. `outcome.kind !== "intent"` → `{ kind: "interpreted", outcome: <rebuilt field by field>, field }` where `field` is the
   context labels for `unclear` with `symbol` + `field` (already_tracked / not_tracked), else `null`.
7. `try { result = await executeConfigurationIntent(outcome.intent, context, deps.config) } catch → error` →
   `{ kind: "executed", result }`. At most one `lib/config/` write call per message (AC8). **PRODUCT #11 default:**
   this step runs immediately, with no confirmation turn.

Every `catch` is a bare `catch {}`: the caught value is never read, stored or returned.

`getChatAvailability(providerDepsFactory = createProviderDeps): Promise<ChatAvailability>` — `try { const a = await
getAiAvailability(providerDepsFactory()); return a.available ? { status: "available" } : { status: "unavailable",
reason: a.reason } } catch { return { status: "error" } }`. Built field by field: the provider id and model are not
passed on (the page does not need them). Key-free by construction (tech-lead point 1).

### 1.3 Server Action (`app/chat/actions.ts`)
```ts
export async function sendChatMessageAction(formData: FormData): Promise<ChatReplyState> {
  const raw = formData.get("message");                // the only field read (story notes, US-020 "no field it does not need")
  try {
    const outcome = await handleChatMessage(typeof raw === "string" ? raw : "");
    const symbol = changedSymbol(outcome);
    if (symbol !== null) {
      revalidatePath("/"); revalidatePath("/admin/etfs");
      revalidatePath(`/admin/etfs/${symbol}/fields`); revalidatePath(`/etf/${symbol}`);   // P-2
    }
    return chatOutcomeToReply(outcome);
  } catch { return GENERIC_ERROR_REPLY; }
}
```
The action takes no `prev` argument: the transcript is client state (P-3). `changedSymbol` returns the symbol only for
`executed` with `changed: true`.

### 1.4 Replies (`app/chat/reply-messages.ts`, sprint decision 7, tech-lead points 2–4)
```ts
// components/chat/chat-state.ts
export type ChatReplyState = {
  tone: "success" | "info" | "error";
  messageKey: ChatReplyKey;
  values?: { symbol?: string; adapter?: string; max?: number };
  field?: { ro: string; en: string };                         // catalogue labels (context / field_catalog)
  detectionReason?: Exclude<DetectionReason, "detected">;
  adminLink?: true;                                            // render a link to /admin/ai
};
```
Mapping (typed `Record`s; no string built from model output):

| Outcome | `messageKey` | values / extras | tone |
|---|---|---|---|
| invalid `empty` / `too_long` | `emptyMessage` / `tooLong` | `max: CHAT_MESSAGE_MAX_LENGTH` for tooLong | error |
| unavailable `not_configured` / `unknown_provider` / `not_implemented` / `no_api_key` / `no_model` | `unavailableNotConfigured` / `unavailableUnknownProvider` / `unavailableNotImplemented` / `unavailableNoApiKey` / `unavailableNoModel` | `adminLink` | info |
| provider_error `timeout` / `network` / `auth_failed` / `rate_limited` / `model_not_found` / `provider_error` / `bad_response` | `providerTimeout` / `providerNetwork` / `providerAuthFailed` / `providerRateLimited` / `providerModelNotFound` (+`adminLink`) / `providerError` / `providerBadResponse` | — | error |
| `unsupported` | `unsupported` | — | info |
| `multiple` | `multiple` | — | info |
| unclear `malformed` | `notUnderstood` | — | info |
| unclear `model_unclear` | `modelUnclear` | — | info |
| unclear `symbol_not_in_message` | `symbolNotInMessage` | — | info |
| unclear `unknown_etf` | **`etfNotFound`** | — | info |
| unclear `unknown_field` | **`fieldNotAvailable`** | — | info |
| unclear `already_tracked` | **`alreadyTracked`** | symbol, field | info |
| unclear `not_tracked` | **`notTracked`** | symbol, field | info |
| executed `added` | `added` | symbol, adapter | success |
| executed `added_no_adapter` | `addedNoAdapter` | symbol, `detectionReason` | success |
| executed `reactivated` | `reactivated` | symbol | success |
| executed `already_monitored` | `alreadyMonitored` | symbol | info |
| executed `add_rejected` | `notUnderstood` | — | info |
| executed `removed` | `removed` | symbol | success |
| executed `already_inactive` | `alreadyInactive` | symbol | info |
| executed `not_found` | **`etfNotFound`** | — | info |
| executed `tracked` | `tracked` | symbol, field | success |
| executed `already_tracked` | **`alreadyTracked`** | symbol, field | info |
| executed `field_not_available` | **`fieldNotAvailable`** | — | info |
| executed `untracked` | `untracked` | symbol, field | success |
| executed `not_tracked` | **`notTracked`** | symbol, field | info |
| error | `genericError` | — | error |

Bold = the four grounding-reason / config-result pairs that share one key (tech-lead point 2). `symbol` is always the
validated symbol (grounded against the message or the context); `adapter` is a registry key; `field` labels come
from `field_catalog` through the context. Nothing else reaches a template.

### 1.5 Page and client (`app/chat/page.tsx`, `components/chat/*`)
- Page: `const a = await getChatAvailability()` → `ChatViewState`: `{ status: "available" }`,
  `{ status: "unavailable", messageKey: unavailableReplyKey(a.reason) }` or `{ status: "error" }` →
  `<ChatView state={…} action={sendChatMessageAction} maxLength={CHAT_MESSAGE_MAX_LENGTH} />`.
- The unavailable notice on the page and the reply to a submitted message use the **same** `Chat.replies.*` key and
  both carry the `/admin/ai` link (AC6 "the same reply").
- `ChatPanel`'s wrapper reads `formData.get("message")` only to show the user's own text in the transcript; it sends
  the `FormData` unchanged. Transcript = React state, lost on reload (decision 13). React 19 resets the uncontrolled
  form after the action.

### 1.6 Message keys (both catalogues; RO is a faithful translation with the same `{placeholders}`)
- `Nav.chat`: "Chat" / "Chat".
- `Chat.heading` ("Configuration chat"), `Chat.intro` ("Change the configuration with a short command, for example
  “add ETF XYZ”, “stop tracking ETF XYZ” or “also track VUAN for BTBETRETF”. One command per message."),
  `Chat.messageLabel` ("Command"), `Chat.send` ("Send"), `Chat.youLabel` ("You"), `Chat.replyLabel` ("Reply"),
  `Chat.loadError` ("Could not load the data. Please try again later."), `Chat.adminAiLink` ("Open Administration → AI").
- `Chat.replies.*` (EN wording; the PO confirms wording at the demo):
  - `added` "{symbol} was added; adapter detected: {adapter}." · `addedNoAdapter` "{symbol} was added; automatic extraction is unavailable." (the reason is appended in parentheses from `Admin.detectionReason`, as `ActionMessage` does) · `reactivated` "{symbol} was already in the list and is monitored again." · `alreadyMonitored` "{symbol} is already monitored."
  - `removed` "{symbol} was removed from monitoring." · `alreadyInactive` "{symbol} is not monitored." · `etfNotFound` "That ETF is not in the list."
  - `tracked` "{field} is now tracked for {symbol}." · `alreadyTracked` "{field} is already tracked for {symbol}." · `untracked` "{field} is no longer tracked for {symbol}." · `notTracked` "{field} is not tracked for {symbol}." · `fieldNotAvailable` "That field is not available for this ETF."
  - `unsupported` "I can only change the configuration: add or remove an ETF, or track or untrack a field." · `multiple` "Please send one command at a time." · `notUnderstood` "I did not understand that command. Please rephrase it." · `modelUnclear` "I could not tell exactly what to change. Please write the ETF's symbol and the change." · `symbolNotInMessage` "Please write the ETF's symbol in your message, for example “add ETF XYZ”."
  - `emptyMessage` "Please write a command." · `tooLong` "The message is too long (at most {max} characters)."
  - `unavailableNotConfigured` "No AI provider is chosen. Choose one in Administration → AI." · `unavailableUnknownProvider` "The stored AI provider is no longer supported. Choose another one in Administration → AI." · `unavailableNotImplemented` "The chosen AI provider is not available in this version. Choose another one in Administration → AI." · `unavailableNoApiKey` "The API key of the chosen AI provider is not set. It is added as an environment variable in Vercel (see Administration → AI)." · `unavailableNoModel` "No AI model is chosen. Choose a model in Administration → AI." (decision 4)
  - `providerTimeout` "The AI provider did not answer in time. Please try again." · `providerNetwork` "The AI provider could not be reached. Please try again later." · `providerAuthFailed` "The AI provider rejected the API key. Check the key in the Vercel environment variables." · `providerRateLimited` "The AI provider's free quota is used up for now. Please try again later." · `providerModelNotFound` "The AI provider does not know this model. Check the model name in Administration → AI." · `providerError` "The AI provider returned an error. Please try again later." · `providerBadResponse` "The AI provider's answer could not be used. Please rephrase your command."
  - `genericError` "Something went wrong. Please try again later."
- `Admin.ai.chatLink` "Open the configuration chat"; `Admin.ai.chatUnavailableNote` removed from both catalogues.

### 1.7 Duration budget (story notes; sprint decision 6)
Worst case of one chat message against `maxDuration = 60` (s), from the code constants:
settings read (1 Neon batch) + context (1 + N parallel batches, US-027 P-7) + provider call ≤ `AI_PROVIDER_TIMEOUT_MS`
= 20 000 ms (`lib/ai/providers/run-generation.ts:11`) + `addEtf` detection: discovery ≤ `CRON_FETCH_TIMEOUT_MS`
= 7 000 ms + download ≤ 7 000 ms (`lib/ingestion/run-daily.ts:3`, wired in `lib/config/default-deps.ts`) + local PDF
text extraction (no timeout, one PDF) + 2 write batches. Bounded network time = 20 + 2 × 7 = **34 s**, leaving
**26 s** for extraction and the database. Test CPG-5 pins `AI_PROVIDER_TIMEOUT_MS + 2 * CRON_FETCH_TIMEOUT_MS <=
maxDuration * 1000 - 20_000` by importing the constants and the page's `maxDuration`, never literals.

---

## 2. Acceptance criteria and the tests that prove them

Every new test file that can reach a provider or the network stubs global `fetch` (`vi.stubGlobal`) with a spy that
throws `"real network forbidden"` and asserts it was never called; `fakeCallInput`'s injected function throws too.
Providers are `createFakeProvider("gemini", …)` in `createProviderRegistry([...])` (the id must be a catalogue id).
Detection is always a `vi.fn` (`detect` in `EtfConfigDeps`, or `@/lib/config/detect-adapter` mocked).

New test files: `lib/ai/capabilities/configuration/execute.test.ts` (EX), `…/execute.pglite.test.ts` (EXP),
`lib/ai/chat.test.ts` (CE), `lib/ai/chat.pglite.test.ts` (CEP), `app/chat/reply-messages.test.ts` (CRM),
`app/chat/actions.test.ts` (CA), `app/chat/actions.pglite.test.ts` (CAP), `app/chat/page.test.tsx` (CPG),
`app/chat/page.safety.test.tsx` (CPS), `components/chat/ChatReply.test.tsx`, `components/chat/ChatPanel.test.tsx`,
`components/chat/ChatView.test.tsx`, `components/chat/transcript.test.ts` (CV), `app/actions.boundary.test.ts` (AB).
Changed test files: `components/AppHeader.test.tsx` (AH), `app/admin/ai/page.test.tsx` (PA-5, PA-10),
`lib/ai/boundaries.test.ts` (LB-0, LB-2 allowlist), `lib/ai/capabilities/boundaries.test.ts` (CB-0, CB-4).

PGlite fixture for CEP/EXP/CAP: `createEmptyTestDatabase()` + `seed(mockDb, runner)` (BTBETRETF, TVBETETF, PTENGETF,
`brd-depositary`, tracking `units_in_circulation` and `nav_per_unit`), plus one `reports` row (`status = 'ok'`) for
BTBETRETF with two `report_values` rows (`units_in_circulation`, `nav_per_unit`), inserted with `pg.query`. Every case
starts from this same state (AC2). Settings row: provider `gemini`, model `m-1` unless the case says otherwise.

### AC1 — Chat page in the user area (Req §5; FR5; FR8.1; decisions 6, 12)
- **CPG-1** (`page.test.tsx`, `@/lib/ai/chat` `getChatAvailability` mocked → `available`, `./actions` mocked): in `ro`
  and `en` the HTML contains `Chat.heading`, a `<textarea name="message"` with `maxlength="500"`, and a submit button
  with `Chat.send`; the named controls are exactly `{message}`; neither locale contains the other's `Chat.heading`.
- **CPG-4** `mod.dynamic === "force-dynamic"`, `mod.maxDuration === 60`.
- **AH-1** (`AppHeader.test.tsx`): in `ro` and `en`, `href="/chat"` with `Nav.chat`; its index in the HTML lies between
  the `href="/"` and `href="/admin"` links.
- Build: `pnpm build` lists `/chat` as a dynamic route (reviewer/tester reads the build output).

### AC2 — Commands change configuration only through `lib/config/` (FR1, FR2, FR9; DEC-016 §§1, 2, 4)
`lib/ai/chat.pglite.test.ts`, `handleChatMessage(message, () => deps)` with `deps.config = { db: mockDb, run: runner,
registry: defaultAdapterRegistry, detect: detectSpy }` and `deps.provider` = fake registry + `loadSettings` returning
the settings row + `readApiKey: () => "k-test"`; the fake answers the canned JSON of each row:
- **CEP-1** "add ETF XYZ" (`{"action":"add_etf","symbol":"XYZ","name":null}`, detect → `{ adapterKey: null, reason:
  "no_match" }`): one new `etfs` row `XYZ`, `is_active = true`, `bvb_url = bvbInstrumentUrl("XYZ")`; detect called once
  with `{ symbol: "XYZ", bvbUrl }`; `createHomeTableLoader(mockDb, defaultAdapterRegistry, runner)()` lists `XYZ`;
  outcome `executed/added_no_adapter` with reason `no_match`.
- **CEP-2** "stop tracking ETF BTBETRETF" (`remove_etf`): `is_active = false`; the home-table loader and
  `createDrizzleEtfLoader(mockDb, runner)()` both omit BTBETRETF; its `reports`, `report_values` and `tracked_fields`
  rows equal the before-snapshot; outcome `removed`.
- **CEP-3** "also track net asset for BTBETRETF" (`track_field net_asset`): `tracked_fields` gains `net_asset` for
  BTBETRETF (at the next `display_order`); home-table `columns` include `net_asset`; outcome `tracked` with field
  `{ fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" }` (seed labels).
- **CEP-4** "stop tracking VUAN for BTBETRETF" (`untrack_field nav_per_unit`): BTBETRETF's `nav_per_unit` tracked row is
  gone; both `report_values` rows remain; outcome `untracked`.
- **CAP-1** (`app/chat/actions.pglite.test.ts`, the real action and entry module with default wiring; mocks only
  `next/cache`, `@/lib/db` → PGlite `mockDb`, `@/lib/ingestion/store` → `neonBatchRunner` returns the PGlite runner
  (rest original), `@/lib/ai/providers/default-registry` → a registry holding a scripted fake `gemini`,
  `@/lib/config/detect-adapter` → `detectAdapter` spy, `@/lib/config/ai-settings` not mocked): FormData
  `message=add ETF XYZ` → `XYZ` row inserted, reply `addedNoAdapter`, `revalidatePath` called with `/`, `/admin/etfs`,
  `/admin/etfs/XYZ/fields`, `/etf/XYZ`.
- **Source scan:** CB-3 (existing, all of `lib/ai`) covers `execute.ts` and `chat.ts`; AB-1/AB-2 cover
  `app/chat/actions.ts` (AC9).

### AC3 — ETF name (FR1; `etfs.name` NOT NULL; sprint-05 decision 4; decision 10)
- **CEP-1** also asserts `name = 'XYZ'`.
- **CEP-5** "add ETF XYZ named Fond Test" + `{"action":"add_etf","symbol":"XYZ","name":"Fond Test"}` → `name = 'Fond Test'`.
- **CEP-6** PTENGETF set inactive with SQL first; "add ETF PTENGETF" → outcome `reactivated`; `name`, `adapter_key`,
  `bvb_url` unchanged; `is_active = true`; detect spy **not called**.
- **EX-1** (unit): `add_etf` with `name: null` → `addEtf({ symbol: "XYZ", name: "XYZ" }, deps)`; with `name: "Fond
  Test"` → that name.

### AC4 — Replies are translated templates, never model prose (FR8.1; decision 7)
- **CRM-1** (`reply-messages.test.ts`): builds every `ChatOutcome` from the shipped runtime lists — `CHAT_INVALID_REASONS`,
  `CHAT_UNAVAILABLE_REASONS`, `PROVIDER_ERROR_CODES`, `UNCLEAR_REASONS` (with symbol/field for already_tracked /
  not_tracked), `EXECUTION_CODES` (with the extras each code carries), plus `unsupported`, `multiple`, `error`. Type
  tests pin the enumerated kinds to the unions (`expectTypeOf<Kinds>().toEqualTypeOf<ChatOutcome["kind"]>()`, the same
  for `InterpretedOutcome["kind"]` and for `ChatUnavailableReason` vs `ActiveProviderFailureReason`), so a new variant
  fails typecheck. For each outcome: `messageKey` exists in `en.Chat.replies` and `ro.Chat.replies`; next-intl
  `createTranslator` renders it in both locales with the reply's values and field label (`ro`/`en`) with no
  `onError` call and no `{` left; a `detectionReason` exists in `Admin.detectionReason`.
- **CRM-2** tech-lead point 2: the four pairs (unclear `unknown_etf` / executed `not_found`, `unknown_field` /
  `field_not_available`, `already_tracked` / `already_tracked`, `not_tracked` / `not_tracked`) give identical
  `messageKey`s.
- **CRM-3** every `Chat.replies` key has the same `{placeholder}` set in `ro` and `en`.
- **CV-1** (`ChatReply.test.tsx`, `renderToStaticMarkup` in `NextIntlClientProvider`): reply `tracked` with
  `field { ro: "Activ net", en: "Net asset" }`, symbol BTBETRETF → the `ro` HTML contains the RO template text with
  `Activ net` and not `Net asset`; the `en` HTML the reverse. `addedNoAdapter` + reason `no_match` → the translated
  reason in parentheses. `adminLink` → `href="/admin/ai"` with `Chat.adminAiLink`.
- **CE-8** (sentinel, `chat.test.ts`): the fake answers
  `{"action":"add_etf","symbol":"XYZ","name":"ZQ-SENTINEL-5531","note":"ZQ-SENTINEL-5531"}` for "add ETF XYZ" (name not
  in the message → dropped by grounding): `JSON.stringify(outcome)` and `JSON.stringify(chatOutcomeToReply(outcome))`
  contain no `ZQ-SENTINEL`; **CV-2** the `ChatReply` HTML of that reply contains no `ZQ-SENTINEL`. A second fake answer
  `{"action":"unsupported","reply":"ZQ-SENTINEL-5531 prose"}` → same assertions.

### AC5 — Every config result is reported (FR1, FR2, FR9; section 3)
Where each case is proven (tech-lead point 2):

| Case | Reached through the chat end to end? | Test |
|---|---|---|
| added with adapter | yes | CEP-7: detect → `{ adapterKey: "brd-depositary", reason: "detected" }` → `added`, row `adapter_key = 'brd-depositary'`; CRM-1 key `added` |
| added with none | yes | CEP-1 → `addedNoAdapter` ("automatic extraction is unavailable") |
| reactivated | yes | CEP-6 |
| `already_monitored` | yes | CEP-8: "add ETF BTBETRETF" → `already_monitored`, detect not called, tables unchanged |
| remove of an unknown symbol → `not_found` | grounding pre-empts (`unclear/unknown_etf`) | EXP-1 constructed intent `remove_etf ZZZETF` on PGlite → `not_found`; CRM-2 same key as `unknown_etf` |
| tracked | yes | CEP-3 |
| already tracked | pre-empted (`unclear/already_tracked`) | EXP-2 `track_field BTBETRETF nav_per_unit` → `already_tracked`, row count unchanged; CEP-9 "also track VUAN for BTBETRETF" end to end → `interpreted/unclear/already_tracked` with the seed labels; CRM-2 |
| untracked | yes | CEP-4 |
| not tracked | pre-empted (`unclear/not_tracked`) | EXP-3 `untrack_field BTBETRETF net_asset` → `not_tracked`; **CEP-10** database changed between interpretation and execution: an inline fake provider whose `generate` deletes BTBETRETF's `nav_per_unit` tracked row (via `pg.query`) and then answers `untrack_field nav_per_unit` → config result `not_tracked` → reply key equals CEP's grounding `not_tracked` key |
| field not available | pre-empted (`unclear/unknown_field`) | EXP-4 `NOADPETF` inserted with `adapter_key` NULL, `track_field NOADPETF net_asset` → `field_not_available` |
| removing an already inactive ETF | yes | CEP-11 PTENGETF inactive, "stop tracking ETF PTENGETF" → `already_inactive` (reply `alreadyInactive` "… is not monitored"), row still inactive (tech-lead point 4) |

Unit table **EX-3** (`execute.test.ts`, `lib/config/etfs` and `lib/config/tracked-fields` mocked with
`importOriginal` + spies for the four write functions): every result variant of `addEtf`, `setEtfActive` (ok with the
context ETF active / inactive, `not_found`), `trackField` and `untrackField` → its code; the set of codes produced by
the table equals `new Set(EXECUTION_CODES)` (not a vacuous list). **EX-5** labels from the context, fallback to the key.

### AC6 — Not-configured states make no request (FR6, FR11; sprint-05 decision 10; decision 4)
- **CPG-2** (page): for each `CHAT_UNAVAILABLE_REASONS` value (loop over the shipped list), `ro` and `en`: the HTML
  contains that reason's `Chat.replies.*` text and `href="/admin/ai"`, and **no** `<textarea`.
- **CEP-12** (PGlite, real `getAiSettings` over the settings row, real `resolveActiveProvider`): `not_configured`
  (provider NULL), `unknown_provider` (stored `openrouter`), `not_implemented` (catalogue id `groq` stored, registry
  holds only the fake `gemini`), `no_api_key` (`readApiKey: () => null`), `no_model` (model NULL) → outcome
  `unavailable/<reason>`; the fake provider's `calls` is empty; the global `fetch` spy and the injected `fetch` spy
  have zero calls; snapshots of `etfs`, `tracked_fields`, `settings`, `reports`, `report_values` unchanged; the
  detect spy not called.
- **CRM-1** gives each reason's reply key; **CRM-4**: `chatOutcomeToReply({ kind: "unavailable", reason })
  .messageKey === unavailableReplyKey(reason)` and `adminLink === true` for every reason — the page notice and the
  reply are the same text.
- **CAP-3** (action, real wiring): settings provider `gemini`, model set, `GEMINI_API_KEY` stubbed empty →
  reply `unavailableNoApiKey`, fetch spy zero calls, database unchanged.

### AC7 — Failures never leak (AGENTS.md Secrets; DEC-015 point 1; Sprint 5 audit W3)
- **CE-5** each `PROVIDER_ERROR_CODES` code (loop asserts length 7) → `interpreted/provider_error/<code>`; execute spy
  not called; **CRM-1** maps each to its key; **CRM-5** `model_not_found` → `providerModelNotFound` with `adminLink`,
  `bad_response` → `providerBadResponse`, `auth_failed` → `providerAuthFailed` (tech-lead point 3).
- **CE-3** `depsFactory` throws `Error("ZQ-EXC-7719 postgres://user:pw@host")` → `{ kind: "error" }`; **CE-4**
  `loadSettings` rejects with it → `error`; **CE-6** `loadConfigurationContext` rejects (module mocked) → `error`,
  zero `generate` calls; **CE-7** `executeConfigurationIntent` rejects (module mocked) → `error`. In each,
  `JSON.stringify(outcome)` and the mapped reply contain neither `ZQ-EXC` nor `postgres://`.
- **CA-4** (action, `@/lib/ai/chat` mocked): `handleChatMessage` rejects with the sentinel error → reply
  `genericError`, no sentinel, `revalidatePath` not called.
- **CAP-2** (action, real wiring): `vi.stubEnv("GEMINI_API_KEY", "ZQ-KEY-GEM-4471")`,
  `vi.stubEnv("GROQ_API_KEY", "ZQ-KEY-GRQ-4471")`; the fake `gemini` records `ctx.apiKey` (asserted to equal the
  sentinel, proving the key did reach the adapter) and answers a valid add; the action result's JSON and the
  `ChatReply` HTML rendered from it contain no `ZQ-KEY`. Repeated with the fake answering `{ ok: false, error:
  "auth_failed" }` → `providerAuthFailed`, no sentinel.
- **CPS-1..3** (`page.safety.test.tsx`, the real `lib/ai/chat`; mocks `@/lib/db`, `@/lib/ai/settings-deps`,
  `@/lib/config/ai-settings` `getAiSettings`, `./actions`; both key variables stubbed to `ZQ-KEY-*` sentinels):
  - CPS-1 `ok` state (settings `gemini` + model): composer shown; HTML has no `ZQ-KEY`.
  - CPS-2 `getDb()` throws the `ZQ-EXC` error → `Chat.loadError` shown, no `<textarea`, no `ZQ-EXC`/`postgres://`/`ZQ-KEY`.
  - CPS-3 `createAiSettingsDeps()` throws, and separately `getAiSettings` rejects → same as CPS-2.
- **CPG-6** no `fetch` call while rendering the page in any state.

### AC8 — Input limits, one call (decision 13; Req §6; decision 6)
`chat.test.ts`, deps factory spy + fake provider:
- **CE-1** `""`, `"   \n\t"`, `"a".repeat(501)`, `"  " + "a".repeat(501) + "  "` → `invalid_message` (`empty` /
  `too_long`); the deps factory spy, the fake's `calls` and the fetch spy all have zero calls.
- **CE-2** `"a".repeat(500)` and `"  " + "a".repeat(500) + "  "` → pass validation (the fake has one call).
- **CE-9** for one message per outcome family (each executed intent, `unsupported`, `unclear`, `multiple`,
  `provider_error`): the fake has exactly one call; the sum of calls to the four `lib/config` write spies
  (`addEtf`, `setEtfActive`, `trackField`, `untrackField`, module mocks) is 1 for an intent and 0 otherwise.
- **CA-1** (action): FormData with `message` plus `symbol`, `name`, `fieldKey`, `active`, `apiKey`,
  `GEMINI_API_KEY` → `handleChatMessage` called exactly once with exactly the `message` string (one argument).
  **CA-2** missing `message` or a `File` → called with `""`.
- **CV-3** (`ChatPanel.test.tsx`): the textarea has `maxlength="500"` (UX only; the server check is CE-1).

### AC9 — Action-boundary test (Sprint 5 audit W2; decision 14)
`app/actions.boundary.test.ts`:
- **AB-0** finds every `app/**/actions.ts` (recursive `readdirSync`): at least 5 files, and the list contains
  `admin/etfs/actions.ts`, `admin/etfs/[symbol]/fields/actions.ts`, `admin/ai/actions.ts`, `admin/cron/actions.ts`,
  `chat/actions.ts`.
- **AB-1** per file: no specifier `drizzle-orm` or `drizzle-orm/…` (via `extractModuleSpecifiers`).
- **AB-2** per file, case-insensitive: no `` sql` ``, no `insert into`, no `update "`, no `delete from`.
- **AB-3** per file: every specifier that resolves under `lib/` (`@/lib/…` or relative, resolved with
  `path.posix` from the file's repo path) is one of `lib/config/<any file>`, `lib/db`, `lib/db/index`,
  `lib/ai/settings-deps`, `lib/ai/chat`.
- **AB-4** self-check: the same checker, fed one synthetic source per forbidden pattern — `import { sql } from
  "drizzle-orm"`, ``const q = sql`select 1` ``, `"INSERT INTO etfs"`, `'update "etfs" set'`, `"Delete From x"` — and
  one per disallowed import — `@/lib/ai/provider-deps`, `../../lib/ingestion/store` (from `app/admin/etfs/actions.ts`),
  `@/lib/ai/capabilities/configuration/execute` — reports exactly one violation each; a clean synthetic source
  (`@/lib/config/etfs`, `@/lib/db`, `@/lib/ai/chat`) reports none.
- Passes on the current tree (the gate run).

### AC10 — `/admin/ai` points to the chat (FR11; FR5)
- **PA-10** (`app/admin/ai/page.test.tsx`, new): `ro` and `en` HTML contain `href="/chat"` with `Admin.ai.chatLink`;
  `"chatUnavailableNote" in en.Admin.ai` and `in ro.Admin.ai` are both `false`.
- **PA-5** (changed): its `chatUnavailableNote` assertion is replaced by the `chatLink` text (the note no longer
  exists, as the AC requires; the test is updated, not weakened: PA-10 adds the positive link check).

### AC11 — Bilingual and gates (FR8.1; AGENTS.md)
- `i18n/messages.test.ts` (existing key parity + non-empty leaves) passes with the new keys; CRM-3 checks placeholders.
- No test reaches a provider, Neon or bvb.ro: every new file's fetch spy asserted uncalled; detection always mocked;
  `lib/ai/boundaries.test.ts` LB-7 (no SDK) unchanged; `package.json` and the lockfile untouched (reviewer checks).
- No schema change: `drizzle/` and `lib/db/schema.ts` untouched.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`.

### Boundary-test updates (exact; part of AC2/AC7/AC9)
- `lib/ai/boundaries.test.ts`:
  - LB-0: add `chat.ts` and `capabilities/configuration/execute.ts` to the expected list; minimum 22 → 24.
  - LB-2 `ALLOWED_TARGETS`: add exactly `lib/ai/provider-deps`, `lib/ai/capabilities/generate`,
    `lib/ai/capabilities/registry`, `lib/ai/capabilities/configuration/execute`, `lib/config/default-deps`.
    Nothing removed. (`lib/db/index`, `lib/config/etfs`, `lib/ai/providers/resolve`, the context/intent targets are
    already there.)
  - LB-3, LB-4 (importers of key-status stay exactly `app/admin/ai/page.tsx` + `lib/ai/provider-deps.ts`), LB-5,
    LB-6, LB-9, LB-2-fetch: unchanged, and they now also scan `chat.ts`, `execute.ts`, `app/chat/*`, `components/chat/*`.
- `lib/ai/capabilities/boundaries.test.ts`:
  - CB-0: add `configuration/execute.ts` (10 files).
  - CB-4: `configuration/execute.ts` is the one exempt file; a new positive half asserts `execute.ts` mentions
    `addEtf`, `setEtfActive`, `trackField`, `untrackField` and none of `setEtfAdapter`, `detectEtfAdapter`,
    `moveField`, `setAiSettings`, `setCronHour` (the chat can do exactly the four actions, FR5 / Req §5).
  - CB-1 unchanged (execute's imports are already allowed); CB-1b, CB-2, CB-3 unchanged.
- **CV-4** (`ChatPanel.test.tsx`): no non-test file under `components/chat/` has a specifier resolving under
  `lib/ai` (the client bundle never pulls in the provider wiring).

### MANUAL-QA (live, user)
- sprint-06.md steps 2–8 (models, RO and EN commands, scope, provider swap, wrong key, Vercel logs): only a live
  Gemini/Groq model proves real phrasing becomes the canned shapes. Checklist `US-028-qa.md` repeats them with the
  exact replies expected from section 1.6.
- Local, no live resource (Codex QA can run it): serve the app with no `DATABASE_URL` → `/chat` shows `Chat.loadError`
  and no composer, in RO and EN; the header shows the Chat link.
- Duration: on the deployment, "add ETF <new symbol>" returns within the 60 s limit (the Vercel function log shows
  the duration); the budget in 1.7 is the offline proof.

---

## 3. Data model
No change. Writes go only through `addEtf`, `setEtfActive`, `trackField`, `untrackField` (existing statements,
DEC-016); no chat history is stored (decision 13). The report write rules (DEC-010) are untouched: nothing here writes
`reports` or `report_values`. No migration.

---

## 4. Plan-level choices (inside the Decided items)
- **P-1** Remove of an ETF that is already inactive: `setEtfActive(false)` is still the one call (Task 1 "exactly one
  `lib/config/` call"); the reply uses the context's `isActive` to say `alreadyInactive` ("… is not monitored")
  instead of `removed` (tech-lead point 4). Pinned by CEP-11 and EX-3.
- **P-2** Revalidation after a change: `/`, `/admin/etfs`, `/admin/etfs/{symbol}/fields` (story Task 4) plus
  `/etf/{symbol}`, as the admin fields action does (tracked fields change the detail page's columns and charts).
- **P-3** The action takes `FormData` only; the transcript is accumulated by a client-side wrapper inside
  `useActionState` (decision 13: nothing on the server, nothing echoed back).
- **P-4** One reply key per situation across grounding and config results (section 1.4 bold rows).
- **P-5** The "added, no adapter" reply reuses `Admin.detectionReason` (story notes "same reason codes as the admin
  form"); no duplicate catalogue block.
- **P-6** `add_rejected` (`invalid_symbol` / `invalid_name`, unreachable today) shows `notUnderstood`, never a generic
  error (FR13 spirit: not silent, not alarming).
- **P-7** Unavailable replies and `providerModelNotFound` carry a link to `/admin/ai` (AC6; tech-lead point 3).
- **P-8** `Admin.ai.chatUnavailableNote` is removed from both catalogues (AC10 "the note is gone"), `Admin.ai.chatLink` added.
- **P-9** Provider availability is checked before the context load, so an unconfigured chat reads only the
  `settings` row.
- **P-10** `getChatAvailability` returns status + reason only; the provider id and model are not shown on the chat
  page (nothing in the ACs asks for them).

## 5. Risks and the smallest design
- **Open endpoint** (Req §6, tech-lead point 6): anyone with the URL can spend the free-tier quota and change the
  configuration, like `/admin`. Bounded by the 500-character check before any call and one provider call per message;
  rate limiting stays out of scope. Listed for the user as information at the demo.
- **Key leak paths**: the key lives only in `ProviderCallInput` inside `lib/ai/`; `app/` receives `ChatOutcome` /
  `ChatAvailability`, built field by field. CAP-2 proves the key reaches the adapter but no reply; CPS proves the page.
- **Client bundle**: a value import of `lib/ai/chat` from a client component would bundle the wiring; CV-4 forbids it,
  the max length is a prop.
- **Stale context** (database changed between interpretation and execution): the config result is authoritative and
  shares the grounding wording (CEP-10).
- **`maxDuration` for a Server Action**: the action runs under the route of the page that renders the form
  (`app/chat/page.tsx` exports `maxDuration = 60`), the same pattern as `/admin/etfs` (US-020).
- **Model variance / prompt injection**: unchanged from US-027 (only four grounded intents can execute); US-028 adds no
  model text to any output.
- **Word-ban scans** (section 0 gotchas) are the most likely first-run failure; the implementer runs the boundary
  tests early.
- **Extensibility, and no further**: the chat entry calls the capability through the registry, so a later capability
  is a registry entry plus its own entry/route; no generic chat framework, no history, no confirmation flow.

## 6. Files changed (expected, for HANDOVER "Files changed")
- new: `lib/ai/capabilities/configuration/execute.ts`, `lib/ai/chat.ts`, `app/chat/page.tsx`, `app/chat/actions.ts`,
  `app/chat/reply-messages.ts`, `components/chat/{chat-state.ts,transcript.ts,ChatReply.tsx,ChatPanel.tsx,ChatView.tsx}`
- new tests: `lib/ai/capabilities/configuration/execute.test.ts`, `…/execute.pglite.test.ts`, `lib/ai/chat.test.ts`,
  `lib/ai/chat.pglite.test.ts`, `app/chat/reply-messages.test.ts`, `app/chat/actions.test.ts`,
  `app/chat/actions.pglite.test.ts`, `app/chat/page.test.tsx`, `app/chat/page.safety.test.tsx`,
  `components/chat/{ChatReply,ChatPanel,ChatView}.test.tsx`, `components/chat/transcript.test.ts`,
  `app/actions.boundary.test.ts`
- changed: `components/AppHeader.tsx`, `components/AppHeader.test.tsx`, `components/admin/AiSettingsAdmin.tsx`,
  `app/admin/ai/page.test.tsx`, `messages/en.json`, `messages/ro.json`, `lib/ai/boundaries.test.ts`,
  `lib/ai/capabilities/boundaries.test.ts`, `README.md` (one line: the chat at `/chat` and that it needs the AI
  provider, model and key from `/admin/ai`)
- untouched: `lib/config/**`, `lib/db/**`, `drizzle/**`, `lib/ai/providers/**`, `lib/ai/provider-deps.ts`,
  `lib/ai/key-status.ts`, US-027's capability files, `package.json`, lockfile.

## 7. Decisions needed

| # | Type | Question | Status / recommendation | Isolated default? |
|---|---|---|---|---|
| sprint #4 | PRODUCT | No default model | Ships: the `no_model` branch (`lib/ai/providers/resolve.ts`, US-025) and the chat's `unavailableNoModel` reply + link (`app/chat/reply-messages.ts`, `Chat.replies.unavailableNoModel`). **NEEDS USER.** | Yes |
| sprint #10 | PRODUCT | ETF name when only a symbol is given | Ships: name = symbol; a verbatim name in the message wins; a reactivated ETF keeps its name. Confined to the one `add_etf` line in `lib/ai/capabilities/configuration/execute.ts`. **NEEDS USER.** | Yes |
| sprint #11 | PRODUCT | Execute immediately or confirm first | Ships: execute immediately, reply says exactly what was done. Confined to step 7 of `handleChatMessage` in `lib/ai/chat.ts` (and `app/chat/actions.ts`, which has no confirmation turn). **NEEDS USER.** | Yes |
| sprint #12 | PRODUCT | Where the chat lives | Ships: `/chat` in the user area (`app/chat/`) + the `Nav.chat` link in `components/AppHeader.tsx`. **NEEDS USER.** | Yes |
| sprint #13 | TECHNICAL | 500-character limit, stateless | Decided — section 1.2 step 1, P-3 | n/a |
| sprint #14 | TECHNICAL | Action-boundary test and its allowlist | Decided — AB-0..AB-4; the chat entry module named by this plan is **`lib/ai/chat.ts`** | n/a |
| sprint #6 | TECHNICAL | Timeout / budget | Decided — section 1.7, CPG-5 | n/a |

No new decision. The reply wording in section 1.6 is agent-drafted text for the PO to confirm at the demo, together
with the drafted ACs.
