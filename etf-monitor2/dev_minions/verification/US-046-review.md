# US-046 independent review

**Verdict: FAIL** — AC1–AC3 MET; AC4 NOT MET (scope not independently verifiable from the permitted evidence).

Reviewed US-046 AC1–AC4, Sprint 11, DEC-022 §9, the spike, and the relevant committed adapter, catalogue, widget-validation, persistence, and fixture sources. No implementation, tests, status, or HANDOVER files were edited for this review.

## Criteria

- **AC1 — MET.** The investigation is bounded to committed material and distinguishes observed behavior from assumptions. The adapter sources support its key feasibility claims: BRD has eight fixed keys and a bounded seven-token search; its VUAN value is extracted from before its label (`brd-depositary.ts:8,34,134`). InterCapital has a separate eight-key parser with ordered headers, currency-checked class rows, and a `Data:` report date (`intercapital-nav.ts:12,31,68,83,125,132`). The catalogue/widget boundary is adapter-specific and numeric (`seed-data.ts:25,86`; `widgets.ts:90`); ingestion stores extracted values, not arbitrary catalogue labels (`select-values.ts:8`). The fixture manifest has fixed expected keys, including the ICBETNETF fixture (`test/fixtures/README.md:15`; `expected.json:178`). The spike correctly marks generalization to future labels as an assumption (`US-046-spike.md:41`).
- **AC2 — MET.** It compares unsupported/catalogue-only behavior with explicit adapter/report-format mappings, including deterministic parsing, ambiguity, catalogue/validation and maintenance costs, fixtures, and historical availability (`US-046-spike.md:37,44`). It does not treat label inference as safe; this is consistent with the format-specific parser constraints above and DEC-022 §9 (`DEC-022-history-widget-definition.md:43`).
- **AC3 — MET.** The recommendation is explicitly for PO consideration, preserves `PROPOSED — NEEDS USER`, and says it neither changes DEC-022 nor blocks US-043–045 (`US-046-spike.md:56,62`). That matches Sprint 11 P-1 and its no-blocker statement (`sprint-11.md:47,59`).
- **AC4 — NOT MET (verification gap, not an observed code regression).** The spike declares that no implementation/extraction changes were made, but also says status/HANDOVER bookkeeping changed (`US-046-spike.md:66`). The permitted evidence and no-git constraint do not establish the actual scoped file changes or independently confirm that they were confined as AC4 requires. The reviewed committed source confirms the described boundaries, but cannot prove a change set. No claim is made that an implementation change occurred.

## Verification

No test suite or shell/git command was run; the deliverable is documentation-only, and this review was limited to the requested source, fixture, and spike evidence. No live resource was accessed.

## Round 2 — 2026-10-03

**Scope:** Re-review AC4 only, following Round 1's evidence gap. AC1–AC3 were not re-reviewed; their Round 1 verdicts stand.

**Verdict: PASS — AC4 scope evidence is consistent with documentation-only changes.**

### Independent modification-metadata check

Read the active-story entry and US-045 file list in `dev_minions/HANDOVER.md`. It records US-046 starting at 10:53 local on 2026-10-03 and lists US-045 implementation files across `app`, `components`, `lib`, and `messages`, alongside its verification and bookkeeping files.

Independently enumerated filenames, without opening their contents, under `app`, `components`, `lib`, `drizzle`, `messages`, `test`, `spikes`, and `dev_minions/verification`, filtering for modification time at or after 2026-10-03 10:53 local. The complete result was:

- `dev_minions/verification/US-045-qa.md`
- `dev_minions/verification/US-045-tests.md`
- `dev_minions/verification/US-046-review.md`
- `dev_minions/verification/US-046-spike.md`

No filenames were returned from `app`, `components`, `lib`, `drizzle`, `messages`, `test`, or `spikes`. Compared with the US-045 list in HANDOVER, the two US-045 filenames returned are its QA/test records; none of its listed implementation filenames appeared in this post-cutoff result. The two US-046 filenames are the verification record and this review. This matches the spike's stated scope, which also allows status/HANDOVER bookkeeping.

### Evidence limits

Modification metadata establishes filenames and their reported modification times only. It does not establish authorship, the contents or nature of edits, or git provenance, and cannot rule out edits whose timestamps were preserved or changes outside the enumerated directories. Accordingly, this PASS is limited to the requested metadata-based scope check and the HANDOVER/spike records; it is not a claim of a complete repository change-set audit.

No code, tests, fixtures, schema, migration, prompt, catalogue, adapter, extraction behavior, or live resource was accessed or changed for this round. No tests were run; none are required for this documentation-only review.
