# test/fixtures/ai/ — Gemini and Groq response/error bodies

Hand-written JSON bodies for `lib/ai/providers/{gemini,groq}.test.ts` and the shared
`responses.test.ts` / `errors.test.ts`. **Not recorded with a real API key** — no agent has one
(AGENTS.md, DEC-015) and this session had no network access to either provider. Each shape below
was written from the provider's public API reference as of the story that added it (US-026); if a
live call ever disagrees, the fix is a fixture + mapping change (`lib/ai/providers/{gemini,groq,http}.ts`),
never a shortcut in the test. What a live provider actually returns is proven only by
`dev_minions/backlog/sprints/sprint-06.md`'s manual QA steps, run by the user.

## Sources

- Gemini `models.generateContent`: https://ai.google.dev/api/generate-content — endpoint, request
  shape (`contents`, `systemInstruction`, `generationConfig`), response shape
  (`candidates[].content.parts[].text`, `finishReason`, `usageMetadata`, `modelVersion`).
- Gemini `GenerationConfig`: https://ai.google.dev/api/generate-content#generationconfig —
  `maxOutputTokens`, `responseMimeType: "application/json"`.
- Gemini API keys: https://ai.google.dev/gemini-api/docs/api-key — the key goes in the
  `x-goog-api-key` header; created in Google AI Studio (https://aistudio.google.com/apikey).
- Gemini troubleshooting: https://ai.google.dev/gemini-api/docs/troubleshooting — 400
  `INVALID_ARGUMENT`, 403 `PERMISSION_DENIED`, 404 `NOT_FOUND`, 429 `RESOURCE_EXHAUSTED`, 500
  `INTERNAL`, 503 `UNAVAILABLE`.
- Google API error model: https://cloud.google.com/apis/design/errors — error envelope
  `{ error: { code, message, status, details[] } }`; an invalid key answers with HTTP 400 and a
  `google.rpc.ErrorInfo` detail whose `reason` is `API_KEY_INVALID`.
- Groq chat completions: https://console.groq.com/docs/api-reference#chat-create — endpoint,
  `Authorization: Bearer`, request fields (`model`, `messages`, `max_tokens`), response shape
  (`choices[].message.content`, `finish_reason`, `usage`, `x_groq`).
- Groq JSON mode: https://console.groq.com/docs/structured-outputs — `response_format: { type:
  "json_object" }`; a failure to produce valid JSON answers with HTTP 400,
  `error.code: "json_validate_failed"` and a `failed_generation` field.
- Groq errors: https://console.groq.com/docs/errors — status table and error envelope
  `{ error: { message, type, code? } }`; 401 `invalid_api_key`, 404 `model_not_found`, 429
  `rate_limit_exceeded`.
- Groq keys: https://console.groq.com/keys — where the user creates the key.

## Files

- `gemini/success.json`, `gemini/no-candidates.json` — a 200 response with and without an answer.
- `gemini/error-429.json`, `gemini/error-400-api-key-invalid.json`,
  `gemini/error-400-invalid-argument.json`, `gemini/error-404-model.json` — 4xx error bodies.
- `groq/success.json`, `groq/no-choices.json` — a 200 response with and without an answer.
- `groq/error-429.json`, `groq/error-401-invalid-key.json`, `groq/error-404-model.json`,
  `groq/error-400-json-validate-failed.json` — 4xx error bodies.

Only the body is fixed here; the HTTP status is set by the test that serves the fixture.

## `chat-regression.json` (US-054)

A table of RO/EN chat messages with a **hand-authored** recorded model output per row, in the
style of a small, sometimes-sloppy model (DEC-025 Consequences: "fixed model outputs") — not
captured from a live provider; no agent has a real key (AGENTS.md, DEC-015). Read by
`lib/ai/chat.regression.test.ts`, which runs each row's `message` through the real
`handleChatMessage` over a fixed fake context and provider, and checks either the merged ordered
list of executor calls (`executed`) or the exact `ChatOutcome` (`outcome`).

To add a row (e.g. once the user supplies a full transcript, or from a live MANUAL-QA failure
recorded by the plan's §8 steps): append an object with `id`, `lang` (`"ro"`/`"en"`), `transcript`
(`true` only for a phrase actually quoted in a sprint/decision/story file), `message`, `model`
(the raw text a provider would answer, may be fenced with ```` ```json ```` ... ```` ``` ````), and
either `executed` (the ordered `{capability, intent}` list the executors should receive) or
`outcome` (the exact `ChatOutcome` for a request that is rejected or unsupported). This is a
data-only change — no test code needs to change.

## `chat-conversations.json` (US-055, AC8)

Multi-turn dialogues, hand-authored like `chat-regression.json` above (no live key, no live
provider). Read by `lib/ai/chat.conversations.pglite.test.ts`, which replays each dialogue through
the real `handleChatMessage` over a seeded PGlite database and a fake provider that returns each
turn's recorded `model` text in order, building the visible history between turns the same way the
chat page does (`historyFromTranscript` → `handleChatMessage` → `buildChatReply` →
`appendTranscript`). Exactly one dialogue has `"transcript": true` — it replays the 5 phrases from
the user's 2026-10-05 script (also in `chat-regression.json`, there as 5 independent single-turn
rows) as one real conversation, turn after turn.

A dialogue is `{ id, lang, transcript, title, turns: [{ user, model, expect }] }`; `model` is
`null` only for a turn that must never reach the provider (a key request). `expect` names the
outcome `kind` and, where relevant, whether any result changed something (`anyChanged`) or the
reply carries the partial-failure warning (`warning`). To add a dialogue: append one more object
with a fresh `id`; no test code needs to change.

## `chat-list-queries.json` (US-059)

Hand-authored, no live key. `state` is the configuration the PGlite test builds (active/inactive
ETFs, tracked keys, custom values, newest *successful* report date per ETF — a newer non-ok report
must never show up); `rows` are list requests in both locales, one or more per category
(`active_etfs`, `inactive_etfs`, `tracked_fields`, `widgets`, `latest_report_date`), each with the
canned model answer (`model`) and the reply the app must return (`reply`). They prove the wiring
only: the context sent to the model carries the state, the answer comes back as `answered`, no action
runs and nothing is written. Language-model quality is a MANUAL-QA check with a real provider.
Run offline: `pnpm exec vitest run lib/ai/chat.list-queries.pglite.test.ts`. To add a request:
append one row with a fresh `id`; no test code needs to change.
