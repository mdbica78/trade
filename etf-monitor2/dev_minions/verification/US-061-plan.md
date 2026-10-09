# US-061 plan — Professional /admin/ai

Date: 2026-10-09. Scope follows the PO's tech-lead brief and BR3.

## Data / schema impact
No schema change or migration. Reuse `settings.ai_models`/`ai_provider_keys`/`ai_custom_providers` and their current server-side projections. Do not pass key values to client components; key form fields remain blank write-only controls.

## Files and implementation
- `app/admin/ai/page.tsx`: pass `settings.models` to the custom-provider card view by provider ID; preserve key-free props and current custom-provider error handling.
- `components/admin/AiSettingsAdmin.tsx`, `components/admin/AiSettingsForms.tsx`: consolidate provider selection and key management into one selected-provider card/menu. Keep provider/model Save and Test connection behavior (DEC-029); render only the selected provider's key status and allowed Save/Replace/Remove controls. On no provider selection, show a localized neutral prompt, not an implicit provider's key form.
- `components/admin/ProviderKeySaveForm.tsx`: retain the existing write-only contract and successful-save reset; only adjust layout props if required.
- `components/admin/CustomProvidersAdmin.tsx`: use a clear card per custom provider showing name, URL, its provider-specific saved model (from DEC-029), key-set state, and per-card edit/delete/key actions. Put Add provider in a native collapsible `<details>` section. Do not display key material or add a key value to any prop.
- `components/admin/AiSettingsAdmin.test.tsx`, `AiSettingsForms.test.tsx`, `CustomProvidersAdmin.test.tsx`, `ProviderKeySaveForm` tests if present, `app/admin/ai/page.test.tsx`, actions/privacy tests: verify provider switching selects the corresponding key state, forms submit only that provider, custom model mapping, empty/add/capped states, and key-value non-rendering. Preserve `DEC-021` failure and key-redaction coverage.
- `messages/en.json`, `messages/ro.json`: new labels, statuses, help and collapsible-card text.
- `components/admin/admin-markup.golden.test.tsx` and `components/admin/__snapshots__/admin-markup.golden.test.tsx.snap`: extend the existing fixture to include AI and custom-provider markup if practical; record only this intentional redesign. Keep existing golden assertions for unrelated admin markup.
- Existing theme/accessibility suites (`app/globals.contrast.test.ts`, `app/globals.tokens.test.ts`, component tests): assert existing token use, visible focus, native selection/collapse semantics and no horizontal overflow.

## Deliberate test / snapshot changes
The current provider key table and per-provider repeated forms are intentionally replaced by a selected-provider presentation, and custom-provider forms become cards plus collapsed Add. Add explicit markup/privacy assertions and refresh only corresponding golden entries through a normal test run (never `-u`). Do not relax existing key-free boundary or action assertions.

## Risks and proof
The selected preset/custom provider must correspond to the same provider/model state used by Test connection and Save; retain `AiSettingsForms` state-reset behavior after server state changes. Environment key status remains available while no value is exposed. All operations continue to use existing server actions. Manual QA: switch preset/custom providers; verify set/source badge and write-only empty input, Save/Replace/Remove only selected provider; verify model and connection test unchanged. Full gates: focused AI admin/actions/privacy/i18n/golden tests, typecheck, lint, full suite and offline build.

## Order
1. Extend the server page projection with key-free custom model display data.
2. Refactor provider/model/key card into one client state surface without changing actions.
3. Restyle custom providers into per-provider cards and collapsible add form.
4. Add RO/EN strings, focused privacy/UI tests and intentional golden entries.
5. Run focused and full gates; prepare the QA checklist and live key-free browser checks.
