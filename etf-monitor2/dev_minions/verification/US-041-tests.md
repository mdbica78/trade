# US-041 — Round 1 Independent Test Verification

**Status: PASS**  
**Test date:** 2026-10-03  
**Phase:** Independent verification round 1

## Environment and safety

- Windows PowerShell 5.1; project pnpm 12.5.1.
- Before each gate, removed `DATABASE_URL`, `CRON_SECRET`,
  `AI_KEY_MASTER_KEY`, `VERCEL_ENV`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
  `OPENROUTER_API_KEY`, and `MISTRAL_API_KEY` from the process environment.
  No environment variable values were inspected or printed.
- No package install was run. Focused integration uses PGlite and provider
  calls use test mocks; no live database, provider, Vercel, or BVB resource
  was accessed.
- No git or credential-file command was run.

## Acceptance criteria

| Criterion | Result | Evidence from this round |
|---|---|---|
| **AC1 — isolated Gemini/Groq preset roster** | **MET** | `lib/ai/provider-catalog.test.ts` PC-3 checks that the roster remains exactly `gemini` and `groq`; PC-2 verifies each has static suggestions. `lib/ai/providers/registry.test.ts` PR-5 verifies provider-catalogue/adapter-registry IDs and order match. The US-041 story and Sprint 10 decisions table retain D-1 as **PROPOSED / NEEDS USER**; no additional preset is implied by this default. |
| **AC2 — fixed endpoints; no user-controlled URL** | **MET** | `app/admin/ai/actions.test.ts` AA-2 verifies a posted `baseUrl` is not forwarded to settings; `lib/ai/providers/gemini.test.ts` GM-7 and `lib/ai/providers/groq.test.ts` GQ-6 verify an injected context `baseUrl` cannot redirect the mocked request. `components/admin/AiProviderModelFields.test.tsx` PMF-5 verifies no URL/endpoint input is rendered. |
| **AC3 — static suggestions and persisted free-text model** | **MET** | `lib/ai/provider-catalog.test.ts` PC-2 checks non-empty, unique, trimmed suggestions; `components/admin/AiProviderModelFields.test.tsx` PMF-1–PMF-5 verifies provider-specific suggestions, saved model rendering, and editable model fields. `app/admin/ai/page.test.tsx` PA-1 verifies the selected provider/model and its datalist suggestions; `lib/config/ai-settings.test.ts` AV-2 and `lib/config/ai-settings.pglite.test.ts` AS-2/AS-6/AS-7/AS-8 verify bounded validation, persistence/reload and invalid-save stability. AS-9 and PA-9 verify no network call for persistence/rendering. |
| **AC4 — safe errors, key-free status, bilingual UI** | **MET** | `lib/config/ai-settings.test.ts` AV-1/AV-2 and PGlite AS-7 cover invalid provider/model inputs; `app/admin/ai/page.test.tsx` PA-1, PA-2, PA-4, PA-5/PA-5b and `components/admin/AiProviderModelFields.test.tsx` PMF-3 verify rendered selection/suggestions, RO/EN output, no URL field, and key-free/write-only behavior. `app/admin/ai/actions.test.ts` AA-1/AA-2/AA-6/AA-7/AA-7b verifies exact action inputs, ignored endpoint data, and closed generic error handling; `components/admin/AiSettingsAdmin.test.tsx` ASK-1–ASK-4 verifies key status without key prefill and form reset behavior. |
| **AC5 — offline tests and project gates** | **MET** | The focused tests, `pnpm typecheck`, `pnpm lint`, full `pnpm test`, and offline `pnpm build` all passed with the eight named variables removed. `app/admin/ai/actions.test.ts` AA-8/AAK-6, config AS-9, and page PA-9 verify no network call in the tested settings/action/render paths. |

## Commands and results

Each command below was preceded by removal of the eight environment variables
listed above. `pnpm` was invoked via
`C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd`.

1. **Focused US-041 tests**

   `pnpm test lib/ai/provider-catalog.test.ts lib/ai/providers/registry.test.ts lib/ai/providers/gemini.test.ts lib/ai/providers/groq.test.ts lib/config/ai-settings.test.ts lib/config/ai-settings.pglite.test.ts components/admin/AiProviderModelFields.test.tsx components/admin/AiSettingsAdmin.test.tsx app/admin/ai/page.test.tsx app/admin/ai/actions.test.ts`

   Exit code **0** — 10 files / 84 tests passed.

2. **Typecheck**

   `pnpm typecheck` → `tsc --noEmit`; exit code **0**.

3. **Lint**

   `pnpm lint` → exit code **0**, 0 errors and 9 warnings.

4. **Full test suite**

   `pnpm test` → exit code **0**, 204 files / 2057 tests passed.

5. **Offline production build**

   `pnpm build` → exit code **0**; migration runner reported it skipped outside
   a production build; Next.js completed and generated all 12 dynamic routes.

**Denied or attempted commands:** none.
