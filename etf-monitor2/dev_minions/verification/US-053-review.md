# US-053 — Independent review

## Round 1 — 2026-10-05

Verdict: PASS

Reviewer: independent `story-reviewer` subagent (fresh context, did not write this code). Read
`AGENTS.md`, `dev_minions/backlog/stories/US-053.md` (AC1-AC7, PO-confirmed 2026-10-05),
`dev_minions/verification/US-053-plan.md`, `dev_minions/decisions/DEC-025-chat-understanding.md`,
and every file listed under "Files changed (US-053)" in `dev_minions/HANDOVER.md`. Read these
files directly, end to end (not summarized): `lib/ai/chat.ts`, `lib/ai/capabilities/action-list.ts`
(+`.test.ts`), `lib/ai/capabilities/configuration/context.ts`,
`lib/ai/capabilities/configuration/prompt.ts` (+`.test.ts`), `lib/ai/capabilities/widgets/context.ts`
(+new `.test.ts`), `lib/ai/capabilities/widgets/intent.ts` (+`.test.ts`),
`lib/ai/capabilities/widgets/execute.ts` (+`.test.ts`, `.pglite.test.ts`), `lib/ai/chat.test.ts`,
`lib/ai/chat.pglite.test.ts`, `app/chat/reply-messages.ts` (+`.test.ts`), `app/chat/actions.ts`
(+`.test.ts`), `messages/en.json`, `messages/ro.json`, and `lib/ai/capabilities/boundaries.test.ts`
/ `lib/ai/boundaries.test.ts` (to confirm they were genuinely left untouched).

### Scope check
Grepped `lib/ai/capabilities` for the forbidden write-function substrings outside `*/execute.ts`
(CB-4 rule) — none found. Cross-checked HANDOVER's "Files changed (US-053)" list against the git
status shown in this session's context: it matches exactly (source + test files), with no
boundary-test file, no `lib/config/*`, no `app/chat/actions.ts` (source), no `components/chat/*`,
no schema/migration/dependency file touched — consistent with the plan's "Not touched" list
(`lib/ai/capabilities/boundaries.test.ts` line 9-28 `ALLOWED_TARGETS` already lists every new
import target; no edit was needed or made). `CLAUDE.md`, `dev_minions/backlog/roadmap.md`,
`dev_minions/decisions/README.md` are also modified in the working tree but are not claimed under
"Files changed (US-053)" and contain no US-053 symbols — Sprint-13 setup noise, not this story.

### Gates I ran myself
- `pnpm typecheck` (env with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/
  `GEMINI_API_KEY`/`GROQ_API_KEY` unset): **0 errors.**
- `pnpm lint` (same env): **0 errors, 11 warnings** — same baseline as US-052 (the 11 listed
  warnings are in files untouched by this story: `app/health/page.failure.test.tsx`,
  `lib/ai/providers/timeout.test.ts`, `lib/cron/default-deps.seam.test.ts`,
  `lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`,
  `lib/ingestion/ingest-etf.ts`, `lib/ingestion/load-etfs.test.ts`). Matches HANDOVER's claim.
