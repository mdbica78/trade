# US-061 — independent test verdict

## Round 1

Tester: independent context (did not write the code). Run from `etf-monitor2`, PowerShell, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` removed from the process environment first (values never printed). No git, migration, `.env*` read or source/test edit.

### Commands run
| Command | Exit (`$LASTEXITCODE`) | Key output |
|---|---|---|
| `corepack pnpm typecheck` | 0 | `$ tsc --noEmit`, no diagnostics |
| `corepack pnpm lint` | 0 | `✖ 21 problems (0 errors, 21 warnings)` |
| `corepack pnpm test` (output to a scratch file, since deleted) | 0 | ` Test Files  261 passed (261)` / `      Tests  2846 passed (2846)` / `Duration  160.72s` |
| `corepack pnpm build` | 0 | `migrate-on-deploy: skipped (not a production build)`, `✓ Compiled successfully in 7.5s`, `✓ Generating static pages … (6/6)`, route list includes `ƒ /admin/ai`; one expected offline `[load-error] home name=MissingDatabaseUrlError` line |

Only stderr noise in the test run is the pre-existing next-intl `ENVIRONMENT_FALLBACK … no timeZone configured` message from server-render tests (no failures).

### Files named in the task — ran and passed in my full run
- `app/admin/ai/page.test.tsx` — 26 tests ✓
- `components/admin/AiSettingsAdmin.test.tsx` — 8 tests ✓
- `components/admin/AiSettingsForms.test.tsx` — 2 tests ✓
- `components/admin/CustomProvidersAdmin.test.tsx` — 10 tests ✓
- `app/globals.contrast.test.ts` — 6 tests ✓; `app/globals.tokens.test.ts` — 5 tests ✓
- No separate `ProviderKeySaveForm` test file exists; the save-form reset/error behavior is covered by `AiSettingsAdmin.test.tsx` ASK-3/ASK-4 (it.each, ✓).

### Acceptance criteria
- **AC1 — MET (automated) + MANUAL-QA (interaction).** `app/admin/ai/page.test.tsx` PA-2 (only the selected provider's key card), PA-3/PA-3b (not-set status; no provider → prompt and no key form), PA-4 (empty password input for the selected provider only, autocomplete off), PA-11 (source shown; Clear only for a stored key); `AiSettingsAdmin.test.tsx` ASK-1 (en/ro: write-only input, source/status, Replace + Clear), ASK-1b (Save, not Replace/Clear, when unset), ASK-1d (settings load failure → picker keeps keys reachable). Live provider switching updating the key card is client state with no DOM-interaction test (`AiSettingsForms.test.tsx` ASF-1/ASF-2 cover only initial state and hidden test-connection inputs) → **MANUAL-QA**: switch providers in a browser and confirm the card/badge changes. Write-only empty input after save, keyboard use → **MANUAL-QA**.
- **AC2 — MET (automated) + MANUAL-QA (details collapse).** `CustomProvidersAdmin.test.tsx` CPU-1 (en/ro: name, URL, key status, edit/delete/add), CPU-7 (each card shows its own saved model, `not-this` other-provider model absent; card without model shows `customModelNone`), CPU-8 (Edit/Key/Add are native `<details>`/`<summary>`, closed by default), CPU-3 (cap of 5 → limit note, no add form), CPU-4/PA-C2 (error states), PA-C3. Actual expand/collapse in a browser → **MANUAL-QA**.
- **AC3 — MET.** Key write-only/never rendered: CPU-6 (no `value=` on any password input, no key text), PA-2 (renders never leak a stubbed key value, en/ro), ASK-1 (no `value`/`defaultValue` on password input), CPU-2/PA-12/ASK-2 (disabled storage omits key controls, keeps environment status). Provider/model behaviour preserved: ASF-1 (saved provider selected, its own model shown), ASF-2 (Test connection carries provider/model hidden inputs, no key/URL field), PA-1/PA-7/PA-7c/PA-C3, CPU-7 (provider-specific model). Server-side validation/actions untouched by tests: the full suite (actions, privacy, boundary, PGlite key-store tests) passed unchanged in count and green.
- **AC4 — MET (automated) + MANUAL-QA (visual).** RO and EN are both exercised via `it.each` in CPU-1/CPU-7/ASK-1/ASK-2/PA-5/PA-12; `app/globals.contrast.test.ts` and `app/globals.tokens.test.ts` (plus the full suite's colour-literal/rules tests) passed. `admin-markup.golden.test.tsx` contains no AI/custom-provider component (no match for AiSettings/CustomProviders/ProviderKey), so no golden snapshot needed refreshing; the suite runs as `vitest run` (no `-u`) and all golden tests passed. Visual look in both themes, WCAG on the new markup in a browser, responsive layout/no horizontal overflow → **MANUAL-QA**.
- **AC5 — MET.** Focused UI/action/privacy tests, typecheck, lint (0 errors), full suite (261 files / 2846 tests) and offline build (`migrate-on-deploy: skipped`) all exit 0 as quoted above.

### Notes (non-blocking)
- Lint has 21 warnings (0 errors); I did not compare against a prior baseline.
- Provider switching and details collapse have no DOM-interaction tests; they rely on the MANUAL-QA steps above.

Verdict: PASS

Denied or attempted commands: none.
