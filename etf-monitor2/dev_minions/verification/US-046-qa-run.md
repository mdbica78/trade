## QA run 1 — 2026-10-04 18:21
Verdict: PASS
Machine checks: 3/3   Left for the user: 1

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Source- and fixture-bounded investigation (qa.md #1; AC1) | AUTO | PASS | Read `US-046-spike.md`, `lib/extraction/adapters/brd-depositary.ts`, `lib/extraction/adapters/intercapital-nav.ts`, `lib/config/widgets.ts`, `lib/ingestion/select-values.ts`, and `test/fixtures/README.md`. Targeted `rg 'BRD_FIELD_KEYS|BRD_BLOCK_TOKENS|VUAN|FIELD_KEYS|Class A|Class B|Data:|numeric|fieldKeys'` over the two adapters and widget config → 0 → BRD fixed keys, bounded 7-token windows/value-before-VUAN; InterCapital class/currency and `Data:` label; widget adapter/catalogue intersection. No live PDF or network request. |
| 2 | Compare bounded options and decision (qa.md #1/#3; AC2–AC3) | AUTO | PASS | `US-046-spike.md` compares catalogue-only A with future adapter/report-format explicit mapping B; covers ambiguity, validation, maintenance and unavailable historical values. Recommendation explicitly states `PROPOSED — NEEDS USER` and does not authorize new extraction or change DEC-022. |
| 3 | Documentation-only scoped record (qa.md #2; AC4) | AUTO-PARTIAL | PASS | `US-046-qa.md` ending file list and `HANDOVER.md` active-story closeout list enumerate only spike/review/tests/checklist, sprint audit/demo and status/handover bookkeeping for US-046. Inspected the spike and current adapters/config boundary; no arbitrary-label parsing capability appears. This is a documentary scope check, not a git provenance proof; current unrelated Sprint 12 changes cannot be attributed to this earlier spike by timestamps alone. |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm drafted AC1–AC4 and decide whether any raw report-label fields should be supported; if yes, name exact labels/formats/currency/classes and persistence/history boundary. The shipped default remains catalogue-only until a separate approved implementation story.

### Failures (if any)
- None. No test/build was run: this is a documentation-only feasibility spike and its checklist requires no runtime gate.

No git command, credential file, live BVB/Neon/provider/Vercel resource, or real secret accessed. No application code/tests changed by this QA run.
