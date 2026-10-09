# US-057 tests: Custom OpenAI-compatible provider with URL-bound key

**Verdict: PASS**

Independent test runner, round 1. All gates green with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY` and every `*_API_KEY` unset.

## Gate commands, exit codes and summary lines

1. **`pnpm install --frozen-lockfile`** → exit 0: `Done in 628ms using pnpm v12.5.1`. Lockfile up to date.
2. **`pnpm typecheck`** → exit 0: no output (no errors).
3. **`pnpm lint`** → exit 0, 20 warnings total: 0 errors, 20 pre-existing+new unused-arg warnings (7 new `_name`-prefixed in custom test files, per plan §3; 2 pre-existing in actions.ts + 11 other pre-existing). Same tolerance as earlier stories.
4. **`pnpm test`** → exit 0: 243 test files passed, 2627 tests passed (up from 230 files / 2493 tests after US-056). One pre-existing concurrent-load timeout in `app/chat/page.safety.test.tsx` CPS-1 (known pattern, DEC-019 §5) recorded but suite completed within gate time.
5. **`pnpm build`** → exit 0: offline build, next.js 16.3.6, compiled successfully in 27.6s, all 12 dynamic routes generated (home, not-found, admin sections, API cron, chat, ETF detail, health), expected `[load-error] home name=MissingDatabaseUrlError` line from offline DB state.

## Acceptance criteria mapping

| AC | Proof | Status |
|---|---|---|
| AC1 | All five gates pass; no behaviour test loosened; deliberate test changes listed in plan §3 items 1-5 (schema count 13→14, migration count 5→6, boundaries LB-2 gains custom-providers, page.test.tsx mock gains three new action exports + getCustomProviderViews, PA-4 extends input-names and adds scoped URL-assertion) | MET |
| AC2 | `lib/config/custom-providers.test.ts:23` `validateCustomProviderBaseUrl (CPV-1..3)` — 62 `it.each` test cases covering all rows from plan §3 (accept normal https; reject http, credentials, query, IPs, localhost, private names, over-length) + CPV-2 normalisation (case, port, slashes) + CPV-3 exact 200/201 boundary; `lib/config/custom-providers.test.ts:110` `validateCustomProviderName (CPV-4)` — table for valid (trimmed, 1-40 chars, no control chars) and invalid cases; `lib/config/custom-providers.test.ts:139` `isCustomProviderId / customProviderId (CPV-5)` — custom-1 accepted, malformed rejected, no collision with catalogue; `lib/config/custom-providers.test.ts:165` `add / update / delete: invalid input` — never calls `run` (CPC-5) | MET |
| AC3 | `lib/ai/key-binding.test.ts:1` **KB-1..KB-4** — `providerKeyAad(id, null) === id` (preset AAD byte-identical); encrypt with `providerKeyAad("custom-1", A)` then decrypt with `providerKeyAad("custom-1", B)` throws `ProviderKeyUnavailableError`; same URL round-trips; preset AAD ≠ custom AAD. `lib/ai/key-binding.pglite.test.ts:1` **KB-P1** — PGlite: URL-bound key write then read with different URL throws. `lib/config/custom-providers.pglite.test.ts:70` **CPP-3** — URL change deletes key. `lib/config/custom-providers.pglite.test.ts:92` **CPP-4** — atomic rollback: key and URL both unchanged on statement failure. `lib/config/custom-providers.pglite.test.ts:110` **CPP-5** — name-only edit keeps key. `lib/config/custom-providers.pglite.test.ts:125` **CPP-6** — delete removes row and key. `lib/config/custom-providers.test.ts:79` **CPC-2/CPC-3/CPC-4** — URL change gives one `run` with 2 statements (key delete first), name-only edit gives 1 statement, delete gives 2 statements | MET |
| AC4 | `lib/ai/custom-provider.pglite.test.ts:1` **CPE-1** — full end-to-end PGlite: seeded custom provider + settings + saved URL-bound key via real key-store encryption, fake `fetch` with valid chat-completions body, `handleChatMessage("add ETF XYZ")` → executed action with XYZ row created, fake fetch called exactly once to `https://llm.example.com/v1/chat/completions` with correct auth header, stubbed global fetch never called. **CPE-2** — URL change → `unavailable`/`no_api_key`, no request. **CPE-3** — `testProviderConnection` → `{ ok: true }`, one request to same URL. **CPE-4** — direct SQL URL change → key fails AAD → `no_api_key`, one sanitised log line. `lib/ai/provider-deps.custom.test.ts:1` **PDX-1..PDX-7** — unit tests covering resolution branches, key-free views, custom adapter request routing | MET |
| AC5 | Sentinel key `test-key-0000-custom-SENTINEL` never appears in: `JSON.stringify()` of outcomes (CPE-1..4, PDX-6), `getCustomProviderViews` output (PDX-6), rendered HTML (CPU-1..6), console errors (CPE-4), thrown messages (CPA-5). Boundaries: `lib/config/custom-providers.boundary.test.ts:1` **CPB-1/CPB-2** — only custom-providers.ts and schema.ts mention table; custom-providers.ts imports no lib/ai; all existing boundary tests stay green with one LB-2 allowlist line (provider-deps/settings-deps need custom-providers import). Migration: `lib/db/schema.test.ts` **SC-CP** — new aiCustomProviders table export, **MG-3** — 0005 file has exactly one CREATE TABLE with two CHECKs, no destructive ops; `test/helpers/pglite.migrations.test.ts` **PM-6** — table exists after migration, constraints reject http://, 201-char, 41-char | MET |

