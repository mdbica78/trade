## Round 1 — 2026-10-05
Verdict: PASS

Acceptance criteria:
- AC1: MET — no behaviour change beyond the allowed C10 change. Verified myself (all commands run with
  `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY` unset):
  `pnpm typecheck` → `tsc --noEmit`, 0 errors. `pnpm lint` → 0 errors, 11 pre-existing warnings (same
  files HANDOVER names: `app/health/page.failure.test.tsx`, `lib/ai/providers/timeout.test.ts`,
  `lib/cron/default-deps.seam.test.ts`, `lib/cron/default-deps.test.ts`,
  `lib/extraction/adapters/types.test.ts`, `lib/ingestion/ingest-etf.ts`,
  `lib/ingestion/load-etfs.test.ts`). `pnpm test` (full suite) → `Test Files 222 passed (222)`,
  `Tests 2285 passed (2285)`, matching HANDOVER's count exactly. `pnpm build` → succeeds,
  `migrate-on-deploy: skipped (not a production build)`, one `[load-error] home
  name=MissingDatabaseUrlError` line, all 12 dynamic routes listed, matching HANDOVER. `find
  lib app components -type f -newermt "2026-10-05 10:55:00" ! -newermt "2026-10-05 11:15:00"` returns
  exactly the files in HANDOVER's "Files changed (US-051)" list — nothing extra was touched, no scope
  creep. Every file HANDOVER claims as "not touched" (`lib/config/ai-keys.ts`,
  `lib/monitoring/widget-engine.ts`, `components/admin/ProviderKeySaveForm.tsx`, `app/admin/ai/page.tsx`,
  `app/admin/ai/actions.ts`, `lib/ai/capabilities/configuration/prompt.ts`,
  `lib/ai/capabilities/configuration/execute.ts`, `lib/ai/settings-deps.ts`,
  `components/chat/ChatView.tsx`, `components/chat/ChatPanel.tsx`, `components/chat/transcript.ts`,
  `app/chat/actions.ts`, `app/chat/page.tsx`, `components/admin/AiProviderModelFields.tsx`,
  `messages/en.json`, `messages/ro.json`, `lib/db/schema.ts`, `package.json`, `pnpm-lock.yaml`, and
  every `boundaries.test.ts`) has an mtime before 2026-10-05 11:00, confirmed by my own `ls -la
  --time-style=full-iso`. The `wc -l` "after" counts in HANDOVER (23 files) match my own `wc -l` on the
  live files exactly, digit for digit. Deliberate test changes are exactly the three HANDOVER lists —
  `lib/ai/capabilities/configuration/intent.test.ts` CI-4 (`intent.test.ts:44`, now calls
  `parseConfigurationAction` on an object literal and drops the "prose" assertion),
  `lib/ai/capabilities/registry.test.ts` CR-1 (`registry.test.ts:17`, now asserts
  `Object.keys(CAPABILITY_REGISTRY)` instead of the deleted `CAPABILITY_IDS`) and CR-2 (deleted,
  grep confirms no remaining reference to `CAPABILITY_IDS`/`Capability.id` anywhere in `lib/`,
  `app/`, `components/`) — no other existing test line changed. Golden snapshots
  (`app/chat/reply-messages.golden.test.ts.snap`, `components/chat/chat-markup.golden.test.tsx.snap`)
  are timestamped 2026-10-05 11:00, before every source file they protect (`chat.ts` 11:06:45,
  `widgets.ts` 11:02:48, `registry.ts` 11:05:10) — proving they were captured against the unchanged
  code, as the plan's mitigation requires. Both golden test files passed in my own focused run with no
  `-u` (37 + 5 tests), so the markup/reply text is unchanged across the refactor.
- AC2: MET — multi-action behaviour (validate all first, execute in order, done/failed/not_run,
  max 5) is unchanged. `lib/ai/chat.ts:128-147` (`executeActions`/`runAction`) stops the list on the
  first failure and marks the rest `not_run` (`lib/ai/chat.ts:138-144`); `lib/ai/chat.ts:185-190`
  validates every action before any execution starts. New `lib/ai/chat.test.ts:436-477` CE-G1/CE-G2
  (both run and passed in my focused run) prove a *returned* widget failure and a *rejecting*
  configuration promise each stop the list with the exact done/failed/not_run shape. `max 5` stays in
  `lib/ai/capabilities/action-list.ts:4,42` (`MAX_ACTIONS_PER_MESSAGE = 5`), unedited test
  `action-list.test.ts` (3 tests) passed. `lib/ai/chat.pglite.test.ts` CEP-1..12 including the two
  US-045 cases all passed in my own run (12 tests, real PGlite).
