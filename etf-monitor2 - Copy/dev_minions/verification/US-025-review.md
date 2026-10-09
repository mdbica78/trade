# US-025 — Independent review

## Round 1 — 2026-09-27

Verdict: PASS

Reviewer: `story-reviewer` (fresh context), reading `dev_minions/backlog/stories/US-025.md` (incl. its
"## Tech-lead review 2026-09-26" section), `dev_minions/verification/US-025-plan.md`,
`dev_minions/decisions/DEC-017-ai-provider-layer.md` (referenced), AGENTS.md, and every file listed
under "Files changed (US-025, in flight)" in `dev_minions/HANDOVER.md`.

### Files read (= "Files changed" in HANDOVER.md)
`lib/ai/providers/types.ts`, `run-generation.ts`, `registry.ts`, `default-registry.ts`, `resolve.ts`,
`lib/ai/provider-deps.ts`, `test/helpers/ai-fakes.ts`, `lib/ai/providers/types.test.ts`,
`run-generation.test.ts`, `registry.test.ts`, `resolve.test.ts`, `lib/ai/provider-deps.test.ts`,
`lib/ai/key-status.ts` (+`readApiKey`), `lib/ai/key-status.test.ts` (KS-3..KS-5),
`lib/ai/boundaries.test.ts` (LB-0, LB-2, LB-4 revised, LB-5..LB-7 new, LB-1/LB-3 verbatim),
`lib/ai/provider-catalog.ts` and `lib/ai/settings-deps.ts` (read to confirm "not touched"),
`app/admin/ai/page.tsx` (read to confirm it still imports only `getKeyStatuses`), `package.json`
(read to confirm no new dependency), `test/helpers/module-specifiers.ts` (unchanged helper referenced
by the new boundary assertions).

Grep across `app/`, `components/`, `lib/config/`, and every other `lib/*` subtree for
`provider-deps|providers/resolve|providers/registry|providers/types|providers/run-generation|
providers/default-registry|readApiKey|loadActiveProvider|resolveActiveProvider|getAiAvailability`
found no matches outside `lib/ai/providers/*`, `lib/ai/provider-deps.ts` and
`lib/ai/boundaries.test.ts` — confirms the story's own scope claim ("Not touched: `app/**`,
`components/**`, `lib/config/**`, …") and that nothing new leaked into the rest of the tree.

### Acceptance criteria

- **AC1 (one adapter interface)** — MET. `lib/ai/providers/types.ts:1-33` defines the closed
  `PROVIDER_ERROR_CODES`/`ProviderErrorCode`, `GenerateRequest`, `ProviderCallContext`,
  `ProviderCallInput`, `GenerateResult`, `AiProvider` in one module with zero imports. Test:
  `lib/ai/providers/types.test.ts` `PT-1` (exact 7-code set incl. `model_not_found`, no duplicates),
  `PT-2` (no concrete-provider name, zero specifiers), `PT-3` (type-level key check), and the unnamed
  "a fake provider typed against AiProvider compiles and passes the wrapper's tests" case (line 34-38)
  which runs `test/helpers/ai-fakes.ts`'s `createFakeProvider` through `runGeneration`.
- **AC2 (wrapper never throws)** — MET. `lib/ai/providers/run-generation.ts:34-62`: owns its own
  `AbortController`, calls `generate` once via `Promise.resolve().then(...)` so both an async
  rejection and a throw inside the (necessarily `async`) fake become a rejection caught by `.catch`,
  a `setTimeout` race gives `timeout` and aborts the controller, `normaliseResult` rebuilds the
  object field-by-field so unknown codes/malformed shapes/extra fields become `provider_error` and
  are dropped. Tests: `run-generation.test.ts` `RG-1`..`RG-8` plus the unnamed "keys within
  {ok,text,error}" case — one test per required branch (ok pass-through, throw, timeout with
  `ctx.signal.aborted`, every one of the 7 codes, 4 malformed shapes + 1 extra-field case, no
  leftover timer). `RG-2`/`RG-6` assert `JSON.stringify(result)` never contains the sentinel/message.
- **AC3 (registry)** — MET. `lib/ai/providers/registry.ts:13-34`: `get`/`list` (frozen copy),
  construction throws on a duplicate id or an id absent from `PROVIDER_CATALOG`.
  `default-registry.ts:5` ships `SHIPPED_PROVIDER_ADAPTERS = []`. Tests: `registry.test.ts`
  `PR-1`..`PR-5` (incl. `PR-5` pinning the empty shipped registry, with a comment naming what US-026
  changes).
