# US-026 — Independent review (story-reviewer)

## Round 1 — 2026-09-27
Verdict: PASS

Reviewer: fresh-context `story-reviewer` subagent. Read: AGENTS.md, CLAUDE.md,
`dev_minions/backlog/stories/US-026.md`, `dev_minions/verification/US-026-plan.md`,
`dev_minions/decisions/DEC-017-ai-provider-layer.md`, DEC-016 §1, HANDOVER.md's "Files changed
(US-026, in flight)" list, and every file on that list, in full. Ran `pnpm typecheck` (clean),
`pnpm lint` (0 errors, 5 pre-existing/new `_prefix` unused-arg warnings — same count HANDOVER
claims), and a targeted `pnpm vitest run` over all 15 new/changed AI test files (129/129 passing,
run by me). Did not re-run the full suite or `pnpm build` — that is the tester's gate; not re-run
here.

### Acceptance criteria

- **AC1 (Gemini request)** — MET. `lib/ai/providers/gemini.ts:51-69` builds
  `POST {GEMINI_MODELS_BASE_URL}{encodeURIComponent(model)}:generateContent`, key only in
  `x-goog-api-key`, body per spec. Tests: `lib/ai/providers/gemini.test.ts` GM-1..GM-6 (grepped,
  present, and I ran them: 6/6 pass), including GM-5's `../x?key=y` / `a/b#c` encoding edge cases
  named in the story's "Notes for verification".
- **AC2 (Groq request)** — MET. `lib/ai/providers/groq.ts` + `openai-compatible.ts` build
  `POST https://api.groq.com/openai/v1/chat/completions`, `Authorization: Bearer`, `max_tokens`,
  `response_format`. Tests: `groq.test.ts` GQ-1..GQ-5, `openai-compatible.test.ts` OC-1 (the
  "one more small entry" proof — a bare `createOpenAiCompatibleProvider({id:"groq",...})` with no
  error rule, proving the factory is provider-neutral). Ran, 6/6 pass.
- **AC3 (Responses)** — MET. `lib/ai/providers/responses.test.ts`, `describe.each` over both
  adapters: RS-1 (success fixture → exact `{ok,text}`), RS-2 (no-candidates/no-choices →
  `bad_response`), RS-3 (non-JSON 200 body → `bad_response`), plus RS-4/RS-5/RS-6 beyond the
  story's letter (blank/whitespace text, thought-parts, multi-part join, a rejecting `text()`).
  Ran, 11/11 pass.
- **AC4 (Errors never leak)** — MET. `lib/ai/providers/errors.test.ts`: HE-1 status table
  (401/403→auth_failed, 404→model_not_found, 429→rate_limited, other→provider_error), HE-2
  committed-fixture cases, HE-3 (`fetch` rejects), HE-4 (aborted→timeout), HE-5/HE-6 (the
  tech-lead's Gemini 400 `API_KEY_INVALID`→`auth_failed` and Groq 400
  `json_validate_failed`→`bad_response` branches, each with a negative case), HE-7 (no throw),
  HE-8 (sentinel-echo: the key, request URL and a body marker never appear in
  `JSON.stringify(result)`, `Object.keys(result)` stays within `{ok,error}`/`{ok,text}`). Ran,
  16/16 pass. This is the criterion DEC-015 §1 and AGENTS.md's secrets rule bind hardest on, and
  it is the most thoroughly tested one in the story.
- **AC5 (One request, no retry)** — MET. Every GM/GQ/RS/HE test asserts the fetch mock was called
  exactly once (or zero for the null-key guard); `lib/ai/providers/timeout.test.ts` OR-2a/OR-2b
  drive `runGeneration` with fake timers: still pending at `AI_PROVIDER_TIMEOUT_MS - 1`, resolves
  `{ok:false,error:"timeout"}` at the constant (imported, never a literal — checked
  `timeout.test.ts:5`), exactly one fetch call, and the signal passed to fetch is aborted. Ran,
  4/4 pass.
- **AC6 (Catalogue equals implemented providers)** — MET. `lib/ai/provider-catalog.ts:9-12`
  trimmed to exactly `gemini`/`groq`; `lib/ai/providers/default-registry.ts:7`
  `SHIPPED_PROVIDER_ADAPTERS = [geminiProvider, groqProvider]`. Tests: `provider-catalog.test.ts`
  PC-1 (`PROVIDER_IDS` equals `["gemini","groq"]`), `registry.test.ts` PR-5 (registry ids equal
  `PROVIDER_IDS`) and PR-6 (each adapter reachable and function-shaped), `env-example.test.ts`
  EX-2 (`.env.example`'s `*_API_KEY` lines equal the catalogue's, each with an `https://`
  comment) and RM-1 (README's Environment-variables section and the whole file mention only
  catalogue variables — confirmed no stray `OPENROUTER_API_KEY`/`MISTRAL_API_KEY` token remains in
  `.env.example` or `README.md` by direct read). Ran PC-1/PR-5/PR-6/EX-2/RM-1, all pass.
- **AC7 (`/admin/ai` follows the catalogue)** — MET. `app/admin/ai/page.tsx` and `actions.ts` are
  unchanged (as the plan says they need no code change); only the tests changed to be
  catalogue-driven. `page.test.tsx`: PA-1 (option count = catalogue length + 1, stored id
  selected), PA-2/PA-3 (key-status counts follow the catalogue, no sentinel leak), PA-5/PA-5b
  (ro/en names and notes, no cross-locale leak), PA-7/PA-7b (a stored `openai`/`mistral`/
  `openrouter` — including the two ids this story just removed from the catalogue — selects none
  and shows the translated notice, in both locales, without throwing), PA-6/PA-6b (`getAiSettings`,
  `getDb()` and `createAiSettingsDeps()` each throwing synchronously give the translated
  `loadError` with no exception text — this closes Sprint 5 audit W3 exactly as the story's Task 5
  and the plan's AC7 section promise). `actions.test.ts` AA-7 (title corrected to describe what it
  tests) and AA-7b (the same two synchronous throwers on the save path: generic error state, no
  `setAiSettings`/`revalidatePath` call, no secret text). Ran page.test.tsx (12/12) and
  actions.test.ts (7/7), all pass.
