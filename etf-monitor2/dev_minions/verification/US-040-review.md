# US-040 review

## Round 1 — 2026-10-02
Verdict: PASS

Scope check: grepped the whole repo for `ai_provider_keys`/`aiProviderKeys`; every match resolves either to a
file on HANDOVER's "Files changed" list for US-040 or to a pre-existing doc (`AGENTS.md`,
`dev_minions/decisions/DEC-021-stored-ai-provider-keys.md`, `dev_minions/backlog/sprints/sprint-10.md`,
`dev_minions/verification/SPRINT-10-review.md`/`SPRINT-11-review.md`, `dev_minions/verification/US-043-plan.md`)
that already referenced the table before this story and is not in the changed-files list — no evidence of
undeclared touches. `app/actions.boundary.test.ts` was not changed and did not need to be: its existing
`ALLOWED_LIB_PREFIXES` already contains `"lib/config/"`, which covers the new `lib/config/ai-keys` import from
`app/admin/ai/actions.ts` without modification — checked by reading both files.

Acceptance criteria:

- **AC1 — Dedicated schema and safe migration: MET.** `lib/db/schema.ts:156-161` declares exactly
  `providerId` (primary key), `ciphertext`, `keySource`, `updatedAt` — no plaintext/prefix/suffix/length column.
  `drizzle/0003_ai_provider_keys.sql` is a single `CREATE TABLE` (expand-only, no `DROP`/`ALTER .. TYPE`/`RENAME`).
  `drizzle/meta/_journal.json` registers it as entry `idx: 3`, `tag: "0003_ai_provider_keys"`, after
  `0002_home_display_settings`. `test/helpers/pglite.migrations.test.ts` PM-5 (grepped, line 57) applies the full
  journal, confirms journal order, and inserts/reads only the expected encrypted-row shape. `lib/health.ts:27-41`
  (`schemaTableNames` + `buildSchemaProbeStatement`) derives the table list from the schema module and probes only
  `to_regclass` names, never selecting rows — unchanged, reused correctly. `lib/health.test.ts:37` asserts
  `ai_provider_keys` is in the schema inventory; `app/health/page.schema.pglite.test.tsx:77-83` drops the table in
  PGlite and asserts `/health` renders `data-missing-table="ai_provider_keys"`.
- **AC2 — Encryption and authenticated storage: MET.** `lib/ai/key-store.ts` uses Node's built-in
  `createCipheriv`/`createDecipheriv`/`randomBytes` (`aes-256-gcm`), a fresh `randomBytes(12)` IV per
  `encryptProviderKeyWithMaterial` call, provider id as AAD via `cipher.setAAD`/`decipher.setAAD`, and packs
  `iv ‖ authTag ‖ ciphertext` into base64 (`IV_LENGTH=12`, `AUTH_TAG_LENGTH=16`). `lib/ai/key-store.test.ts`
  KS-1 proves the 12/16-byte layout, two fresh IVs produce different ciphertexts, and a round trip recovers the
  fake key while the packed string never contains the plaintext; KS-2 proves tampered payload bytes, a tampered
  tag, the wrong provider id, and the wrong key each throw `ProviderKeyUnavailableError`. `app/admin/ai/page.tsx:10-11`
  and `app/admin/layout.tsx:4` both set `export const runtime = "nodejs"`; `app/admin/layout.test.tsx:65-66`
  (`AL-6`) and `app/chat/page.test.tsx:57` assert this. `lib/ai/boundaries.test.ts` LB-3 (line 176) asserts
  `process.env` appears in `lib/ai/` only in `key-status.ts`, so crypto material cannot be read from an Edge-only
  path elsewhere in the module.