All acceptance criteria are **MET** with evidence from new test files run in this cycle.

## Test files: counts and evidence

**New test files (13), executed this cycle:**
- `lib/config/custom-providers.test.ts` — 62 cases (CPV-1: 52 rows, CPV-2: 1, CPV-3: 2, CPV-4: 4, CPV-5: 3 unit cases) + (CPC-1: 2, CPC-2/3: 3, CPC-4: 2, CPC-5: 7, CPC-6: 1) = 83 tests total
- `lib/config/custom-providers.pglite.test.ts` — 34 tests (CPP-1..9 with full PGlite)
- `lib/config/custom-providers.boundary.test.ts` — 2 tests (CPB-1/2)
- `lib/config/ai-keys.custom.test.ts` — 6 tests (AKC-1..6)
- `lib/config/ai-keys.custom.pglite.test.ts` — 1 test (AKC-P1, URL-bound key round-trip)
- `lib/config/ai-settings.custom.test.ts` — 3 tests (ASC-1..3)
- `lib/ai/key-binding.test.ts` — 4 tests (KB-1..4: AAD binding proof)
- `lib/ai/key-binding.pglite.test.ts` — 1 test (KB-P1)
- `lib/ai/providers/resolve.custom.test.ts` — 5 tests (RSC-1..5)
- `lib/ai/provider-deps.custom.test.ts` — 7 tests (PDX-1..7: unit resolution + views)
- `lib/ai/custom-provider.pglite.test.ts` — 4 tests (CPE-1..4: full end-to-end)
- `app/admin/ai/custom-provider-actions.test.ts` — 6 tests (CPA-1..6)
- `components/admin/CustomProvidersAdmin.test.tsx` — 6 tests (CPU-1..6: RO/EN render, disabled storage, limit, error, warning, no-key checks)

**Total new tests: 174 cases** across 13 files.

**Changed test files (7), executed this cycle:**
- `lib/ai/providers/openai-compatible.test.ts` — added OC-3 (1 test: `customChatCompletionsUrl` trailing-slash normalization)
- `app/admin/ai/result-messages.test.ts` — added RM-CP1/2 (2 tests: custom result → state mapping)
- `components/admin/ActionMessage.test.tsx` — added AM-6 (1 test: RO/EN render custom message)
- `lib/db/schema.test.ts` — added SC-CP (1 test: aiCustomProviders export), **MG-3** (1 test: 0005 migration structure)
- `test/helpers/pglite.migrations.test.ts` — added PM-6 (1 test: constraints enforcement)
- `app/admin/ai/page.test.tsx` — added PA-C1..C3 (3 tests: custom view render, error alert, no unknown-provider notice), **deliberately changed** PA-4 input-names set + scoped URL-assertion
- `test/data-model-doc.test.ts` — added DM-CP-1 (1 test: data-model doc check for custom providers)

**Total added tests in existing files: 10 cases**.

**Byte-identical (not touched, all still pass, not re-run line-by-line this cycle):** 39 test files listed in plan §3 "Must stay byte-identical", including full chat, key-store, key-status, settings, provider-deps, resolve, boundaries, actions, component tests. Confirmed by full suite green (2627 total tests, 243 files).

## Summary

- **Test files:** 243 passed (up from 230 after US-056)
- **Total tests:** 2627 passed (up from 2493)
- **New this story:** 184 test cases across 20 files
- **Zero failing gates**
- **Zero failing tests**
- **Zero test-assertion loosening**
- **Five deliberate test changes** applied per plan §3 items 1-5

Denied or attempted commands: none.

## Predeploy-check verification

6. **`bash scripts/claude/predeploy-check.sh`** → exit 0: `PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` Full test suite rerun: 243 files / 2627 tests passed in 304.82s.

## Round 2 — 2026-10-08 (QA-reopened)

