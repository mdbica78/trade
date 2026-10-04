# US-042 review

## Round 1 — 2026-10-03

Verdict: **FAIL**

### Acceptance criteria

- **AC1 — Localized instruction area: MET.** `components/chat/ChatView.tsx` renders a labelled `section` using the `Chat.instructions` namespace. `messages/en.json` and `messages/ro.json` contain corresponding heading, intro, four action labels and key-guidance entries. `components/chat/ChatView.test.tsx` checks equal instruction-key sets and renders all instruction strings in both locales; its all-state test covers available, unavailable and error states. Independently ran `corepack pnpm exec vitest run components/chat/ChatView.test.tsx app/chat/page.test.tsx`: exit **0**, 2 files / 22 tests passed.
- **AC2 — Advertised capabilities match what ships: MET.** The four displayed list items are exactly add ETF, remove ETF, track field and untrack field. `components/chat/ChatView.test.tsx` maps those message keys to the complete `CONFIGURATION_ACTIONS` tuple from `lib/ai/capabilities/configuration/intent.ts`, asserts exact key/action correspondence and RO/EN key parity, and checks the rendered strings. It also guards against widget, raw-field, multi-action and corresponding Romanian future-feature claims. The current static examples do not promise those unimplemented capabilities.
- **AC3 — Key guidance and privacy: NOT MET.** The static guidance itself is appropriately explicit in both locales: do not paste provider keys into chat and set/replace them through the `/admin/ai` link. The new section adds no input; `ChatView.test.tsx` asserts no input element or key/baseUrl named control across all states. However, the required *existing fixed reply* for a key-setting request is not present or tested. DEC-021 §9 says such a request gets a fixed `/admin/ai` reply and must not be sent to a provider. In `lib/ai/chat.ts`, after ordinary message validation, `handleChatMessage` resolves the active provider and passes the message to the configuration capability (`getCapability("configuration").run(...)`); there is no key-request interception before this call. The system prompt in `lib/ai/capabilities/configuration/prompt.ts` only classifies “other settings” as unsupported, and `app/chat/reply-messages.ts` maps that outcome to the generic `unsupported` reply without an admin link. Searches of the capability, chat, and reply code/tests found no key-setting special case/test. Consequently a key-setting request is not guaranteed a fixed refusal and, if it contains key text, the ordinary path can forward it to the provider, contrary to DEC-021 §9 and AC3. This is a criterion failure, not a live-QA item.
- **AC4 — Static, offline rendering: MET.** `/chat` page wiring in `app/chat/page.tsx` passes static props to `ChatView`; the instruction component has no provider/action call of its own. `app/chat/page.test.tsx` mocks `getChatAvailability`, renders both locales, and spies on `globalThis.fetch`, asserting zero calls; it also checks the `/admin/ai` guidance and absence of a key field. Independently ran the focused 2-file suite (22/22 pass), `corepack pnpm typecheck` (exit **0**), `corepack pnpm lint` (exit **0**, 9 warnings), `corepack pnpm test` (exit **0**, 204 files / 2063 tests), and `corepack pnpm build` (exit **0**, offline build; migration runner skipped and all 12 dynamic routes generated). Before each command, `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY` and `GROQ_API_KEY` were removed from the process environment. No live provider, database, or other live resource was used.

### Finding

- **AC3 failure — key requests lack the DEC-021 fixed refusal path.** The guidance correctly tells users not to paste keys and where to manage them, but a static instruction is not a substitute for the required request-time refusal. Current flow can send a submitted key-bearing message to the configured AI provider. Add/restore a deterministic pre-provider refusal that points to `/admin/ai`, and a regression test proving the provider is not called for a key-setting request, before considering this criterion met.

Denied or attempted commands: none. No git command, `.env*`/credential file, secret value, live resource, or `ai_provider_keys` row was accessed.

## Round 2 — 2026-10-03

Verdict: **FAIL**

### Re-review of failing criterion