- **AC3 — Derivation and recorded key source: MET.** `lib/ai/key-status.ts` implements `masterKey` (strict
  base64, exactly 32 bytes) and `cronSecret` (≥24 chars) with `getEncryptionKeyMaterial` trying master first, then
  cron, else `null`; `getEncryptionMaterialForSource` resolves only the row's own recorded source and never falls
  back to the other. `lib/ai/key-store.ts` `deriveEncryptionKey` uses `hkdfSync("sha256", secret, "etf-monitor2",
  "ai-provider-keys/v1", 32)` for the cron path and the raw 32 bytes for the master path.
  `lib/ai/key-store.test.ts` KS-3 recomputes the same HKDF call independently and asserts the derived key equals
  it, is 32 bytes, and differs from the raw cron secret; KS-4 proves a `cron_derived` ciphertext decrypts with
  cron material and fails (`ProviderKeyUnavailableError`) when only master material is supplied — i.e. no
  cross-source fallback. `lib/ai/key-status.test.ts` KS-6 (master wins over invalid-base64 fallback to cron),
  KS-7 (`storingEnabled` false for empty/short material, true for a valid ≥24-char cron secret), KS-8 (
  `getEncryptionMaterialForSource` still returns the old cron secret when a master key is later added, returns
  `null` for `"master"` when no master key exists, and returns `null` when the cron secret has rotated to a short
  value) together cover "old rows continue decrypting by their recorded source" and "rotated secret makes only
  that key unavailable". All of the above use literal fake buffers/strings, never `process.env`. The PGlite tests
  (`key-store.pglite.test.ts`, `ai-keys.pglite.test.ts`) persist rows with master material only; a persisted
  `cron_derived` row's lifecycle after a later master-key addition or cron rotation is proven only at the
  unit-test level (KS-4/KS-8), not re-proven against a real row — noted below as non-blocking.