- **AC8 (Interchangeable by settings alone)** — MET.
  `lib/ai/provider-deps.interchange.test.ts` IC-1/IC-2 build `ProviderDeps` from the real shipped
  registry and `readApiKey`, varying only `loadSettings`'s return value, and drive a real
  `loadActiveProvider` → `runGeneration` round trip against a fetch spy that answers by URL host
  with the committed success fixtures; IC-3 confirms each call carries only its own provider's
  sentinel key. Ran, 3/3 pass. No adapter is referenced by name in the test — only through
  `settings.provider` — which is the literal "no code change between the two" reading of AC8.
- **AC9 (Offline and gates)** — MET. Every new/changed AI test file stubs global `fetch` in
  `beforeEach` with a throwing spy (grepped across all 15 files; consistent). `package.json` has
  no new dependency (read directly — no AI SDK, no new package at all) and `lib/ai/boundaries.
  test.ts` LB-7 pins the denylist check. `pnpm typecheck` and `pnpm lint` I ran myself are clean
  (0 lint errors). `pnpm test` (full suite) and `pnpm build` (incl. the offline env-unset variant)
  are the tester's gates — not re-run by me; HANDOVER.md's stated full-suite/build results are not
  verified by me in this round.

### Non-negotiable rules (AGENTS.md / DEC-017)
- Deterministic, no AI: N/A to this story (it is the AI provider layer itself; the "AI module =
  one pluggable provider adapter" rule is what this story implements). No PDF/extraction code
  touched.
- Key boundary (DEC-017 §4): `lib/ai/boundaries.test.ts` LB-4 now scans the whole `lib/` tree, not
  only `lib/ai` — this closes US-025 review's W1 exactly as HANDOVER's "Exact next step" asked for.
  I ran LB-4 myself (part of the 36-test boundaries.test.ts run, 36/36 pass). LB-8 (new) pins that
  the key never appears in a URL and that `gemini.ts`/`groq.ts` each have exactly one `https://`
  literal, matching their exported base-URL constant. LB-9 (new) pins no `console.*` in any
  non-test `lib/ai` file. LB-6 (unchanged) still forbids `providers/*` importing `key-status`,
  `provider-deps` or `lib/db` — read `gemini.ts`/`groq.ts`/`http.ts`/`openai-compatible.ts`
  directly and confirmed each imports only `./types` and, where relevant, `./http` /
  `./openai-compatible`.
- No SDK (DEC-017 §3): confirmed by direct read of `package.json` plus LB-7.
- next-intl ro+en: no new UI string was needed (the unknown-provider notice and the
  "chat not available yet" note already existed from US-022); confirmed `messages/en.json` and
  `messages/ro.json`'s `Admin.ai` blocks are unchanged and both contain `unknownStoredProvider`
  and `chatUnavailableNote`. `messages/*.json` correctly absent from "Files changed".
  `components/**` also correctly absent — confirmed `AiSettingsAdmin.tsx` and `sections.ts` carry
  file timestamps from earlier stories (2026-09-26), not touched today.
- Secrets: the sentinel-echo tests (HE-8, GM-2, GQ-2) and the PA-6b/AA-7b synchronous-throw tests
  are the concrete proof; `lib/ai/providers/http.ts` builds every result as a fresh literal
  (`{ok:false,error:<code>}`/`{ok:true,text}`), never spreading a body or forwarding a caught
  value — read directly, matches DEC-017 §1's "never puts the key, the URL or response text into
  a result".
- No weakened/skipped tests: grepped `lib/ai/`, `app/admin/ai/`, `test/helpers/ai-http.ts` for
  `.skip(`/`.only(`/`xit(`/`xdescribe(` — none found.
- No scope creep: grepped the whole repo (excluding `node_modules`, `dev_minions`) for
  `openrouter`/`mistral`/`OPENROUTER_API_KEY`/`MISTRAL_API_KEY` — the only remaining hits are in
  test files, either as intentional stale-id fixtures for the unknown-provider-notice tests
  (`page.test.tsx` PA-7b) or as denylist regex fragments (`boundaries.test.ts`,
  `providers/types.test.ts`); no non-test code references either provider. Files outside the
  HANDOVER "Files changed" list were not touched (checked mtimes on `components/admin/
  AiSettingsAdmin.tsx` and `sections.ts`; `app/admin/ai/page.tsx`/`actions.ts` read and confirmed
  byte-for-byte consistent with "needs no code change", per the plan).

### Findings
None Critical. None Warning. One Note:
- **N1** — I did not re-run `pnpm test` (full suite) or `pnpm build` myself in this round; the
  targeted run I performed (129 tests across the 15 US-026 AI files) all pass, and `pnpm
  typecheck`/`pnpm lint` I ran are clean, but the full-suite count and the offline-build claims in
  HANDOVER.md are the tester's to confirm, not mine.

Denied or attempted commands: one `git diff --stat HEAD -- package.json pnpm-lock.yaml` I
attempted out of habit while checking that `package.json`/`pnpm-lock.yaml` were untouched — denied,
not retried; I instead confirmed by reading `package.json` directly (no SDK, no new dependency).
