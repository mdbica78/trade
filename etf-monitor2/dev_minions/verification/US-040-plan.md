# US-040 plan — Store provider keys from `/admin/ai`

**Scope:** planning only. Implement US-040 in the reviewed Sprint 10 order, before US-041 and US-042. The story ACs remain drafted for PO confirmation. No source code, tests, status board, or handover state is changed by this plan.

## Binding inputs and decisions

- FR16 and the detailed criteria in `backlog/stories/US-040.md`.
- `backlog/sprints/sprint-10.md` and the detailed approval in `verification/SPRINT-10-review.md`.
- DEC-021: dedicated `ai_provider_keys` table; AES-256-GCM; 12-byte fresh IV; provider ID as AAD; ciphertext encoding `base64(iv ‖ tag ‖ ciphertext)`; `key_source` records `master` or `cron_derived`; valid `AI_KEY_MASTER_KEY` takes precedence for new writes, otherwise HKDF-SHA256 from `CRON_SECRET`; decrypt only by the row's recorded source; stored key before environment key; thin config/action boundary; no plaintext-bearing values outside `lib/ai/`; no custom provider URL.
- DEC-023: generate a local expand-only migration, verify it on PGlite, and never apply it against Neon; production build applies it.
- DEC-016/017/019: plain configuration functions over `Db`/`BatchRunner`, synchronous `resolveActiveProvider`, provider wiring owns key-carrying runtime objects, and sanitized server-side diagnostics.
- No new runtime dependency: use Node's built-in `crypto`; crypto-bearing routes and modules must stay on Node runtime.

**Decisions needed for US-040: none.** Do not reopen the accepted no-login risk or propose a Vercel/Neon/credential step. Sprint 10 D-1 is for US-041 only, remains **PROPOSED / NEEDS USER**, and does not block this story. No other unsettled choice is introduced by this plan.

## Architectural boundaries

1. `lib/ai/key-status.ts` remains the sole `process.env` reader for provider and encryption environment material. It may expose only key-free provider status to callers; environment encryption material is handed transiently to `lib/ai/key-store.ts`. Add a boolean `storingEnabled()` view so the UI cannot infer or reveal why storage material is invalid.
2. `lib/ai/key-store.ts` is the only module that encrypts/decrypts provider keys and selects/inserts/upserts/deletes `ai_provider_keys`. It obtains material via `key-status.ts`, uses the closed provider catalogue, and returns plaintext key values only to `lib/ai/provider-deps.ts`. Its key-free metadata projection may reach `/admin/ai` only through provider wiring.
3. The only importers of `key-store.ts` are `lib/ai/provider-deps.ts` and `lib/config/ai-keys.ts`. The Server Action receives the submitted key as a transient request value; `lib/config/ai-keys.ts` validates and forwards it only to injected encryption/storage dependencies. Neither persists plaintext, logs it, returns it, or puts it in a view or error. No plaintext-bearing object leaves the `lib/ai/` provider runtime/wiring path.
4. `lib/config/ai-keys.ts` owns save/clear validation and orchestration as plain functions over the existing configuration pattern. It receives provider descriptors, storage-enabled state, and injected encrypt/store operations; it does not contain SQL for `ai_provider_keys`. The one explicitly DEC-021-authorized `key-store.ts` import is the sole narrow exception to the existing config/AI boundary. It introduces no `process.env`, Next.js, React, or adapter imports.
5. Server Actions remain thin, with no SQL and only closed result/message keys. They read only the expected fields (`providerId`, `key`) and ignore `baseUrl` or any other extra field. Keep Next's same-origin protection; add no custom origin bypass.
6. Keep `/admin/ai` and `/chat` `noindex` via Next metadata; this is a crawler directive, not authentication. Add no login, authorization, rate limiter, endpoint override, or key handling to chat.
7. `/health` uses the existing schema-derived inventory only. It must identify a missing required table without selecting its rows. Missing-table/read/decrypt failures cannot break existing settings, ETF, or `/admin/ai` rendering.

## Phase order

### Phase 1 — Schema, migration, health inventory

