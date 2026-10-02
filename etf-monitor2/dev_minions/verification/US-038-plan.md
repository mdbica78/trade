# US-038 plan — per-chart type and single-point display

Copilot fallback; detailed criteria are already in `../backlog/stories/US-038.md`.
P-4, D-6 and D-8 ship the isolated defaults settled in Sprint 9; no new decision.

- AC1/AC3/AC7: add a pure `components/chart-type.ts` with four ids, per-symbol/field
  storage key, safe read/write, and isolated-point logic. Add pure tests and
  bilingual selector/identity render tests.
- AC2/AC4/AC5/AC6: extend `FieldChart` using one Recharts `ComposedChart` and
  type-specific `Line`/`Bar`/`Area`; preserve axes, tooltip and null gaps.
  Add a large labelled single-point dot in every mode using stored display
  text through `formatNumber`, never plotting floats. Mocked Recharts tests
  verify every mode and palette.
- AC1/AC7/AC8: pass translated selector labels and per-chart identity from
  `EtfDetail`; add RO/EN catalogue keys. Change exact-markup assertions only
  for the chart wrapper and document them in HANDOVER.
- AC8: run focused tests, typecheck, lint, full tests and offline build with
  database/cron/provider variables unset. Live chart visual check is MANUAL-QA
  on a populated deployment; offline tests do not call Neon, BVB or providers.