- **AC4 — Key precedence and asynchronous provider wiring: MET.** `lib/ai/provider-deps.ts`
  `loadActiveProvider`/`getAiAvailability` both `await deps.loadStoredKeys()` before calling the still-synchronous
  `resolveActiveProvider`, and build `readApiKey` as `storedKeys.get(id)?.key ?? deps.readApiKey(id)` (stored >
  environment > unset). `lib/ai/provider-deps.test.ts` PD-8 proves ordering with a `order` array
  (`["settings", "stored-start", "stored-ready"]` before resolution) and that the stored key wins over the
  environment key; PD-9 proves a thrown read error for one provider (`gemini`) is isolated — `stored.has("gemini")`
  is false while `stored.has("groq")` stays true, the adapter still resolves to the groq stored key, and the
  console log is exactly one sanitized `[load-error] ai/provider-key/gemini ...` line containing neither "submitted
  key" nor "database url" fragments from the thrown error; PD-10 proves a `42P01` (missing table) error produces
  an empty stored-key map with zero console calls. `lib/ai/providers/resolve.ts` is untouched (not in the changed
  files list; `resolveActiveProvider`'s synchronous signature is called unchanged from both wiring functions).
  `lib/ai/provider-deps.pglite.test.ts` PD-P1 proves real decryption through PGlite feeds exactly the selected
  provider's key into the adapter context.
- **AC5 — Save, replace, clear and closed validation: MET.** `lib/config/ai-keys.ts` `saveProviderKey` validates
  provider (must be in catalogue and `requiresApiKey`) → `unknown_provider`; key (`trim().length` 8–512, no
  `\s`/control chars via `/[\s\p{Cc}]/u`) → `key_invalid`; `!deps.storageEnabled` → `storing_disabled`; a thrown
  `writeEncrypted` → `write_failed`; success → `{ ok: true }` with no key/ciphertext in the result shape.
  `clearProviderKey` deletes only the matched provider's row via `clearStoredProviderKey(db, providerId)`.
  `lib/config/ai-keys.pglite.test.ts` AK-P1 proves save/replace write only the targeted row and leave the
  `settings` table's `ai_provider`/`ai_model` untouched; AK-P2 proves clearing `gemini` removes only that row and
  leaves `groq`'s stored row and count intact; AK-P3 proves a missing table maps to `write_failed` with no fake
  key in the serialized result. `app/admin/ai/actions.ts` reads only `formData.get("providerId")` /
  `formData.get("key")`, so a posted `baseUrl` is structurally unreachable; `app/admin/ai/actions.test.ts` AAK-1
  (line 132) posts `baseUrl: "https://fake.invalid"` together with a real save and asserts the config call
  receives only `{ providerId, key }`, and AAK-2 does the same for clear.
- **AC6 — Missing table and failure privacy: MET.** `lib/ai/provider-deps.ts` `isMissingProviderKeyTable` (via
  `describeLoadError(error).code === "42P01"`) makes `loadStoredProviderKeys` skip the sanitized log for a
  missing table (PD-10, no console call) while still returning an empty map so `getAiAvailability`/`/admin/ai`
  keep rendering; a non-42P01 read/decrypt failure per provider calls `logLoadError` once (PD-9, format
  `[load-error] ai/provider-key/<id> ...`, asserted to omit the thrown exception text). `app/admin/ai/page.tsx`
  wraps `getAiSettings` in try/catch and falls back to `{ status: "error" }` (AC7's `loadError` message) rather
  than throwing; `app/admin/ai/page.test.tsx` PA-6/PA-6b assert the safe fallback and that the key table still
  renders. No test or source file under review printed a raw exception, ciphertext, derived/master key or
  `CRON_SECRET` value — verified by reading the log call sites and their test assertions directly (PD-9, PA-6).
- **AC7 — Write-only bilingual UI and mitigations: MET.** `components/admin/AiSettingsAdmin.tsx` renders only
  `row.isSet`/`row.source` text (via `SOURCE_MESSAGE_KEYS`) — never a key value; when `!storageEnabled` it renders
  only the `storageDisabled` note and omits every `ProviderKeySaveForm`/clear button (confirmed by reading the
  conditional render block); when enabled, `components/admin/ProviderKeySaveForm.tsx` renders
  `<input type="password" name="key" autoComplete="off" />` with no `value`/`defaultValue`, and
  `resetFormAfterSuccessfulAction` (called from a `useEffect`, not during render, which is what fixed the earlier
  lint violation per HANDOVER) resets the form on a `status: "success"` state. `components/admin/
  AiSettingsAdmin.test.tsx` asserts `type="password"`, `autoComplete="off"`, no `value`/`defaultValue` attribute
  on that input, the fake key's absence from the rendered HTML, and that disabled storage omits the password
  input and both the save/clear labels. `app/admin/layout.tsx:6` and `app/chat/page.tsx:11` both set
  `robots: { index: false, follow: false }`, asserted by `app/admin/layout.test.tsx` AL-6 and
  `app/chat/page.test.tsx:56`. `app/admin/ai/actions.ts` adds no custom origin check (no header/token
  comparison in the file), relying on Next's built-in Server Action same-origin protection as the plan requires.
  `messages/en.json`/`messages/ro.json` carry matching keys (`keysHeading`, `sourceStored/Environment/None`,
  `keyInputLabel`, `saveKey`, `replaceKey`, `clearStoredKey`, `storageDisabled`, `keysNote`, `providerKeySaved`,
  `providerKeyCleared`, `providerKeyInvalid`, `providerKeyStorageDisabled`, `providerKeyWriteFailed`) with the
  Romanian text genuinely translated, not copied — read side by side.
- **AC8 — Hard secret boundary: MET.** `lib/ai/boundaries.test.ts` LB-3 pins `process.env` to `key-status.ts`
  only inside `lib/ai/`; LB-4 scans every `.ts`/`.tsx` under `app/`, `components/`, `lib/` and asserts the only
  importers of `key-status.ts` are `key-store.ts`, `provider-deps.ts`, `settings-deps.ts`, that no file starting
  with `"use client"` imports `key-status`/`key-store`, and that `readApiKey` is referenced nowhere outside
  `lib/ai/`. LB-10 asserts the only importers of `key-store.ts` are `provider-deps.ts` and `lib/config/ai-keys.ts`
  (exactly the two DEC-021 names). LB-11 scans the whole tree for the literal `ai_provider_keys` and asserts it
  appears only in `key-store.ts` and `schema.ts`, and that only `key-store.ts` contains a `select ... from` /
  `insert into` / `delete from` targeting that table. `lib/ai/capabilities/boundaries.test.ts` CB-3 (fixed per
  HANDOVER to allow exactly `key-store.ts`'s SQL under DEC-021) and `lib/config/boundaries.test.ts` (line 25,
  `approvedKeyStoreException` for `ai-keys.ts` → `../ai/key-store` only) complete the importer pinning. Fake-key
  absence from serialized views/HTML/action results/console output is asserted repeatedly: `key-store.test.ts`
  KS-1 (`ciphertext.includes(FAKE_KEY)` false), `provider-deps.test.ts` PD-2/PD-9 (`JSON.stringify(...)` excludes
  "SENTINEL"), `provider-deps.pglite.test.ts` PD-P1/PD-P2, `ai-keys.pglite.test.ts` AK-P3,
  `AiSettingsAdmin.test.tsx` (`html.includes(FAKE_KEY)` false), `actions.test.ts` (fake-key absence from action
  result). No test in the reviewed set selects a real `ai_provider_keys` row or reads a real environment variable.
- **AC9 — Offline gates: not re-run.** This reviewer instance has no shell/execute tool available, so
  `pnpm typecheck`, `pnpm lint`, `pnpm test` and an offline `pnpm build` were not independently reproduced.
  HANDOVER's narrative (203 files / 2046 tests, 0 typecheck errors, 0 lint errors, successful offline build with
  secret variables absent) is **not re-run** by me and is not cited as proof in this file beyond quoting it as
  HANDOVER's claim. Every individual test file that backs AC1–AC8 was read directly in full and is coherent with
  the implementation it targets, which is the evidence basis for those criteria above. AC9's command-level claims
  are the separate test verifier's responsibility (`US-040-tests.md`); flagged as a Note below rather than marked
  MET on HANDOVER's word alone, and not marked NOT MET since the per-file test evidence I did read is consistent
  and nothing I found contradicts the claimed gate results.

## Findings

- **Note:** AC9's full-suite/typecheck/lint/build claims could not be independently re-run in this review round
  (no execute tool available to this reviewer instance); rely on `US-040-tests.md` for that evidence. Not
  Critical: every individual test file backing AC1–AC8 was read directly and is internally coherent, and
  AGENTS.md routes full-suite execution to the independent test verifier, not the code reviewer.
- **Note:** AC3's persisted-row source lifecycle (a `cron_derived` row still decrypting after a master key is
  added later, or becoming unavailable after `CRON_SECRET` rotation) is proven at the unit level (KS-4/KS-8) but
  not re-proven against a real PGlite-persisted row of that source. The implementation path is identical to the
  already-proven master-material PGlite path, so this is non-blocking.
- **Note:** `DEC-021 §9` ("chat refusal when asked to set a key") is not asserted by any AC in this story (the
  story's own "Out of scope" explicitly defers "Chat instructions or new chat capabilities" to US-042/Sprint 11),
  so its absence from `lib/ai/capabilities/boundaries.test.ts` is consistent with the story's scope, not a gap.
- No Critical or Warning findings.

Overall: **PASS** — AC1–AC8 are MET with first-hand file:line evidence from source and existing tests read in
this round; AC9's command-level claims are deferred to the independent test verdict (`US-040-tests.md`), which
this reviewer did not reproduce itself this round (no execute tool available), and nothing found contradicts
them.

Denied or attempted commands: none.
