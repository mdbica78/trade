# Sprint 10 — AI setup in the browser

> Detailed by agent (story-planner), 2026-10-02 — PO to confirm at demo.
> Source of scope: `backlog/roadmap.md` Sprint 10. Binding review: `verification/SPRINT-10-review.md` (APPROVED FOR DETAILING); this file carries the review forward and re-decides nothing.

**Epic:** EPIC-08 · **Requirements:** `requirements/etf-monitoring-requirements.md` §8 (FR16, FR17)  
**Binding inputs:** DEC-021 (stored provider keys and fixed presets), DEC-023 (production deploy applies migrations), DEC-017 (provider adapter boundary), DEC-016 (configuration writes), DEC-019 (sanitised load-error reporting).  
**Blocked by:** nothing. D-1 has an isolated default; none of the stories waits for a user step.

## Goal

Let the user configure an AI provider, model and write-only provider key from `/admin/ai`, without editing Vercel settings, and explain supported chat requests in Romanian and English.

## Why this order

**US-040 → US-041 → US-042**, as required by `verification/SPRINT-10-review.md` §1.

- **US-040 first:** adds encrypted key persistence, its expand-only migration and the asynchronous provider-key loading boundary. No downstream story may overlap its edits to provider wiring or `/admin/ai`.
- **US-041 second:** adds only fixed provider presets and model-selection UI/configuration. The roster default is limited to implemented Gemini and Groq adapters; no free-form endpoint is allowed.
- **US-042 last:** adds static bilingual guidance against the final supported request set and avoids concurrent edits to chat-facing messages. It has no functional dependency on US-041 after US-040; the order is for conflict avoidance, not a product dependency.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-040 | Store provider keys from `/admin/ai` (write-only, encrypted; DEC-021 decided, key derived from the existing `CRON_SECRET`, no user step) | US-022, US-025, US-026, US-028, US-048 | strong model, high thinking — AI key/crypto boundary, async provider wiring, schema/migration, many privacy-critical criteria |
| US-041 | Provider presets (OpenAI-compatible list) and model picker; no free-form URL (presets only) | US-040 (sequence); existing provider catalogue/settings from US-022/025/026 | strong model, high thinking — provider registry/catalogue/UI/configuration and unresolved product roster |
| US-042 | Chat page instruction area (RO and EN) | US-028 (chat surface); US-040 (sequence for shared AI/chat edits) | mid model, medium thinking — static bilingual UI and scope guard |

These prerequisites are already delivered or Awaiting QA; no new story is blocked on them. US-041 and US-042 do not have a functional dependency on one another once US-040 is complete.

## Decisions needed

| # | Story | Type | Question | Resolution / recommendation | Isolated default possible? |
|---|---|---|---|---|---|
| D-1 | US-041 | PRODUCT — **PROPOSED / NEEDS USER** | Which providers belong in the initial preset roster? FR16 and DEC-021 require presets but do not name vendors; the roadmap title says “OpenAI-compatible list” without enumerating providers. | Review §4 recommends keeping the initial catalogue to already implemented Google Gemini and Groq. Ship those two fixed-endpoint presets only unless the user explicitly names additional providers. Do not treat this recommendation as a Decided roster; do not silently add vendors. A free-form/custom URL is excluded by FR16 and DEC-021, not an option for this question. | **Yes.** Use the existing Gemini/Groq catalogue and adapters; keep D-1 PROPOSED / NEEDS USER if the product wants additions. No story waits. |

No technical decision remains open: implement the key lifecycle, storage source, validation, table shape, module boundary, and deployment migration exactly as DEC-021 / DEC-023 and the pre-detail review specify.

## Sprint Definition of Done

- US-040, US-041 and US-042 meet their drafted acceptance criteria; each criterion cites FR16 or FR17 and remains marked for PO confirmation.
- All automated verification is offline: fake keys only, PGlite for SQL/migrations, and mocks for provider/network calls. Never read or select `ai_provider_keys`, use live credentials, call AI providers, run a migration against Neon, or change Vercel settings.
- Any new migration is generated locally, expand-only, and tested by applying the journal-order migrations to PGlite. Production applies it at deploy under DEC-023; no manual Neon step is created.
- No new runtime dependency is introduced. Crypto runs in Node, never Edge.
- Preserve key-free output and the three-module key boundary from DEC-021; keep `resolveActiveProvider` synchronous and unchanged.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and offline `pnpm build` pass with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and provider-key variables unset. Tests use only explicit obvious fake values and must not print them.
- Every UI string is localized in `messages/en.json` and `messages/ro.json`; D-1 remains visibly **PROPOSED / NEEDS USER**, with the Gemini/Groq isolated default.

## Manual QA / live steps

- **No setup, credential, Neon, or Vercel step is required.** DEC-021 derives the default encryption key from the existing `CRON_SECRET`, and DEC-023 applies the migration in the production build.
- After user push, Codex may observe the deployed `/admin/ai` and `/health` behavior as part of its QA checklist. That observation is not a prerequisite and must not expose or enter a real key. Live provider validation is out of scope; model discovery and credential checking are not performed.
- D-1 is answered by the PO at demo only if the initial roster should include named providers beyond the isolated Gemini/Groq default.
