# US-044 QA checklist — widget engine and history display

Independent development review PASS (round 2, after an AC2/AC4 comparison fix);
independent tests PASS (round 1): AC1–AC7 MET, focused 8 files / 108 tests,
full 210 files / 2142 tests, typecheck, lint and offline build green. Codex QA
is separate and need not complete before the next development story.

## Offline checks

1. With database, deployment and provider-key variables removed from the
   process (never print values), run `pnpm install --frozen-lockfile`,
   `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Expect no errors
   and a skipped non-production migration. Do not run a live migration.
2. Run `pnpm exec vitest run lib/monitoring/exact-decimal.test.ts
   lib/monitoring/delta.test.ts lib/monitoring/widget-engine.test.ts
   lib/monitoring/history.pglite.test.ts components/CustomValues.test.tsx
   components/EtfDetail.test.tsx components/EtfDetail.chart-types.test.tsx
   app/etf/'[symbol]'/page.test.tsx lib/config/boundaries.test.ts`.
   Check inclusive calendar and report windows, missing comparison values,
   exact rounding and basis dates, untracked catalogue fields, escaped titles,
   bilingual page markup and preserved history/chart rendering.
3. Exercise both optional-error cases in the PGlite suite: a missing
   `etf_widgets` table and an unrelated query error hide only Custom values,
   leave history available, and emit exactly one sanitized
   `[load-error] etf-detail-widgets` diagnostic. Never log SQL error messages
   or connection details.

## Post-push MANUAL-QA

4. On an ETF detail page with saved widgets (after US-045 makes chat
   configuration available), check the Custom values area above history in
   Romanian and English, actual basis dates and locale-specific decimal marks.
   Check an ETF with no widgets still has its unchanged history and chart.
5. A widget referring to a valid but untracked catalogue field should show
   its stored value without adding a history column or chart. A window without
   enough stored history should say insufficient history, not show zero.
   Historical values must not be inferred or backfilled.

PO to confirm drafted AC1–AC7 (FR18; DEC-022). No real AI key or live
database table containing secrets should be selected in QA.

## Files changed

- `dev_minions/verification/US-044-plan.md`,
  `dev_minions/verification/US-044-review.md`,
  `dev_minions/verification/US-044-tests.md`,
  `dev_minions/verification/US-044-qa.md`,
  `dev_minions/HANDOVER.md`, `dev_minions/status.md`
- `lib/monitoring/exact-decimal.ts`,
  `lib/monitoring/exact-decimal.test.ts`, `lib/monitoring/delta.ts`,
  `lib/monitoring/widget-engine.ts`,
  `lib/monitoring/widget-engine.test.ts`,
  `lib/monitoring/history.ts`, `lib/monitoring/history.pglite.test.ts`,
  `lib/format/delta-direction.ts`, `lib/config/boundaries.test.ts`
- `components/HomeTable.tsx`, `components/CustomValues.tsx`,
  `components/CustomValues.test.tsx`, `components/EtfDetail.tsx`,
  `components/EtfDetail.test.tsx`, `components/EtfDetail.chart-types.test.tsx`,
  `app/etf/[symbol]/page.test.tsx`, `messages/en.json`, `messages/ro.json`

No dependency, migration, provider, extraction, or chat change in US-044.
