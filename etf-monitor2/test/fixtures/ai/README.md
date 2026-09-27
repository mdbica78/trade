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
