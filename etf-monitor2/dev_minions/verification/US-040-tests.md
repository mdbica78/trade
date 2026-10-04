# US-040 — Round 1 Independent Test Verification

**Status: PASS**  
**Test date:** 2026-10-02  
**Phase:** Independent verification round 1

## Environment and safety

- Windows PowerShell 5.1; project pnpm 12.5.1 and Node.js 24.19.0.
- Before each test/build gate, removed `DATABASE_URL`, `CRON_SECRET`,
  `AI_KEY_MASTER_KEY`, `VERCEL_ENV`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
  `OPENROUTER_API_KEY`, and `MISTRAL_API_KEY` from the process environment.
  No environment variable values were inspected or printed.
- Tests use their controlled fakes and PGlite. No live database, migration,
  provider, Vercel, or BVB resource was accessed.
- No git or credential-file command was run.

## Acceptance criteria

| Criterion | Result | Evidence from this round |
|---|---|---|
| **AC1 — schema, migration, health inventory** | **MET** | `lib/db/schema.test.ts` (23 tests), including the exact encrypted-key table shape; `test/helpers/pglite.migrations.test.ts` PM-5/PM-4 applies the journal and verifies the ciphertext-only row shape; `lib/health.test.ts` ST-1; `app/health/page.schema.pglite.test.tsx` HP-S3 (Romanian and English missing-table visibility without row reads). |
| **AC2 — encryption, AAD, authenticated storage** | **MET** | `lib/ai/key-store.test.ts` KS-1/KS-2 verifies fresh 12-byte IV packing, round-trip, tamper/tag/AAD/wrong-key rejection; `lib/ai/key-store.pglite.test.ts` KS-P1 verifies persisted ciphertext/source/timestamp metadata. `app/admin/layout.test.tsx` AL-6 verifies Node runtime for encrypted-key code. |
| **AC3 — derivation and recorded source** | **MET** | `lib/ai/key-store.test.ts` KS-3/KS-4 verifies fixed HKDF parameters/output separation and source-bound encryption/decryption; `lib/ai/key-status.test.ts` KS-6–KS-8 verifies master precedence, disabled material cases, source-specific decryption, and rotation behavior; `lib/ai/key-store.pglite.test.ts` KS-P1 verifies persisted source metadata. |
| **AC4 — stored/environment/unset precedence and async wiring** | **MET** | `lib/ai/provider-deps.test.ts` PD-8–PD-10 verifies stored precedence, load-before-resolution, per-provider failure isolation/sanitized logging, and absent-table handling; `lib/ai/provider-deps.pglite.test.ts` PD-P1–PD-P3 verifies selected-provider decryption, key-free status, and missing-table fallback; `lib/ai/provider-deps.interchange.test.ts` IC-1–IC-3 verifies the two adapters retain their fixed endpoints and provider-key isolation. The full suite also passed the existing resolver tests. |
| **AC5 — save, replace, clear, validation, closed results** | **MET** | `lib/config/ai-keys.test.ts` AK-1–AK-6 and `lib/config/ai-keys.pglite.test.ts` AK-P1–AK-P3 cover validation, disabled storage, write failures, upsert/replace, provider-isolated clear, environment fallback, and missing-table write failure; `app/admin/ai/actions.test.ts` AAK-1–AAK-6 verifies action inputs, ignored `baseUrl`, closed/key-free results, revalidation, malformed forms, and no network calls; `app/admin/ai/result-messages.test.ts` checks bilingual message keys. |
| **AC6 — missing-table fallback and failure privacy** | **MET** | `lib/ai/provider-deps.test.ts` PD-9/PD-10 and `lib/ai/provider-deps.pglite.test.ts` PD-P3 cover sanitized isolated failures and missing-table fallback; `app/admin/ai/page.test.tsx` PA-6/PA-6b verifies settings and key UI survive dependency/load failures without secret text; health HP-S3 verifies missing-table visibility. |
| **AC7 — write-only bilingual UI and mitigations** | **MET** | `components/admin/AiSettingsAdmin.test.tsx` ASK-1–ASK-4 covers enabled/disabled UI, localized status, empty password input, and reset after successful save; `app/admin/ai/page.test.tsx` PA-11/PA-12 covers source/status and disabled controls; `app/admin/layout.test.tsx` AL-6 and `app/chat/page.test.tsx` assert noindex metadata. Action tests cover the thin server-action contract. **Coverage note:** this offline suite does not separately exercise Next.js same-origin enforcement through an HTTP request; actual origin rejection remains framework behavior and was not independently probed. |
| **AC8 — hard secret boundary and leak coverage** | **MET** | `lib/ai/boundaries.test.ts` LB-3/LB-4/LB-10/LB-11 checks the environment reader, approved `key-store` importers, and exclusive SQL ownership; `lib/config/boundaries.test.ts` and `app/actions.boundary.test.ts` cover config/action boundaries; provider, action, and page tests assert key-free results, logs, and rendered output. No fake value appeared in the test runner’s displayed output. |
| **AC9 — offline gates** | **MET** | The complete focused suite, typecheck, lint, full suite, and offline production build passed with the eight named variables removed. The build reported `migrate-on-deploy: skipped (not a production build)` and generated all 12 dynamic routes. |

## Commands and results

Every command below was preceded by removal of the eight environment variables
listed above. `pnpm` was invoked by its installed path
`C:\Users\BicajanM\AppData\Local\pnpm\pnpm.cmd`; no project manifest or lockfile
was changed.

1. **Focused US-040 tests**

   `pnpm test lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts lib/health.test.ts app/health/page.schema.pglite.test.tsx lib/ai/key-status.test.ts lib/ai/key-store.test.ts lib/ai/key-store.pglite.test.ts lib/config/ai-keys.test.ts lib/config/ai-keys.pglite.test.ts lib/ai/provider-deps.test.ts lib/ai/provider-deps.interchange.test.ts lib/ai/provider-deps.pglite.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/config/boundaries.test.ts app/admin/ai/actions.test.ts app/admin/ai/result-messages.test.ts app/admin/ai/page.test.tsx components/admin/AiSettingsAdmin.test.tsx app/admin/layout.test.tsx app/chat/page.test.tsx lib/ai/boundaries.test.ts app/actions.boundary.test.ts test/data-model-doc.test.ts test/readme-deployment.test.ts lib/ai/env-example.test.ts`

   Exit code **0** — 26 files / 291 tests passed.

2. **Typecheck**

   `pnpm typecheck` → `tsc --noEmit`; exit code **0**.

3. **Lint**

   `pnpm lint` → exit code **0**, 0 errors and 9 warnings.

4. **Full test suite**

   `pnpm test` → exit code **0**, 203 files / 2046 tests passed.

5. **Offline production build**

   `pnpm build` → exit code **0**; migration runner skipped outside production;
   Next.js production build completed with all 12 dynamic routes.

## Execution notes

- Initial invocation by bare `pnpm` was unavailable on the shell PATH (exit 1);
  reran using the installed explicit `pnpm.cmd` path above.
- An attempted `pnpm test --reporter=dot` was rejected by the installed Vitest
  reporter options (exit 2); reran the full suite using the package script
  without that option, and it passed.

**Denied or attempted commands:** none.
