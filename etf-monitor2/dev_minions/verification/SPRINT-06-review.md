# Sprint 6 review: AI natural-language configuration

Reviewer: tech-lead subagent (in-loop, DEC-009), 2026-09-26.

Verdict: APPROVED

- US-025: APPROVED — Task 1 amended in place (`model_not_found`); `## Tech-lead review` lists five binding points for the plan (LB-4 must scan `lib/`, key object stays in `lib/ai/`, concrete `fetch` scan, success-path sentinel).
- US-026: APPROVED — one real defect fixed in place (Gemini answers a wrong key with HTTP 400 `API_KEY_INVALID`, not 401: Task 3, Task 7, AC4 amended; 404 → `model_not_found`; Groq `json_validate_failed` → `bad_response`); AC5 FR citation added; `## Tech-lead review` explains.
- US-027: APPROVED — AC4's VUAN example fixed in place (the seed already tracks `nav_per_unit`); `## Tech-lead review` adds plan points ("JSON" in the prompt, generous `maxOutputTokens`, prompt data untrusted).
- US-028: APPROVED — AC7 clarified in place (page handles a throwing `getDb()` too); `## Tech-lead review` adds plan points (key-free availability view for the page, which config results grounding pre-empts, reply wording for the new codes, inactive-ETF remove reply).

The amendments are complete specifications, so no re-draft is needed; each story's planner folds its `## Tech-lead review` section into the plan, and the reviewer checks against it.

Scope: `backlog/sprints/sprint-06.md` and `backlog/stories/US-025.md` to `US-028.md`, all drafted by `story-planner`.

Checked against:
- `requirements/etf-monitoring-requirements.md` (FR1, FR2, FR5, FR6, FR8.1, FR9, FR11, §2.2 design note, sections 3, 5, 6);
- `backlog/roadmap.md` (Sprint 6 titles, "Carry-forward notes" for Sprint 6 and "Any sprint"), `backlog/epics.md` (EPIC-06 "Done when");
- `sprint-05.md` decisions 9 and 10 and "Notes for whoever details Sprint 6"; `verification/SPRINT-05-audit.md` (W2, W3, N3, N5, N7);
- DEC-015, DEC-016, ADR-001 (via AGENTS.md stack line);
- the code the stories cite: `lib/ai/{provider-catalog,key-status,settings-deps,boundaries.test}.ts`, `lib/config/{etfs,tracked-fields,detect-adapter,default-deps}.ts`, `lib/config/ai-settings.ts` (exports), `lib/db/seed-data.ts`, `lib/ingestion/run-daily.ts` (`CRON_FETCH_TIMEOUT_MS`), every `app/**/actions.ts` (imports), `components/AppHeader.tsx`, `components/admin/AiSettingsAdmin.tsx`, `app/admin/ai/page.tsx`, `messages/en.json` (`Nav`, `chatUnavailableNote`), `status.md` (story board).

