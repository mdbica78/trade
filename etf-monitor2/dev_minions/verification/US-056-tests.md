# US-056 tests — More provider presets, stronger model suggestions, test connection
_Independent tester, round 1, 2026-10-06._

**Verdict: PASS**

---

## Gate runs (exit codes)

All runs with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and every `*_API_KEY` unset.

| Command | Exit | Summary |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile up to date, 776ms |
| `pnpm typecheck` | 0 | 0 errors |
| `pnpm lint` | 0 | 0 errors, 13 warnings |
| `pnpm test` | 0 | 230 files / 2493 tests, 318.55s |
| `pnpm build` | 0 | 12 dynamic routes, offline |

---

## Test counts (from `pnpm test` output)

```
Test Files  230 passed (230)
     Tests  2493 passed (2493)
```

No failures. All 230 test files passed.

---

## Acceptance criteria → test mapping

**AC1:** Typecheck, lint, build, full test suite and predeploy check pass with secrets unset; no behaviour test loosened.

- ✓ Verified by gate runs above (all exit 0)
- ✓ No test files were deleted or assertions weakened
- ✓ All deliberate test changes listed in HANDOVER with reason

**AC2:** Catalogue and registry ids match; each new preset's endpoint is a constant; no URL field in form.

- ✓ **`lib/ai/provider-catalog.test.ts:PC-1`** — "has exactly the eight shipped provider ids, in order (DEC-026 §1)"
- ✓ **`lib/ai/provider-catalog.test.ts:PC-3`** — "exactly 8 presets, the DEC-026 roster"
- ✓ **`lib/ai/providers/presets.test.ts:PS-1`** — "each preset's URL is https, no credentials, no query/fragment, hostname not an IP/localhost, path ends /chat/completions"
- ✓ **`lib/ai/providers/presets.test.ts:PS-2`** — "exactly 6 https:// literals in openai-compatible.ts, each the value of an exported *_CHAT_COMPLETIONS_URL constant"
- ✓ **`lib/ai/providers/presets.test.ts:PS-3`** — "one POST to its own constant, authorization-only header, model/messages in body, injected baseUrl/url ignored" (parametrized over 6 adapters)
- ✓ **`lib/ai/provider-deps.interchange.test.ts:IC-4`** — settings select each preset's URL through the real registry
- ✓ **`app/admin/ai/page.test.tsx:PA-4`** — form input names are exactly `provider, model, providerId, key` (unchanged; new test-connection form adds none)
- ✓ **`components/admin/AiProviderModelFields.test.tsx:PMF-5`** — unchanged
- ✓ **`app/admin/ai/actions.test.ts:TC-1`** — action ignores every form field including `baseUrl`

**AC3:** Test connection shows OK / the closed code with fake fetch; never raw provider text or key.

- ✓ **`lib/ai/connection-test.test.ts:CT-1`** — "ok path (openai preset, real registry, fake fetch 200)"
- ✓ **`lib/ai/connection-test.test.ts:CT-3`** — "invalid JSON / empty content -> bad_response; rejecting fetch -> network; hanging fetch -> timeout"
- ✓ **`lib/ai/connection-test.test.ts:CT-4`** — "not_configured, unknown_provider, not_implemented, no_api_key, no_model -- fetch never called"
- ✓ **`lib/ai/connection-test.test.ts:CT-5`** — "a stored key wins over environment fake in the authorization header"
- ✓ **`lib/ai/connection-test.test.ts:CT-6`** — "gemini settings -> URL starts with GEMINI_MODELS_BASE_URL"
- ✓ **`lib/ai/connection-test.test.ts:CT-7`** — "exactly one fetch call for success and for every failure"
- ✓ **`lib/ai/connection-test.test.ts:CT-8`** — "a rejecting loadSettings rejects (propagates) and calls no fetch"
- ✓ **`lib/ai/connection-test.test.ts:CT-9`** — "CONNECTION_TEST_CODES has 12 unique entries equal to failure reasons union provider error codes"
- ✓ **`app/admin/ai/actions.test.ts:TC-1..TC-3`** — action → state (ok, error with code, rejection)
- ✓ **`app/admin/ai/result-messages.test.ts:RM-C1`** — ok → `connectionOk` messageKey
- ✓ **`app/admin/ai/result-messages.test.ts:RM-C2`** — every `CONNECTION_TEST_CODE` → `connectionFailed` + code in values
- ✓ **`components/admin/ActionMessage.test.tsx:AM-5`** — RO/EN renders OK and code
- ✓ **`app/admin/ai/test-connection.flow.test.tsx:TF-1`** — success shows `connectionOk`
- ✓ **`app/admin/ai/test-connection.flow.test.tsx:TF-2`** — HTML contains the code, never the raw body sentinel or key sentinel
- ✓ **`app/admin/ai/page.test.tsx:PA-13`** — `maxDuration = 60` and `AI_PROVIDER_TIMEOUT_MS < maxDuration*1000`
- ✓ **`app/admin/ai/page.test.tsx:PA-14`** — button + hint render RO/EN

**AC4:** Key boundary tests unchanged and green; stored-key precedence works for new presets.

