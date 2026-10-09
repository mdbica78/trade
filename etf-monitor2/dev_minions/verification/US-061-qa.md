# US-061 — QA checklist (/admin/ai redesign)

Review: PASS (round 1, `US-061-review.md`). Tests: PASS (round 1, `US-061-tests.md`, 261 files / 2846 tests, typecheck, lint 0 errors, offline build). Codex QA not yet run.

## Offline commands
`corepack pnpm typecheck`, `lint`, `test`, `build` with DB/cron/key variables unset. Focused: `app/admin/ai/page.test.tsx`, `components/admin/AiSettingsAdmin.test.tsx`, `AiSettingsForms.test.tsx`, `CustomProvidersAdmin.test.tsx`, `app/globals.contrast.test.ts`, `app/globals.tokens.test.ts`.

## MANUAL-QA (browser; reviewer Warning: no test clicks the selector — all new tests render static markup)
1. `/admin/ai` RO and EN: change the Provider selector — the key card below updates to that provider (status set/not set, source, env var) and shows Save/Replace and (stored keys only) Clear for that provider only; the password input is empty after every switch and after a successful save. (AC1, AC3)
2. No provider selected → the card asks to choose one; a custom provider selected → the pointer to its own card, no key form. (AC1)
3. Save and Test connection still use the provider and model shown in the selector (DEC-029). Note (review): a provider/model Save remounts the forms and drops any unsaved key text. (AC3)
4. Custom providers: each is a card with name, URL, saved model (or "not set"), key state; Edit, API key and Add provider are collapsed `<details>` that open by keyboard (Enter/Space) and mouse; delete works; with 5 providers only the limit note shows. (AC2)
5. With saved settings failing to load (DB error): the load error plus a provider picker still gives access to key management. (AC3)
6. Both themes, focus visibility, 375 px layout (cards stack, no horizontal overflow). (AC4)
7. No key value appears anywhere in the page source (view source / DevTools), including after saving a key. (AC3)

## Deliberate changes
Provider/key table and per-provider key forms replaced by the selected-provider card; custom providers become cards with `<details>`. Tests changed: `app/admin/ai/page.test.tsx` PA-2/3/4/5/11/12 (+PA-3b), `AiSettingsAdmin.test.tsx` ASK-1 (+1b/1c/1d), `AiSettingsForms.test.tsx` (new props), `CustomProvidersAdmin.test.tsx` (+CPU-7, CPU-8). No golden snapshot covers these components. Review notes (non-blocking): custom-provider card section has no `aria-labelledby`; some old key-table message keys (`providerColumn`) are now unused.

## Files changed
`components/admin/ProviderKeyCard.tsx` (new), `components/admin/AiSettingsForms.tsx`, `AiSettingsAdmin.tsx`, `CustomProvidersAdmin.tsx`, `app/admin/ai/page.tsx`, `messages/en.json`, `messages/ro.json`; tests `app/admin/ai/page.test.tsx`, `components/admin/AiSettingsAdmin.test.tsx`, `AiSettingsForms.test.tsx`, `CustomProvidersAdmin.test.tsx`; process `US-061-review.md`, `US-061-tests.md`, `US-061-qa.md`, `dev_minions/status.md`, `dev_minions/HANDOVER.md`.