1. Add `aiProviderKeys` to `lib/db/schema.ts` with exactly the DEC-021 columns: `provider_id` text primary key, `ciphertext` text not null, `key_source` text not null, and `updated_at` timestamptz not null. Add no plaintext, prefix, suffix, key-length, endpoint, or unrelated fields; no FK is needed.
2. Update `lib/db/schema.test.ts` for the schema/table and exact column shape.
3. Generate the migration locally with `pnpm db:generate`; review that it creates only the new table, is expand-only, and is journaled after `0002_home_display_settings`. Persist the generated `drizzle/0003_ai_provider_keys.sql`, `drizzle/meta/0003_snapshot.json`, and `drizzle/meta/_journal.json`. Do not run `pnpm db:migrate`, `drizzle-kit migrate`, or the deploy script against Neon.
4. Extend `test/helpers/pglite.migrations.test.ts` to prove journal inclusion/order, that the full migration journal creates the schema-declared table, and that PGlite accepts only the encrypted fake-row shape. Assertions must not print or snapshot ciphertext.
5. `lib/health.ts` already derives table names from the schema and performs a `to_regclass` probe without selecting table rows. Preserve that implementation; extend `lib/health.test.ts` to prove the table is in the schema inventory and that the probe only tests names. Extend `app/health/page.schema.pglite.test.tsx` to drop this table in PGlite and prove `/health` reports its name in both locales.

### Phase 2 — Environment-material boundary and crypto/key store

1. Extend `lib/ai/key-status.ts` rather than adding another environment reader. Add narrow, typed accessors for the active encryption source/material and source-specific decryption material, plus `storingEnabled()`. Keep raw material confined to the `key-status.ts` → `key-store.ts` path; the public UI view receives only booleans/source labels. Valid master material is strict base64 decoding to exactly 32 bytes; invalid material is treated as absent. `CRON_SECRET` fallback requires at least 24 characters and is HKDF-SHA256 with salt `etf-monitor2`, info `ai-provider-keys/v1`, 32-byte output. Never use raw `CRON_SECRET` as the AES key.
2. Add `lib/ai/key-store.ts` using Node built-in crypto. Export the narrow encrypt/decrypt operations and database read/write primitives needed by `provider-deps.ts` and `lib/config/ai-keys.ts`. Generate a new random 12-byte IV for every encryption, set provider ID as AES-GCM AAD, and encode/decode exactly `iv ‖ authTag ‖ ciphertext` in base64. Decryption uses only the row's recorded source; it must not retry with another source after source loss, rotation, malformed ciphertext, or authentication failure.
3. Add `lib/ai/key-store.test.ts` with injected literal fake material and deterministic/controlled crypto inputs where needed. Cover AES-GCM round trip, 12-byte IV and fresh IV per write, tampered ciphertext/tag, wrong provider AAD, wrong key, exact byte encoding, HKDF parameters/output size/separation from raw fake cron input, valid-master precedence for new writes, cron-derived fallback, invalid/missing/short material disabling storage, source-specific decrypt after a master is added, and source loss/cron rotation yielding unavailable only for the affected stored key.
4. Add `lib/ai/key-store.pglite.test.ts` for actual SQL against migrated PGlite using a fake encrypted value only. Verify insert/upsert/delete and select shape as applicable, encrypted row metadata/source/timestamp, per-provider read/decrypt failure isolation, and missing-table fallback. No test may query a real database or inspect a real `ai_provider_keys` table.
5. Extend `lib/ai/key-status.test.ts` with fake-only master/cron/invalid/absent material cases, ensuring outputs exposed to views contain no material and `storingEnabled()` is only boolean. Test env behavior only through controlled fake values; never inspect ambient variable values.

### Phase 3 — Configuration save/replace/clear

