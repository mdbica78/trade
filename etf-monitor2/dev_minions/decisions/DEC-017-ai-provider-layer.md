# DEC-017 — AI provider layer: one adapter interface, the key boundary, capability plugins

- Status: **Decided**
- Validated by tech-lead subagent (in-loop, DEC-009), 2026-09-26: FR6 asks for "a single AI-provider adapter, easy
  to swap" and §2.2 for a capability system; plain HTTPS through an injected `fetch` needs no SDK (ADR-001), keeps
  every test offline, and lets the key reach an adapter through exactly one module while `key-status.ts` stays the
  only `process.env` reader (AGENTS.md Secrets, DEC-015).
- Source: Sprint 6 review (`backlog/sprints/sprint-06.md` → "Decisions needed" #1, #2, #3; US-025, US-027). Binds
  Sprint 6 and every later AI capability or provider (requirements §6).

## Context
Sprint 5 (US-022) built a static provider catalogue and `lib/ai/key-status.ts`, which returns booleans only, and
boundary tests that forbid any `fetch(` in `lib/ai` (LB-2) and any importer of `key-status` other than
`app/admin/ai/page.tsx` (LB-4). Sprint 6 must call real providers, so a key value has to reach an adapter and an
HTTP request has to be made. Requirements §6 foresees more AI capabilities later (e.g. a news feed).

## Decision
1. **One adapter interface** (`lib/ai/providers/`): `AiProvider { id; generate(request, ctx) }`. The request holds
   `system`, `user`, `json`, `maxOutputTokens`; the context holds `apiKey`, `model`, an injected `fetch` and an
   `AbortSignal`. The result is `{ ok: true, text }` or `{ ok: false, error }` with the closed `ProviderErrorCode`
   set `timeout | network | auth_failed | rate_limited | model_not_found | provider_error | bad_response`. An
   adapter never throws, makes at most one request per call, and never puts the key, the URL or response text into
   a result; it may read an error body's code fields to classify a failure.
2. **One wrapper** (`runGeneration`) owns the timeout (one constant in `lib/ai/`), turns anything thrown into
   `provider_error`, never throws, and is the only entry point for callers.
3. **No provider SDK.** Every call is plain HTTPS through the injected `fetch`, to a base URL fixed in the adapter's
   code. A new provider is one adapter file plus one catalogue entry; the catalogue and the registry hold the same
   ids (pinned by a test).
4. **Key boundary.**
   - `lib/ai/key-status.ts` stays the only reader of `process.env` in `lib/ai` (LB-3). It adds
     `readApiKey(providerId)`, whose value goes only into the adapter call context.
   - Exactly one server-side wiring module in `lib/ai/` combines settings, `readApiKey`, the registry and the global
     `fetch`. The importers of `key-status` in the whole tree (`app/`, `components/`, `lib/`) are exactly
     `app/admin/ai/page.tsx` (booleans only, no `readApiKey`) and that module; no client component.
   - An object carrying the key never leaves `lib/ai/`; `app/` receives key-free views only.
   - No bare `fetch(` and no `globalThis.fetch` in `lib/ai` outside the wiring module; network calls appear only in
     `lib/ai/providers/*`, on the injected context `fetch`.
5. **Capabilities** live in `lib/ai/capabilities/<id>/`, registered in one capability registry. A capability
   depends on the provider interface and `runGeneration` only, never on a concrete adapter or the wiring module; it
   may call `lib/config/*` (never the reverse, DEC-016 §1). Adding a capability is a new folder plus one registry
   entry, with no change to provider code.

## Not decided here
- How a capability presents model output. The configuration capability shows no model prose (sprint-06 decision 7);
  a later capability (e.g. the news feed) decides its own rule.
- Which providers, and whether a default model ships (product, sprint-06 decisions 4 and 5).
- Storing keys in the app (sprint-05 decision 9, credentials, `NEEDS USER`).

## Consequences
- US-025 revises LB-2 and LB-4 as above; the reviewer checks that every assertion outside `lib/ai/providers/*` and
  the wiring module is at least as strict as before and that LB-3 is untouched.
- A new `ProviderErrorCode` is a change to this DEC, because every capability's reply mapping must cover it.
