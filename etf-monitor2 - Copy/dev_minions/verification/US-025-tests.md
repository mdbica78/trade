# US-025 — Test verdict

**Round 1 — 2026-09-27**

Verdict: PASS

## Test summary

- `pnpm install --frozen-lockfile` — exit 0 (clean install: rm -rf node_modules, frozen lockfile respected)
- `pnpm typecheck` — exit 0
- `pnpm lint` — exit 0 (0 errors; 3 pre-existing warnings)
- `pnpm test` — exit 1 first run (1 unrelated flaky timeout in `lib/ingestion/default-deps.cron.test.ts`, not US-025 code; 1186/1187 passed); retry exit 0 (all 1187/1187 passed)
- `pnpm build` — exit 0
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build` — exit 0

Test files: 106 passed
Tests total: 1187 passed (after flaky retry)

## Acceptance criteria to test mapping

**AC1 — One adapter interface** (FR6; sprint decision 1)
- PT-1 `lib/ai/providers/types.test.ts:10` — PROVIDER_ERROR_CODES equals exactly seven codes
- PT-2 `lib/ai/providers/types.test.ts:23` — types.ts names no concrete provider, zero module specifiers
- PT-3 `lib/ai/providers/types.test.ts:29` — GenerateResult union members only have keys ok/text/error
- RG-* `lib/ai/providers/run-generation.test.ts` — fake provider typed and passes wrapper tests

**AC2 — The wrapper never throws** (FR6; AGENTS.md secrets; sprint decisions 1, 6)
- RG-1 `lib/ai/providers/run-generation.test.ts:17` — ok result passes through unchanged
- RG-2 `lib/ai/providers/run-generation.test.ts:30` — async rejection gives provider_error, never leaks message
- RG-3 `lib/ai/providers/run-generation.test.ts:38` — synchronous throw resolves to provider_error
- RG-4 `lib/ai/providers/run-generation.test.ts:43` — never-settling adapter times out at AI_PROVIDER_TIMEOUT_MS, signal aborted
- RG-5 `lib/ai/providers/run-generation.test.ts:62` — every error code passes through unchanged
- RG-6 `lib/ai/providers/run-generation.test.ts:70` — malformed results become provider_error, extra fields dropped
- RG-7 `lib/ai/providers/run-generation.test.ts:88` — no pending timer after settled call, signal not aborted on success
- RG-8 `lib/ai/providers/run-generation.test.ts:95` — AI_PROVIDER_TIMEOUT_MS is exactly 20000

**AC3 — Registry** (FR6; sprint-05 decision 10)
- PR-1 `lib/ai/providers/registry.test.ts:7` — get returns same adapter for registered id, unknown give undefined
- PR-2 `lib/ai/providers/registry.test.ts:15` — list() returns adapters in construction order, mutation-safe
- PR-3 `lib/ai/providers/registry.test.ts:25` — duplicate id throws
- PR-4 `lib/ai/providers/registry.test.ts:31` — id not in PROVIDER_CATALOG throws; empty list valid
- PR-5 `lib/ai/providers/registry.test.ts:36` — shipped registry is empty

**AC4 — Resolution** (FR6, FR11; sprint-05 decision 10; sprint decision 4)
- AR-1 `lib/ai/providers/resolve.test.ts:11` — not_configured for null and blank provider
- AR-2 `lib/ai/providers/resolve.test.ts:21` — unknown_provider for stored id not in catalogue
- AR-3 `lib/ai/providers/resolve.test.ts:29` — not_implemented for catalogued id with no adapter
- AR-4 `lib/ai/providers/resolve.test.ts:37` — no_api_key when readApiKey returns null
- AR-5 `lib/ai/providers/resolve.test.ts:44` — no_model for null and blank model, key present
- AR-6 `lib/ai/providers/resolve.test.ts:53` — ok with fake provider, trimmed model and key
- AR-7 `lib/ai/providers/resolve.test.ts:60` — reports earliest failing check when several would fail
- AR-8 `lib/ai/providers/resolve.test.ts:78` — throwing readApiKey never escapes as exception
- AR-9 `lib/ai/providers/resolve.test.ts:91` — toAvailability exposes exactly expected keys

**AC5 — Key boundary** (AGENTS.md Secrets; DEC-015; sprint-05 decision 9; sprint decision 2)
- KS-3 `lib/ai/key-status.test.ts:35` — readApiKey returns each provider's own sentinel, no other's
- KS-4 `lib/ai/key-status.test.ts:46` — unset, empty, blank give null; value is trimmed
- KS-5 `lib/ai/key-status.test.ts:57` — only catalogue provider id accepted, never arbitrary env var
- KS-1 `lib/ai/key-status.test.ts:10` — getKeyStatuses returns booleans only (unchanged from US-022)
- PD-1 `lib/ai/provider-deps.test.ts:37` — loadActiveProvider ok carries key, model, injected fetch
- PD-2 `lib/ai/provider-deps.test.ts:48` — failure paths never leak sentinel
- PD-3 `lib/ai/provider-deps.test.ts:64` — getAiAvailability ok case is key-free
- PD-5 `lib/ai/provider-deps.test.ts:81` — adapter error or thrown value never leaks sentinel
- PD-6 `lib/ai/provider-deps.test.ts` — AiAvailability, GenerateResult never carry apiKey/secret/token
- LB-3 `lib/ai/boundaries.test.ts:135` — process.env appears only in key-status.ts (unchanged)
- LB-4 `lib/ai/boundaries.test.ts:146` — importers of key-status are exactly app/admin/ai/page.tsx and lib/ai/provider-deps.ts (revised)
- LB-5 `lib/ai/boundaries.test.ts:177` — app/ and components/ never mention key-carrying resolution names (new)

**AC6 — No SDK, network only by injection** (ADR-001; AGENTS.md dependency rules)
- PD-4 `lib/ai/provider-deps.test.ts:71` — no resolution branch calls injected or global fetch
- PD-7 `lib/ai/provider-deps.test.ts:100` — createProviderDeps with DATABASE_URL and key vars unset does not throw, does not call getDb
- LB-2 `lib/ai/boundaries.test.ts:89` — specifiers only to allowed targets; no SDK; fetch rules per role (revised)
- LB-6 `lib/ai/boundaries.test.ts:207` — lib/ai/providers/* imports neither key-status nor provider-deps nor lib/db (new)
- LB-7 `lib/ai/boundaries.test.ts:221` — package.json has no SDK dependency (new)

**AC7 — Nothing else changes, gates pass**
- `/admin/ai` unchanged: `lib/ai/key-status.test.ts`, `app/admin/ai/page.test.tsx` pass unchanged
- `lib/config/boundaries.test.ts` BC-1 unchanged: `lib/config/` imports nothing from `lib/ai/`
- No schema, migration, or message-file change
- `pnpm typecheck` — pass
- `pnpm lint` — pass
- `pnpm test` — pass (1187/1187 after flaky retry)
- `pnpm build` — pass
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build` — pass

