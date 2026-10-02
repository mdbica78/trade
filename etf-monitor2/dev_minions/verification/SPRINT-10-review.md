# Sprint 10 pre-detail review — AI setup in the browser

Reviewer: Technical Lead chat, 2026-10-02. Inputs: `backlog/roadmap.md` Sprint 10; requirements §8 (FR16–FR17); `decisions/DEC-021-stored-ai-provider-keys.md`; `verification/SPRINT-09-review.md` §5; current provider/configuration interfaces (`lib/ai/provider-catalog.ts`, `lib/config/ai-settings.ts`, DEC-017).

## Verdict

**APPROVED FOR DETAILING WITH ONE PROPOSED PRODUCT ITEM.** The technical boundaries, test approach, and safe defaults below are binding for the sprint detailer. The exact provider preset roster for US-041 is not specified by FR16, DEC-021, or the roadmap; it remains **PROPOSED / NEEDS USER**, not a Technical Lead decision. Detail US-041 with an explicit isolated default and record the question in its “Decisions needed” table. Do not silently add unnamed vendors or allow arbitrary endpoints. This review does not approve implementation of an expanded roster.

No user step blocks the stories: use the app's fixed presets and the DEC-021-derived key by default; migrations are applied by production build under DEC-023. The user-accepted no-login risk is settled and must not be reopened as a login proposal.

## 1. Scope and order

Sprint goal from the roadmap: configure an AI provider and model and enter a provider key from the browser, without touching Vercel; add a bilingual chat instruction area.

Recommended build order: **US-040 → US-041 → US-042**.

- **US-040 first.** It establishes encrypted key storage, the migration, and the asynchronous provider-key loading boundary. US-041 then works against the resulting provider/key configuration rather than competing with that foundational change.
- **US-041 second.** It changes provider presets and the existing AI settings UI/configuration; do not overlap this with US-040's edits to the provider wiring and admin AI surface.
- **US-042 last.** It is functionally independent after the existing chat surface, but keeping it last avoids concurrent changes to chat-facing messages and lets its instructions describe the final supported request set.

US-041 and US-042 have no product dependency on one another after US-040; the order is a conflict-avoidance recommendation, not a newly invented requirement.

## 2. Binding decisions and guardrails

### US-040 — Store provider keys from `/admin/ai` (FR16, DEC-021)

- Implement DEC-021 as written: dedicated `ai_provider_keys` table and its own expand-only migration; AES-256-GCM with fresh 12-byte IV, provider id as authenticated additional data, and `key_source` persisted with each row.
- Key derivation precedence is valid `AI_KEY_MASTER_KEY` first, otherwise HKDF-SHA256 derived from `CRON_SECRET` using DEC-021's fixed salt/info and minimum length. Invalid/missing material disables storage visibly; it must not silently substitute another key source for decryption. Preserve stored-key → environment-key → unset precedence.
- Keep `resolveActiveProvider` synchronous and unchanged. Load stored keys asynchronously before the resolver is called. Keep the three-module key boundary from DEC-021 (key status, key store, provider wiring), with only the two specified importers of `key-store`; pin it with a boundary test. No plaintext-bearing object may leave `lib/ai/`.
- Use the shared `lib/config/` write pattern and a thin server action. Validate the catalogue provider, key length/characters, and storage-enabled state; return only closed errors and key-free success values. The password control is write-only, has no default value, and clears after save. Clearing a stored key restores environment fallback.
- A missing `ai_provider_keys` table is a no-stored-key state, not a page failure. Follow DEC-019's sanitized logging style for per-provider read/decrypt failures; never log key material, exception text, ciphertext, or master/derived key material. `/health` must identify the missing schema table without querying its rows.
- Preserve DEC-021's `robots: noindex` and Next same-origin server-action mitigation. Do not add a rate limiter or authentication scheme; the residual access/quota risk is already accepted.
- Use fake keys only. Tests must prove the fake is absent from serialized views, HTML, action results, thrown messages and all captured console output. Never read, select, seed, or print real secret variables or `ai_provider_keys` rows.

### US-041 — Provider presets and model picker (FR16, DEC-017, DEC-021)

- Presets are fixed catalogue entries backed by implemented adapters, with provider endpoints fixed in code. No user-supplied or form-posted `baseUrl`; test that an injected `baseUrl` is ignored. Keep catalogue/registry IDs aligned and preserve the key boundary.
- Per Sprint 9 review §5, model suggestions are static per preset with free-text entry; do not call a provider to list models. Reuse the existing `settings.ai_provider` / `settings.ai_model` configuration path and its model-length validation rather than adding a separate secret-bearing configuration store.
- The current shipped catalogue contains Gemini and Groq; the exact additions/roster implied by “OpenAI-compatible list” are unresolved. See §4. Do not interpret “preset” as arbitrary endpoint creation.

