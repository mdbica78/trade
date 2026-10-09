# US-059 plan — Chat answers "list …"

Date: 2026-10-09. Scope follows the PO's tech-lead brief: model answers from context; no deterministic command route or new action.

## Data / schema impact
No schema change or migration. Add a read-only configuration-layer query for latest successful report dates. Reuse existing `listEtfs`, tracked-field and widget configuration readers; keep SQL in `lib/config/`, not `lib/ai/`. Do not include AI keys, source URLs, report values, or raw database rows in context.

## Files and implementation
- `lib/config/latest-report-dates.ts` (new): query a single latest `reports.report_date::text` per ETF for `status = 'ok'`, including inactive ETFs; expose `Map`/plain-record result using the existing `Db` + `BatchRunner` seam.
- `lib/config/latest-report-dates.pglite.test.ts` (new), `lib/config/boundaries.test.ts`: verify correct ETF/date mapping, absent reports, non-ok reports ignored, read-only behavior, and config-module boundaries.
- `lib/ai/capabilities/configuration/context.ts`: extend `ContextEtf` with `lastReportDate: string | null`; load the date projection alongside ETF/field context and retain labels/tracked keys for active and inactive ETFs.
- `lib/ai/capabilities/widgets/context.ts` and its tests: keep widget reads for all ETFs; project inactive ETF tracked keys/widgets/date into the prompt's compact inactive list without exposing inactive catalogue fields unnecessarily.
- `lib/ai/capabilities/configuration/prompt.ts`: compactly document model-based listing from the supplied state; serialize latest successful date, active/inactive status, tracked keys and widget definitions. Keep XML data escaping and never reinterpret user text as system instructions. Replace/shorten a non-pinned conversation example if required rather than exceed the empty prompt cap.
- `lib/ai/capabilities/configuration/prompt.test.ts`: add data-block shape and list-instruction assertions; retain pinned substrings; enforce CP-12 (8,000 empty-context cap), CP-18 (12,000 realistic / 170,000 worst-case caps) and existing prompt-safety checks.
- `components/chat/ChatView.tsx`, `messages/en.json`, `messages/ro.json`: add short localized list examples; no new UI framework or hard-coded UI string.
- `test/fixtures/ai/chat-list-queries.json` (new): fixture requests and canned natural-language answers for each category (active/inactive ETFs, tracked fields, widgets/custom values, latest successful report date), in both locales.
- `lib/ai/chat.list-queries.test.ts` (new): use the fixture with a fake provider and PGlite-backed context; assert the generated context contains the fixture state, the model answer is returned, no capability executor is called, and storage is unchanged. Extend test boundary allowlists only for the new source/test files.
- Update `test/fixtures/ai/README.md` with fixture provenance and offline command.

## Deliberate test / snapshot changes
Add tests only; no existing behavior assertion is removed or weakened. If the existing ChatView test pins full instruction markup, update only the expected markup for the added bilingual examples. Do not update any snapshot with Vitest `-u`; use a normal run and inspect the diff manually.

## Risks and proof
Prompt growth is the primary risk: baseline empty prompt is about 7,761/8,000 characters. Keep new static prose/examples short; maintain all CP-12-pinned text, and trim only already-approved non-pinned examples/prose if necessary. Context expansion can increase prompt size; CP-18 guards realistic and worst-case data. Fixture answers prove wiring/grounding shape, not language-model quality; live model quality remains MANUAL-QA. Full gates: focused context/prompt/chat tests, `pnpm typecheck`, `pnpm lint`, `pnpm test`, offline `pnpm build`.

## Order
1. Add date projection and its PGlite proof.
2. Extend context/data-block types and prompt-size/escaping tests.
3. Add fixtures, fake-provider conversation test, help strings and both locales.
4. Run focused tests, then all listed gates; prepare a QA checklist with live model checks.