1. Add `lib/config/ai-keys.ts` with typed `saveProviderKey` / `clearProviderKey` results and dependencies following the existing DEC-016 configuration pattern. Inject provider descriptors, storage-enabled boolean, and encryption/store operations from the approved boundary. Validate catalogue membership and `requiresApiKey`; trim before storage; accept only trimmed lengths 8–512 and reject any whitespace/control characters. Return only `unknown_provider`, `key_invalid`, `storing_disabled`, or `write_failed` for the specified failures.
2. `lib/config/ai-keys.ts` calls injected key-store operations; `lib/ai/key-store.ts` performs one atomic upsert of ciphertext, recorded source, and timestamp, or deletes only the requested provider row. Neither operation mutates `settings` or another provider row. A successful clear lets the existing environment variable become effective again. Convert store/database failures at the config boundary to `write_failed`, without surfacing exception text.
3. Add `lib/config/ai-keys.test.ts` for all validation cases, exact closed-result shapes, no writes on invalid/disabled requests, a failure result, and no key-bearing values in results or error text.
4. Add `lib/config/ai-keys.pglite.test.ts` for first save, replacement, provider-isolated clear, environment fallback after clear at the wiring layer or with an injected environment read, unchanged neighboring provider/config rows, and write failure behavior. Use only fake key material and assert non-disclosure with boolean inclusion checks so failure output cannot echo the fake.
5. Extend `lib/config/boundaries.test.ts`: preserve all existing bans on Next/React/UI imports and `process.env`; allow exactly `lib/config/ai-keys.ts` to import `lib/ai/key-store.ts` as required by DEC-021, and continue to forbid other AI imports from config.

### Phase 4 — Async provider wiring

1. Update `lib/ai/provider-deps.ts` to load stored keys asynchronously before calling the existing synchronous `resolveActiveProvider`. Build the resolver's synchronous `readApiKey` closure as stored key first, then the existing environment `readApiKey`, then null. Apply the same loading step to `getAiAvailability`; no key value may be included in its result.
2. Keep `lib/ai/providers/resolve.ts`, `lib/ai/providers/resolve.test.ts`, and provider adapters unchanged. Do not change resolver semantics, return type, or adapter key context.
3. Isolate per-provider retrieval/decryption errors so one provider resolves to no stored key (`no_api_key`) without suppressing another provider's valid key. Emit one sanitized DEC-019-style line for that provider using only a catalogued provider ID and safe closed diagnostic fields; never include exception text, URL, environment value, plaintext, ciphertext, or derived/master material. Treat missing table as no stored key while `/health` exposes the schema drift.
4. Extend `lib/ai/provider-deps.test.ts` for stored/environment/unset precedence; prove stored loading completes before the synchronous resolver path, source/read failure for one provider leaves another usable, sanitized one-line logging, key-free availability, and zero network calls during resolution.
5. Extend `lib/ai/provider-deps.interchange.test.ts` to exercise both real provider adapters with injected fake environment and stored keys while preserving their fixed URLs and own-provider-key isolation. Add `lib/ai/provider-deps.pglite.test.ts` if a direct real wiring-to-PGlite integration is needed to prove stored ciphertext is decrypted and passed only to the selected adapter.
6. Update typed `ProviderDeps` fixtures in `lib/ai/chat.test.ts` and `lib/ai/chat.pglite.test.ts` if the new async loading dependency changes the type. Keep chat callers and key-free outcomes intact; add no key-reading/writing capability behavior.

### Phase 5 — Server Actions, key-free status view, write-only bilingual UI

