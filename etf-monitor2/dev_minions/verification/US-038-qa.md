# US-038 QA checklist — chart types and isolated values

## Offline gates

From the project root, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
`GEMINI_API_KEY` and `GROQ_API_KEY` unset (do not print their values):

1. `pnpm install --frozen-lockfile` — exit 0.
2. `pnpm typecheck` — exit 0; `pnpm lint` — 0 errors (the existing nine
   unrelated warnings may remain).
3. `pnpm exec vitest run components/chart-type.test.ts components/FieldChart.test.tsx components/FieldChart.palette.test.tsx components/FieldChart.smoke.test.tsx components/EtfDetail.test.tsx components/EtfDetail.chart-types.test.tsx i18n/messages.test.ts lib/monitoring/chart-series.test.ts`
   — every focused test passes. The mocked Recharts tests establish type,
   token colour, gap, single-value label and tooltip behavior. They do not
   connect to a real database or a provider.
4. `pnpm test` — every test passes. If a concurrent PGlite timeout occurs,
   record the original failure, check that file alone, and rerun the full
   suite before reporting a pass; never weaken or delete the test.
5. `pnpm build` — exit 0, migration step skipped outside production, ETF
   detail route included. Do not deploy or run migrations against Neon.

## MANUAL-QA — populated ETF charts (FR8.2)

The local QA server without a database cannot supply a populated chart. On a
populated deployment *after the user's own push*, open a detail page with at
least two tracked fields, in both RO and EN:

1. Each chart initially shows **Line** and has a localized, labelled selector
   with four options in order: line, line with dots, columns, area. Switch one
   chart to columns; the other remains line. Reload: only the chosen chart
   retains columns in this browser. Inspect the same field on another ETF:
   its selector remains line. With storage disabled, the selector must still
   change for the current view; reload falls back to line.
2. For each type, verify readable theme-token colours in light and dark
   themes, date/number axes, and a tooltip showing the stored value and
   localized date. A missing report date must stay blank (not connected or
   carried forward). Line shows dots only at isolated readings; line with
   dots shows them on each stored day.
3. For a field with exactly one stored reading, verify a visibly larger
   point and a label using its exact stored decimal digits in both languages;
   columns mode must show the column as well as the point. Do not create
   live data merely for this check. If such data is unavailable, record one
   JUDGMENT/MANUAL-QA item rather than claiming a visual pass.
4. Check `/etf/<symbol>` with an unavailable database in both RO and EN: the
   translated safe error still displays, without a raw exception. Production
   reads only; no secret, Vercel or Neon settings need changing.

These acceptance criteria were drafted by an agent: **PO to confirm at demo**.
Codex QA runs separately from Copilot; no story is marked Done by QA.

## Files changed (US-038)

- Plan/verdict/handoff: `dev_minions/verification/US-038-plan.md`,
  `dev_minions/verification/US-038-review.md`,
  `dev_minions/verification/US-038-tests.md`,
  `dev_minions/verification/US-038-qa.md`, `dev_minions/status.md`,
  `dev_minions/HANDOVER.md`.
- Chart component and pure module: `components/FieldChart.tsx`,
  `components/chart-type.ts`; bilingual detail wiring:
  `components/EtfDetail.tsx`, `messages/en.json`, `messages/ro.json`.
- Tests: `components/chart-type.test.ts`,
  `components/FieldChart.test.tsx`,
  `components/FieldChart.palette.test.tsx`,
  `components/FieldChart.smoke.test.tsx`,
  `components/EtfDetail.test.tsx`,
  `components/EtfDetail.chart-types.test.tsx`.
- Related documentation: `README.md`. No dependency, schema, migration or
  lockfile changes.
