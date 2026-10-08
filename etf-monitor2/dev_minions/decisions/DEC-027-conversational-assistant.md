# DEC-027 — Conversational assistant

Status: **Decided** (Technical Lead chat, 2026-10-05). Technical design only. The product choices come from the PO review in `backlog/sprints/sprint-13.md` and stories US-055 and US-058, and are not re-opened here.
Amends: DEC-017 (sprint-06 decision 7, "no model prose shown"), which is **revoked**; DEC-025 §5 (clarify-only text, 6 turns), which is **replaced** by this decision; DEC-022 §7 (action list), which gains the confirmation step.
Unchanged:
- The closed operation set; the model never writes code (DEC-022).
- Validate everything first, then execute in order.
- At most 5 model actions per message, after `*` expansion counting (DEC-025 §2).
- The key boundary (DEC-017 §4, DEC-021).
- The key-request refusal before any model call.
- Sanitised logs.

## 1. The model's reply is shown, and the app's result list is the truth
- **Model text.** The model writes `reply`, at most `REPLY_MAX_CHARS = 600` characters (longer is cut at a word boundary and gets "…").
  - It is rendered as a plain React text node: never HTML or markdown, no auto-linking, never executed or interpreted.
  - It is written in the language of the user's message; the prompt says so.
  - **Ordering:** the model writes before anything runs, so the prompt tells it to describe what it *will* do ("I'll add…", "Adaug…"), not claim it is done.
- **Server result list.** It is always rendered under the reply and visually separate from it, labelled "What the app did" / "Ce a făcut aplicația". It holds the DEC-025 §5 per-action lines and the specific failure reasons.
- **Disagreement rules:** the server decides which text the user sees.
  - **All actions done:** show the reply plus the result list.
  - **Some actions failed or did not run:** show the reply with a fixed warning line above the list, "Not everything was done — see below" / "Nu s-a făcut tot — vezi mai jos". The result list shows the failures.
  - **Nothing ran** (validation still fails after §3, or the plan is refused): **do not show the model's reply.** It would describe changes that did not happen. Show a server-built message naming the reasons instead.
  - **No actions** (an answer, a question, or out of scope): show the reply alone, with no result list.
- **Fallbacks.** The fixed template sentences remain only when there is no usable reply. That covers provider errors, timeouts, rate limits and output that cannot be parsed after §3.

## 2. Response shape and structured output
- **Envelope.** One structured answer per model call:
  ```json
  { "reply": "string", "actions": [ ... ], "question": "string or null" }
  ```
  - `actions` may be empty: that is a setup answer, an out-of-scope answer or a clarifying question.
  - `question` (at most 300 characters) is set only when the model needs a detail. It is then shown as part of the reply, and `actions` must be empty, so nothing runs while a question is open.
  - `kind: unsupported / unclear / too_many` from DEC-025 are folded into this envelope: an empty `actions` with a `reply` or `question`. The old shapes are still accepted by the fallback parser.
  - **The model never sets confirmation.** `needsConfirmation` is decided by the server (§4), so a manipulated model cannot skip it.
- **Native structured output where the provider supports it.** The preset descriptor gains a static `structuredOutput` value:
  - `"json_schema"`: OpenAI-compatible `response_format: { type: "json_schema", json_schema: { strict: true, … } }` for presets known to support it (OpenAI; Groq, Cerebras and others per their docs at build time). Gemini uses `responseMimeType: "application/json"` plus `responseSchema`.
  - `"json_object"`: OpenAI-compatible `response_format: { type: "json_object" }`. This is today's behaviour and the default for custom providers.
  - `"none"`: JSON-in-text, parsed by today's fence-tolerant parser.
