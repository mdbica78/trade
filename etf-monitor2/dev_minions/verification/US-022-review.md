# US-022 review — Admin: AI provider and API key settings

## Round 1 — 2026-09-26

Verdict: PASS

Reviewer: story-reviewer subagent (independent context, did not write this code).
Inputs read: `AGENTS.md`, `dev_minions/backlog/stories/US-022.md`, `dev_minions/verification/US-022-plan.md`,
`dev_minions/decisions/DEC-016-shared-configuration-layer.md`, `dev_minions/HANDOVER.md` ("Files changed" for
US-022), `lib/db/schema.ts` (`settings` table). Every file listed under US-022 in HANDOVER.md "Files changed" was
read in full. Grepped `app/`, `components/`, `lib/config/` for `process.env`, `PROVIDER_CATALOG`, `providerIds`,
`key-status` to confirm nothing outside that list was touched for this story; `lib/config/default-deps.ts` (a
pre-existing file, not in the list) was read and confirmed to hold no AI wiring, consistent with DEC-016 §1.

### Acceptance criteria

- **AC1 (choice from the supported list)** — MET. `lib/ai/provider-catalog.ts:9-14` (`PROVIDER_CATALOG`, 4 FR6
  providers) proven by `lib/ai/provider-catalog.test.ts` ("has exactly the four FR6 provider ids, in order", PC-1).
  Page renders exactly 5 options (4 + none) in catalogue order, preselects the stored provider, fills the model
  field: `app/admin/ai/page.test.tsx:41` (`PA-1`), `:51` (`PA-1b`), `:57` (`PA-7`, unknown stored id → "none" +
  notice, `AiSettingsAdmin.tsx:24-27,38`).
- **AC2 (save writes only its columns)** — MET. `lib/config/ai-settings.ts:83-90` (`setAiSettings`, one
  `insert ... on conflict do update set "ai_provider" = ..., "ai_model" = ...`, naming only the two columns).
  Proven on PGlite: `lib/config/ai-settings.pglite.test.ts:21` (`AS-2`, `cron_hour_utc`/`default_locale` untouched),
  `:40` (`AS-3`, missing row created with column defaults), `:48` (`AS-4`, clearing nulls both columns, others
  kept), `:64` (`AS-4b`, null/undefined behave like empty string), `:127` (`AS-11`, exactly one runner call with
  one statement).
- **AC3 (validation)** — MET. `lib/config/ai-settings.ts:28-60` (`normaliseProvider`, `normaliseModel`). Proven by
  `lib/config/ai-settings.test.ts:17` (`AV-1`, unknown/malformed provider, zero runner calls), `:26` (`AV-2`,
  over-length or non-string model, zero runner calls), `:40` (`AV-4`, trims), `:47` (`AV-5`, clearing ignores an
  over-length model); PGlite `AS-6` (exactly 200 accepted), `AS-7` (row unchanged after a rejected save);
  `app/admin/ai/actions.test.ts` (`AA-1`, `"a not-ok result never revalidates"`); `app/admin/ai/result-messages.ts`
  and its test (`unknown_provider`→`unknownProvider`, `invalid_model`→`invalidModel`); `RM-2`
  (`result-messages.test.ts:43`) confirms `Admin.messages.invalidModel` states "200" in both catalogues;
  `components/admin/ActionMessage.test.tsx:66` (`AM-3`) renders both translated.
- **AC4 (keys stay in the environment)** — MET. `lib/ai/key-status.ts:16-28` (`getKeyStatuses`, booleans only,
  the sole file reading `process.env[<key var>]` — confirmed by grep and by `lib/ai/boundaries.test.ts:50`, `LB-3`).
  Proven: `lib/ai/key-status.test.ts:10` (`KS-1`, sentinel values never leak, `JSON.stringify` check), `:24` (`KS-2`,
  blank/unset → false); `app/admin/ai/page.test.tsx:64` (`PA-2`, real `key-status` module + 4 sentinels, HTML has
  no `SENTINEL`/`9f3c`, 4 `data-key-status="set"` cells, variable names shown), `:75` (`PA-3`, not-set path), `:86`
  (`PA-4`, no key-shaped input, no `type="password"`, only `provider`/`model` named controls);
  `app/admin/ai/actions.test.ts:28` (`AA-1`, action ignores `apiKey`/env-shaped extra form fields); PGlite `AS-10`
  (DB dump after a save with all four keys stubbed contains no sentinel); `lib/ai/boundaries.test.ts:61` (`LB-4`,
  only `app/admin/ai/page.tsx` imports `key-status`, no `"use client"` importer — confirmed `AiSettingsAdmin.tsx`
  does not import it and carries no `"use client"` directive).
- **AC5 (no AI call, no network)** — MET. `lib/ai/provider-catalog.ts` has zero imports (`LB-1`).
  `lib/ai/boundaries.test.ts:39` (`LB-2`, allow-list of specifiers, no SDK) covers every non-test `.ts` in
  `lib/ai/` (confirmed: `provider-catalog.ts`, `key-status.ts`, `settings-deps.ts`, ≥3 files, not vacuous per
  `:28`). `lib/config/boundaries.test.ts:94` (`BC-6`, new) confirms `ai-settings.ts` imports no `unpdf`,
  `@neondatabase/serverless`, `./default-deps`, `extraction/*`; the pre-existing loop (`:18-46`) already covers it
  for `/ai/` specifiers and `process.env`. `fetch` spies never called: PGlite `AS-9`, page `PA-9`, action `AA-8`.
