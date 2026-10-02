# Sprint 11 pre-detail review — Programmable history area

Date: 2026-10-02  
Reviewer: Technical Lead  
Inputs: `AGENTS.md`, `dev_minions/roles/technical-lead.md`, `dev_minions/HANDOVER.md`,
`dev_minions/status.md`, `dev_minions/process.md`, `dev_minions/decisions/DEC-022-history-widget-definition.md`,
`dev_minions/decisions/DEC-023-migrations-applied-by-the-deploy.md`,
`dev_minions/verification/SPRINT-09-review.md` §5, `dev_minions/backlog/roadmap.md` Sprint 11,
and `dev_minions/requirements/etf-monitoring-requirements.md` FR18–FR19.

## Verdict

**APPROVED TO DETAIL, within the binding scope below.** DEC-022 settles the widget definition,
semantics, storage, validation, writes, capability contract, multi-action rules, and display
fallbacks. The story planner must carry these decisions through without reopening them or
inventing product behavior.

**US-046 is not an implementation story.** The product outcome about user-defined raw fields is
still **PROPOSED — NEEDS USER** as described below. That unresolved product choice does not alter
the closed, catalogue-only widget contract in US-043–045.

Sprint 11 is not detailed yet. This is the pre-detail mandate; the detailed sprint and story files
must cite the FR for every acceptance criterion and mark agent-drafted criteria for PO confirmation.

## Binding decisions for US-043–045

1. **Widget definition and validation — US-043 (FR18, DEC-022 §§1, 4).**
   - A widget contains only `operation` (`change`, `percent_change`, `average`, `min`, `max`),
     an existing numeric `fieldKey` from that ETF adapter's `field_catalog`, `periodUnit`
     (`days` or `reports`), `periodAmount` (integer 1–365), and optional plain-text `title`
     (maximum 60 characters). Reject unknown keys; do not accept expressions, formulas, code,
     URLs, or free-form field names.
   - `validateWidgetDefinition(input, catalogue)` is the single definition-validation gate used
     by chat and any form. It checks operation, numeric catalogue membership, period, title, and
     slot where applicable; invalid model output returns closed error codes and does not throw.
     Preserve the specified codes: `unknown_operation`, `unknown_field`, `bad_period`,
     `bad_title`, `bad_slot`, `unknown_etf`, and `too_many`.
   - Keep writes in plain `lib/config/widgets.ts` functions over `Db` + `BatchRunner`; actions
     and chat must not contain their own SQL. `addWidget` takes the first free slot; update
     changes only supplied fields; clear supports one slot or all widgets for one ETF; replace
     replaces that ETF's list in one batch.

2. **Persistence and deploy — US-043 (FR18, DEC-022 §3, DEC-023).**
   - Add `etf_widgets` in its own expand-only migration, with the DEC-022 columns, per-ETF
     unique slot, ETF cascade FK, and database checks for operation, period unit, slot 1–6,
     and period amount 1–365. Do not store definitions as JSON.
   - The six per-ETF slots and three product defaults in DEC-022's `PW-1`–`PW-3` are the
     isolated defaults; do not block for user confirmation or change the limit, ownership, or
     average precision.
   - Generate and test the migration locally with the project tooling/PGlite. Never run a
     migration against Neon; production build applies it (DEC-023). The page must remain
     usable before deployment has created this optional table.

3. **Deterministic engine and rendering — US-044 (FR18, DEC-022 §§2, 8).**
   - The engine is pure and deterministic. “Latest” means the newest `ok` report, not the
     calendar date. `days` uses the inclusive window from latest report date minus the amount
     through latest date; `reports` uses the latest amount of `ok` reports.
   - `change` and `percent_change` compare the latest value to the newest `ok` report on or
     before the period boundary (or the report amount earlier for `reports`). `average`, `min`,
     and `max` use the window values. A missing field is skipped, never treated as zero.
     Missing comparison value or an empty value window produces `insufficient_history`; a zero
     divisor has no percent result.
   - Use the existing exact decimal/bigint helpers and P7 percent rounding (two decimals,
     half away from zero). Average uses the settled four-decimal, half-away-from-zero rule.
     Return the basis report date(s) with the result.
   - Render the optional “Custom values” area above the ETF history table, per ETF. Show title,
     formatted value, change sign/arrow where applicable, and basis dates. Use a translated
     insufficient-history message. If the table is missing or its query fails, hide the area,
     emit one sanitised `[load-error]` line, and do not fail the page (DEC-019).
   - Tests must include days versus reports, gaps/weekends, missing field, absent comparison
     report, empty window, zero divisor, rounding, and basis dates. Rendering/query tests must
     cover optional-table and query-error behavior and both locales.

4. **Capability and multi-action chat — US-045 (FR18; DEC-022 §§6–7).**
   - Add the widget capability at `lib/ai/capabilities/widgets/` with the four closed actions:
     `widget_add`, `widget_update`, `widget_clear`, and `widget_replace`. Model output is
     structured JSON, parsed and validated before any write; model text is never executed or
     rendered as HTML. The model receives only the ETF symbols and catalogue labels needed for
     the request.
   - The shared intent result is a list of 1–5 actions across capabilities, not a widget-only
     list. Validate every action against current state before executing any. If validation
     fails, execute none and identify the invalid action. Otherwise execute in order, stop on
     runtime failure, and report each action as `done`, `failed`, or `not run`. Do not promise
     rollback across actions; each configuration write is atomic, and `widget_replace` is atomic
     within itself. More than five actions receives the fixed split-the-request refusal.
   - Update existing exact tests deliberately when replacing the old `{kind:"multiple"}` refusal;
     do not loosen or delete them. Add tests proving validate-all-before-write, ordering, the
     five-action limit, and per-action runtime-failure reporting. Keep tests offline with fake
     providers and fake keys only.
   - Integrate with the completed Sprint 10 provider/model setup and chat instruction area;
     update the supported-request instructions in Romanian and English. Do not modify or
     duplicate Sprint 10's key-storage/preset implementation.