### US-042 — Chat page instruction area (FR17)

- Add a static instruction area, localized through next-intl in Romanian and English. It must enumerate only requests actually supported by the shipped chat capability; it must not imply that FR18/FR19 functionality from Sprint 11 is already available.
- Keep the content static and key-free. A prompt to enter/change a key should direct the user to `/admin/ai`, consistent with DEC-021; the chat must never accept, echo, store, or forward key text as configuration.
- Test both locales, translation-key parity, and that the advertised request set stays within the currently supported capability. No model/network call is needed to render the instructions.

## 3. Minimum acceptance coverage for detailing

These are review minimums, not a substitute for the planner's complete criteria. Every criterion in the detailed sprint must cite FR16 or FR17 (or DEC-021/DEC-023 for migration/process constraints) and have offline evidence unless it is explicitly a live-only check.

| Story | Required evidence |
|---|---|
| US-040 | Schema/migration structure and journal order; migration integration on PGlite; encryption/decryption round trip, fresh IV, tamper and wrong-provider-AAD rejection, wrong key, deterministic HKDF and separation from raw `CRON_SECRET`; precedence and per-row `key_source`, including master-key override for new writes while old rows still decrypt by their recorded source; disabled storage for short/missing derivation material; save/replace/clear validation and closed errors; async provider wiring without changing resolver semantics; missing-table fallback and sanitized failure behavior; key-free output/leak scans; action/UI write-only behavior and RO/EN; boundary tests and offline gates. Never test with a real key, environment secret, live provider, live Neon, or selected `ai_provider_keys` rows. |
| US-041 | Exact preset roster recorded as settled or explicitly PROPOSED; every offered preset maps to a fixed implemented endpoint and supported adapter; no arbitrary URL path; model suggestions are static, free text remains validated and bounded; settings persist and reload through the existing config layer; locale coverage and offline tests. No live model discovery or credential validation. |
| US-042 | Static instruction area is present and accessible on the chat page in RO and EN; all strings use translation keys with parity; content corresponds to supported requests and excludes future widget/raw-field capabilities; key-related instructions point to `/admin/ai`; render tests make no network request and expose no key input. |

## 4. Unresolved product item — PROPOSED, not decided

**D-1 (US-041): Which provider presets are in the initial list?**

- **Context:** FR16 requires a list of presets and a model name but does not enumerate vendors. DEC-021 prohibits free-form URLs and says US-041 adds presets, not URLs. DEC-017 leaves provider choice to product decisions. The current implementation/catalogue supports Google Gemini and Groq; the roadmap title additionally calls out an “OpenAI-compatible list” without naming entries.
- **Options:** (a) keep the initial list to the already shipped Gemini/Groq providers; (b) add a named, curated list of fixed-endpoint OpenAI-compatible providers, each backed by the required adapter/catalogue implementation; (c) another explicitly named curated list.
- **Recommendation / isolated default:** ship only already-supported Gemini and Groq until additional vendors are named. This avoids inventing a vendor/cost choice and does not create a user step; any expansion must be explicit in the story's fixed preset list and implementation.
- **Status:** **PROPOSED — NEEDS USER** if the product intends the initial roster to include additional providers. Do not label the roster Decided in this review. No free-form URL is an option under current FR16/DEC-021.

## 5. Risks to carry into the sprint

1. **Secret disclosure (highest impact):** tests, errors, render snapshots, logs, action results, and handover/QA artifacts can accidentally reveal a submitted key. Use only obvious fake values and assert their absence from every observable output, not merely the main view model.
2. **Encryption-source lifecycle:** rotating/removing `CRON_SECRET` makes rows encrypted from that source unreadable; changing to `AI_KEY_MASTER_KEY` affects new writes only. Preserve the recorded-source behavior and surface “not set” without exposing decryption details.
3. **Unavailable or delayed migration:** keep the key table isolated so older `settings`/ETF reads continue to work; missing-table reads degrade safely and `/health` identifies schema drift. Generate an expand-only migration; never run it against Neon.
4. **Endpoint/key exfiltration:** any form URL or user-controlled provider URL could redirect a stored key. Fixed presets, adapter-owned endpoints, and an ignored-`baseUrl` regression test are mandatory.
5. **Async wiring regression:** key loading touches `provider-deps.ts`, the chat send path, and `/admin/ai`; keep `resolveActiveProvider` unchanged and test the wiring, fallback, and sanitized error behavior independently.
6. **Accepted exposure remains:** `/admin` and `/chat` have no login. `noindex` and same-origin action checks are mitigations, not authentication. Do not describe them as access control or reopen the settled no-login product decision.
7. **Instruction drift:** US-042 can become misleading if it advertises future or unsupported requests. Keep it static and test its scope against the current capability.

