# US-041 plan — Provider presets and model picker

**Scope:** planning only. Implement after US-040 has completed its implementation and independent gates, in the reviewed Sprint 10 order. The story acceptance criteria remain drafted for PO confirmation. This plan does not change application code, tests, status, sprint files, or HANDOVER.

## Binding inputs

- `backlog/stories/US-041.md` — drafted AC1–AC5 and scope.
- `backlog/sprints/sprint-10.md` and `verification/SPRINT-10-review.md` — approved order, guardrails, and D-1.
- FR16, DEC-016, DEC-017 and DEC-021 — reuse `settings.ai_provider` / `settings.ai_model`, keep model input bounded, fixed adapter endpoints, and prohibit custom URLs.
- `dev_minions/HANDOVER.md` records US-040 as currently implementing. US-041 depends on its resulting `/admin/ai` write-only key behavior and must not overlap its provider-wiring or admin-page edits.

## Product decision — D-1

**D-1 remains PRODUCT — PROPOSED / NEEDS USER.** FR16 does not enumerate vendors. The isolated default for this story is exactly the already implemented Gemini and Groq providers, with their existing fixed endpoints and adapters. Do not add or imply support for another vendor based on “OpenAI-compatible list”; a future addition requires a separately scoped adapter and fixed endpoint. Free-form/custom URLs are prohibited, not an option for D-1.

The sprint and story already record this question. This plan preserves its proposed status and does not edit either file.

## Plan and files

Do not start until US-040 has finished its implementation and the resulting branch includes its key persistence/UI changes. Then re-read the final US-040 files and integrate with, rather than replace, its write-only key controls and action flow.

### 1. Catalogue and adapter invariants — AC1, AC2

- Extend `lib/ai/provider-catalog.ts` with immutable static model suggestions for each of the two existing provider descriptors. Keep IDs and fixed endpoint ownership unchanged; model names are suggestions only, not a claim that a model is live or available.
- Extend `lib/ai/provider-catalog.test.ts` to assert that the selectable IDs are exactly `gemini` and `groq`, each has non-empty static suggestions, and IDs remain unique.
- Extend `lib/ai/providers/registry.test.ts` to retain and explicitly assert catalogue/registry parity and ordering for the shipped adapters. The existing fixed endpoint constants and routing stay in `lib/ai/providers/gemini.ts` and `lib/ai/providers/groq.ts`.
- Extend `lib/ai/providers/gemini.test.ts` and `lib/ai/providers/groq.test.ts` with adversarial runtime contexts carrying an extra `baseUrl`; assert the mocked fetch target remains the existing adapter-owned endpoint. No URL is accepted from settings, form data, or catalogue selection.

### 2. Existing model settings validation and persistence — AC3, AC4

- Keep `lib/config/ai-settings.ts` as the single settings read/write path; do not create another store or weaken `AI_MODEL_MAX_LENGTH`.
- Update provider-ID fixtures in `lib/config/ai-settings.test.ts` and `lib/config/ai-settings.pglite.test.ts` to match the production Gemini/Groq catalogue. Retain checks for invalid providers, the 200-character bound, unchanged rows after invalid input, and saved settings reloading through `getAiSettings`.
- Do not change `lib/ai/settings-deps.ts` or the provider ID wiring unless integration with the completed US-040 version demonstrates a concrete regression; it already injects `PROVIDER_IDS`.

### 3. Admin UI and action boundary — AC2, AC3, AC4

- Update `app/admin/ai/page.tsx` to pass each catalogue entry’s static suggestions to the existing settings UI while preserving the final US-040 key status/key action props.
- Update `components/admin/AiSettingsAdmin.tsx` and add `components/admin/AiProviderModelFields.tsx` plus `components/admin/AiProviderModelFields.test.tsx`. Keep the provider selector and bounded free-text model input in the existing settings form. Use a provider-aware static suggestion list (for example, a datalist associated with the model input) that changes when the selected preset changes; choosing a suggestion fills the same `model` field, and arbitrary text remains editable. No suggestion triggers a request. Preserve saved provider/model defaults and all US-040 key controls.
- Update `messages/en.json` and `messages/ro.json` only for any new or revised visible model-suggestion/help text. Extend the admin page tests to verify matching translated output, provider-specific static suggestions, free-text/bounded input, and absence of any URL control.
- Extend `app/admin/ai/actions.test.ts` to submit an extra `baseUrl` field and prove the action forwards only `{ provider, model }` to `setAiSettings`, without revalidation on invalid input. The provider adapters’ tests above independently prove that an injected runtime `baseUrl` cannot redirect the mocked request.
- Extend `app/admin/ai/page.test.tsx` for both locales: exact Gemini/Groq presets in catalogue order, suggestions for the saved/selected provider, persisted model value, and no key material or URL input. Preserve and adapt its write-only/key-free assertions to the post-US-040 props and rendering.

### 4. Offline verification — AC5

Run targeted tests first:

```text
pnpm exec vitest run lib/ai/provider-catalog.test.ts lib/ai/providers/registry.test.ts lib/ai/providers/gemini.test.ts lib/ai/providers/groq.test.ts lib/config/ai-settings.test.ts lib/config/ai-settings.pglite.test.ts components/admin/AiProviderModelFields.test.tsx app/admin/ai/page.test.tsx app/admin/ai/actions.test.ts
```

Then run the project gates:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run them with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, and `GROQ_API_KEY` absent. Do not print variable values. Tests use only fake values, PGlite, static catalogue data, and mocked fetch; they make no provider/model-discovery call and access no live resource. The build must remain offline and rely on the existing non-production migration skip. Add no dependency.

## Acceptance-criteria evidence map

| Criterion | Planned evidence |
|---|---|
| AC1 — isolated fixed preset roster | `provider-catalog.test.ts` exact IDs; `providers/registry.test.ts` parity; this plan records D-1 PROPOSED / NEEDS USER and the Gemini/Groq-only default. |
| AC2 — endpoints cannot be user-controlled | `app/admin/ai/actions.test.ts` extra form `baseUrl` ignored; `gemini.test.ts` and `groq.test.ts` adversarial runtime `baseUrl` cannot change mocked fetch URLs; page/component tests assert no URL input. |
| AC3 — static suggestions and persisted free text | Catalogue tests; provider-aware picker tests; existing config unit/PGlite tests prove bounded validation, settings persistence and reload. |
| AC4 — safe, bilingual settings UI | Admin page tests in RO and EN assert preset/model/suggestion rendering and preserve the post-US-040 write-only/key-free assertions; translation entries are updated in both catalogs. |
| AC5 — offline tests and gates | Targeted suite and all four project gates above, with live database/provider variables absent and no network calls. |

## Boundaries and stop conditions

- Do not edit `dev_minions/backlog/stories/US-041.md`, `dev_minions/backlog/sprints/sprint-10.md`, `dev_minions/status.md`, or `dev_minions/HANDOVER.md` as part of this planning-only request.
- Do not change US-040 encryption, key storage, key lifecycle, or key visibility. Preserve its write-only UI and keep key material out of model suggestions, settings results, rendered output, logs, and errors.
- Do not add providers, custom URLs, live model discovery, credential validation, dependencies, or database schema/migrations.
- The reviewed Sprint 10 inputs settle the technical boundaries and approach; no additional technical decision is identified by this plan. If implementation uncovers an actual unsettled technical choice, stop and write a PROPOSED decision draft rather than choosing.
