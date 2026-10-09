# US-022 — Admin: AI provider and API key settings

**Verdict: PASS**

## Round 1 — 2026-09-26

### Command results

| Command | Exit code | Summary |
|---------|-----------|---------|
| `pnpm install --frozen-lockfile` | 0 | Lockfile passes supply-chain policies, up to date |
| `pnpm typecheck` | 0 | No TypeScript errors |
| `pnpm lint` | 0 | 0 errors, 3 warnings in existing test files (unrelated to US-022) |
| `pnpm test` | 0 | 88 test files, 1022 tests passed |
| `env -u DATABASE_URL pnpm build` | 0 | Build successful, `/admin/ai` route included |

### Test coverage by acceptance criterion

**AC1 — Choice from the supported list**
- `lib/ai/provider-catalog.test.ts:5` — has exactly the four FR6 provider ids, in order
- `lib/ai/provider-catalog.test.ts:9` — has unique ids and unique apiKeyEnvVar values
- `lib/ai/provider-catalog.test.ts:16` — every apiKeyEnvVar matches the *_API_KEY shape
- `lib/ai/provider-catalog.test.ts:22` — every provider requires an API key and has a non-empty name
- `app/admin/ai/page.test.tsx:41` — PA-1: shows exactly 5 provider options in catalogue order, the stored provider selected, model filled
- `app/admin/ai/page.test.tsx:51` — PA-1b: no stored provider/model selects none and leaves the model field empty
- `app/admin/ai/page.test.tsx:57` — PA-7: a stored provider no longer in the catalogue selects none and shows the notice
- MET

**AC2 — Save writes only its columns**
- `lib/config/ai-settings.pglite.test.ts:21` — AS-2: saves provider and model, trims the model, leaves the other settings columns untouched
- `lib/config/ai-settings.pglite.test.ts:40` — AS-3: with no existing row, save creates id=1 with the column defaults
- `lib/config/ai-settings.pglite.test.ts:48` — AS-4: clearing the provider (empty string) nulls both columns, keeps cron_hour_utc/default_locale
- `lib/config/ai-settings.pglite.test.ts:64` — AS-4b: null and undefined provider behave like an empty string
- MET

**AC3 — Validation**
- `lib/config/ai-settings.test.ts:17` — AV-1: an unknown or malformed provider is rejected, zero runner calls
- `lib/config/ai-settings.test.ts:26` — AV-2: a model over the length limit, or a non-string model, is rejected
- `lib/config/ai-settings.test.ts:40` — AV-4: a provider with surrounding whitespace is trimmed and accepted
- `lib/config/ai-settings.test.ts:47` — AV-5: clearing the provider ignores an otherwise-too-long model
- `app/admin/ai/result-messages.test.ts:35` — RM-1: every message key exists in both catalogues
- `app/admin/ai/result-messages.test.ts:43` — RM-2: invalidModel states the length limit (200) in both catalogues
- `components/admin/ActionMessage.test.tsx:66` — AM-3: renders the translated unknownProvider / invalidModel error messages
- MET

**AC4 — Keys stay in the environment**
- `lib/ai/key-status.test.ts:10` — KS-1: one entry per catalogue provider, in order, isSet true when set, never leaks the value
- `lib/ai/key-status.test.ts:24` — KS-2: blank or unset variables are isSet: false
- `app/admin/ai/page.test.tsx:64` — PA-2: en/ro renders never leak a stubbed key value
- `app/admin/ai/page.test.tsx:75` — PA-3: unset/blank keys show not-set
- `app/admin/ai/page.test.tsx:86` — PA-4: no key-shaped input, no password input; only provider and model are named controls
- `app/admin/ai/actions.test.ts:28` — AA-1: calls setAiSettings with exactly {provider, model}, ignoring apiKey / env-shaped extra fields
- `lib/config/ai-settings.pglite.test.ts:117` — AS-10: a database dump after saving with keys set in the environment contains no key value
- `lib/ai/boundaries.test.ts:61` — LB-4: only app/admin/ai/page.tsx imports lib/ai/key-status, and no client component does
- MET

**AC5 — No AI call, no network**
- `lib/ai/boundaries.test.ts:28` — found at least 3 non-test .ts files (not a vacuous pass)
- `lib/ai/boundaries.test.ts:32` — LB-1: provider-catalog.ts has zero imports, no process.env, no fetch
- `lib/ai/boundaries.test.ts:40` — LB-2: each non-test .ts file imports only the allowed specifiers, no SDK, no fetch (multiple test iterations)
- `lib/ai/boundaries.test.ts:50` — LB-3: process.env appears in lib/ai only in key-status.ts
- `lib/config/ai-settings.pglite.test.ts:110` — AS-9: no network call during a save
- `app/admin/ai/page.test.tsx:122` — PA-9: no network call while rendering
- `app/admin/ai/actions.test.ts:84` — AA-8: no network call during the action
- MET

**AC6 — Bilingual**
- `app/admin/ai/page.test.tsx:95` — PA-5/PA-5b: ro/en show translated notes and identical provider names, never the other locale's text
- `app/admin/layout.test.tsx:34` — AL-3: renders the AI nav link
- MET

**AC7 — Failure states**
- `app/admin/ai/page.test.tsx:110` — PA-6: getAiSettings throwing gives the translated load error, no secret text, key table still renders
- `app/admin/ai/actions.test.ts:62` — AA-6: a thrown secret-shaped error returns the generic error, never the message, never revalidates
- `app/admin/ai/actions.test.ts:77` — AA-7: getDb/createAiSettingsDeps throwing gives the same generic error state
- MET

**AC8 — Documentation and gates**
- `lib/ai/env-example.test.ts:11` — EX-1: has each API key variable (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY) preceded by a comment line
- `app/admin/ai/page.test.tsx:130` — PA-8: exports force-dynamic
- Command exits: typecheck 0, lint 0, test 0, build 0 (all passed)
- MET

### Summary

- **Test files modified:** 2 (app/admin/layout.test.tsx, components/admin/ActionMessage.test.tsx)
- **Test files created:** 8 (provider-catalog, key-status, boundaries, ai-settings, ai-settings.pglite, page, actions, result-messages, env-example)
- **Tests added:** 58 new tests across all US-022 files
- **All acceptance criteria:** MET
- **No acceptance criterion is UNCOVERED**

Denied or attempted commands: none