No new runtime dependency is justified by these stories. Node crypto is already mandated by DEC-021; crypto code must run in the Node runtime, never Edge.

## 6. Carry-forward to the sprint detailer

- Create the Sprint 10 file and US-040..042 story files only; mark any planner-drafted acceptance criteria for PO confirmation per process.
- Carry DEC-021's exact behavior and boundaries as binding, cite FR16/FR17 on each criterion, and include D-1 in the sprint's “Decisions needed” table as **PROPOSED / NEEDS USER**, with the isolated default above.
- Keep provider preset selection separate from custom endpoint support: the latter is forbidden by the current decision.
- Plan all tests offline with fake keys and PGlite/mocks. Do not read secrets or `ai_provider_keys` data, call providers, run a live migration, or make any Vercel changes.
- Keep US-040 → US-041 → US-042 in order. US-039 remains owned by the separate verification work and is not part of this review.

Files changed: `dev_minions/verification/SPRINT-10-review.md` only. No code, story, status, or HANDOVER files were changed. No git, live secrets, or `ai_provider_keys` rows were accessed.

## Detailed review of planner draft — 2026-10-02

Reviewer: Technical Lead chat. Inputs: `backlog/sprints/sprint-10.md`, `backlog/stories/US-040.md`, `US-041.md`, `US-042.md`; this pre-detail mandate; DEC-021; requirements §8 FR16–FR17. No code, status, HANDOVER, secret, or database-row reads; no git commands.

### Verdict

**APPROVED after the wording clarifications listed below.** Sprint 10 and all three stories preserve the pre-detail scope, mandatory order, offline verification constraints, and DEC-021 behavior. Acceptance criteria are explicitly planner-drafted for PO confirmation and cite the applicable FR/decision. No code or test evidence was reviewed or claimed.

**D-1 remains PRODUCT — PROPOSED / NEEDS USER.** The sprint/story preserve Gemini and Groq as the isolated current-catalogue default, do not infer a roster from “OpenAI-compatible list,” and exclude free-form endpoints. This review does not decide the roster or authorize additional providers.

### Detailed checks

- **Sprint structure and sequencing:** US-040 → US-041 → US-042 matches §1. Dependencies and rationale are stated; US-041/042 are correctly described as functionally independent after US-040. No story is held for a manual credential, Neon, or Vercel step; migration handling follows DEC-023.
- **US-040:** AC1–AC9 cover the dedicated table/migration, AES-GCM and AAD, derivation/source lifecycle, stored/env precedence and async wiring, config writes/closed errors, missing-table behavior and sanitized logging, write-only UI/locales/mitigations, boundary/leak evidence, and offline gates. These align with DEC-021. Corrected the ambiguity between the documented three-module `lib/ai/` boundary and the unavoidable transient submitted-key input in the Server Action/config write layer. Also made DEC-021 §3's disabled-storage behavior explicit: omit the key input and show the note while environment-variable keys remain usable.
- **US-041:** AC1–AC5 correctly constrain the default to implemented Gemini/Groq fixed-endpoint adapters, static model suggestions plus bounded free text, existing settings persistence, locale/error behavior, ignored `baseUrl`, and offline tests. Corrected AC1 to make clear that merely naming another vendor does not authorize expanding this story; an added preset needs explicitly scoped implementation of its adapter and fixed endpoint. This does not resolve D-1.
- **US-042:** AC1–AC4 implement FR17 as static bilingual guidance, ensure advertised requests match the existing capability, exclude Sprint 11 functionality, point key setup to `/admin/ai` without asking for keys in chat, and avoid provider calls. No scope or decision gap found.
- **Sprint DoD and live steps:** correctly require fake-key-only tests, PGlite/mocks, local expand-only migration tests, no live migration/provider/credential step, Node-only crypto, localized UI, and full offline project gates. Codex may observe deployed behavior after push without making it a prerequisite or entering a real key.

### Required clarifications applied

1. `backlog/stories/US-040.md`: clarified the `lib/ai/` key-material boundary while explicitly allowing only transient submitted-key receipt/validation/forwarding by the Server Action and `lib/config/ai-keys.ts`; prohibited plaintext persistence, logging, response/view exposure. Made storage-disabled UI behavior explicit.
2. `backlog/stories/US-041.md`: specified Gemini/Groq for this story and clarified that any additional vendor requires a separately scoped implementation; D-1 remains proposed.

No changes were needed in `backlog/sprints/sprint-10.md` or `backlog/stories/US-042.md`. No issue remains that blocks detailing or implementation under the isolated default. No decision about the provider roster was made.
