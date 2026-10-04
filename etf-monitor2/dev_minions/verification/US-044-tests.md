# US-044 — Independent test verdict

**Round:** 1  
**Verdict:** **PASS**  
**Scope:** Independent development testing against `backlog/stories/US-044.md` and
`verification/US-044-plan.md`. No source, test, review-verdict, or Codex QA log files were edited.

## Environment and commands

Before each command, removed these six process environment variables (without printing their
values): `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`,
`GROQ_API_KEY`.

| Command | Exit | Result |
|---|---:|---|
| `corepack pnpm typecheck` | 0 | `tsc --noEmit` completed successfully. |
| `corepack pnpm lint` | 0 | 0 errors, 9 warnings. Warnings were in unrelated files: `app/health/page.failure.test.tsx`, `lib/ai/providers/timeout.test.ts`, `lib/cron/default-deps.seam.test.ts`, `lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`, and `lib/ingestion/load-etfs.test.ts`. |
| `corepack pnpm exec vitest run 'lib\monitoring\exact-decimal.test.ts' 'lib\monitoring\delta.test.ts' 'lib\monitoring\widget-engine.test.ts' 'lib\monitoring\history.pglite.test.ts' 'components\CustomValues.test.tsx' 'components\EtfDetail.test.tsx' 'components\EtfDetail.chart-types.test.tsx' 'app\etf\[symbol]\page.test.tsx'` | 0 | 8 files passed; 108 tests passed. Includes the US-044 history PGlite tests. |
| `corepack pnpm test` | 0 | 210 files passed; 2,142 tests passed. |
| `corepack pnpm build` | 0 | Migration runner skipped because this was not a production build; Next.js compiled and generated all 12 dynamic routes. The no-database static home load emitted the sanitized `[load-error] home name=MissingDatabaseUrlError` line. |

**Selector invocation note:** The first attempted focused command used
`corepack pnpm test -- <file selectors>`. pnpm forwarded the literal `--` to Vitest, which then ran
the unfiltered suite (210 files / 2,142 tests, exit 0); this was not counted as focused evidence.
The focused suite above was rerun using explicit Vitest selectors and passed. `EtfDetail` and the
route tests emitted next-intl `ENVIRONMENT_FALLBACK` warnings because their test providers omit a
timezone; those tests passed. No live database, deploy, or provider was accessed.

## Acceptance criteria

- **AC1 — periods/latest: MET.** `lib/monitoring/widget-engine.test.ts` verifies only `ok` reports
  contribute, the latest stored report anchors day windows, inclusive boundaries, day-vs-report
  windows, report-count comparisons, leap-day/date gaps, and expected values/dates. The focused
  tests passed.
- **AC2 — changes: MET.** The widget-engine tests exercise exact change/percent results,
  missing-current-value skipping, insufficient history when no comparison is available, and a
  zero divisor returning no percent. `lib/monitoring/delta.test.ts` additionally verifies signed
  exact changes, zero change, positive/negative P7 rounding, and zero-divisor behavior. All passed.
- **AC3 — aggregates/exact arithmetic: MET.** The engine tests cover average/min/max, empty or
  missing-value windows, and returned basis dates. `lib/monitoring/exact-decimal.test.ts` covers
  positive and negative half-away average ties, mixed scales, large values, and canonical input;
  `lib/monitoring/delta.test.ts` covers positive and negative percent-rounding boundaries and the
  arithmetic-path source guard. Passed.
- **AC4 — basis dates: MET.** Engine assertions check the exact operand and aggregate report dates
  across gaps; the rendered Custom values assertions verify those dates in English and Romanian.
  The relevant engine and component tests passed.
- **AC5 — detail rendering: MET.** `components/CustomValues.test.tsx` verifies localized titles,
  decimal marks, basis dates, change arrows/signs, flat and percent-zero display, aggregate output,
  translated insufficient history, escaped saved titles, and no area with no widgets.
  `components/EtfDetail.test.tsx` verifies the area precedes the table and existing charts/table
  output remains available. `app/etf/[symbol]/page.test.tsx` passed.
- **AC6 — optional query failures: MET.** `lib/monitoring/history.pglite.test.ts` verifies both a
  missing `etf_widgets` table and an unrelated optional-query failure preserve history, return no
  widgets, log exactly one sanitized diagnostic, and do not expose the supplied error text. Detail
  component tests verify the area is absent when there are no widget definitions. Passed.
- **AC7 — scope/regression and gates: MET.** The PGlite loader tests verify a catalogue-approved
  untracked widget field can be read without altering tracked history and that a field without
  adapter-catalogue membership is excluded. Existing no-fill / only-`ok` history behavior is
  covered in the history test file. Typecheck, lint, focused tests, full suite, and offline build
  all passed.

**Manual QA:** None required by AC1–AC7; all criteria were exercised offline in this round.

**Files changed by this test phase:** `dev_minions/verification/US-044-tests.md`,
`dev_minions/HANDOVER.md`. No implementation or test source was edited.
