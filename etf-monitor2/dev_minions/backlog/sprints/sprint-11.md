# Sprint 11 — Programmable history area

> Detailed by agent (story-planner), 2026-10-02 — PO to confirm at demo.
> Source of scope and binding sequence: `verification/SPRINT-11-review.md` (Technical Lead,
> APPROVED TO DETAIL). This sprint carries that review forward and does not reopen DEC-022.

**Epic:** EPIC-08 · **Requirements:** `requirements/etf-monitoring-requirements.md` §8 (FR18–FR19)
**Binding inputs:** DEC-022 (history widget definition and multi-action chat), DEC-023 (production-build
migrations), DEC-019 (sanitised load-error fallback), DEC-016 (configuration writes), DEC-010 (database
write rules), DEC-007 (number formatting), and `verification/SPRINT-11-review.md`.
**Status:** see the `status.md` Story board. No user step blocks US-043–045.

## Goal

Let the user configure a bounded set of deterministic derived values for an ETF through chat, store
those definitions, and show their calculated values on the ETF detail page. Existing adapter
catalogue numeric fields remain the only eligible inputs in this sprint. US-046 investigates the
separate proposed raw-field question without implementing it.

## Why this order

US-043 establishes the closed definition, validation and persistence contract. US-044 consumes that
contract to compute and render custom values. US-045 adds the widget chat actions and changes the
shared intent result from one action to an ordered list, so it follows the other widget work and the
Sprint 10 provider/model/chat-instruction stories. US-046 is an independent spike; placing it last
keeps the catalogue-only implementation boundary explicit. The review's safe single-agent order is
**US-043 → US-044 → US-045 → US-046**; do not parallelize edits to the shared chat intent path.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-043 | Schema, validator and config functions for the widget definition | US-048 migration-on-deploy path; existing DEC-016 config-write pattern | Strong model, high thinking. Complex: schema/migration, validation and atomic config writes. |
| US-044 | Widget engine and history-area rendering | US-043; existing ETF detail/history read model | Strong model, high thinking. Complex: exact decimal engine, optional-table reads and bilingual rendering. |
| US-045 | Chat capability: add, update, clear, replace widgets; several actions per message | US-043, US-044, and Sprint 10 US-040, US-041, US-042 | Strong model, high thinking. Complex: capability integration and shared multi-action intent/execution. |
| US-046 | Spike: user-defined raw field from a report label (decide, do not build) | None; independent of US-043–045 | Mid model, high thinking. Bounded investigation and recommendation only. |

US-045 must not start until US-040–042 are available and US-043/044 are complete; it must integrate with their provider/model
setup and instruction area without changing or duplicating their key-storage or preset implementation.
US-046 has no dependency on the implementation stories and its unresolved product outcome does not
block them.

## Decisions needed

| # | Story | Type | Question | Recommendation / isolated default | User step blocks US-043–045? |
|---|---|---|---|---|---|
| P-1 | US-046 | PRODUCT — PROPOSED, NEEDS USER | Should users be able to request a new raw field read from a report label, and, if so, what labels/formats and persistence boundary are supported? | Keep the shipped scope catalogue-only: widgets accept only existing numeric adapter catalogue keys. US-046 investigates feasibility and records options; recommend, for consideration only, explicitly mapped labels and adapter/report formats if support is later approved. This default is isolated to the accepted field catalogue in US-043–045. | No. The raw-field outcome remains unresolved and no implementation is authorized by this sprint. |
| PW-1 | US-043 | PRODUCT — isolated default | Widget ownership and capacity | Carry DEC-022's default: six slots per ETF, widgets belong to one ETF. | No |
| PW-2 | US-043/044 | PRODUCT — isolated default | Average precision | Carry DEC-022's default: four decimal places, half away from zero. | No |
| PW-3 | US-044 | PRODUCT — isolated default | Meaning of “today” | Carry DEC-022's default: newest stored `ok` report, with its report date. | No |

The technical definition, storage, validation, computation, and action semantics are settled by
DEC-022 and the approved pre-detail review; do not introduce further decisions for them.

## Sprint Definition of Done

- US-043, US-044 and US-045 meet their drafted criteria and have independent review and test verdicts
  PASS in the same round, plus QA checklists; stories move to Awaiting QA, not Done.
- US-046 produces only a bounded investigation and recommendation. Its raw-field product decision
  remains PROPOSED — NEEDS USER; no code or extraction change is made.
- All tests remain offline: use PGlite, fixtures, mocked providers and fake keys. No live Neon,
  Vercel, BVB, or AI-provider requests.
- The `etf_widgets` migration is generated locally, expand-only, and tested against PGlite in
  journal order. Never run it against Neon; DEC-023 applies it through a production build.
- Romanian and English strings are covered wherever a story adds user-visible text. Diagnostics
  remain sanitised and contain no provider response bodies, URLs, or secrets.

## Manual QA / live steps

No manual step or live resource blocks this sprint. Migration verification is offline; after the
user's normal production push, `/health` and the ETF detail page can be observed as deployment
smoke checks. Do not access or change Neon/Vercel while implementing these stories. The PO's
decision on raw-field support remains for the demo and does not gate US-043–045.