1. Extend `app/admin/ai/actions.ts` with thin save and clear provider-key actions, passing only the provider ID and submitted key to `lib/config/ai-keys.ts`. Ignore `baseUrl` and unrecognized form fields. Revalidate `/admin/ai` only on success. Catch dependency-construction errors into a generic key-free state; rely on framework same-origin protection.
2. Extend `app/admin/ai/actions.test.ts` to prove exact config input, extra-field/`baseUrl` ignore, invalid form shape short-circuit, success revalidation, closed error translation, exception sanitization, no network access, and fake-key absence from action result/log captures. Add `app/admin/ai/actions.pglite.test.ts` only if needed to test the action-to-real-config boundary; core SQL behavior remains proven in config PGlite tests.
3. Extend `app/admin/ai/result-messages.ts` and `.test.ts` for saved, cleared, storing-disabled, invalid-key, unknown-provider, and write-failed closed outcomes; assert every message key exists in both locale catalogues.
4. Change `app/admin/ai/page.tsx` to combine existing AI settings with a key-free provider status projection (source `stored`, `environment`, or `none`, set/unset, and `updatedAt` only where available). Do not pass encrypted rows or plaintext to the component. Missing-table/read failures must preserve the settings view and environment-key status.
5. Update `components/admin/AiSettingsAdmin.tsx` to show key status/source only. If storage is disabled, omit the key input and show only the translated disabled note while still showing environment-key status. If enabled, render a password input with `autoComplete="off"` and no `value`/`defaultValue`, plus save/replace and clear-stored-key controls. Ensure a successful save clears the uncontrolled input. Add a separate `components/admin/AiSettingsAdmin.test.tsx` for both storage states, input attributes, no prefill, status/source labels, clear/save actions, successful-input clearing, both locales, and fake-key absence from markup.
6. Extend `app/admin/ai/page.test.tsx` for stored/environment/none display, disabled storage, missing-table fallback, localized notes, and no secret material in HTML. Extend existing `app/admin/ai/actions.test.ts` and `app/admin/ai/result-messages.test.ts`; do not include real credentials in fixtures.
7. Add all new provider-key labels, source/status terms, disabled note, input/help text, save/replace/clear labels, and closed-result messages to `messages/en.json` and `messages/ro.json`; add parity assertions to the relevant test(s).
8. Add `metadata` with `robots: { index: false, follow: false }` to `app/admin/layout.tsx` and `app/chat/page.tsx` so all admin routes and `/chat` are noindex. Extend `app/admin/layout.test.tsx` and `app/chat/page.test.tsx` to assert metadata while preserving existing rendered behavior and same-origin action use.

### Phase 6 — Boundary, documentation, and leak regression coverage

1. Extend `lib/ai/boundaries.test.ts` to pin: `process.env` only in `key-status.ts`; key-status/key-store/key-material importer sets; key-store importers exactly `lib/ai/provider-deps.ts` and `lib/config/ai-keys.ts`; no client import of secret-bearing modules; all SQL reads/writes of `ai_provider_keys` confined to `key-store.ts`; and no chat/capability access to the key table. Keep current adapter/network/SDK boundary assertions.
2. Extend `app/actions.boundary.test.ts` so the new AI key actions remain SQL-free and only call the configuration layer (allow `lib/config/ai-keys` under its existing action allowlist).
3. Update `dev_minions/architecture/data-model.md` with the table columns and rules: ciphertext only, source-bound decryption, application-only writer/reader, no plain output, and production-deploy migration. Extend `test/data-model-doc.test.ts` with exact table/column/secret-boundary assertions.
4. Update `README.md`'s AI environment/admin section to explain the `/admin/ai` write-only stored-key path, the default `CRON_SECRET` derivation and re-entry consequence after rotating it, optional valid `AI_KEY_MASTER_KEY`, environment-key fallback, and no live key verification. Add only a commented variable-name/example placeholder to `.env.example` if documenting the optional master-key override there; never put a real or useful credential in either file. Extend `lib/ai/env-example.test.ts` and the relevant README test if those files change.
5. Add leak assertions across all observables required by AC8: serialized view/status, rendered HTML, action results, thrown/error messages, captured console output and test-output-safe assertion shapes. Use an unmistakable fake key and fake master/cron inputs only. Avoid snapshots, test names, interpolation, or failing equality diffs that would print any fake key or ciphertext.

### Phase 7 — Independent verification handoff

1. Run targeted tests covering key-status/key-store crypto and PGlite, config PGlite, provider wiring, AI admin actions/UI, health schema, and boundary/i18n tests.
2. Run `pnpm typecheck`, `pnpm lint`, full `pnpm test`, and offline `pnpm build`, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, and `GROQ_API_KEY` absent from the process environment. Tests inject explicit fake material; never inspect ambient values or print variables. Do not weaken or skip existing tests to get a green gate.
3. Run `pnpm db:generate` only after the schema is updated; review generated SQL and metadata, then let the test helper apply the journal to PGlite. Never run `pnpm db:migrate`, `drizzle-kit migrate`, or a production deploy script against Neon.
4. After the implementation is green, independent review/test verdicts and the US-040 QA checklist are separate delivery steps; live post-push `/health` observation is optional QA evidence, not an implementation gate or a request for a real key.

