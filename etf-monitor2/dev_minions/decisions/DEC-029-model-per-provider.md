# DEC-029 — Model stored per provider; Test connection uses the form

Status: **Decided** (TECHNICAL; written by the Copilot fallback, validated by the tech-lead 2026-10-09).

Tech-lead validation 2026-10-09: migration `drizzle/0006_ai_provider_models.sql` is a single nullable `ADD COLUMN` (expand-only, DEC-023). `lib/config/ai-settings.ts` reads legacy `ai_model` as the active provider's fallback and saves in one `insert … on conflict` statement. Test connection sends only the form's provider and model, never a key or URL (DEC-017/021 intact). Option 2 is sound and no product question is involved.

## Context
QA live check 2026-10-09 (US-041/US-056/US-057): `settings.ai_model` is one value for every provider, so switching provider kept a stale model (custom provider answered `model_not_found`); the uncontrolled form fields did not follow the saved state; Test connection read stored settings, not the form.

## Options
1. New table `ai_provider_models` — clean, but the save becomes a second statement and breaks the pinned "one runner call, one statement" test AS-11.
2. **New nullable `settings.ai_models jsonb` (chosen)** — expand-only `ADD COLUMN`, one statement per save, any provider id including custom ones. `ai_model` stays as the active provider's mirror, so rows written before the migration still read correctly.
3. Clear the model on provider change — loses each provider's model, does not fix custom providers.

## Decision (shipped)
Option 2, migration `0006_ai_provider_models`. A blank model removes that provider's entry; other entries are never touched; clearing the provider keeps all entries. A deleted custom provider's entry is left behind (ids are never reused). The form shows the selected provider's own model; Test connection sends only the form's provider and model (never a key or URL) and falls back to stored settings only when the form has no provider.
