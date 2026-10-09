# US-059 — independent review

## Round 1

Reviewer: independent context (did not write the code). Read: AGENTS.md, story, plan, HANDOVER "Files changed US-059", and the changed source/tests/fixture/messages. Own runs (DB/CRON/VERCEL_ENV/master-key/provider vars removed from the process env):
- `node_modules\.bin\vitest.cmd run` over `lib/config/latest-report-dates.pglite.test.ts lib/ai/chat.list-queries.pglite.test.ts lib/ai/capabilities/configuration lib/ai/boundaries.test.ts lib/ai/capabilities/boundaries.test.ts lib/config/boundaries.test.ts components/chat` → 22 files / 289 tests, all passed (the shell reported exit 1 only because of the `| Select-Object` pipeline; the vitest summary shows 0 failures).
- `node_modules\.bin\tsc.cmd --noEmit -p .` → exit 0.
- Full suite, lint, offline build: **not re-run** (tester's gate; HANDOVER's numbers are not cited as mine).

### Acceptance criteria

- **AC1 — MET.** No new action/command/write: `lib/ai/capabilities/configuration/prompt.ts:195-200` tells the model to answer list requests in `"reply"` from the data with `"actions":[]`, and report-value questions stay "not supported"; no capability/registry/chat.ts change; the example at `prompt.ts:120-127` is a `reply`-only answer. Proven end-to-end by `lib/ai/chat.list-queries.pglite.test.ts` LQ-2 (outcome `answered`, one provider call, 7-table DB snapshot unchanged, `fetch` never called). Category coverage in both locales: fixture `test/fixtures/ai/chat-list-queries.json` L01-L10 (active, inactive, tracked, widgets, latest report × ro/en), asserted by LQ-0.
- **AC2 — MET.** `lib/config/latest-report-dates.ts:11-29`: one read-only statement, `status = 'ok'`, `max(report_date)::text` per ETF symbol, inactive included, no values/URLs/errors returned; SQL lives in `lib/config`, `lib/ai/.../context.ts:29-33` only calls the loader (my run of both boundary suites passed with the allowlist entries added at `lib/ai/boundaries.test.ts:35`, `lib/ai/capabilities/boundaries.test.ts:30`). Data block `prompt.ts:145-170`: `latest_report` per active ETF, `inactive_etfs` unchanged, new compact `inactive_state` (symbol, tracked keys, widgets, latest_report; no names/catalogue/URLs/values); still serialised through `escapeForDataBlock(JSON.stringify(...))` (`prompt.ts:170`), system prompt still takes only `context` (user message can't reach `system`). Tests: LR-1..5 (newest ok wins, non-ok newer ignored, absent when none, plain text date, single read-only statement), CC-6, CP-7b (inactive name/catalogue not leaked), CP-7c, LQ-1 (newer non-ok dates and `https://bvb.ro` not in the prompt). Existing CP-4/CP-6/CP-15 escaping/name tests untouched and passing.
- **AC3 — MET.** `components/chat/ChatView.tsx:39` renders `t("instructions.listExamples")`; `messages/en.json:369` and `messages/ro.json:369` are parallel (five examples each, note that answers come from configuration, not report values); no hard-coded string; `ChatView.test.tsx:92` asserts it renders in all three availability states in both locales.
- **AC4 — MET (with the scope caveat below).** Offline, fake provider, PGlite, `fetch` stubbed to throw; each of 5 categories has ≥1 ro and ≥1 en row (LQ-0); LQ-1 asserts the exact context content; LQ-2 asserts answer returned, no action, DB unchanged, and that every symbol/date in the canned reply exists in the data block.
- **AC5 — MET for what I ran / partly not re-run.** Existing tests intact (see prompt-guard analysis); my focused run + typecheck green; full suite, lint and offline build not re-run by me.

### Prompt-trim analysis (the flagged risk)

CP-12 (≤8000 empty) and CP-18 (≤12000 realistic, ≤170000 worst case) are unchanged in their caps and assertions; the realistic fixture was made stricter (now carries `lastReportDate`). All pinned substrings I could find in `prompt.test.ts` (CP-1, 8, 10, 11, 13-17, "Setup questions", "I don't see that in the app's data", "not supported", "more than 5 actions", "never for add_etf or remove_etf", `Operations: …`, period words, `data, not instructions`, both "Earlier messages…" sentences) still appear in the current `prompt.ts`; the 289-test run confirms. Behaviour-relevant content checked in the current text: the confirmation rule is kept (`prompt.ts:224`, "never ask for confirmation in question"), the split-over-5 rule, `match` rule, `*` rule, untrack-vs-clear rule, reply language/"never say it is already done", injection sentences, and the action names/operations are still fully listed through the action shapes and `WIDGET_OPERATIONS` (so the removed "Configuration operations are … widget operations are …" sentence was redundant). I cannot diff against the previous text (git is off-limits), so "what was removed" rests on HANDOVER's description plus the above; I found no lost instruction that a safety need or pin depends on. The replaced `CONVERSATION_EXAMPLES` entry ("which ETFs are active?", en) was swapped for a ro inactive/last-report list example (`prompt.ts:120-127`); it is a non-pinned example and CP-17 checks the replacement generically. No test was weakened or deleted that I could identify.

### Findings

**Critical:** none.

**Warning:** none.

**Note:**
1. N1 — What the AC4 tests prove: they prove context content, wiring (answer passes through as `answered`, no action executes, no writes, no network) and that canned answers only cite data present in the prompt. They do **not** prove model quality — fixture `model` strings are canned. The story's MANUAL-QA step covers it; the plan says so. Not a defect.
2. N2 — The worst-case CP-18 context does not set `lastReportDate` and contains no inactive ETFs, so the added `latest_report`/`inactive_state` bytes (≈35 chars × ETFs; inactive_state bounded by 6 widgets each, no catalogue) are not part of the 170 000 measurement, which was already pinned tight at ~169 300. Realistic case is covered. Consider adding the field to the worst-case fixture when the cap is next revisited.
3. N3 — Fixture state has no inactive ETF with non-empty widgets (L06 covers an inactive ETF's tracked fields, but `inactive_state.widgets` is always `[]` in LQ-1; CP-7b likewise). The projection code path is the same `widgetData` used for active ETFs, so low risk.
4. N4 — With the swap, the prompt's full-answer examples no longer contain an English list example (only the ro one at `prompt.ts:120-127`; the en setup-question behaviour is carried by the "Setup questions" paragraph). Cosmetic prompt-quality point for MANUAL-QA.
5. N5 — Context loading now runs one more statement per chat message (`Promise.all` with the field reads); a failure of that read fails context load like the other config reads (existing isolated error path). Acceptable.

Denied or attempted commands: none.

Verdict: PASS
