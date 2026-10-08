# US-056 — QA checklist
More provider presets (OpenAI, OpenRouter, Mistral, DeepSeek, Cerebras, Together AI), Groq
suggestion reorder, and a key-free "Test connection" button on `/admin/ai`.
Dev-loop verdicts: review PASS, tests PASS (round 1) — `US-056-review.md`, `US-056-tests.md`.

## Automated gates (re-run by Codex QA, all offline)
1. `pnpm install --frozen-lockfile` → exit 0.
2. `pnpm typecheck` → 0 errors.
3. `pnpm lint` → 0 errors (13 warnings expected, same baseline as this round).
4. `pnpm test` → 230 files / 2493 tests, all green. Run with `DATABASE_URL`, `CRON_SECRET`,
   `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and every `*_API_KEY` (`GEMINI_API_KEY`, `GROQ_API_KEY`,
   `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`,
   `CEREBRAS_API_KEY`, `TOGETHER_API_KEY`) unset.
5. `pnpm build` (offline) → 12 dynamic routes, `migrate-on-deploy: skipped`.
6. `bash scripts/claude/predeploy-check.sh` → PASS (run from a WSL login shell if on this
   machine — a non-login shell may lack `pnpm` on PATH).
7. `pnpm db:generate` with `DATABASE_URL` unset → reports no schema changes (AC2/§4 of the plan;
   confirms no migration was introduced for the catalogue/preset additions).

## Local app check (no live key, no database)
8. Start the app locally (no `DATABASE_URL`). Visit `/admin/ai` in both `en` and `ro`:
   - the provider selector lists all 8 presets (Gemini, Groq, OpenAI, OpenRouter, Mistral,
     DeepSeek, Cerebras, Together AI), each with its own model-suggestion datalist;
   - Groq's suggestions appear in the new strongest-first order (`openai/gpt-oss-120b`,
     `llama-3.3-70b-versatile`, then the two smaller ones) and the small-model hint text renders
     in both locales;
   - no URL/endpoint input exists anywhere on the page;
   - the page returns HTTP 200 with the expected safe no-database state (settings load error),
     the same pattern as every other admin page without a database.
9. `/admin/ai`'s "Test connection" button is absent on the settings-load-error page (no settings
   to test) — expected per PA-14.

## Live steps (need a real key, entered by the user only — never by an agent, never in chat/tests)
These exercise the one behaviour this story cannot prove offline: that the six new presets'
hardcoded endpoints, auth scheme and suggested model names are actually correct against each
vendor's live API.
10. **M-1** — On the deployed app, open `/admin/ai`, save a real key for one new preset (e.g.
    OpenRouter or Cerebras, both have a free tier), select the preset and one of its suggested
    models, Save, click **Test connection** → expect "Connection OK." Change the model field to a
    nonsense name, Save, Test connection again → expect `model_not_found` (or `provider_error` for
    a vendor that answers with a generic 400). Replace the saved key with an obviously wrong one,
    Test connection → expect `auth_failed`. At every step the page must show only the closed code
    text — never raw provider response text, never the key.
11. **M-2** — Groq: select `openai/gpt-oss-120b` (now the first suggestion), Test connection →
    expect OK. Then try `/chat` with one of the US-053 transcript phrases → expect it to work
    (sanity check only, not a new acceptance criterion for this story).
12. **M-3** (optional, per preset the user actually has a key for) — repeat Test connection for
    each of OpenAI, Mistral, DeepSeek, Together AI → expect OK. The endpoint URLs and model names
    were taken from vendor documentation and cannot be proven offline; this is the only way to
    confirm each is still correct.

## PO to confirm (drafted/isolated-default items, not blocking)
- D-1 (model-suggestion lists per new preset) and D-2 (failed-test message shows the closed code
  verbatim, e.g. "Connection failed: auth_failed") both ship their isolated default from the plan.
  Logged under HANDOVER.md "Waiting on the user" for the next demo; no action needed unless the
  PO wants different suggestions or a friendlier failure message.

## Files changed
- changed (source): `lib/ai/provider-catalog.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/providers/default-registry.ts`, `components/admin/action-state.ts`,
  `app/admin/ai/result-messages.ts`, `app/admin/ai/actions.ts`, `app/admin/ai/page.tsx`,
  `components/admin/AiProviderModelFields.tsx`, `components/admin/AiSettingsAdmin.tsx`,
  `messages/en.json`, `messages/ro.json`
- new (source): `lib/ai/connection-test.ts`
- changed (docs/config): `.env.example`, `README.md`
- new (tests): `lib/ai/providers/presets.test.ts`, `lib/ai/connection-test.test.ts`,
  `lib/ai/provider-presets.pglite.test.ts`, `app/admin/ai/test-connection.flow.test.tsx`
- changed (tests, additions): `lib/ai/provider-catalog.test.ts`, `lib/ai/providers/openai-compatible.test.ts`,
  `lib/ai/provider-deps.interchange.test.ts`, `app/admin/ai/actions.test.ts`,
  `app/admin/ai/result-messages.test.ts`, `components/admin/ActionMessage.test.tsx`,
  `components/admin/AiProviderModelFields.test.tsx`, `app/admin/ai/page.test.tsx`
- deliberate test changes: plan §3 items 1-7 + the PMF-2 same-cause fallout (`"openai"` →
  `"anthropic"` as the unknown-id case in `components/admin/AiProviderModelFields.test.tsx`)
- process: `dev_minions/HANDOVER.md`, `dev_minions/verification/US-056-plan.md`,
  `dev_minions/verification/US-056-review.md`, `dev_minions/verification/US-056-tests.md`,
  `dev_minions/status.md`