## Flakiness notes

One unrelated test timed out in the full suite: `lib/ingestion/default-deps.cron.test.ts > calls discoverLatestReport with { timeoutMs: 7000 } (CRON_FETCH_TIMEOUT_MS)` (test timeout in 5000ms). This test is not in US-025 scope. On isolated retry, all 1187 tests passed. No US-025 test showed flakiness.

## US-025 test counts (from plan)

Files with US-025 code and tests:
- `lib/ai/providers/types.test.ts` — 4 tests (PT-1..PT-3, `expectTypeOf` type check)
- `lib/ai/providers/run-generation.test.ts` — 9 tests (RG-1..RG-8, result-keys check)
- `lib/ai/providers/registry.test.ts` — 5 tests (PR-1..PR-5)
- `lib/ai/providers/resolve.test.ts` — 11 tests (AR-1..AR-9, ARB, AR-9)
- `lib/ai/key-status.test.ts` — 5 tests (KS-1..KS-5)
- `lib/ai/provider-deps.test.ts` — 6 tests (PD-1..PD-7)
- `lib/ai/boundaries.test.ts` — 26 tests (LB-0..LB-7, file scans for each role)

Total US-025 tests: 4 + 9 + 5 + 11 + 5 + 6 + 26 = 66 tests, all passed.

## Denied or attempted commands

None.