- **AC4 (resolution)** — MET. `lib/ai/providers/resolve.ts:21-62` implements the five-branch order
  (`not_configured` → `unknown_provider` → `not_implemented` → `no_api_key` → `no_model` → ok) inside
  a function that never throws (the `readApiKey` call is wrapped in `try/catch` at exactly the one
  step that needs it) and makes no network call (no `fetch` parameter in its input type — proven at
  the type level by the last `resolve.test.ts` case). Tests: `resolve.test.ts` `AR-1`..`AR-9`,
  covering every branch, the two multi-failure order cases (`AR-7`, `AR-7b`), and the throwing
  `readApiKey` (`AR-8`).
- **AC5 (key boundary)** — MET, with one Warning (W1, below). `lib/ai/key-status.ts:35-46` adds
  `readApiKey`, keeping `process.env` reads confined to `key-status.ts` (`LB-3`, byte-identical to
  before). `lib/ai/provider-deps.ts` is the single wiring module combining `loadSettings`,
  `readApiKey`, the registry and `fetch`; `loadActiveProvider` is key-carrying and stays in `lib/ai`,
  `getAiAvailability`/`toAvailability` build a key-free `AiAvailability` field-by-field
  (`resolve.ts:65-70`, "never by spreading the resolution"). Tests: `key-status.test.ts` `KS-3`
  (own-sentinel-only), `KS-4` (unset/blank/trim), `KS-5` (only catalogue ids, not `PATH` or the env
  var name itself); `provider-deps.test.ts` `PD-1` (key reaches `input.apiKey`), `PD-2` (5 failure
  cases, no sentinel in either `loadActiveProvider` or `getAiAvailability` output), `PD-3` (ok-case
  availability is exactly `{available,providerId,model}`, no sentinel), `PD-5` (an adapter that
  throws or returns an error never leaks a sentinel through `runGeneration`). `lib/ai/boundaries.test.ts`
  `LB-4` (revised) and `LB-5` (new) enforce the import/reference boundary — see W1 for a scope gap
  found in `LB-4`.
- **AC6 (no SDK, network only by injection)** — MET. `boundaries.test.ts` `LB-2` (revised: allowlist
  widened only by the new relative `lib/ai` targets, explicit SDK denylist regex, no re-export
  bypass, no other network primitive, and the fetch-token rules: bare `fetch(`/global `fetch` banned
  everywhere except `provider-deps.ts`; the token `fetch` banned outright outside
  `providers/*`+`provider-deps.ts`; inside `providers/*` every fetch call must be exactly
  `ctx.fetch(`), `LB-6` (new: `lib/ai/providers/*` imports neither `key-status` nor `provider-deps`
  nor `lib/db`), `LB-7` (new: no `package.json` dependency matches the SDK denylist — confirmed
  myself by reading `package.json`: no new runtime dependency of any kind was added).
  `provider-deps.test.ts` `PD-4` (no resolution branch, incl. ok, calls the injected or global
  `fetch`) and `PD-7` (`createProviderDeps()` with `DATABASE_URL` and every key var unset does not
  throw and does not call `getDb`; its `fetch` delegates to the stubbed global) prove the module is
  build-safe and makes no live call. Every test file stubs a throwing global `fetch` in `beforeEach`.