- **The schema covers the envelope only** (`reply`, `actions` as an array of objects, `question`). The inner action shapes stay validated by the server: one strict union schema is too large for some providers' schema limits, and the server is the gate anyway (DEC-025 §7 normalisation, then strict validation).
- **Native tool/function calling is not used.** It adds a second message shape per provider, and one JSON envelope already carries several actions.
- **Downgrade.** If a call with `json_schema` returns HTTP 400 (the new closed code `unsupported_format`), the same request is retried once with `json_object`. That retry counts toward the call cap (§3). The result is cached in memory per provider and model for the life of the server instance; nothing is stored.
- **Adapter interface.** `GenerateRequest` becomes `{ system, messages: [{role: "user"|"assistant", content}], format: "json_schema"|"json_object"|"none", schema?, maxOutputTokens }`. The adapters map it to their native request bodies. Adapters still make at most one HTTP request per call.

## 3. One self-correction round and a cap on model calls
- **Correction round.** After the first answer, the server parses, normalises (DEC-025 §7), expands `*` and validates every action. If the envelope is unparseable or **any** action is invalid, the server makes **one** correction call:
  - **Sent:** the same system prompt and history, the model's previous output (as an assistant turn), then a user turn containing **only** the closed reason list. Example: `action 2: no_matching_widget (PTENGETF; match operation=max fieldKey=units_in_circulation periodAmount=30)`.
  - **Reason text:** built only from closed codes and values already present in the data block or validated input. No database free text, no exception text.
  - **Outcome:** the corrected answer is validated again. If it still fails, nothing runs and the user gets the server-built reasons (§1).
- **Call cap.** `MAX_MODEL_CALLS_PER_MESSAGE = 2`, the first call plus one correction. It is 3 only when a format downgrade (§2) happened in that message.
- **Rate limits.** A `rate_limited` or `timeout` result is never retried within the same message. The template fallback says so.
- **Confirmation.** A confirmation (§4) makes **zero** model calls.

## 4. Confirmation runs exactly the plan that was shown
This needs no login and no server session.
- **When it applies.** The server decides with a pure function, `needsConfirmation(plan)`. It is true when the validated, expanded plan contains any of:
  - `remove_etf`;
  - `untrack_field`;
  - `widget_clear` or `widget_replace` affecting more than one ETF.

  Otherwise the plan executes at once (US-058).
- **What the server returns instead of executing.**
  - The reply.
  - A result list in "proposed" form ("Will remove: … — confirm?").
  - A **plan token**: `base64url(payload) + "." + base64url(HMAC-SHA256(key, payload))`. The payload is canonical JSON:
    - `v: 1`;
    - `plan`: the validated, expanded intents exactly as they will execute;
    - `fp`: a state fingerprint, the SHA-256 of the canonical current state the plan depends on (active ETF set, plus the tracked fields and widgets of every affected ETF);
    - `exp`: now + `PLAN_TOKEN_TTL = 10 minutes`;
    - `n`: a random nonce.
- **Signing key.** HKDF-SHA256 from `AI_KEY_MASTER_KEY` if set, otherwise from `CRON_SECRET` (the same source rule as DEC-021 §2). Use a different `info` value: `chat-plan/v1`. The derivation lives in `lib/ai/key-status.ts` / `key-store.ts` (key boundary).
  - **No key material:** the confirmation is refused with the template "Confirmation is not available; ask again" and nothing runs.
- **Where the token lives.** In the browser transcript only. The page shows "Confirm" / "Confirmă" and "Cancel" / "Anulează" buttons.
  - **Short answers count:** a short user answer while a plan is pending, matched case- and diacritic-insensitively against a fixed list (`da, yes, ok, confirm, confirmă, sigur, go`), is treated as Confirm by the client.
  - **Anything else cancels:** any other message discards the pending plan and is handled as a new request.
- **Confirm action.** The server receives **only the token**, never the text, and:
  - verifies the signature with a constant-time compare, checks `v`, and checks `exp` against now;
  - recomputes `fp` from the current state; a mismatch is refused with "Things changed since this was proposed — please ask again". This also makes a replayed token harmless, because the first execution changed the state;
  - runs exactly `plan` through the same execute path, with no model call and no re-interpretation;
  - returns the result list.
