# DEC-026 — More AI providers: named presets plus a custom OpenAI-compatible provider

Status: **Decided** (Technical Lead chat, 2026-10-05), on the user's request "add a new provider/model". Amends DEC-021 §8 (presets only) and US-041 D-1 (roster). Product defaults marked "default".

## Context
Today the provider list is code: Google Gemini and Groq. The model field is already free text (any model name can be typed; the list under it is only a suggestion). DEC-021 §8 refused a free-form base URL because anyone reaching `/admin/ai` could point the stored key at their own server. The user wants to add providers without code changes; anyone who can open `/admin/ai` can use the form.

## Decision
1. **Named presets (default roster), all through the existing OpenAI-compatible adapter with fixed endpoints in code:** OpenAI, OpenRouter, Mistral, DeepSeek, Cerebras, Together AI — plus the existing Gemini and Groq. Each preset: id, name, fixed chat-completions URL, env var name, suggested models. Adding one later stays a one-entry change.
2. **Custom provider (OpenAI-compatible), stored in the database** (new table `ai_custom_providers`, expand-only migration applied by the deploy, DEC-023): `id`, `name` (≤ 40 chars), `base_url`, `created_at`. It appears in the provider selector next to the presets.
   - `base_url` must be `https://`, no credentials, no query/fragment, not an IP literal or `localhost`/private range, ≤ 200 chars; the server appends `/chat/completions`.
   - **The stored key is bound to the URL:** the URL is part of the key's encryption AAD, and **changing or deleting a custom provider's URL deletes its stored key in the same batch**. So someone who changes the URL cannot send the existing key anywhere; they would have to supply their own key. This removes the reason DEC-021 §8 had for refusing custom URLs.
   - Custom providers use stored keys only (no env var).
   - At most 5 custom providers.
3. **Model suggestions (default):** Groq suggestions are ordered strongest-first for this task: `openai/gpt-oss-120b`, `llama-3.3-70b-versatile`, then smaller ones; the admin hint says small models (e.g. `openai/gpt-oss-20b`, `llama-3.1-8b-instant`) understand chat requests less well.
4. **"Test connection" button** on `/admin/ai`: sends one tiny request with the active provider/model and shows OK or the closed error code (`auth_failed`, `rate_limited`, `bad_response`…), never the provider's raw text.
5. Unchanged: key boundary (DEC-017 §4, DEC-021 §5), write-only keys, no key in any output, chat never handles keys, agents never read keys.

## Consequences
- Sprint 13 stories US-056 (presets, suggestions, test connection) and US-057 (custom provider with URL-bound key).
- No user step: the migration rides the next deploy.