- **AC7 (nothing else changes, gates pass)** — MET. `app/admin/ai/page.tsx` (read in full) imports
  only `getDb`, `createAiSettingsDeps`, `getKeyStatuses`, `PROVIDER_CATALOG`, `getAiSettings`,
  `AiSettingsAdmin`, `saveAiSettingsAction` — no new import, matching the plan's "not touched" claim
  for `app/**`. `lib/ai/provider-catalog.ts` and `lib/ai/settings-deps.ts` are unchanged in content
  and structure from what US-022's own review/tests describe (4-entry static catalogue,
  `createAiSettingsDeps` wiring). No schema, migration, or message-file change (grepped
  `messages/en.json` for AI-related additions — none). Gates I re-ran myself this round:
  `pnpm typecheck` → clean (`tsc --noEmit`, no errors). `pnpm lint` → `0 errors, 3 pre-existing
  warnings` (same three files/lines as prior stories: `lib/cron/default-deps.test.ts`,
  `lib/extraction/adapters/types.test.ts`, `lib/ingestion/load-etfs.test.ts` — unrelated to this
  story). I did not re-run `pnpm test` or `pnpm build` myself (`story-tester`'s job) — not re-run.

### Non-negotiable rules (AGENTS.md) — checked

- No AI used for the deterministic PDF extraction path — untouched by this story.
- Adapter-per-format rule — n/a to this story (no concrete adapters shipped; `SHIPPED_PROVIDER_ADAPTERS`
  is deliberately empty, matches AC3/PR-5 and the story's "Out of scope").
- next-intl ro+en — no new UI string; confirmed no `messages/*.json` change.
- Number display (DEC-007) — n/a, no numeric UI in this story.
- Secrets: `readApiKey`'s value is read only in `key-status.ts`, reaches only
  `ProviderCallContext.apiKey`/`ProviderCallInput.apiKey`, and every test that could carry a real
  sentinel asserts `JSON.stringify(...)` does not contain it (`RG-2`, `RG-6`, `PD-2`, `PD-3`, `PD-5`).
  No log/console statement was added anywhere in the new code (checked while reading each file).
- Tests never call live Neon/Vercel/bvb.ro/AI providers — every new test uses the fake provider,
  fake timers, or a throwing global `fetch` stub; `PD-7` proves the wiring module needs neither
  `DATABASE_URL` nor a key var to construct.
- No weakened/skipped/deleted test: `LB-1` and `LB-3` are byte-identical to before (read and compared
  to the plan's transcription); `LB-4` is widened (new candidate dir `lib/ai`, stricter client-component
  check, new `readApiKey`-absence check) not narrowed; `LB-2`'s old "ban substring `fetch(`" becomes a
  strictly stronger "ban the whole `fetch` token" outside `providers/*`+`provider-deps.ts` — no old
  assertion was deleted.
- Scope: confirmed via the grep above — nothing outside the planned file list was touched.

### Findings

- **W1 (Warning, should fix)** — The tech-lead's "## Tech-lead review 2026-09-26" review comment on
  this story states, for LB-4: "Today LB-4 ... walks only `app/` and `components/`. The revised LB-4
  walks `lib/` as well (non-test files), so 'exactly `app/admin/ai/page.tsx` and the wiring module
  import `key-status`' is true of **the whole tree**, not of two folders." The shipped
  `lib/ai/boundaries.test.ts` `LB-4` (lines 146-175) only adds `lib/ai` itself to its
  `candidateDirs` — it still does not scan `lib/config/`, `lib/ingestion/`, `lib/admin/`, `lib/db/`,
  `lib/cron/`, `lib/extraction/` or `lib/format/`. So the guarantee is "true of `app/`, `components/`
  and `lib/ai/`", not "true of the whole tree" as the tech-lead's binding review note required. I
  confirmed by grep (`grep -rln "key-status\|readApiKey" lib --include="*.ts" --include="*.tsx" |
  grep -v "^lib/ai/"`) that nothing outside `lib/ai` currently imports `key-status` or references
  `readApiKey`, so there is no live secrets leak today — this is a test-coverage gap against an
  explicit tech-lead instruction, not a functional defect, hence Warning rather than Critical. The
  plan's own "Re-plan check" section (bottom of `US-025-plan.md`) asserts "2. LB-4 walks `lib/` and
  bans `readApiKey` in `app/` and `components/`" as satisfied, which is not accurate for the
  full-tree part of that claim. Recommend widening `LB-4`'s `candidateDirs` to the whole `lib/` tree
  (excluding `.test.ts`/`.test.tsx`, already handled by `collectFiles`) before or alongside US-026,
  which is the first story to add a second `lib/ai` consumer.
- **N1 (Note)** — `test/helpers/ai-fakes.ts`'s `"throws"` and `"throwsSync"` steps are functionally
  identical: `generate` is declared `async`, so a throw anywhere inside it becomes a promise
  rejection regardless of the naming intent, and `runGeneration`'s `Promise.resolve().then(...)`
  wrapping would catch a genuinely synchronous throw the same way. `RG-2` and `RG-3` therefore
  exercise the same code path twice under different names. Not a defect — `runGeneration`'s design
  already makes the sync/async distinction irrelevant — just a harmless test redundancy.
- **N2 (Note)** — `dev_minions/status.md`'s Story board still shows US-025 as `Ready` rather than
  `In progress`/`Review`, even though the plan, implementation and this review are already underway.
  Process hygiene only, not a code finding.

### Verdict rationale

All 7 acceptance criteria plus the 5 tech-lead review points are MET with test evidence I traced
myself; the one Warning (W1) is a coverage gap in a defensive boundary test against an explicit
review instruction, not a live secrets leak or a regression in shipped behaviour, so it does not
block PASS. No Critical finding.

Denied or attempted commands: one `diff <(git show HEAD:<path>) <path>` I attempted mid-review to
compare `app/admin/ai/page.tsx`/`lib/ai/settings-deps.ts`/`lib/ai/provider-catalog.ts` against their
prior committed state — denied (it invokes `git show`), not retried. I instead read the current
files directly and reasoned from the story's own "not touched" list and the boundary-test evidence.