## Independent checks (what I read myself)
- **Boundary tests** (US-025): `lib/ai/boundaries.test.ts` has LB-1..LB-4 as the story says. LB-2 forbids any `fetch(` and has a four-entry specifier allowlist; LB-4 walks only `app/` and `components/`, so a `lib/` importer of `key-status` is invisible to it today. The revision must widen the walk (sprint decision 2, tightened).
- **Key reader**: `key-status.ts` reads `process.env[provider.apiKeyEnvVar]` and returns booleans only; the catalogue holds four ids (`gemini`, `groq`, `openrouter`, `mistral`), as US-025/US-026 state.
- **Config API** (US-027/US-028): `addEtf` returns `added` (with `adapterKey` and `DetectionReason`) / `reactivated` / `invalid_symbol` / `invalid_name` / `already_monitored`; `setEtfActive` returns `ok` or `not_found`, and returns `ok` for an ETF that is already inactive; `trackField` returns `tracked` / `already_tracked` / `not_found` / `field_not_available`; `untrackField` returns `ok` / `not_found` / `not_tracked`; `listFieldsForEtf` gives `available` (adapter keys ∩ catalogue) and `tracked` with both labels; `normaliseSymbol` accepts letters and digits only. The stories' "What exists" sections match.
- **Seed**: three ETFs (BTBETRETF, TVBETETF, PTENGETF; ICBETNETF is not seeded), each tracking `units_in_circulation` and `nav_per_unit`. So "also track VUAN for BTBETRETF" on a seeded database is `already_tracked`: US-027 AC4 and sprint manual QA step 4 fixed in place; US-028 AC2's choices (`net_asset` to track, `nav_per_unit` to untrack) are already correct.
- **Server Actions** (decision 14): there are four today (`app/admin/{ai,cron,etfs,etfs/[symbol]/fields}/actions.ts`); all import only `next/cache`, `@/lib/db`, `@/lib/config/*`, `@/lib/ai/settings-deps`, `@/components/admin/action-state` and a local `result-messages`. The allowlist passes on the current tree once specifiers are matched in `@/lib/…` form; with `app/chat/actions.ts` there are five, so US-028 AC9's "at least five" is exact.
- **Duration** (decision 6): `CRON_FETCH_TIMEOUT_MS = 7_000` (`lib/ingestion/run-daily.ts:3`), used for discovery and download in `createEtfConfigDeps`; the admin ETF page and the cron route export `maxDuration = 60`. 20 s + 14 s + PDF text extraction fits.
- **Provider wire formats** (US-026, from my knowledge of the public APIs; agents cannot call them): Gemini `v1beta/models/{model}:generateContent`, `x-goog-api-key`, `systemInstruction`, `generationConfig.{maxOutputTokens,responseMimeType}` — correct. Groq `https://api.groq.com/openai/v1/chat/completions`, Bearer, `response_format: {type: "json_object"}` — correct. **Defect:** Gemini answers an invalid key with HTTP 400 (`API_KEY_INVALID`), not 401/403, so the draft's mapping would fail manual QA step 7 for Gemini. Fixed in place in US-026; the plan must cite the documentation for each error shape.
- **`/admin/ai`**: `AiSettingsAdmin.tsx` already renders `unknownStoredProvider`; `chatUnavailableNote` exists in both catalogues; `app/admin/ai/page.tsx` wraps `getDb()` in a `try` (PA-6b is a missing test, not a missing guard, as the Sprint 5 audit says).
- **Dependencies**: US-020..US-024 are Awaiting QA (`status.md`); US-022 has Codex QA PASS. Order US-025 → {US-026, US-027} → US-028 is right; US-026 and US-027 touch different files.
- **AC citations**: every AC cites an FR, a requirements section or (for gate ACs) AGENTS.md; all are marked "DRAFTED BY AGENT — PO to confirm". US-026 AC5 cited only a sprint decision; FR6 added. AC counts match the sprint table (7, 9, 9, 11).
- **Offline testability**: every AC is provable with the fake provider, a mocked/injected `fetch`, committed JSON fixtures and PGlite. Live behaviour (model understanding, real error bodies, JSON mode) is correctly left to the user's manual QA.
- **Carry-forward notes**: roadmap Sprint 6 (pluggable adapter + capability plugins → US-025/US-027, DEC-017; keys never handled by agents → env vars, sentinel tests only). Sprint 5 forward notes (reuse `lib/config/`, symbol-only name, trim catalogue, open admin) and Sprint 5 audit W2 (US-028), W3 US-022 part (US-026), N5 (US-027) are all assigned. Items left out (W3 US-020/US-023 parts, N3, N7, W1/W4, "any sprint" debts) have a stated reason: the files are not touched this sprint.
- **Scope** matches the roadmap titles and EPIC-06 "Done when" ("RO and EN, at least two interchangeable free providers"). Nothing is built beyond FR1/FR2/FR5/FR6 except the action-boundary test (audit W2) and PA-6b (audit W3), both carried debts.

## Decisions table (settled in place in `sprint-06.md`)
- TECHNICAL #1, #2, #3: **Decided**, recorded in `decisions/DEC-017-ai-provider-layer.md` (binds later AI capabilities). #1 amended: `ProviderErrorCode` gains `model_not_found`. #2 tightened: LB-4 scans `lib/`, no `readApiKey` under `app/`/`components/`, the key object never leaves `lib/ai/`, concrete `fetch` scan.
- TECHNICAL #6, #7, #8, #13, #14: **Decided** in place, sprint-local (no DEC). #7 is scoped to the configuration capability only and adds "JSON" to the prompt; #14 adds case-insensitive patterns, `@/lib/…` matching and per-pattern self-checks.
- PRODUCT #4 (no default model), #5 (Gemini + Groq, catalogue trimmed), #9 (one action per message), #10 (name = symbol), #11 (execute immediately), #12 (`/chat` in the user area): isolated default can ship — **yes** for every one (literal FR reading, confined to the code each row names). `NEEDS USER` stands; none blocks a story.
- New item for the user (information, not a decision): the open `/chat` endpoint lets anyone with the URL spend the free-tier quota (requirements §6, no login); the 500-character limit bounds each request (US-028 review point 6).

## For the main session
- `status.md` has no Sprint 6 rows yet (line 106 says the dev loop adds them); add US-025..US-028 as Ready.

Denied or attempted commands: none. I ran no git command, read no `.env*` or credential file, and printed no variable value. I ran no gate (`pnpm`) in this review; nothing above cites a test run.