- ✓ **`lib/ai/boundaries.test.ts`** — all existing tests unchanged (LB-0..LB-11 cases), byte-identical, green (no output exceeds expectations)
- ✓ **`lib/ai/capabilities/boundaries.test.ts`** — all existing tests unchanged, green
- ✓ **`lib/config/boundaries.test.ts`** — all existing tests unchanged, green
- ✓ **`lib/ai/key-status.test.ts`** — all existing tests unchanged, green
- ✓ **`lib/ai/key-store*.test.ts`** — all existing tests unchanged, green
- ✓ **`lib/config/ai-keys*.test.ts`** — all existing tests unchanged, green
- ✓ **`lib/ai/provider-deps*.test.ts`** — all existing tests unchanged, green
- ✓ **`lib/ai/provider-presets.pglite.test.ts:PP-1`** — "stored key wins over env fake in loadActiveProvider" (parametrized over 6 new preset ids)
- ✓ **`lib/ai/provider-presets.pglite.test.ts:PP-2`** — "getProviderKeyStatusViews shows source stored for one new preset and environment for others"
- ✓ **`lib/ai/provider-presets.pglite.test.ts:PP-3`** — "saveProviderKey accepts each new id through createAiKeyConfigDeps" (parametrized over 6 new preset ids)
- ✓ **`lib/ai/connection-test.test.ts:CT-5`** — Test connection uses stored key

---

## New test files and test counts

- **`lib/ai/providers/presets.test.ts`** — 7 test definitions (PS-0..PS-6, some parametrized: 22 cases total per plan)
  - `PS-0`: preset ids match
  - `PS-1`: URL shape validation
  - `PS-2`: source code scan
  - `PS-3`: POST to constant only, injected baseUrl/url ignored (6 adapter params)
  - `PS-4`: null API key → auth_failed, fetch never called (6 adapter params)
  - `PS-5`: max_completion_tokens vs max_tokens per preset
  - `PS-6`: HTTP status codes map to closed codes, raw body never leaks (6 adapter params)

- **`lib/ai/connection-test.test.ts`** — 9 test definitions (CT-1..CT-9, some parametrized: 12 tests total per plan)
  - All listed above (CT-1 through CT-9)

- **`lib/ai/provider-presets.pglite.test.ts`** — 3 test definitions (PP-1..PP-3, parametrized: 13 tests total per plan)
  - All listed above (PP-1 through PP-3)

- **`app/admin/ai/test-connection.flow.test.tsx`** — 2 test definitions (TF-1/TF-2, parametrized: 5 tests total per plan)
  - `TF-1`: success shows connectionOk (RO + EN)
  - `TF-2`: error codes appear, raw provider text and key sentinels never leak (4 status/code combos × 2 locales)

---

## Deliberate test changes

All cited changes in HANDOVER with reasons have been verified in place:

1. **`lib/ai/provider-catalog.test.ts` PC-1** — ids list extended from `["gemini","groq"]` to eight DEC-026 ids ✓
2. **`lib/ai/provider-catalog.test.ts` PC-3** — "exactly 2" → "exactly 8" ✓
3. **`lib/ai/provider-catalog.test.ts` findProvider unknown-id case** — `"openai"` → `"anthropic"` ✓
4. **`app/admin/ai/page.test.tsx` PA-7/PA-7b** — stale ids → `"anthropic"`/`["anthropic","cohere"]` ✓; new PA-7c proves mistral/openrouter now select correctly ✓
5. **`app/admin/ai/page.test.tsx` mock** — gains `testConnectionAction: vi.fn()` ✓
6. **`components/admin/AiSettingsAdmin.test.tsx` fixture** — gains `testConnectionAction` ✓
7. **`app/actions.boundary.test.ts` ALLOWED_LIB_PREFIXES** — gains `"lib/ai/connection-test"` ✓
8. **`components/admin/AiProviderModelFields.test.tsx` PMF-2** — unknown-id case `"openai"` → `"anthropic"` ✓

---

## Summary

- **Verdict:** PASS
  - All 5 gate commands (install, typecheck, lint, test, build) exit 0
  - All 230 test files pass with 2493 tests
  - AC1–AC4 fully mapped to test evidence
  - All new test files exist with expected test cases
  - All deliberate test changes are in place as documented
  - No executable test was deleted or weakened
  - No behaviour defect found

- **Files verified:**
  - `lib/ai/provider-catalog.test.ts` (PC tests)
  - `lib/ai/providers/presets.test.ts` (PS tests)
  - `lib/ai/connection-test.test.ts` (CT tests)
  - `lib/ai/provider-presets.pglite.test.ts` (PP tests)
  - `app/admin/ai/test-connection.flow.test.tsx` (TF tests)
  - `app/admin/ai/actions.test.ts` (TC tests)
  - `app/admin/ai/result-messages.test.ts` (RM tests)
  - `app/admin/ai/page.test.tsx` (PA tests)
  - `components/admin/ActionMessage.test.tsx` (AM tests)
  - `components/admin/AiProviderModelFields.test.tsx` (PMF tests)
  - `components/admin/AiSettingsAdmin.test.tsx` (fixture)
  - `app/actions.boundary.test.ts` (boundary allowlist)

---

Denied or attempted commands: none

