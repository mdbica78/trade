# DEC-007 — Number display format: no thousands separator, locale-specific decimal mark only

- Status: **Decided**
- Implemented 2026-09-25 by US-016: `lib/format/number.ts` (`formatNumber` works on the stored string —
  no `Intl` rounding, no grouping); chart axis ticks use `Intl.NumberFormat` with `useGrouping: false`
  (`lib/format/chart.ts`). The "no story currently implements" consequence below is history. Folding the
  rule into `requirements/` is still a PO to-do.
- Date: 2026-09-23
- Requested by: the user, directly, confirmed in this chat
- Related: ADR-001 (`next-intl`, bilingual RO/EN UI, FR8.1); `spikes/pdf-extraction/FINDINGS.md`
  (source-data number formatting notes); `backlog/stories/US-004.md` (bilingual
  infrastructure — explicitly defers number formatting to "the stories that render
  numbers")

## Context

The BRD depositary reports parsed by the future PDF adapter use comma-thousands /
dot-decimal formatting inconsistently in one respect: decimal-place count varies
field-to-field and issuer-to-issuer (e.g. `37,470,000` vs `28,220,000.00`; VUAN values
`11.091`, `54.1373`, `14.8856` at variable precision) — see FINDINGS.md, "Number
formatting (AC5)". That is a **source-parsing** concern and is unaffected by this
decision: the adapter still parses whatever separators the source PDF actually uses,
and stores a plain numeric value.

What's decided here is separate: how the app **displays** a parsed number back to the
user, in the bilingual (RO/EN) UI, once it's a stored numeric value with no separators
of its own.

## Decision

Across both locales, numbers are displayed **without a thousands separator**. Only a
decimal separator is shown, chosen per locale:

- Romanian UI: comma (`,`) as the decimal mark — e.g. `415591664.27` → `415591664,27`.
- English UI: dot (`.`) as the decimal mark — e.g. `415591664.27` → `415591664.27`.

No grouping character (comma, dot, space, or apostrophe) is inserted for thousands in
either locale. Same structural rule both locales; only the decimal mark differs.

## Consequences

- The shared number-display utility (built on `next-intl`'s formatting API, or a small
  custom formatter — `Intl.NumberFormat`'s locale defaults include thousands grouping by
  default and need `useGrouping: false` set explicitly) must apply `useGrouping: false`
  for both the `ro` and `en` locales, with only the locale's decimal mark active.
- Presentation-layer only: does not change what the PDF adapter parses or how values are
  stored.
- No story currently implements number display — US-004 explicitly defers it ("no
  locale-specific number or date formatting yet; that belongs with the stories that
  render numbers"). Whichever story eventually builds the shared number-display
  component should implement this rule and cite DEC-007, rather than re-deciding it.
- Flag for the PO: `requirements/etf-monitoring-requirements.md` (FR8.1, or wherever
  number/locale display is specified) should be updated to reflect this rule — the
  Technical Lead does not edit `requirements/` directly (see `roles/technical-lead.md`
  Boundaries).

Logged directly as Decided rather than PROPOSED: this was requested and confirmed by the
user in real time in this chat, not a PO draft awaiting technical sign-off.
