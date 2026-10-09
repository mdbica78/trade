# US-056 — independent review

## Round 1 — 2026-10-06
Verdict: PASS

Scope read: `AGENTS.md`, `dev_minions/backlog/stories/US-056.md`, `dev_minions/verification/US-056-plan.md`,
`dev_minions/decisions/DEC-026-more-ai-providers.md`, `dev_minions/HANDOVER.md` ("Files changed (US-056, in
flight)"). Every file listed there was read in full; a repo-wide grep for the story's new symbols
(`OPENAI_COMPATIBLE_PRESET*`, `testConnectionAction`, `connection-test`, `CONNECTION_TEST_CODES`,
`modelStrengthHint`, each new `*_CHAT_COMPLETIONS_URL`) returned exactly the files on that list (plus
`dev_minions/.checkpoint.md`/`HANDOVER.md`/`US-056-plan.md`, which are process files) — no file outside the
declared list was touched for this story.

### Acceptance criteria

- **AC1** (gates pass; no behaviour test loosened; deliberate test changes listed with reason) — **MET**.
  - `pnpm typecheck`: 0 errors (re-run by me, this round).
  - `pnpm lint`: 0 errors, 13 warnings — the two new ones are `app/admin/ai/actions.ts:53-54` on
    `testConnectionAction`'s unused `_prev`/`_formData`, same style as the file's sibling actions (re-run by me,
    this round; matches HANDOVER's count exactly).
  - I ran the 15 directly-affected test files myself (not the full suite — that is the tester's gate per my
    brief): `lib/ai/provider-catalog.test.ts`, `lib/ai/providers/presets.test.ts`, `lib/ai/connection-test.test.ts`,
    `lib/ai/provider-presets.pglite.test.ts`, `lib/ai/providers/openai-compatible.test.ts`,
    `lib/ai/provider-deps.interchange.test.ts`, `app/admin/ai/actions.test.ts`,
    `app/admin/ai/result-messages.test.ts`, `app/admin/ai/page.test.tsx`,
    `app/admin/ai/test-connection.flow.test.tsx`, `components/admin/ActionMessage.test.tsx`,
    `components/admin/AiProviderModelFields.test.tsx`, `components/admin/AiSettingsAdmin.test.tsx`,
    `lib/ai/boundaries.test.ts`, `app/actions.boundary.test.ts` → **15 files / 246 tests, all green**.
  - I separately re-ran every file the plan (§3) says must stay byte-identical for AC4:
    `lib/ai/capabilities/boundaries.test.ts`, `lib/config/boundaries.test.ts`, `lib/ai/key-status.test.ts`,
    `lib/ai/key-store.test.ts`, `lib/ai/key-store.pglite.test.ts`, `lib/config/ai-keys.test.ts`,
    `lib/config/ai-keys.pglite.test.ts`, `lib/ai/provider-deps.test.ts`, `lib/ai/provider-deps.pglite.test.ts`,
    `lib/ai/providers/registry.test.ts`, `lib/ai/providers/groq.test.ts`, `lib/ai/providers/gemini.test.ts`,
    `lib/ai/env-example.test.ts` → **13 files / 116 tests, all green**. I cannot confirm "byte-identical" against
    a prior revision myself (git diff is off-limits), but their content and pass count are consistent with no
    edit; none of them is on HANDOVER's "Files changed" list either.
  - I did not run `pnpm build`, the full `pnpm test` suite or `scripts/claude/predeploy-check.sh` myself (tester's
    gate); citing HANDOVER's reported numbers for those as "not re-run" rather than as my own evidence.
  - Deliberate test changes: I independently found and verified each of the 7 listed changes plus the PMF-2
    fallout, by reading the actual test files (not by trusting the list): `lib/ai/provider-catalog.test.ts`
    (PC-1 now 8 ids, PC-3 "exactly 8", `findProvider`'s unknown-id case now `"anthropic"`),
    `app/admin/ai/page.test.tsx` (PA-7/PA-7b now use `anthropic`/`cohere`, new PA-7c covers `mistral`/`openrouter`
    positively, `vi.mock("./actions")` factory has `testConnectionAction: vi.fn()`),
    `components/admin/AiSettingsAdmin.test.tsx` (`props()` fixture has `testConnectionAction`),
    `app/actions.boundary.test.ts` (`ALLOWED_LIB_PREFIXES` has `"lib/ai/connection-test"`),
    `components/admin/AiProviderModelFields.test.tsx` (PMF-2 now uses `"anthropic"` instead of `"openai"`). Every
    one preserves the original test's intent (an unknown id/provider is still rejected/shown as unknown); none
    weakens an assertion. No other existing assertion in any of these files was changed.

- **AC2** (catalogue/registry ids match; each new preset's endpoint is a code constant; no URL field in the form)
  — **MET**.
  - `lib/ai/provider-catalog.ts:19-89` lists the 8 DEC-026 ids in order; `lib/ai/providers/registry.test.ts`
    PR-5 (unchanged test, line 37-40) asserts `SHIPPED_PROVIDER_ADAPTERS`/the real registry's ids equal
    `PROVIDER_IDS` — passes over all 8 now that the catalogue grew, with no test edit needed.
  - `lib/ai/providers/openai-compatible.ts:57-75` has the six endpoints as exported `*_CHAT_COMPLETIONS_URL`
    constants, each used exactly once in the `OPENAI_COMPATIBLE_PRESETS` table — proven by
    `lib/ai/providers/presets.test.ts` PS-0..PS-6 (ids match catalogue minus gemini/groq; URL shape; exactly 6
    `https://` literals in the file, each the value of an exported constant; one POST per preset to its own
    constant, ignoring an injected `baseUrl`/`url` context member; `openai` alone uses
    `max_completion_tokens`).
  - No URL/`baseUrl` field anywhere in the form: `components/admin/AiProviderModelFields.tsx` renders only
    `provider`/`model`; `app/admin/ai/page.test.tsx` PA-4 (unchanged) still pins the exact input/select name set
    `["provider","model","providerId","key"]`; `app/admin/ai/actions.test.ts` TC-1 (new) proves
    `testConnectionAction` ignores a `baseUrl`/`apiKey` field even if a form were to send one, and calls
    `testProviderConnection` with zero arguments.

- **AC3** (Test connection shows OK / closed code with fake fetch; never raw text or a key) — **MET**.
  - `lib/ai/connection-test.ts` builds its result field-by-field (`{ ok: true }` or `{ ok: false, code }`),
    never spreading the provider call or generation result — confirmed by reading the file; `sendProviderRequest`
    (`lib/ai/providers/http.ts:31-82`) never lets a raw body/text/status reach the caller on any path.
  - `lib/ai/connection-test.test.ts` CT-1..CT-9 (I ran these, 9 tests, all pass) prove the ok path, every HTTP
    failure code, invalid-JSON/empty-content/network/timeout, every early resolve failure with zero fetch calls,
    stored-key precedence in the header, Gemini routing, exactly-one-call, a propagating `loadSettings`
    rejection, and the exact 12-entry closed code set — each with an explicit `JSON.stringify(result)` /
    `Object.keys` check that no raw-body or key sentinel ever appears.
  - `app/admin/ai/test-connection.flow.test.tsx` TF-1/TF-2 (ran, 5 tests pass) exercise the real action → real
    `connection-test` → real default registry/adapter over a fake fetch whose error body embeds both a raw-text
    sentinel and a key sentinel, rendered through the real `ActionMessage` in both locales: the HTML contains the
    closed code and neither sentinel.
  - UI: `components/admin/AiSettingsAdmin.tsx:62-66` renders the Test-connection button only when
    `settings.status === "ok"`, confirmed by `app/admin/ai/page.test.tsx` PA-14 (ran) in both locales; `maxDuration
    = 60` in `app/admin/ai/page.tsx:17` with `AI_PROVIDER_TIMEOUT_MS = 20_000` (`lib/ai/providers/run-generation.ts:11`),
    both checked directly and by PA-13 (ran).

- **AC4** (key boundary tests unchanged and green; stored-key precedence works for the new presets) — **MET**.
  - The 13 files the plan names as "must stay byte-identical" (listed under AC1 above) all pass unchanged; none
    is in HANDOVER's "Files changed" list, and my own repo-wide symbol grep found no edit to them for this story.
  - `lib/ai/provider-presets.pglite.test.ts` PP-1/PP-2/PP-3 (ran, 13 tests, real PGlite + real encryption +
    real default registry) prove, for each of the six new ids: a stored key wins over a different env fake in
    `loadActiveProvider` and reaches the adapter's `authorization` header; `getProviderKeyStatusViews` reports
    `source: "stored"` for the one with a saved key and `"environment"` for the rest; `saveProviderKey` accepts
    each new id through the real `createAiKeyConfigDeps`.
  - `lib/ai/provider-deps.interchange.test.ts` IC-4 (ran) independently proves, through the real
    `loadActiveProvider`/`runGeneration`, that settings alone route a real fetch call to each preset's own URL
    carrying only that preset's own sentinel key.
  - `lib/ai/boundaries.test.ts` (ran, 2 new files added to its own `LB-0` existence floor list, `LB-1..LB-11` all
    still pass): `connection-test.ts` imports only already-allowed targets
    (`./provider-deps`, `./providers/run-generation`, `./providers/resolve`, `./providers/types`); it mentions
    the word "fetch" nowhere (confirmed by reading the file, and `LB-2-fetch`'s rule for non-provider,
    non-provider-deps files would fail otherwise); `app/actions.boundary.test.ts`'s `ALLOWED_LIB_PREFIXES` gained
    exactly the one new entry the plan names.

### Non-negotiable rules (AGENTS.md)
No AI used for extraction (not touched). One adapter per report format (not touched). No UI string bypasses
next-intl: every new string (`modelStrengthHint`, `testConnectionSubmit`, `testConnectionHint`, `connectionOk`,
`connectionFailed`) is present in both `messages/en.json` and `messages/ro.json` with matching placeholders —
confirmed by direct grep of both files. No secret read, logged or printed by this round's commands. No test
weakened or skipped (see AC1's deliberate-change audit above). No scope creep (confirmed by the repo-wide symbol
grep above matching HANDOVER's file list exactly). `lib/config/` still never imports `lib/ai` — unaffected by
this story's files.

### Findings
No Critical, no Warning.

- **Note (non-blocking):** AC4's "byte-identical" claim for the 13 key-boundary test files cannot be
  independently verified against a prior revision without `git diff`, which is off-limits. I verified instead
  that (a) none of the 13 files appears on HANDOVER's "Files changed" list, (b) my own repo-wide grep for every
  new symbol this story introduces found no match inside any of the 13 files, and (c) all 13 pass. That is as
  strong a guarantee as is available under the no-git rule, but it is indirect rather than a direct diff.
- **Note (non-blocking):** M-1/M-2/M-3 (live-provider checks) are correctly left as MANUAL-QA in the plan and not
  claimed as met by any local evidence — consistent with the acceptance criteria, which do not require a live
  call.

Denied or attempted commands: none.

## Round 2 — 2026-10-08
Verdict: PASS

Scope: QA-reopened findings #8/#9 in `US-056-qa-run.md` (the no-database `/admin/ai` failure and
the Test Connection control on the settings-load-error page), plus regression safety for the
round-2 changes. Read the updated `HANDOVER.md` round-2 summary, the QA finding, the source and
test changes, and the page/components that consume the result.

### Acceptance criteria

- **AC1** — **MET for the reviewed changes.** The implementation adds a targeted missing-database
  regression rather than weakening existing assertions. I ran
  `corepack pnpm exec vitest run lib\ai\provider-deps.custom.test.ts app\admin\ai\page.test.tsx`
  with database, cron, master-key and provider-key variables removed: **2 files / 34 tests passed**.
  I did not independently rerun typecheck, lint, the full suite, build or predeploy in this review;
  those gates remain for the independent test verdict.
- **AC2–AC4** — **MET, carried forward from Round 1.** The round-2 changes are confined to custom
  provider view loading and its test; they do not alter the preset catalogue/registry, Test
  Connection implementation or provider-key resolution/boundaries reviewed in Round 1.

### QA-reopened findings

- **Finding #8 — no-database `/admin/ai` returns 500:** **MET.** In
  `lib/ai/provider-deps.ts`, `getCustomProviderViews` now acquires the database and constructs
  its default list/reader inside the existing `try`. Thus a synchronous `getDb()` failure follows
  the same sanitized `logLoadError("ai/custom-providers", error)` and `{ status: "error" }` path
  as list failures. The page's other database reads are already guarded (`loadOrError` for
  settings; `getProviderKeyStatusViews` has its own catch). `CustomProvidersAdmin` renders a
  localized load-error state for this status, so this missing-database rejection no longer escapes
  the page's `Promise.all`.
- **Finding #9 — Test Connection absent on the settings-load-error page:** **MET.** The page passes
  `{ status: "error" }` for failed settings loads, and `AiSettingsAdmin` renders its load error
  instead of the settings form and Test Connection form in that state. Existing PA-14 asserts the
  button/hint are absent for both locales; it passed in the focused run.
- **PDX-8** in `lib/ai/provider-deps.custom.test.ts` invokes the real helper with
  `DATABASE_URL` empty, expects the safe error status, exactly one log line naming
  `MissingDatabaseUrlError`, and verifies the connection-string error text is absent. This directly
  covers the prior uncaught `getDb()` path.

### Findings

No Critical, Warning, or new Note.

The reviewer test command passed; its first invocation through the test tool found no tests, and
the Windows shell did not have `pnpm` on PATH. The successful Corepack invocation ran the
focused suite. These were tooling limitations, not denied or prohibited commands.

Denied or attempted commands: none.
