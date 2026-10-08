# US-052 independent review — Round 1

**Verdict: FAIL — AC6 is not met.** Source review found no blocking behavior regression in the implementation. The remaining failure is the story's explicit line-count evidence requirement: HANDOVER has post-edit source counts, but no pre-edit baseline, so it cannot demonstrate before/after counts or substantiate the claimed simplification quantitatively. This is a criterion-level blocker to a full PASS unless the PO accepts a waiver. The reviewer did not attempt to reconstruct the baseline.

Review was read-only. I inspected the story, plan, Sprint 12 binding rules and §D findings, HANDOVER's complete US-052 changed-files list, and the listed implementation and relevant tests. No tests, typecheck, lint, build, predeploy, QA, live-resource or secret commands were run. HANDOVER's reported gate results were not treated as independently verified.

## Acceptance criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| AC1 — behavior preserved except D4/D7; tests and gates | **MET by source review; gates not independently verified** | Inspected the changed implementations and relevant existing/added tests. The two identified behavior changes are D4 (one `/admin` nav) and D7 (malformed direction maps to the existing invalid-direction result). No other behavior change was found in the reviewed paths. This review did not execute tests or gates and makes no claim that they pass. HANDOVER lists test edits individually; the markup snapshot remains a separate unchanged expected-output fixture. |
| AC2 — actions delegate through `runAdminAction` and `lib/config`; result texts unchanged | **MET** | The listed admin action modules use the shared action runner; the runner centralizes try/catch, configuration calls, revalidation and action-result mapping. The result-message tests retain the existing localized result mapping. `app/actions.boundary.test.ts` includes the real relative-import path check and disallowed-import self-checks. |
| AC3 — admin page loads use `loadOrError`; errors use `logLoadError` | **MET in current implementation; guard has a non-blocking gap** | Inspected the listed admin pages and shared wrapper. The ETF fields page keeps `notFound()` outside the wrapper, preserving its control flow. Current pages use the shared wrapper. However, `app/load-error.boundary.test.ts`'s “wrapper import missing” assertion only checks that the source contains the text `loadOrError`; it does not verify the import resolves to `lib/log/load-error`. Current source imports the correct wrapper, so this is a future-regression-test weakness, not a current behavior failure. |
| AC4 — header, theme toggle and admin forms byte-identical except D4 | **MET by static comparison** | `components/admin/admin-markup.golden.test.tsx` and its snapshot provide the baseline captured before the relevant source edits. Inspected the component markup and serialized snapshot for RO/EN header, theme-toggle and tracked-field forms; the changed component boundaries retain the prior elements, attributes and ordering. D4 is outside this snapshot scope. Snapshot execution was not performed in this review. |
| AC5 — CSS/token tests unchanged; `untrackField` uses one batch | **MET by inspection** | Inspected the CSS/token/contrast/colour-literal test changes and `lib/config/tracked-fields.ts`. The `untrackField` data-modifying CTE performs the delete and catalogue cleanup in one runner invocation; `lib/config/tracked-fields.pglite.test.ts` UT-1 asserts one call containing one statement. No weakening of the token equality or contrast assertions was found. These tests were not run. |
| AC6 — per-finding disposition and before/after source counts in HANDOVER | **NOT MET** | HANDOVER records dispositions for D1–D13 (some grouped as ranges) and post-edit line counts. It explicitly records that baseline counts were not captured before edits. Therefore it does not contain the required before/after counts for touched source files. This is the sole criterion-level blocker in this review. |

## §D findings

| Finding | Verdict | Review evidence |
|---|---|---|
| D1 | **Done** | Shared action-state type and `runAdminAction` replace repeated action control flow; callers preserve their existing action result codes. |
| D2 | **Done** | Shared result mapping is used by admin actions; inspected mapping and result-message tests. |
| D3 | **Done** | Shared `loadOrError` wraps page data loading and routes failures through `logLoadError`; current pages import the shared implementation. Boundary test gap noted under AC3. |
| D4 | **Done; allowed behavior change** | `/admin` no longer renders a duplicate `AdminNav`; the layout retains navigation. |
| D5 | **Done** | Field-key normalization and adapter-registration checks are centralized and used by the reviewed callers. |
| D6 | **Done** | `listFieldsForEtf` builds its result once; `untrackField` batches related changes in one statement, with UT-1 asserting one runner call/one statement. |
| D7 | **Done; allowed behavior change** | Direction validation is performed in `lib/config`; malformed direction reaches the existing invalid-direction result/message. Other outcomes remain mapped through the shared action path. |
| D8 | **Done** | `createDbDeps` replaces the duplicated config dependency factories for its callers. |
| D9 | **Done, with the recorded skip** | Hour validation is centralized in `isHour`; the two existing `RangeError` strings remain. The dark `--radius` removal was skipped because TK-2 requires the light and dark token-name sets to match exactly; retaining the dark declaration preserves that tested invariant. |
| D10 | **Done** | Header icon rendering is routed through the shared `Icon` wrapper while preserving SVG markup/attributes in the baseline snapshot. |
| D11 | **Done** | Tracked-field form markup is factored into `FieldActionForm`; hidden inputs and their order match the baseline snapshot by inspection. |
| D12 | **Done** | Only the specified dead/inherited CSS declarations were removed; inspected CSS and unchanged token/contrast assertions. |
| D13 | **Done, with the recorded skip** | Normalizer, discriminated-result handling, revalidation and cron destructuring changes are present. Retaining `reason: undefined` is justified by the existing `detectResultToState` object-shape assertion; changing it would alter a pinned result shape without simplifying the behavior under test. |

## Findings and limitations

- **AC6 — criterion failure / blocking for a full review PASS.** No pre-edit source line counts were recorded; HANDOVER contains post-edit counts only. The gap cannot be resolved by this read-only review without the forbidden version-control history or an independently preserved pre-edit baseline.
- **AC3 boundary guard — low, non-blocking note.** The current page imports are correct, but LB-E1 does not assert the wrapper's module specifier; a future page could use another `loadOrError` implementation and satisfy that check.
- **No implementation behavior blocker found.** This conclusion is from direct source/test inspection only, not test execution.

**Denied or attempted commands:** none.