- AC3: MET — key boundary unchanged. Every `boundaries.test.ts` file (`lib/ai/boundaries.test.ts`,
  `lib/ai/capabilities/boundaries.test.ts`, `lib/config/boundaries.test.ts`,
  `app/actions.boundary.test.ts`, `components/chat/ChatPanel.test.tsx`) has an mtime before this
  story's first edit (2026-09-27 through 2026-10-03), confirming none was edited, and all five passed
  in my focused run (`app/actions.boundary.test.ts` 8 tests, `components/chat/ChatPanel.test.tsx`
  included in the 42-file run). `lib/ai/providers/resolve.test.ts` AR-9 and `lib/ai/provider-deps.test.ts`
  PD-3 (both unedited, mtime before the story) still pin the key-free `AiAvailability` shape —
  `lib/ai/providers/resolve.ts:72-77` `toAvailability` still builds `{ available: true, providerId,
  model }` field by field, never spreading the resolution. `lib/ai/provider-deps.ts:111-119`
  `resolveFromDeps` keeps `loadSettings()` then `loadStoredKeys()` sequential (PD-8's pinned order).
  No key-carrying object crosses into `app/`/`components/`: grepped for `ActiveProviderCall`,
  `ActiveProviderResolution`, `ProviderCallInput`, `ProviderCallContext`, `loadActiveProvider`,
  `resolveActiveProvider` outside `lib/ai/` — none found (LB-5 unedited, passed).
- AC4: MET — chat replies (RO/EN text, codes) identical for every existing test, proven by two new
  golden snapshots written and passed against the **unchanged** code first (file mtimes 11:00, strictly
  before every source edit, see AC1), then matched with no `-u` after the refactor. All of
  `app/chat/reply-messages.test.ts` (48 tests), `components/chat/ChatReply.test.tsx`,
  `components/chat/ChatView.test.tsx`, `components/chat/ChatPanel.test.tsx`,
  `components/chat/transcript.test.ts`, `app/chat/page.test.tsx`, `app/chat/page.safety.test.tsx`
  passed unedited in my focused run. `app/chat/reply-messages.ts:120` `isSuccess = result?.capability
  === "widgets" || result?.changed === true` matches the plan's pinned tone rule (§0.10), and the
  `WIDGET_KEYS` lookup at `reply-messages.ts:85` no longer has the unreachable `?? "actionFailed"`
  fallback (`noUncheckedIndexedAccess` is off per `tsconfig.json`, so this types cleanly).
- AC5: MET — one registry (`lib/ai/capabilities/registry.ts:5-8`, `CAPABILITY_REGISTRY`) still lists
  exactly `configuration` and `widgets`, each with its closed action set
  (`lib/ai/capabilities/configuration/capability.ts`, `lib/ai/capabilities/widgets/capability.ts`,
  neither touched beyond dropping the dead `id:` field). `lib/ai/chat.ts:88`'s `validateAction` makes
  one combined lookup: `isCapabilityId(capability) ... && getCapability(capability).actions.includes
  (action)`. `isCapabilityId` (`registry.ts:16-18`) uses `Object.hasOwn`, not `in`, so a prototype key
  like `"toString"` cannot leak through — proven by new `lib/ai/chat.test.ts:481-496` CE-V1 (passed in
  my run, including the `"toString"`/`"cron"` prototype-key cases and the dead
  trim/lowercase-is-unreachable `"ADD_ETF"` case). `registry.test.ts` CR-1 (passed, 1 test) confirms
  the registry keys and both action sets.
- AC6: MET — HANDOVER's US-051 section gives a `done` / `done (partial): reason` / `skipped: reason`
  line for every one of C1-C14 (§"AC6 record, finding by finding"), each matching the actual code I
  read myself (verified C1/C2/C3/C4/C5/C6/C7/C8/C9/C10/C11/C12/C13/C14 against the live files, listed
  under "Acceptance criteria" above and in Findings). The `wc -l` "before" table (recorded at session
  start) and "after" table are both present; my own `wc -l` on the 23 live source files matches every
  "after" number exactly (verified in this round).

Findings (ordered by severity):
None — no Critical, no Warning. Two Notes, neither blocking:
1. (Note) `lib/ai/chat.test.ts:451` CE-G1's expected `configuration` outcome for the first
   `remove_etf` action is the test's fixed mock payload (`code: "added", symbol: "XYZ", ...`), not a
   `remove_etf`-shaped outcome. This is the pre-existing `vi.mock` fixture design (same mock used by
   every other `chat.test.ts` case, unrelated to this story's refactor) — it still exactly proves the
   point CE-G1 is written for (the loop's done/failed/not_run shape), but a reader skimming only this
   test could be confused by the mismatched action/outcome pairing. Not a defect in the shipped code.
2. (Note) I could not independently verify the "before" `wc -l` counts recorded in HANDOVER (they were
   taken at session start, before any edit, and git is off-limits to reconstruct them) — only the
   "after" counts are something I could check myself this round, and they match exactly.

Scope deviations:
- None. `find lib app components -type f -newermt "2026-10-05 10:55:00" ! -newermt "2026-10-05
  11:15:00"` returns exactly the file set in HANDOVER's "Files changed (US-051)" list (30 files/dirs
  of source, test and snapshot files) — nothing outside the story's named scope
  (`lib/ai/**`, `lib/config/ai-keys.ts`/`ai-settings.ts`/`widgets.ts`, `lib/monitoring/widget-engine.ts`,
  `app/chat/*`, `app/admin/ai/*`, `components/chat/*`, `components/admin/Ai*.tsx`,
  `ProviderKeySaveForm.tsx`) was touched. No new dependency, no migration, no renamed route or message
  key (grepped `messages/en.json`/`messages/ro.json` mtimes — both predate this story's first edit).

Denied or attempted commands: none.
