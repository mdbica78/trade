# US-041 review

## Round 1 — 2026-10-03

Verdict: **PASS**

### Acceptance criteria

- **AC1 — Explicit isolated preset roster: MET.** `lib/ai/provider-catalog.ts` offers exactly `gemini` and `groq`; `lib/ai/provider-catalog.test.ts` PC-1/PC-3 pins the exact IDs and two-entry count. `lib/ai/providers/registry.test.ts` PR-5 checks that both shipped adapter IDs and the default registry IDs equal the catalogue IDs in order; PR-6 checks each resolves to an adapter. Both `backlog/stories/US-041.md` and `backlog/sprints/sprint-10.md` keep D-1 **PRODUCT — PROPOSED / NEEDS USER** and ask whether additional named vendors are wanted. No additional preset is implied or implemented.
- **AC2 — Fixed endpoints and adapter mapping: MET.** `app/admin/ai/actions.ts` reads only `provider` and `model` for settings; `app/admin/ai/actions.test.ts` AA-2 posts a hostile `baseUrl` and proves only `{ provider, model }` reaches `setAiSettings`. `ProviderCallContext` in `lib/ai/providers/types.ts` has no `baseUrl` member. `lib/ai/providers/gemini.ts` and `groq.ts` construct requests from their adapter-owned URL constants; GM-7 and GQ-6 inject an extra `baseUrl` and assert requests still target those constants. `components/admin/AiProviderModelFields.tsx` renders only provider/model fields, and PMF-5 checks no URL/endpoint input is rendered.
- **AC3 — Model picker and existing persistence: MET.** The catalogue has static suggestions per provider; the component selects the suggestion list from the current provider state, updates that state on `<select>` changes, and presents suggestions through a datalist on the bounded free-text model input. `lib/config/ai-settings.ts` retains `AI_MODEL_MAX_LENGTH = 200`, validates the provider against injected IDs, and writes/reads `settings.ai_provider` and `settings.ai_model`. PGlite tests AS-2/AS-8 cover persistence/reload; page test PA-1 and component test PMF-3 cover the stored provider/model and corresponding suggestions in the rendered UI. AA-8, PA-9 and AS-9 assert no network call during action, page render, or save.
- **AC4 — Closed errors, bilingual UI, and write-only key behavior: MET.** `setAiSettings` returns closed `unknown_provider`/`invalid_model` results and validates before its write; PGlite test AS-7 proves invalid provider/model submissions leave the row unchanged. PMF-3 renders the selected provider, saved model and static suggestions in both RO and EN; the existing translated `modelHint` remains in both message catalogs. The US-040 key controls remain separate from the replaced provider/model fields: `components/admin/AiSettingsAdmin.test.tsx` ASK-1/ASK-2 covers enabled write-only empty password input and disabled-storage behavior in both locales; `app/admin/ai/page.test.tsx` PA-2/PA-4/PA-11/PA-12 covers key-free output, empty password controls, stored-key clearing and disabled storage. The save/clear actions and key form source were not changed by US-041.
- **AC5 — Offline boundaries and gates: MET.** I independently ran the focused review suite with the database, cron, deployment, master-key and provider-key environment variables removed:

  ```text
  corepack pnpm exec vitest run lib/ai/provider-catalog.test.ts lib/ai/providers/registry.test.ts lib/ai/providers/gemini.test.ts lib/ai/providers/groq.test.ts lib/config/ai-settings.test.ts lib/config/ai-settings.pglite.test.ts components/admin/AiProviderModelFields.test.tsx components/admin/AiSettingsAdmin.test.tsx app/admin/ai/page.test.tsx app/admin/ai/actions.test.ts
  ```

  Exit code **0**; **10 files / 84 tests passed**. This verifies the offline catalogue, registry, adapter, configuration, action, UI, localization and key-control coverage. The tests use mocks, static data and PGlite; no live provider or database was accessed. The implementation's full `typecheck`/`lint`/suite/build gates are recorded in HANDOVER but were not rerun as part of this independent review; the separate independent test verdict remains responsible for confirming those gates.

### Non-blocking notes

- **LOW — stale configuration-test allowlists.** The plan §2 asked that provider-ID fixtures in `lib/config/ai-settings.test.ts` and `lib/config/ai-settings.pglite.test.ts` match the production Gemini/Groq catalogue. Both still inject `["gemini", "groq", "openrouter", "mistral"]`; AS-8 still demonstrates saving `mistral`. This does not change production behavior: `lib/ai/settings-deps.ts` supplies `PROVIDER_IDS` from the current catalogue, and AC1/AC4 coverage uses the current catalogue plus the generic unknown-provider rejection. It does leave misleading stale test fixtures and should be cleaned up in a later scoped change.
- **LOW — no provider-switch interaction assertion.** PMF-3 verifies the datalist for a provider already selected at render, while PMF-1/PMF-2 test the pure lookup; there is no UI interaction test that changes the `<select>` and observes its suggestions swap. The component source connects `onChange` to state and derives suggestions from that state, so no behavior defect was found.

No Critical or Warning findings.

Denied or attempted commands: none. No git command, secret/credential file, live resource, or `ai_provider_keys` row was accessed.


## Round 2 (QA reopen fix)
Verdict: **PASS** (static source review; tests not re-run by this reviewer). Scope: DEC-029 fix shared by US-041/US-056/US-057.

Checked:
1. Persistence � `0006_ai_provider_models.sql` is a single nullable `ADD COLUMN` (expand-only). `setAiSettings` is one statement: upsert of the active pair plus this provider's own entry in `ai_models`; blank model removes only that entry, other entries untouched, provider cleared keeps all entries, a legacy `ai_model` is folded into the previous provider's entry before switching. `getAiSettings` returns the selected provider's own model and falls back to the legacy column. Custom provider ids work (same id-validation path), so save?reload?switch?save?reload keeps each provider's model.
2. Form � `AiSettingsForms` remounts on any saved-state change (key = provider/model/models); `AiProviderModelFields` swaps model to `models[next] ?? ""` on provider change; `AiSettingsAdmin` passes `models`; the page reads via `getAiSettings`.
3. Test connection � action forwards only the form's `provider`/`model` strings (hidden inputs); `testProviderConnection` overrides `loadSettings` only; the key still comes from the existing key path, no URL/key accepted from the form; result type remains the closed key-free `ConnectionTestCode` set.
4. No test weakened � the three deliberate changes in HANDOVER (schema journal/column, AS-8 `models`, TC-1 forwards form values) are direct consequences of the intended behavior; new tests added (AS-12..15, CT-F1/F2, TC-4, AiSettingsForms).

Findings:
- Critical: none.
- Warning: none.
- Note N1: a deleted custom provider's entry stays in `ai_models` (documented in DEC-029; ids never reused, harmless).
- Note N2: DEC-029 is still PROPOSED (technical); `tech-lead` should set it Decided at the next audit.
- Note N3: the target `provider` is not validated against known ids in the test path; an unknown id just resolves to a closed `unknown_provider`-style failure code (no leak).

Denied or attempted commands: none.