## Carry-forward risks and required mitigations

- **Intent/test migration:** Sprint 9 review §5 specifically flags `configuration/intent.ts` and
  its exact tests. Inventory all old single/multiple-intent assumptions; replace only behavior
  required by DEC-022 and prove both valid and invalid multi-action paths.
- **Historical coverage:** reports stored before US-037 may contain only previously tracked
  fields. A valid widget can therefore show `insufficient_history` until enough new reports
  contain that field. Do not backfill, infer values, or turn missing values into zero.
- **Extraction boundary:** US-043–045 only accept keys already present in the ETF's numeric
  adapter catalogue. PDF extraction remains deterministic and label-based; no AI extraction,
  arbitrary labels, or generated parser code.
- **Optional schema and diagnostics:** preserve the DEC-019 optional-table behavior and sanitised
  logging. Do not expose database exceptions, URLs, keys, or provider response bodies in the
  UI/logs.
- **Secrets:** never read/select/seed `ai_provider_keys`, `CRON_SECRET`, `AI_KEY_MASTER_KEY`, or
  derived keys. Use obvious fake keys in tests and ensure no output contains them.
- **Migrations/dependencies:** migration applies only through the production build. No live
  Neon/Vercel/BVB/provider calls in tests. No new runtime dependency without the required
  justification and decision.

## Sequence and dependency guidance

| Order | Story | Required relationship |
|---|---|---|
| 1 | US-043 — schema, validator, config functions | Establishes the persisted contract and sole write/validation layer. Its migration relies on the US-048 deploy migration path. |
| 2 | US-044 — engine and detail-page area | Depends on US-043's definition/storage contract; keep computation pure and rendering isolated from the home table. |
| 3 | US-045 — capability and multi-action chat | Depends on US-043 and the Sprint 10 chat setup/instruction area (US-040–042); integrate only after those changes are available. |
| 4 | US-046 — raw-field spike | Keep independent and spike-only. It must not change the widget field contract or block US-043–045. |

Use this as the safe single-agent build order: **US-043 → US-044 → US-045 → US-046**. Do not
parallelize changes to the shared chat intent path. Sprint 10 is being verified separately; do
not edit its stories or verdicts. Record dependencies in the detailed sprint/story files so
execution waits only on actual prerequisites.

## US-046 — unresolved product question (PROPOSED)

FR19 says raw fields are a separate spike; it does not settle whether a user may add a raw field
dynamically, what labels/formats are eligible, or whether such a field becomes a persistent
catalogue entry. US-046 should investigate feasibility and trade-offs, document a recommendation,
and make **no code, schema, prompt, or extraction change**. Its result must remain:

**Status: PROPOSED — NEEDS USER.** The PO must decide whether raw-field requests are supported
and, if so, their boundary. The technical constraint is binding regardless of that choice:
any eventual extraction must use deterministic, adapter-specific label rules; the model must
never extract values or author/execute parser code. Recommendation for the user's consideration:
if supported, constrain requests to explicitly mapped labels and adapter/report formats, rather
than arbitrary model-interpreted text. This is a recommendation, not a decision or a Sprint 11
implementation authorization.

## Review boundary

No Sprint 11 story/sprint files exist yet, so this review sets the constraints for detailing;
the planner must produce FR-cited, testable criteria and the detailed material must not weaken
these bindings. No code, tests, status, or HANDOVER files were changed. No git command, live
secret, or `ai_provider_keys` row was accessed.

## Detailed sprint review — 2026-10-02

Inputs: `dev_minions/backlog/sprints/sprint-11.md` and
`dev_minions/backlog/stories/US-043.md` through `US-046.md`, checked against this pre-detail
review, DEC-022 §§1–9, FR18–FR19, DEC-023, and the Sprint 9 review §5 carry-forward notes.

**Verdict: APPROVED.** No binding requirement or decision was dropped, no unsettled product or
technical choice was self-approved, and no correction to the sprint or story files is necessary.
The stories are explicitly drafted for PO confirmation, and the implementation stories' criteria
cite FR18/FR19 as applicable. The detailing retains:

- US-043's closed column schema, sole validator/config write layer, atomic replacement, and
  locally tested migration through the DEC-023 production-build path only.
- US-044's pure deterministic computation, exact arithmetic, report-date basis, localized
  detail-page display, and optional-table/error fallback.
- US-045's shared 1–5 action list across capabilities, validate-all-before-write, ordered
  execution and per-action runtime outcomes, with the Sprint 10 dependency explicit.
- US-046 as an independent investigation only: no implementation or extraction change; the raw
  field outcome remains **PROPOSED — NEEDS USER**. Its recommendation is explicitly non-binding
  and does not block US-043–045.

The sequence US-043 → US-044 → US-045 → US-046 matches the pre-detail mandate; the US-045
dependency on US-040–042 is also explicit. The historical-data limitation, catalogue-only widget
boundary, sanitised diagnostics, fake-key/offline testing, and no-live-migration constraints are
carried into the sprint or story criteria. Sprint 10 files and implementation code were not
changed. No code, tests, status, or HANDOVER files were edited; no git command, live secret, or
`ai_provider_keys` row was accessed.