- Full `pnpm test` / offline `pnpm build` / `predeploy-check.sh`: **not re-run** by me (the
  `story-tester` subagent's job); I rely on its round-1 verdict for those counts.

### Acceptance criteria

- **AC1** (gates, no loosened test, deliberate changes listed) — **MET**. `pnpm typecheck`/`pnpm lint`
  pass as above (self-run). Read every touched test file in full: the only two assertion changes
  to pre-existing tests are exactly the two HANDOVER documents and the plan names —
  `lib/ai/chat.test.ts` `CE-W1` (line 501-507, now `toHaveBeenCalledTimes(1)`) and
  `lib/ai/capabilities/configuration/prompt.test.ts` `CP-3` (line 52-70, now asserts `tracked`
  equals the context's tracked keys instead of its absence). Every other change to an existing test
  file (`action-list.test.ts`, `widgets/intent.test.ts`, `widgets/execute.test.ts`,
  `widgets/execute.pglite.test.ts`, `reply-messages.test.ts`, `app/chat/actions.test.ts`) is a pure
  addition — none of the pre-existing `it(...)` bodies were edited or removed. No boundary test
  file was touched (`lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts` absent
  from the changed-files list; `CB-1`'s `ALLOWED_TARGETS` already covers every import used).
- **AC2** (prompt has tracked fields + widgets, injection-safe) — **MET**.
  `lib/ai/capabilities/configuration/prompt.ts:12-31` (`contextDataBlock`) emits `tracked` and
  `widgets` per active ETF and a top-level `inactive_etfs` array, still `escapeForDataBlock`-escaped
  inside `<catalogue_data>`. Proven by `prompt.test.ts` `CP-5` (line 72-101, tracked+widgets in slot
  order), `CP-6` (line 103-135, a `</catalogue_data>`/`<b>`-laden widget title stays inside the
  block exactly once, JSON round-trips byte-for-byte), `CP-7` (line 137-153, inactive ETF only in
  `inactive_etfs`), `CP-8` (line 155-163, prompt text states the `*`/default-scope/`match` rules);
  end to end, `lib/ai/chat.test.ts` `CE-P1` (line 539-556) and `lib/ai/chat.pglite.test.ts` `T-8`
  (line 417-424, real inserted widget reaches the real system prompt via real PGlite).
- **AC3** (`*` expansion, cap counts model actions) — **MET**.
  `lib/ai/capabilities/action-list.ts:21-50` (`resolveActionTargets`) expands `*` to active-context
  ETFs in order, rejects it for add/remove (`all_not_allowed`) and for a numeric slot
  (`bad_slot`), rejects zero active ETFs (`no_active_etfs`). Proven by `action-list.test.ts`
  `RT-1`..`RT-6` (line 49-120) and `lib/ai/chat.test.ts` `CE-A1` (line 570-588, 8 active + 1
  inactive, expands to exactly 8, `index:1` on every result, `executeWidgetIntent` never called
  with the inactive symbol), `CE-A2` (line 590-600), `CE-A3` (line 602-622, one `*` action over 3
  ETFs plus 4 more model actions = 5 model actions, 7 results, not `too_many`).
- **AC4** (transcript cases, clear/update by description) — **MET**.
  `lib/ai/capabilities/widgets/intent.ts:52-90` (`parseWidgetMatch`/`matchingSlots`) and
  `execute.ts:22-71` implement `match`/`slots`. Proven by `lib/ai/chat.pglite.test.ts` `T-1/T-3`
  (line 267-288, real PGlite rows: the matching widget is removed on BTBETRETF and TVBETETF,
  `matched:0` reported for PTENGETF which never had it, the reply lines are
  `["widgetCleared","widgetNothingMatched","widgetCleared"]`) and `T-2` (line 290-300, a different
  match clears consistently and leaves the others). `T-4` (line 302-327) proves `widget_update` by
  `match` over `*` only changes the matching widgets' `periodAmount`, PTENGETF's untouched widget
  stays at 7.
- **AC5** (default scope) — **MET**. `T-5` (`chat.pglite.test.ts:329-344`): a message naming no ETF,
  recorded model output `etf:"*"`, adds the widget to all 3 active ETFs (`[1,2,3,4]`/`[1,2,3]`/`[1,2]`
  slot counts after the add, consistent with each ETF's pre-seeded widgets).
- **AC6** (validate-all-first, in-order execution) — **MET**. `lib/ai/chat.ts:196-216`
  (`handleChatMessage`'s validation loop) builds the full `validated` list across every model action
  and every expanded per-ETF target before calling `executeActions`; any validation failure anywhere
  returns immediately with **no** call to `executeActions` at all. Proven by `CE-A4`
  (`chat.test.ts:624-643`, a failure on the 2nd model action's expanded 3rd target still gives
  `executeWidgetIntent`/`executeConfigurationIntent` zero calls, even though the 1st model action
  and the first two of the 2nd action's targets would individually have validated), `CE-A5`
  (line 653-672, in-order execution: 3 widget calls then 1 configuration call, asserted via
  `invocationCallOrder`), `CE-A6` (line 674-694, a runtime failure on the 2nd expanded target gives
  `["done","failed","not_run","not_run"]`), and `T-6` (`chat.pglite.test.ts:346-365`, a `too_many`
  failure on one expanded ETF leaves every `etf_widgets` row unchanged on every ETF, confirmed by
  real PGlite row counts before/after). Every pre-existing `chat.test.ts`/`chat.pglite.test.ts`
  test I read (`CEP-1`..`CEP-11`, `CE-W2`, the earlier `describe` blocks) is present and intact.
- **AC7** (active ETFs only) — **MET**. `resolveActionTargets` (`action-list.ts:41-47`) rejects an
  explicitly named inactive ETF with `etf_inactive` for every action except `add_etf`/`remove_etf`.
  Proven by `action-list.test.ts` `RT-6` (line 90-107) and end to end by `chat.pglite.test.ts`
  `T-7` (line 367-415: a deactivated PTENGETF is excluded from a `*` widget-add and a `*` untrack,
  and gives `{kind:"invalid_action", reason:"etf_inactive", symbol:"PTENGETF"}` with **no row
  change** when named explicitly for either a configuration or a widget action). The reply text is
  proven by `app/chat/reply-messages.test.ts` `RM-I1` (line 160-167, both RO and EN render the
  symbol) and `RM-K1` (line 188-197). `CEP-6` (add_etf reactivates) and `CEP-11` (remove_etf on an
  already-inactive ETF) are present unchanged, confirming the two exempted actions still give their
  pre-existing specific replies rather than being swept into `etf_inactive`.

### Findings

**Notes (non-blocking):**
1. The plan's §2 row for `lib/ai/chat.ts` describes the validation order as "existing
   record/capability/action registry check first; then `resolveActionTargets`"; the shipped code
   does it the other way — `resolveActionTargets(raw, context)` runs first (keyed only on
   `raw.capability === "widgets"` as a boolean test, never throwing on a malformed/unknown
   `capability`), and the registry/capability check happens inside `validateAction` per resolved
   target. I traced this through every AC3/AC6 edge case in the tests (a non-widgets/non-
   configuration `capability` with `"*"`, an unknown action, etc.) and found no case where the
   reordering changes an outcome or lets an invalid action slip through — `resolveActionTargets`
   never trusts `capability`/`action` to be valid, it only expands or passes through, and
   `validateAction` still rejects anything not closed. A wording mismatch against the plan, not a
   code defect.
2. Housekeeping, not a code finding: `dev_minions/verification/.us053-tmp`, and the duplicate
   `dev_minions/HANDOVER-1.md`/`HANDOVER-2.md`/`status-1.md` files sitting in the working tree,
   are not attributed to this story and look like leftover session artifacts; worth deleting before
   the user's next commit, but outside this review's scope.

No Critical finding. No Warning.

Denied or attempted commands: none.