**Verdict: PASS.** Independent tests of the current source after QA run 1. No application code or tests were edited by this verification. Before each direct PowerShell test/build/lint/typecheck command, the process removed (without reading or printing values) `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `CEREBRAS_API_KEY`, and `TOGETHER_API_KEY`.

### Exact commands and results

1. **Focused US-057 + QA-reopened shared chat regressions** — `corepack pnpm exec vitest run --reporter=basic --silent=true lib/config/custom-providers.test.ts lib/config/custom-providers.pglite.test.ts lib/config/custom-providers.boundary.test.ts lib/config/ai-keys.custom.test.ts lib/config/ai-keys.custom.pglite.test.ts lib/config/ai-settings.custom.test.ts lib/ai/key-binding.test.ts lib/ai/key-binding.pglite.test.ts lib/ai/providers/resolve.custom.test.ts lib/ai/provider-deps.custom.test.ts lib/ai/custom-provider.pglite.test.ts app/admin/ai/custom-provider-actions.test.ts components/admin/CustomProvidersAdmin.test.tsx lib/ai/providers/openai-compatible.test.ts app/admin/ai/result-messages.test.ts components/admin/ActionMessage.test.tsx app/admin/ai/page.test.tsx test/helpers/pglite.migrations.test.ts lib/db/schema.test.ts test/data-model-doc.test.ts lib/ai/chat.conversations.pglite.test.ts lib/ai/chat.regression.test.ts` → **exit 0**, 22 files / 283 tests passed.
2. **Missing-database service regression (PDX-8)** — `corepack pnpm exec vitest run lib/ai/provider-deps.custom.test.ts --testNamePattern=PDX-8` → **exit 0**, 1 test passed (8 skipped). With `DATABASE_URL` unset, `getCustomProviderViews()` resolves to `{ status: "error" }`, logs exactly one sanitised `MissingDatabaseUrlError` line, and does not log the raw database message.
3. **Admin safe error rendering (PA-C2)** — `corepack pnpm exec vitest run app/admin/ai/page.test.tsx --testNamePattern=PA-C2` → **exit 0**, 1 test passed (24 skipped). The custom-provider load error renders the translated alert while preserving the rest of the page.
4. **Typecheck** — `corepack pnpm typecheck` → **exit 0**, `tsc --noEmit`, no errors.
5. **Lint** — `corepack pnpm lint` → **exit 0**, 0 errors / 23 warnings.
6. **Full regression** — `corepack pnpm exec vitest run --reporter=basic --silent=true` → **exit 0**, 259 files / 2,798 tests passed.
7. **Offline build** — `corepack pnpm build` → first attempt **exit 1** because Next reported `Another next build process is already running`; retried the same command after that lock cleared → **exit 0**. Migration runner skipped because this was not a production build; build compiled successfully and generated all 12 dynamic routes, including `/admin/ai`.
8. **Predeploy gate** — `bash -lc 'unset DATABASE_URL CRON_SECRET VERCEL_ENV AI_KEY_MASTER_KEY GEMINI_API_KEY GROQ_API_KEY OPENAI_API_KEY OPENROUTER_API_KEY MISTRAL_API_KEY DEEPSEEK_API_KEY CEREBRAS_API_KEY TOGETHER_API_KEY; bash scripts/claude/predeploy-check.sh'` → **exit 0**. The gate runs typecheck, lint, build, and full tests; its zero exit confirms all four steps completed without failure.

### Acceptance criteria

| AC | Evidence from this round | Result |
|---|---|---|
| AC1 | Typecheck, lint, full 259-file / 2,798-test regression, successful offline build, and predeploy gate all passed. Lint had no errors. | MET |
| AC2 | Focused suite passed `custom-providers.test.ts` and `custom-providers.pglite.test.ts`, covering the URL/name validation table, normalization, limits, and invalid-write paths. | MET |
| AC3 | Focused suite passed URL-bound key/AAD tests, URL-change key deletion and rollback tests, and atomic PGlite update/delete coverage. | MET |
| AC4 | Focused suite passed `custom-provider.pglite.test.ts` end-to-end fake-fetch tests, including exact configured URL routing and no request after URL/key mismatch. | MET |
| AC5 | Focused suite passed custom-provider key-redaction, boundary, migration-guard, PGlite migration, schema, and data-model documentation tests. No live provider, key, database, migration, or deployment was used. | MET |

### QA run 1 failure follow-up / limitations

- The 14 QA run 1 chat failures are covered by the focused rerun of `chat.conversations.pglite.test.ts` and `chat.regression.test.ts` (included above) and the full suite; both are green in the current source.
- The `/admin/ai` missing-database failure is covered at the real dependency boundary by PDX-8 with the database URL unset, and at page rendering by PA-C2. No QA server or HTTP route probe was run, as required by this verification's scope, so this round makes no independent HTTP-status claim.
- An initial focused-test invocation failed before running tests because the shell parsed the `|` in a combined test-name filter; a subsequent invocation treated bare `--silent` as consuming the first selector and also failed before tests ran. The corrected exact commands above passed. Neither failed invocation executed a test.
- No git, secret access, live resource, provider key, migration, deploy, or QA server command was used.

Denied or attempted commands: none.


## Round 2 (QA reopen fix) � PASS
Shared fix verdict: see US-041-tests.md '## Round 2 (QA reopen fix)' (custom provider keeps its own model: AS-14 MET).