- **AC3 — Key guidance and privacy: NOT MET.** The round-2 change closes the previously reported canonical paths: `lib/ai/chat.ts` checks `isProviderKeyRequest(message)` before creating dependencies, so detected requests return only `{ kind: "key_request" }` without provider/dependency/context calls. `app/chat/reply-messages.ts` maps that outcome to the fixed `keyRequest` reply with `adminLink: true`; `ChatReply` renders the `/admin/ai` link. The reply contains no request text or interpolation values. `ChatPanel.tsx` supplies the translated hidden label to `appendTranscript`, and `components/chat/transcript.ts` replaces the submitted text whenever the fixed reply key is returned. Tests in `lib/ai/chat.test.ts` cover five canonical English/Romanian key phrases and assert no dependency, provider, context or execute call and no key in the returned outcome; `app/chat/reply-messages.test.ts` pins the fixed reply; `components/chat/transcript.test.ts` proves the submitted sentinel is absent from transcript state.

  **Adversarial gap:** `isProviderKeyRequest`'s Romanian expression only recognizes a provider name following `de` (e.g. `cheia de la Groq`), not the natural Romanian form `cheia Gemini` / `cheia Groq`. I independently evaluated the exact source regex against these strings: `setează cheia API la value`, `schimbă cheia de furnizor value`, and `configurează cheia de la Groq value` matched, but `setează cheia Gemini value` and `setează cheia Groq value` did not. The unmatched requests therefore proceed to dependency creation and can reach the provider with the submitted key text. This contradicts DEC-021 §9's fixed refusal for a key-setting request and leaves the same key-exposure path open for ordinary Romanian phrasing.

  Independently ran the requested focused suite:

  ```text
  corepack pnpm exec vitest run lib/ai/chat.test.ts app/chat/reply-messages.test.ts components/chat/transcript.test.ts components/chat/ChatView.test.tsx app/chat/page.test.tsx
  ```

  Exit code **0**; **5 files / 98 tests passed**. The suite passes the implemented canonical cases but does not include the failing vendor-specific Romanian phrases above. Full typecheck/lint/suite/build are not re-run in this review round; those claims are not relied on for this AC3 verdict.

### Finding

- **AC3 remains NOT MET — Romanian vendor-specific key phrasing bypasses the refusal.** Extend the deterministic recognition and regression coverage to include natural Romanian constructions such as `setează cheia Gemini` and `setează cheia Groq`; prove that the submitted text is neither sent to the provider nor retained in transcript state, and that only the fixed key-free `/admin/ai` reply is returned.

Denied or attempted commands: none. No git command, `.env*`/credential file, secret value, live resource, or `ai_provider_keys` row was accessed.

## Round 3 — 2026-10-03

Verdict: **PASS** (re-review of AC3 only)

### Re-review of failing criterion

- **AC3 — Key guidance and privacy: MET.** The named-vendor Romanian gap from round 2 is closed: `lib/ai/chat.ts` now recognizes both `cheia Gemini` and `cheia Groq`, as well as explicit API/provider-key labels. Its generic English action-plus-key and Romanian action-plus-cheie patterns cover unqualified actionable requests such as “set my key” / “setează cheia”. `handleChatMessage` performs this recognition after input-length validation but before `depsFactory()`, so detected messages produce only `{ kind: "key_request" }`: provider resolution, context loading, capability generation and execution are skipped. `lib/ai/chat.test.ts` asserts for ten English/Romanian provider-specific and generic requests that the sentinel is absent from the outcome and dependency creation, fetch, context loading and execution do not occur. Its benign-request cases prove ordinary field-change requests still proceed to dependency creation/provider execution, reducing concern about an overbroad generic matcher.

  `app/chat/reply-messages.ts` maps the fixed outcome to `{ tone: "info", messageKey: "keyRequest", adminLink: true }`, with no request-derived values; the existing `ChatReply` renders the `/admin/ai` link for that flag. `components/chat/ChatPanel.tsx` passes the localized hidden label to `appendTranscript`, and `components/chat/transcript.ts` substitutes that label for any `keyRequest` response. `components/chat/transcript.test.ts` verifies the submitted sentinel is absent from serialized transcript state. The English and Romanian catalogs both provide the fixed key-free refusal and hidden transcript label.

  Independently ran:

  ```text
  corepack pnpm exec vitest run lib/ai/chat.test.ts app/chat/reply-messages.test.ts components/chat/transcript.test.ts
  ```

  Exit code **0**; **3 files / 83 tests passed**. This is focused AC3 evidence; typecheck, lint, full-suite and build were not rerun for this review round.

No remaining AC3 finding. No `MANUAL-QA` is needed for this deterministic offline behavior.

Denied or attempted commands: none. No git command, `.env*`/credential file, secret value, live resource, or `ai_provider_keys` row was accessed.