## Acceptance criteria → evidence map

| Criterion | Planned implementation and evidence |
|---|---|
| **AC1 — schema/migration/health** | Phase 1: schema and generated journal-order migration; `lib/db/schema.test.ts`; `test/helpers/pglite.migrations.test.ts`; `lib/health.test.ts`; `app/health/page.schema.pglite.test.tsx`; docs guard `test/data-model-doc.test.ts`. PGlite proves migration application and encrypted-row column shape. Health checks only table existence, never row data. |
| **AC2 — encryption/AAD** | Phase 2: `lib/ai/key-store.ts`; new `lib/ai/key-store.test.ts`; PGlite storage integration. Assert round-trip, distinct fresh 12-byte IV per write, tamper/tag/AAD/wrong-key rejection, exact packed encoding, and no plaintext. Assert Node built-in crypto import and no Edge runtime on routes that execute it. |
| **AC3 — derivation/source lifecycle** | Phase 2 tests in `lib/ai/key-status.test.ts` and `lib/ai/key-store.test.ts`: deterministic HKDF salt/info/32-byte output, raw-input separation, strict master parsing/precedence, cron minimum length/fallback, disabled conditions, row source persistence, old cron-source decryption after master appears, no cross-source fallback on missing/rotated material. All inputs are explicit fake strings/bytes passed through injected readers. |
| **AC4 — precedence/async wiring** | Phase 4: `lib/ai/provider-deps.test.ts`, `lib/ai/provider-deps.interchange.test.ts`, and `lib/ai/provider-deps.pglite.test.ts` if required. Prove stored > environment > unset; loader resolves before `resolveActiveProvider`; per-provider decrypt/read failure degrades independently; existing resolver and adapter contracts remain unchanged. |
| **AC5 — save/replace/clear/validation** | Phase 3: `lib/config/ai-keys.test.ts` and `.pglite.test.ts`; Phase 5: `app/admin/ai/actions.test.ts`, optional action/PGlite boundary test, and `app/admin/ai/result-messages.test.ts`. Prove upsert/replace, selected-row-only clear, environment fallback, each closed code, `baseUrl` ignore, key-free result, and no request to providers. |
| **AC6 — absent table/failure privacy** | Phase 2/4/5: key-store PGlite tests for `42P01` no-key fallback and per-provider decrypt/read isolation; `lib/ai/provider-deps.test.ts` for one safe log line and unaffected other provider; `app/admin/ai/page.test.tsx` for settings/UI continuity; `app/health/page.schema.pglite.test.tsx` for missing-table visibility. Assert no fake material, ciphertext, URL, raw exception, or environment text in HTML/logs/results/errors. |
| **AC7 — write-only localized UI/mitigations** | Phase 5: `components/admin/AiSettingsAdmin.test.tsx`, `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts`, `app/admin/ai/result-messages.test.ts`, `app/admin/layout.test.tsx`, and `app/chat/page.test.tsx`. Prove both locales, no-prefill password control and successful clear, disabled-storage omission/note, source/status-only output, clear/replace, noindex metadata, and ordinary Next same-origin Server Action behavior with no bypass. |
| **AC8 — hard boundaries/leaks** | Phase 3/6: `lib/ai/boundaries.test.ts`, `lib/config/boundaries.test.ts`, `app/actions.boundary.test.ts`, and the cross-surface fake-material assertions in crypto/config/action/page tests. Pin the exact approved importers and ensure only `key-store.ts` touches the key table. Test output must not contain fake values. |
| **AC9 — offline gates** | Phase 7: targeted story suite plus `pnpm typecheck`, `pnpm lint`, `pnpm test`, and offline `pnpm build`; migration runs only through the existing full-journal PGlite helper. No provider, Neon, or Vercel calls. All secret variables absent from gate process environments, all test key material injected fake-only. |

