# US-046 — Independent test verdict

## Round 2

**Verdict: PASS — documentary acceptance criteria verified.**

**Scope:** Read US-046, DEC-022, `US-046-spike.md`, the Sprint 11 review, FR19, and the source/fixture references cited by the spike. This is a bounded document and source-content review. No filesystem metadata or complete change-set audit was performed for this verdict.

**Commands/tests: NOT RUN** — no command or test execution was needed for this documentation-only spike. No counts are reported. No git, secret-file, network, or live-resource access was performed.

### AC1 — Bounded feasibility investigation: PASS

- US-046 AC1 requires repository sources and committed fixtures only, and a distinction between known facts and assumptions. The spike's “Observed boundaries” section distinguishes existing adapter behavior from the limitation that the committed fixtures do not establish how arbitrary labels behave; its “Options” section explicitly calls future-label reliability an assumption, not a fixture finding.
- The observed BRD behavior matches [brd-depositary.ts](../../lib/extraction/adapters/brd-depositary.ts): fixed `BRD_FIELD_KEYS` and format labels, bounded sub-searches (`BRD_BLOCK_TOKENS`), and special handling for VUAN where the value precedes the label (lines 8–34, 114–145).
- The InterCapital observations match [intercapital-nav.ts](../../lib/extraction/adapters/intercapital-nav.ts): its fixed field-key set, ordered header lookup, currency-specific Class A/B row checks, and `Data:` report-date extraction (lines 12–30, 39–78, 81–97).
- The catalogue and persistence boundary are consistent with [seed-data.ts](../../lib/db/seed-data.ts) (adapter-specific field catalogue entries) and [select-values.ts](../../lib/ingestion/select-values.ts) (only values returned by the adapter are persisted; tracked fields determine completeness, not extraction).
- The committed-fixture documentation in [test/fixtures/README.md](../../test/fixtures/README.md) identifies the BRD and InterCapital fixture/manifest conventions. The [expected.json](../../test/fixtures/expected.json) InterCapital entry identifies `ICBETNETF-2026-09-24.pdf`, its adapter, report date, and existing adapter field values (lines 178–191). The spike reports no new fixture or live fetch.

### AC2 — Options and trade-offs: PASS

- The spike compares (A) retaining the current unsupported/catalogue-only behavior with (B) future explicit mappings scoped to adapter/report format.
- It discusses deterministic parsing and why unrestricted label matching is unsafe: the BRD value-before-label case, bounded repeated label groups, and InterCapital's class/currency context. The cited adapter source confirms these are actual constraints rather than hypothetical parser behavior.
- It covers mapping eligibility, catalogue/validation and adapter work, mapping approval/versioning, ambiguity and fail-closed handling, historical availability/no backfill, and ongoing maintenance when report layouts change. It does not claim that arbitrary labels can be inferred safely.
- This matches [DEC-022](../decisions/DEC-022-history-widget-definition.md) §§1 and 9: widgets accept only existing numeric adapter-catalogue keys; raw report-label fields and model-written parsers are out of scope.

### AC3 — Recommendation remains non-binding: PASS

- The spike labels its outcome **PROPOSED — NEEDS USER** and labels the explicit-mapping recommendation as a recommendation for PO consideration, not as a decision.
- It says the recommendation does not change DEC-022, authorize raw-field support in US-043–045, or block those stories. DEC-022 §9 and the Sprint 11 review (“US-046 — unresolved product question”) preserve the same boundary and non-blocking status.
- No decision record or implementation scope is changed by the spike content reviewed here.

### AC4 — No implementation or extraction expansion: PASS (documentary scope)

- The spike's “Scope of this spike” section confines its findings to the verification record and describes status/handover changes as bookkeeping; it explicitly states that no application code, tests, schema, migration, prompt, catalogue, adapter, fixture, extraction behavior, network, or production resource was changed or used.
- The spike itself contains investigation, options, a historical-data boundary, and a non-binding recommendation; it contains no arbitrary-label parser or model-written extraction logic. The cited current adapter and widget validation sources continue to show the fixed adapter-key/catalogue boundary ([widgets.ts](../../lib/config/widgets.ts), `validateWidgetDefinition` and `resolveEtf`, lines 35–50, 74–98).
- This PASS is limited to documentary scope and content. It is not an independent inventory of workspace file changes and does not claim to prove the absence of unrelated or external edits.

**Denied or attempted commands:** None.
