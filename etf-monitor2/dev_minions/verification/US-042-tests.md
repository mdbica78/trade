# US-042 — Round 1 Independent Test Verification

**Status: PASS**  
**Test date:** 2026-10-03  
**Phase:** Independent verification round 1

## Environment and safety

- Windows PowerShell 5.1; project pnpm 12.5.1.
- Before each gate, removed `DATABASE_URL`, `CRON_SECRET`,
  `AI_KEY_MASTER_KEY`, `VERCEL_ENV`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
  `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY` from the process environment.
  No environment-variable values were inspected or printed.
- No package install was run. Tests use local fakes/mocks; no live database,
  provider, Vercel, or BVB resource was accessed. No real `ai_provider_keys`
  row was read.
- No git or credential-file command was run.

## Acceptance criteria

| Criterion | Result | Evidence from this round |
|---|---|---|
| **AC1 — localized instruction area** | **MET** | `components/chat/ChatView.test.tsx` checks the matching instruction-key sets in English and Romanian and renders the localized instructions in every availability state. `app/chat/page.test.tsx` verifies page wiring in both locales. |
| **AC2 — advertised capabilities match supported actions** | **MET** | `components/chat/ChatView.test.tsx` maps displayed instruction categories exactly to `CONFIGURATION_ACTIONS` and rejects unsupported future-feature language. |
| **AC3 — key guidance and privacy** | **MET** | `ChatView.test.tsx` checks the `/admin/ai` key guidance and absence of key/API-key/base-URL inputs. `app/chat/actions.test.ts` verifies extra `apiKey` form input is ignored; `app/chat/page.safety.test.tsx` checks key-free HTML and no rendering-time fetch. Existing `app/chat/reply-messages.test.ts` and `lib/ai/chat.test.ts` passed, covering unchanged closed replies and key-free error behavior. |
| **AC4 — static offline rendering and gates** | **MET** | `app/chat/page.test.tsx` asserts zero fetch calls in both locales; `app/chat/page.safety.test.tsx` CPG-6 verifies no fetch across page availability states. Focused tests, typecheck, lint, full suite, and offline build all passed with the listed database/secret/provider variables removed. |

## Commands and results

Each command was preceded by removal of the eleven environment variables
listed above. `pnpm` was invoked through
`C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd`.

1. **Focused ChatView, page, scope, and privacy tests**

   `pnpm test components/chat/ChatView.test.tsx app/chat/page.test.tsx app/chat/page.safety.test.tsx app/chat/page.load-error.test.tsx app/chat/reply-messages.test.ts app/chat/actions.test.ts lib/ai/chat.test.ts lib/ai/capabilities/configuration/intent.test.ts lib/ai/capabilities/configuration/grounding.test.ts lib/ai/capabilities/configuration/prompt.test.ts`

   Exit code **0** — 10 files / 121 tests passed.

2. **Typecheck**

   `pnpm typecheck` → `tsc --noEmit`; exit code **0**.

3. **Lint**

   `pnpm lint` → exit code **0**, 0 errors and 9 warnings.

4. **Full test suite**

   `pnpm test` → exit code **0**, 204 files / 2063 tests passed.

5. **Offline production build**

   `pnpm build` → exit code **0**; migration runner skipped outside a
   production build; Next.js completed and generated all 12 dynamic routes.

**Denied or attempted commands:** none.
