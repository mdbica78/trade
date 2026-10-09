# US-061 — independent review

## Round 1

Reviewer: independent context (did not write the code). Read AGENTS.md, story, plan, HANDOVER "Files changed US-061", then the changed source and tests.

### Evidence I produced
- `vitest run` on `AiSettingsAdmin.test.tsx`, `AiSettingsForms.test.tsx`, `CustomProvidersAdmin.test.tsx`, `AiProviderModelFields.test.tsx`, `app/admin/ai` (page/actions/result-messages/test-connection), `admin-markup.golden.test.tsx`, `app/globals.contrast.test.ts`, `globals.tokens.test.ts`, `globals.rules.test.ts`, `app/colour-literals.test.ts` (DATABASE_URL/CRON_SECRET/VERCEL_ENV/AI_KEY_MASTER_KEY/GEMINI/GROQ keys unset): **14 files / 135 tests passed**. (The shell reported exit 1 only because of piped stderr noise — the `[load-error]` log lines and an IntlError timeZone warning that tests print; summary line shows all passed.)
- `tsc --noEmit`: exit 0.
- Node script comparing flattened key sets of `messages/en.json` vs `messages/ro.json`: no key missing in either direction (includes the 7 new `Admin.ai.*` keys, en.json:175-176,193-197 / ro.json:174-175,193-197).
- Typecheck beyond tsc, lint, full suite and offline build: **not re-run** (HANDOVER figures are the implementer's, not cited as mine).

### Criteria

**AC1 — MET (live state follows via code; interaction not DOM-tested).**
- `AiSettingsForms.tsx:61-80` keeps `current` provider/model in state fed by `AiProviderModelFields` `onChange` (`AiProviderModelFields.tsx:48-53`, `:72-74`) and passes `current.provider` to `ProviderKeyCard` (`AiSettingsForms.tsx:77`). The card renders only `keyRows.find(id === providerId)` (`ProviderKeyCard.tsx:76-111`): status (`data-key-status`), source (`data-key-source`), env var, write-only Save/Replace (`submitLabel` switches on `row.isSet`, `:101`) and Remove (`:104-108`, only for `source === "stored"`). Not a list. No selection → `keyCardNone` prompt (`:79`), no key form.
- Forms are not nested: `AiSettingsAdmin.tsx` has no wrapping form; `Forms` renders three siblings (`AiSettingsForms.tsx:68-80`); the Remove `ActionForm` is a sibling of the save form inside a `div` (`ProviderKeyCard.tsx:96-109`).
- State reset on provider switch: the key forms sit in `<div key={row.id}>` (`ProviderKeyCard.tsx:96`), so switching provider remounts the password input; `ProviderKeySaveForm` still resets on success (`ProviderKeySaveForm.tsx:25-27`).
- Settings-load failure keeps key management reachable: `ProviderKeyPicker` (`ProviderKeyCard.tsx:21-49`, used at `AiSettingsAdmin.tsx:62-68`), selector has no `name` (nothing submitted); proven by ASK-1d.

**AC2 — MET.** `CustomProvidersAdmin.tsx:56-125`: one `<section data-custom-provider>` card per provider with name, URL, saved model (`models[provider.id]`, DEC-029 per-provider mapping; `customModelNone` fallback), key status; native `<details>` for Edit (`:76`), Key (`:93`) and per-card Delete form (`:117`); Add form in a collapsible `<details data-custom-add>` (`:131`), replaced by the limit note at the cap (`:146`). `page.tsx:62` passes `settings.models` (key-free). Tests CPU-1/3/7/8 pass (run by me).

**AC3 — MET.** Key values never reach props/markup: components only receive `ProviderKeyStatusView` (`provider-deps.ts:36`) and `CustomProviderView` (`:114`) — no key field; password inputs have no `value` (`ProviderKeySaveForm.tsx:43`); new code adds no logging. Tests: ASK-1 (`no value=`, FAKE_KEY absent), PA-2 (SENTINEL absent, only the selected provider's env var in the page), PA-4, CPU-6, ASF-2 (no baseurl/apikey/password in the provider/test forms) — all passed in my run. Test connection and Save use the live provider/model (`AiSettingsForms.tsx:68-76` hidden inputs from `current`; ASF-2). Actions/server validation untouched (not in the changed-files list; the action tests passed).

**AC4 — MET for what is checkable / MANUAL-QA for visual.** Styling uses only token classes (`var(--line)`, `--head`, `--muted`, `--panel`, `--radius`); `colour-literals`, tokens, contrast and rules tests pass (run by me). RO/EN parity verified (above) and both locales rendered in ASK-1, CPU-1/7, PA-2/3b. No admin golden snapshot covers these components (`admin-markup.golden.test.tsx` has none), so no snapshot was changed — nothing to refresh; consistent with the plan's "if practical". Real WCAG/visual check in both themes and no-overflow at narrow width → MANUAL-QA.

**AC5 — MET (partial self-evidence).** Focused tests and `tsc` I ran pass; lint, full suite and offline build are the implementer's HANDOVER claims, **not re-run** by me (tester gate covers them).

### Findings

**Critical:** none.

**Warning**
- W1. No test exercises the *client-side* behaviour that is the core of AC1 (switching the provider `<select>` updates the key card; password input remounts). All new tests are `renderToStaticMarkup` of the initial state (ASK-1b/1c select the provider via saved settings, not via change). The behaviour is correct by code reading, but is unproven by tests; add it to the QA checklist as a MANUAL-QA step (switch preset → set/not-set badge changes and empty input; switch to a custom provider → pointer text).

**Note**
- N1. The custom-provider card `<section data-custom-provider>` (`CustomProvidersAdmin.tsx:60-64`) has no `aria-labelledby` pointing at its `<h3>` (the key card does, `ProviderKeyCard.tsx:73`); the plan mentioned aria-labelledby. Not a defect (headings still label it visually/for navigation), cheap to add.
- N2. `ProviderKeyCard` uses a fixed `id="ai-key-card-heading"`; fine as there is one card per page (the picker and form variants are mutually exclusive).
- N3. Several old key-table message keys (`providerColumn`-style) may now be unused; harmless, ro/en parity intact.
- N4. After a provider/model Save, `Forms` remounts (key = saved state, `AiSettingsForms.tsx:46`), including the key card, so text typed but unsaved in the key input is dropped. Acceptable; matches the documented reset behaviour.
- N5. Intentional behavioural change: environment/stored key status is no longer visible for all providers at once, only the selected one — this is AC1 as written; test changes (PA-2/3/4/5/11/12, ASK-1) replace the table assertions with equivalent selected-provider assertions and add PA-3b/ASK-1b/1c/1d; I found no weakened or deleted assertions on key privacy, failure handling or redaction (PA-6/6b/LE-P8, ASK-2 retained).

Verdict: PASS

Denied or attempted commands: none.
