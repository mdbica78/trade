# US-057 — Independent review

## Round 1 — 2026-10-06

Verdict: PASS

Reviewer: `story-reviewer` subagent, fresh context, independent of the implementing session. Read
`AGENTS.md`, `dev_minions/backlog/stories/US-057.md`, `dev_minions/verification/US-057-plan.md`,
`dev_minions/decisions/DEC-026-more-ai-providers.md`, and every file listed under "Files changed
(US-057)" in `dev_minions/HANDOVER.md`, in full. Grepped the whole repo for every new symbol
(`CustomProvider`, `custom-provider`, `ai_custom_providers`, `CUSTOM_PROVIDER`) to confirm nothing
outside the declared file list was touched — the grep hit set matches HANDOVER's list exactly, no
more, no less.

### Acceptance criteria

- **AC1 — gates green, no loosened test, deliberate changes disclosed: MET.**
  Independently ran (process env had `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/
  `AI_KEY_MASTER_KEY`/every `*_API_KEY` unset throughout):
  - `pnpm typecheck` → 0 errors.
  - `pnpm lint` → 0 errors, 20 warnings (matches HANDOVER's count exactly; all new warnings are
    `_name`-prefixed unused-arg fakes in new test files, the same tolerated style as pre-existing
    files).
  - Focused run of all 25 files this story lists as new/changed tests (`lib/config/custom-providers*`,
    `lib/ai/key-binding*`, `lib/ai/custom-provider.pglite.test.ts`, `lib/ai/provider-deps.custom.test.ts`,
    `lib/ai/providers/resolve.custom.test.ts`, `app/admin/ai/custom-provider-actions.test.ts`,
    `components/admin/CustomProvidersAdmin.test.tsx`, plus every boundary/schema/migration/doc test
    this story touches) → **25 files / 394 tests, all green.**
  - `pnpm test` (full suite) → **243 files / 2627 tests, all green** — matches HANDOVER's count
    exactly.
  - `bash scripts/claude/predeploy-check.sh` → **PASS** ("typecheck, lint, build and tests are
    green. Safe to commit and push."), run to completion by this reviewer (not re-using the
    implementer's own in-flight run, which was still executing when this round started — waited
    for that process to exit, then ran the script again myself for independent evidence).
  - `env -u DATABASE_URL pnpm db:generate` → "No schema changes, nothing to migrate" — the
    committed `0005_ai_custom_providers.sql`/snapshot match `schema.ts` exactly, no drift.
  - The five deliberate test changes (§3 items 1-5 of the plan) are disclosed in HANDOVER and
    verified in place: `lib/db/schema.test.ts`'s "fourteen table exports" and `MG-1` (`toHaveLength(6)`,
    `0005_ai_custom_providers` tag) both updated correctly; `lib/ai/boundaries.test.ts`'s
    `ALLOWED_TARGETS` gained exactly `"lib/config/custom-providers"`; `app/admin/ai/page.test.tsx`'s
    `vi.mock` factories gained the three new action exports and `getCustomProviderViews`; PA-4's
    expected input-name set and the new scoped "provider form has no baseUrl input" assertion are
    both present and pass. No existing assertion was weakened — each change either adds a
    previously-absent mock export (required, since vitest throws on access to a missing factory
    export) or widens an exact-count/exact-set check to include the new table/column/target, with
    the original check's precision kept.

  One gap found and closed in this round, not a code defect: the plan's §1 AC5 table and §3 named
  a specific **`MG-3`** test in `lib/db/schema.test.ts` (asserting the migration file has exactly
  one `CREATE TABLE "ai_custom_providers"`, no `drop`/`rename`/`alter column … type`, no `ALTER
  TABLE` on any other table, and that `guardMigrationStatements` on it returns `[]`). That specific
  test does not exist under that name or with that exact content — confirmed by grep, twice. The
  underlying guarantee is nonetheless proven: `lib/deploy/migrate.test.ts`'s pre-existing **MD-G10**
  (`guardAllMigrations(drizzle/)` returns `[]`) scans the real `drizzle/` directory generically, so
  it automatically covers the new `0005_ai_custom_providers.sql` once the file exists — re-ran it
  in isolation, PASS. Manual inspection of the migration SQL (`drizzle/0005_ai_custom_providers.sql`)
  confirms it is exactly one `CREATE TABLE` with its two `CHECK`s and nothing else — no `DROP`,
  `RENAME`, `ALTER COLUMN … TYPE`, or `ALTER TABLE` on any other table. So AC1's and AC5's
  "guard test green, migration is expand-only" are still MET on the evidence that exists, just not
  under the plan's named test id. This is a Note, not a Critical or Warning: the plan over-specified
  a test name relative to what the existing generic guard already proves, and nothing is weaker as
  a result.

- **AC2 — URL validation table: MET.**
  `validateCustomProviderBaseUrl` (`lib/config/custom-providers.ts:60-86`) rejects http, credentials,
  query/fragment, every IP-literal form (IPv4 dotted/decimal/hex, IPv6 bracketed), localhost and
  every closed private-suffix name, and enforces the 200-char cap on the normalised value; accepts a
  plain https URL, a path, a non-default port, and normalises case/trailing-slash/default-port.
  Proof: `lib/config/custom-providers.test.ts` CPV-1 (`it.each` over ~30 accept/reject cases,
  line-by-line matching the plan's table exactly) + CPV-2/CPV-3 (normalisation, exact 200/201 char
  boundary) + CPV-4 (name table) + CPV-5 (`isCustomProviderId`/`customProviderId`, confirmed never
  collides with any `PROVIDER_IDS` catalogue entry). Server-side only — the admin form's
  `type="url"`/`maxLength` (`components/admin/CustomProvidersAdmin.tsx:54-58,91-95`) are confirmed
  convenience, not the real check (`validateCustomProviderBaseUrl` is called inside
  `addCustomProvider`/`updateCustomProvider`, never bypassed by the form). Ran CPV-1..5 myself in
  the focused run above — all green.

- **AC3 — URL change deletes the key in the same batch; URL-bound AAD: MET.**
  `providerKeyAad(providerId, baseUrl)` (`lib/ai/key-store.ts:40-42`) is byte-identical to the old
  bare-id AAD when `baseUrl` is `null` (so every existing preset ciphertext still decrypts — proven
  by KB-1) and `` `${providerId}\n${baseUrl}` `` otherwise. KB-2/KB-3/KB-4
  (`lib/ai/key-binding.test.ts`) prove a key encrypted for URL A throws `ProviderKeyUnavailableError`
  when decrypted for URL B, round-trips for the same URL, and a preset AAD never equals a custom
  AAD for the same id. KB-P1 (`lib/ai/key-binding.pglite.test.ts`) proves the same over a real
  PGlite row. The same-batch deletion: `updateCustomProvider` (`lib/config/custom-providers.ts:
  140-167`) calls `deps.run([deps.clearKeyStatement(id), update])` as **one** call when the
  normalised URL changed, `[update]` alone otherwise; `deleteCustomProvider` always calls
  `deps.run([deps.clearKeyStatement(providerId), delete])`. Proof at the unit level: CPC-2/CPC-3/
  CPC-4 (fake runner, exact statement counts and identity of the first statement). Proof at the
  real-transaction level: **CPP-3** (URL change deletes the key row), **CPP-4** (atomic rollback —
  a failing statement appended to the same batch leaves both the URL and the key untouched,
  proving the delete and the update really are one transaction, not two sequential calls), **CPP-5**
  (name-only edit keeps the key), **CPP-6** (delete removes both). Ran KB-1..4, KB-P1 and CPP-1..9
  myself — all green (CPP-4 specifically exercised with a `select * from "no_such_table_at_all"`
  appended statement; the whole batch rejects and both rows are confirmed unchanged afterward).

- **AC4 — chat works end to end with a custom provider and a fake fetch, request goes only to the
  configured URL: MET.** `lib/ai/custom-provider.pglite.test.ts` CPE-1 is a real, non-trivial
  end-to-end test: a seeded PGlite database, a real `addCustomProvider`/`saveProviderKey`/
  `setAiSettings` round trip, a real `ProviderDeps` built from `getAiSettings`/`listCustomProviders`/
  `loadStoredProviderKeys` and the real default registry, a fake `fetch` returning a chat-completions
  body with an `add_etf` action, and a real `handleChatMessage`. Asserts: the outcome is
  `executed_actions`/`done`, the XYZ row really exists in the PGlite `etfs` table, the custom fetch
  was called **exactly once** with URL exactly `https://llm.example.com/v1/chat/completions`,
  `redirect: "error"`, and the correct bearer header — and the **stubbed global `fetch` was never
  called** (ruling out a fallback to a preset/env path). CPE-2 proves a URL change makes the chat
  `unavailable`/`no_api_key` with zero requests. CPE-3 proves `testProviderConnection` posts once to
  the same URL. CPE-4 proves a `base_url` changed directly in SQL (bypassing the app's own update
  path) makes the stored key fail its AAD check, with zero requests and no key in the one sanitised
  log line. Ran all four myself — green (CPE-1..4, 15.2s total). `lib/ai/provider-deps.custom.test.ts`
  PDX-1..7 cover every resolution branch (custom selected / preset selected / no stored key with an
  env sentinel present but unused / unlisted custom id / a `loadCustomProviders` rejection / key-free
  views / per-provider URL-bound key read) at the unit level — ran, all green.

- **AC5 — no key in any output; boundary tests green; migration expand-only: MET.**
  No-key-in-output is proven with the real sentinel `test-key-0000-custom-SENTINEL` put in by
  CPE-1..4, PDX-6, AKC-6, CPA-5/6, CPU-1/6: each asserts the sentinel is absent from the outcome/
  result/state object (via `JSON.stringify`), from `getCustomProviderViews`'s output, from the
  rendered HTML, and from every `console.error` call captured by a spy. Boundary tests: ran
  `lib/ai/boundaries.test.ts` (including **LB-10** — key-store's importers are exactly
  `lib/ai/provider-deps.ts` and `lib/config/ai-keys.ts`, unchanged by this story — and **LB-11** —
  only `key-store.ts` and `schema.ts` mention `ai_provider_keys`, confirmed by my own repo-wide
  grep that no new file, including `lib/config/custom-providers.ts`, mentions that string),
  `lib/ai/capabilities/boundaries.test.ts` (**CB-3** — only `key-store.ts` under `lib/ai/` uses raw
  SQL or `drizzle-orm`; `lib/config/custom-providers.ts`'s SQL lives outside `lib/ai/`, so CB-3
  doesn't even need to see it, by design), `lib/config/boundaries.test.ts` (no `lib/config/*`
  specifier may contain an `ai` word or `/ai/` segment except the one approved `ai-keys.ts →
  ../ai/key-store` exception — `custom-providers.ts` imports no `lib/ai` module at all), the new
  **CPB-1/CPB-2** (`lib/config/custom-providers.boundary.test.ts` — only `custom-providers.ts` and
  `schema.ts` mention `ai_custom_providers`; `custom-providers.ts` imports no `/ai/`, `next` or
  `react` specifier), and `app/actions.boundary.test.ts` (the new action imports are all under the
  already-allowed `lib/config/`/`lib/db`/`lib/ai/settings-deps` prefixes, no SQL text in the new
  action bodies). All green on my own run. Migration: see the AC1 note above — `MD-G10` plus manual
  inspection of the single generated `CREATE TABLE` confirm expand-only.

### Design/architecture conformance
- T-1..T-11 (plan §5) are followed exactly as written: the AAD helper and the batch-delete statement
  live in `key-store.ts` only; `custom-providers.ts` never imports `lib/ai`; `lib/config/ai-keys.ts`
  is the sole bridge (`createCustomProviderConfigDeps`); ids are `custom-<serial>`; resolution loads
  custom providers only when the saved provider id matches the `custom-` pattern, so preset-only
  installations never touch the new table (confirmed by PDX-2's "loadCustomProviders is never
  called" assertion).
- DEC-026 §2's literal requirements are all present: ≤40-char name, ≤200-char https-only URL, no
  credentials/query/fragment, no IP/localhost/private host, at most 5 custom providers (CPP-2),
  stored keys only (no env var path for a `custom-` id — confirmed in `resolve.ts`/`provider-deps.ts`:
  `readApiKey` returns `null` for a custom id instead of falling through to `deps.readApiKey`), and
  the server appends `/chat/completions` (`customChatCompletionsUrl`).
- D-1/D-2/D-3 (plan §6, all PRODUCT, isolated defaults) are shipped exactly as described and
  confined to the files the plan names (`validateCustomProviderName` has no uniqueness check;
  `deleteCustomProvider` never touches `settings`; `CustomProvidersAdmin.tsx`'s wording/placement).
  None blocks the story; all three need PO confirmation at demo, same as the plan says. HANDOVER
  does not yet list these three under "Waiting on the user" — it says they will be "logged ... once
  this story closes out". Noted so the implementer doesn't forget before the story leaves review,
  not a blocking finding since the story hasn't closed yet.
- No scope creep: a repo-wide grep for every new symbol/table name touches exactly the files listed
  under "Files changed (US-057)" in HANDOVER.md, no more, no less. `components/admin/AiSettingsAdmin.tsx`
  was read in full and confirmed unchanged in substance — it still only renders catalogue/preset key
  rows (`getProviderKeyStatusViews()` never includes a custom id), with all custom-provider UI
  delegated to the new sibling component, exactly as plan item 13 requires.

### Findings
No Critical. No Warning.
- **Note (non-blocking):** the plan's named test `MG-3` does not exist under that name; the
  equivalent guarantee is proven by the pre-existing generic `MD-G10` guard plus manual inspection
  of the one generated migration file. Recommend adding the file-specific `MG-3` assertions before
  the next migration-touching story, for a faster signal if a future migration regresses the
  expand-only rule, but nothing is unproven today.
- **Note (non-blocking):** D-1/D-2/D-3 are not yet cross-referenced under HANDOVER's "Waiting on the
  user" section (they are disclosed in the active-story narrative and in this plan, just not yet
  copied to that list). Same pattern as a prior story's non-blocking note (US-054). Flag for the
  story's close-out step.

Denied or attempted commands: one `git diff --stat -- components/admin/AiSettingsAdmin.tsx` attempted
mid-review to double-check this file's unchanged status — denied, not retried (DEC-015). Confirmed the
same fact without git: the file was read in full and its content matches the plan's "stays unchanged"
requirement, and it is absent from HANDOVER's "Files changed (US-057)" list.