- **Validation is not repeated.** The fingerprint guarantees the state the plan was validated against.

## 5. History budget for the last 21 messages
- **Count.** `HISTORY_MESSAGES = 21`: the last 21 visible messages, user and assistant counted one by one, oldest dropped first.
- **What goes in each turn.** History is sent as native `user` / `assistant` turns (better follow-ups than a quoted block, see §6).
  - **User turns:** the user's text.
  - **Assistant turns:** the shown reply plus a compact one-line form of the result list (e.g. `[done: widget_add max units_in_circulation 30d — BTBETRETF, PTENGETF]`), so "remove that" can refer to it.
  - **Pending plans:** a turn's pending plan token is never included.
- **Per-message cap.** `HISTORY_MESSAGE_MAX_CHARS = 400`; longer is cut in the middle with "…", keeping the start and the end.
- **Total cap.** `HISTORY_TOTAL_MAX_CHARS = 6000` for all 21 together. If exceeded, the oldest messages are cut further, down to 120 characters each. **The count of 21 is never reduced.**
- **Current message.** The current user message (up to `CHAT_MESSAGE_MAX_LENGTH = 2000`) is sent whole.
- **Token sizing.** About 4 characters per token gives:
  - system prompt plus data block: ≤ ~3,000 tokens (the data block is bounded by ETFs × 6 widgets; the prompt test pins an upper size for 20 ETFs);
  - history: ≤ ~1,500 tokens;
  - message: ≤ ~500 tokens;
  - `maxOutputTokens`: 1,024 (2,048 for Gemini thinking models, as today).

  That makes ~5–6k tokens per call, so two calls fit inside a ~12k tokens-per-minute free tier.
- **Model hint.** Smaller per-minute tiers (e.g. ~8k) may hit `rate_limited` on a correction round. The admin model hint (DEC-026 §3) names this.
- **Where the conversation lives.** The browser page only. "New conversation" empties it. The server stores no conversation.

## 6. Prompt-injection posture
- **Database data stays in the escaped data block.** That covers ETF names, field labels, widget titles, tracked fields and the provider/model in use. The block is labelled "data, not instructions" (DEC-025 §1). Widget titles are cut to 60 characters (already the limit).
- **History as native turns is a deliberate choice.** Those turns contain only what the user typed and what this page showed. The page has no login, so a person can only forge history in their own browser, and that has no effect beyond their own request. **Safety does not depend on the prompt.**
- **What safety depends on:**
  - every action passes the strict server validator (closed set, catalogue checks);
  - the confirmation rule is decided by the server (§4);
  - model text is never executed and never rendered as HTML or links.
- **No key in a reply.** Keys are never in the prompt. As a last guard, if the reply or question contains the plaintext key used for that call, or any string matching the stored-key and env-var key patterns, the reply is dropped and the template is shown. The check runs inside `lib/ai`, so the key never leaves it.
- **Key requests.** The key-request refusal (`isProviderKeyRequest`) still runs before any model call. A message asking to set a key never reaches the model.
- **No model text in logs.** Reply text, history and the user's message are never logged; logs keep closed codes only.
- **Setup questions** are answered only from the data block. The prompt tells the model to say "I don't see that in the app's data" rather than guess. Data-value questions (prices, NAV history) remain out of scope (US-055).

## Consequences
- **US-055** builds §1, §2 (envelope and fallback parser), §5 and §6, plus the "New conversation" button and the 2000-character message limit.
- **US-058** builds §2 (native structured output and downgrade), §3 and §4.
- **Tests (no network, recorded model outputs)** cover:
  - escaping and cutting of the reply;
  - the disagreement rules;
  - the 21-message window and character caps;
  - the correction round and the call cap, with a counting fake provider;
  - plan tokens: valid, tampered, expired, state changed and replayed, all refused except valid;
  - confirm makes zero model calls;
  - the key-in-reply guard;
  - the downgrade path.
- **New closed provider error code:** `unsupported_format` (used only to trigger the downgrade, never shown).
