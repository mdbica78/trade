# US-026 — QA checklist (two concrete free providers behind the interface)

Round 1: review PASS (`US-026-review.md`, 1 non-blocking Note), tests PASS (`US-026-tests.md`,
129/129 story-specific tests, 1246/1248 full suite — 2 pre-existing/unrelated flaky timeouts in
`fields page` and `cron route` tests, confirmed unrelated to this story). Local gates all green:
`pnpm typecheck`, `pnpm lint` (0 errors, 5 pre-existing/new `_prefix` unused-arg warnings),
`pnpm build`, `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u GROQ_API_KEY pnpm build`
(offline).

## Offline checks (Codex QA can run these)

1. `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
   expect exit 0 for each (a full-suite run may show 1-2 pre-existing unrelated flaky timeouts;
   retry in isolation to confirm).
2. `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` — expect exit 0 (build must
   not require a database or a provider key).
3. Serve the app locally (`pnpm build && pnpm start`, or `pnpm dev`) and open `/admin/ai` in both
   `ro` and `en`:
   - the provider select and the key-status table list exactly two providers, Google Gemini and
     Groq;
   - both `GEMINI_API_KEY` and `GROQ_API_KEY` show as "not set" (no value ever shown);
   - the "chat not available yet" note is present (removed only when US-028 ships).
4. Confirm no live network call is made by any test: `grep -rn "generativelanguage.googleapis.com\|api.groq.com" test/` should
   only match fixture/adapter constant files under `lib/ai/providers/` and `test/fixtures/ai/` —
   never a live `fetch`.

## Live checks (user only — needs real API keys / Vercel; not run by Codex or this loop)

5. Create a free API key in Google AI Studio (https://aistudio.google.com/apikey) and a Groq
   console key (https://console.groq.com/keys); set `GEMINI_API_KEY` and `GROQ_API_KEY` in the
   Vercel project's Production environment variables; redeploy.
6. After redeploy, `/admin/ai` shows both keys as "set", no value ever shown. If the database
   already stores a provider id of `openrouter` or `mistral` from before this story, `/admin/ai`
   shows the existing translated "unknown provider" notice and does not error.
7. **After US-028 ships** (the chat is the only surface that actually calls a provider — this
   story does not add one): exercise a real Gemini call with a current model name, an unknown
   model name (expect a "model not found"-style reply), then switch the admin setting to Groq and
   repeat with the same commands; also try a deliberately wrong key for each provider (expect "the
   AI provider rejected the key"). These four checks are listed here per the story's "Notes for
   verification" but actually run together with US-028's own QA checklist, once that story ships.

## PO to confirm drafted criteria

All 9 acceptance criteria in `dev_minions/backlog/stories/US-026.md` are marked
"DRAFTED BY AGENT — PO to confirm". Also confirm Sprint 6 decision #5 (Google Gemini + Groq as the
two shipped providers) — the isolated default already shipped; see HANDOVER.md "Waiting on the
user".

## Files changed

- `dev_minions/verification/US-026-plan.md` (story-planner), `US-026-review.md`, `US-026-tests.md`,
  `US-026-qa.md` (new, this file)
- new: `lib/ai/providers/http.ts`, `lib/ai/providers/gemini.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/providers/groq.ts`, `test/helpers/ai-http.ts`
- new fixtures: `test/fixtures/ai/README.md`, `test/fixtures/ai/gemini/{success,no-candidates,error-429,
  error-400-api-key-invalid,error-400-invalid-argument,error-404-model}.json`,
  `test/fixtures/ai/groq/{success,no-choices,error-429,error-401-invalid-key,error-404-model,
  error-400-json-validate-failed}.json`
- new tests: `lib/ai/providers/gemini.test.ts`, `lib/ai/providers/groq.test.ts`,
  `lib/ai/providers/openai-compatible.test.ts`, `lib/ai/providers/responses.test.ts`,
  `lib/ai/providers/errors.test.ts`, `lib/ai/providers/timeout.test.ts`,
  `lib/ai/provider-deps.interchange.test.ts`
- changed: `lib/ai/providers/default-registry.ts` (ships gemini+groq), `lib/ai/provider-catalog.ts`
  (trimmed to gemini+groq, sprint 6 decision 5), `lib/ai/provider-catalog.test.ts` (PC-1),
  `lib/ai/providers/registry.test.ts` (PR-5 replaced, PR-6 new), `lib/ai/boundaries.test.ts` (LB-0,
  LB-2(a), LB-4 widened to scan all of `lib/` — closes US-025 review W1; LB-8, LB-9 new),
  `lib/ai/env-example.test.ts` (EX-2, RM-1 new), `lib/ai/key-status.test.ts` (KS-2 catalogue-driven),
  `lib/ai/provider-deps.test.ts` (PD-7 catalogue-driven), `app/admin/ai/page.test.tsx` (PA-1/2/3/5
  catalogue-driven; PA-6b, PA-7b new), `app/admin/ai/actions.test.ts` (AA-7 title corrected, AA-7b
  new), `.env.example` (OpenRouter/Mistral blocks removed), `README.md` (env var + admin sections),
  `test/fixtures/README.md` (pointer to `ai/README.md`)