## Expected file set

### New

- `lib/ai/key-store.ts`
- `lib/ai/key-store.test.ts`
- `lib/ai/key-store.pglite.test.ts`
- `lib/ai/provider-deps.pglite.test.ts` (if needed for direct stored-key-to-provider integration)
- `lib/config/ai-keys.ts`
- `lib/config/ai-keys.test.ts`
- `lib/config/ai-keys.pglite.test.ts`
- `components/admin/AiSettingsAdmin.test.tsx`
- `drizzle/0003_ai_provider_keys.sql`
- `drizzle/meta/0003_snapshot.json`

### Changed

- Schema/migration/health: `lib/db/schema.ts`, `lib/db/schema.test.ts`, `drizzle/meta/_journal.json`, `test/helpers/pglite.migrations.test.ts`, `lib/health.test.ts`, `app/health/page.schema.pglite.test.tsx`.
- AI boundary and wiring: `lib/ai/key-status.ts`, `lib/ai/key-status.test.ts`, `lib/ai/provider-deps.ts`, `lib/ai/provider-deps.test.ts`, `lib/ai/provider-deps.interchange.test.ts`, `lib/ai/chat.test.ts`, `lib/ai/chat.pglite.test.ts`, `lib/ai/boundaries.test.ts`.
- Configuration/actions/UI: `lib/config/boundaries.test.ts`, `app/admin/ai/actions.ts`, `app/admin/ai/actions.test.ts`, `app/admin/ai/result-messages.ts`, `app/admin/ai/result-messages.test.ts`, `app/admin/ai/page.tsx`, `app/admin/ai/page.test.tsx`, `components/admin/AiSettingsAdmin.tsx`, `app/admin/layout.tsx`, `app/admin/layout.test.tsx`, `app/chat/page.tsx`, `app/chat/page.test.tsx`, `app/actions.boundary.test.ts`.
- Localization/docs: `messages/en.json`, `messages/ro.json`, `dev_minions/architecture/data-model.md`, `test/data-model-doc.test.ts`, `README.md`, `.env.example`, and `lib/ai/env-example.test.ts` only if the optional master-key example is added.
- No production dependency or lockfile change is expected. `test/helpers/pglite.ts`, `lib/health.ts`, `lib/ai/providers/resolve.ts`, provider adapters, `app/admin/ai/result-messages` closed code mapping patterns, and the migration deploy script should need no behavior changes beyond the specific files above unless implementation evidence proves otherwise; any scope expansion must be documented before doing it.

## Failure cases and non-negotiable checks

- Invalid/absent master key: treat as absent; use valid cron-derived source if available, else storage disabled. Do not expose the cause in UI.
- Missing/short cron secret and no valid master: no key input; environment variables remain usable.
- `AI_KEY_MASTER_KEY` appears after rows were written with `cron_derived`: new writes use master, old rows still derive with cron source. Conversely, do not try cron when a `master` row cannot be decrypted.
- Rotated/removed recorded source, corrupt ciphertext/tag, wrong provider AAD, and wrong key: only that stored key is unavailable; do not reveal decryption details or substitute another source.
- A read/decrypt failure for one provider: log one sanitized provider-scoped line and let the other provider resolve normally. Table absence degrades to no stored key and `/health` reports the required missing table.
- Invalid provider, key-requiring provider mismatch, invalid key, disabled storage, and persistence failure: return only the specified closed error codes; never expose thrown database/crypto text.
- Replacing a key is an upsert. Clearing deletes only that provider's encrypted row and restores that provider's environment fallback. No plaintext is stored, returned, rendered, or logged.
- Unexpected fake key/master/ciphertext leakage in any output is a test failure; assertions must not themselves print the tested secret if they fail.
- `baseUrl` and other extra form fields cannot alter adapter or endpoint selection. No AI/provider request occurs during save, clear, status rendering, health checks, or provider resolution tests.
- No agent reads real `.env*`, any credential, environment variable value, Neon row, or `ai_provider_keys` data; no live key is requested. No migration is applied to Neon and no Vercel setting is changed.