- **AC6 (bilingual)** — MET. `messages/en.json` and `messages/ro.json` both carry the new `Admin.nav.ai`,
  `Admin.ai.*` (18 keys), `Admin.messages.{aiSaved,aiCleared,unknownProvider,invalidModel}` (confirmed by direct
  read of both catalogues — identical key sets, ro/en text distinct, provider display names identical proper
  nouns). Existing `i18n/messages.test.ts` key-parity test is unchanged and covers the new keys. Render tests:
  `app/admin/ai/page.test.tsx:95` (`PA-5`/`PA-5b`, ro vs en, provider names identical, no cross-locale leakage),
  `app/admin/layout.test.tsx:34` (`AL-3`, AI nav link in both locales). `eslint.config.mjs:21`
  (`react/jsx-no-literals`) is active and `pnpm lint` passed 0 errors on the new `app/**`/`components/**` files
  (re-run by this reviewer, see Gates below).
- **AC7 (failure states)** — MET. `app/admin/ai/page.tsx:11-19` (`loadSettings`, catches any exception from
  `getDb`/`createAiSettingsDeps`/`getAiSettings` together, never renders it) and `AiSettingsAdmin.tsx:34-35`
  (`role="alert"` + `t("loadError")`). Proven: `app/admin/ai/page.test.tsx:110` (`PA-6`, thrown error with a
  connection string and the word "secret" → translated `loadError` only, key table still renders).
  `app/admin/ai/actions.ts:19-25` (catches, returns `GENERIC_ERROR`) proven by `app/admin/ai/actions.test.ts:62`
  (`AA-6`, secret-shaped thrown error → generic key only, `JSON.stringify` has none of the secret text), `:77`
  (`AA-7`, `getDb`-shaped throw → same generic state). One gap against the plan: `US-022-plan.md` §1 names a
  `PA-6b` test ("`getDb` throws (as with `DATABASE_URL` unset) → same `loadError`") that is not present in
  `app/admin/ai/page.test.tsx` — only `PA-6` (which stubs `getAiSettings` throwing) exists. The criterion is still
  met: `loadSettings` wraps `getDb()`, `createAiSettingsDeps()` and `getAiSettings()` in the same `try`, so a
  `getDb` throw takes the identical code path already proven by `PA-6`; this is a test-coverage gap versus the
  plan's own list, not a criterion failure. Logged as Warning W1 below.
- **AC8 (documentation and gates)** — MET. `.env.example:9-23` lists all four variables, each `NAME=` (empty)
  preceded by a one-line `#` comment, proven by `lib/ai/env-example.test.ts` (`EX-1`, reads `.env.example` per the
  DEC-015 exception). `README.md:77-80` documents the four variables as optional until Sprint 6; `README.md:138-139`
  documents `/admin/ai` under "Administration" (confirmed by direct read). `app/admin/ai/page.tsx:9`
  (`export const dynamic = "force-dynamic"`) proven by `PA-8`. This reviewer re-ran, locally: `pnpm typecheck`
  (clean, no errors) and `pnpm lint` (0 errors, 3 pre-existing warnings in unrelated files —
  `lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`, `lib/ingestion/load-etfs.test.ts` —
  none touched by this story). `pnpm test` and `pnpm build` were **not re-run** by this reviewer (that is the
  tester's gate); HANDOVER.md reports 1022/1022 and an offline production build, not independently re-verified
  here.

### Non-negotiable rules (AGENTS.md) — checked

- Deterministic extraction / no AI: untouched by this story; `lib/ai/*` is static data + an env-status reader, no
  network, no SDK (LB-1/LB-2, confirmed by direct read — no `fetch`, no provider SDK imports).
- Adapter-per-format, empty-day-on-missing-report: not touched by this story.
- next-intl ro+en for every string: confirmed — every literal in `AiSettingsAdmin.tsx` goes through `t(...)`;
  `react/jsx-no-literals` lint passed.
- DEC-007 number display: no numeric UI added by this story (provider/model are text; key status is a translated
  string, not a number).
- No secrets in code or logs: confirmed by direct read of `key-status.ts`, `provider-catalog.ts`, the page,
  actions, and `.env.example` (empty values only); AC4/AC7 evidence above.
- No weakened or skipped tests: none observed; `lib/config/boundaries.test.ts` and `lib/ai/boundaries.test.ts`
  both have "not vacuous" guards (`≥3 files`); no `.skip`/`.only` found in any new or modified test file read.
- No scope creep: `default-deps.ts` (pre-existing, not in the Files-changed list) was checked and confirmed
  untouched, consistent with DEC-016 §1 keeping AI wiring out of `lib/config/`. `action-state.ts` needed no edit
  because `AdminMessageKey` is derived from `(typeof ro)["Admin"]["messages"]` and therefore already includes the
  new keys — confirmed by direct read, not a gap.

### Findings

- **W1 (Warning, non-blocking)** — The plan (`US-022-plan.md` §1, AC7 row) names a `PA-6b` test ("`getDb` throws →
  same `loadError`") that was not written; only `PA-6` (`getAiSettings` throwing) exists in
  `app/admin/ai/page.test.tsx`. The production code already covers both paths identically (single `try` around
  `getDb`, `createAiSettingsDeps`, `getAiSettings`), so AC7 is still MET, but a future change that special-cased
  `getDb` would not be caught by the current test file. Suggest adding `PA-6b` in a later pass; not worth a fix
  round on its own.
- **N1 (Note)** — `dev_minions/status.md` still lists US-022 as `Ready` (not yet `Awaiting QA`); per AGENTS.md
  this is the orchestrator's job to update once both review and test verdicts are in, not a code issue.

### Denied or attempted commands: none.
