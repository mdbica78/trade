# US-047 independent review — Round 1

**Reviewer:** Copilot independent review  
**Story:** US-047 — Home display settings (FR7.3)  
**Inputs reviewed:** `dev_minions/backlog/stories/US-047.md`, `dev_minions/verification/US-047-plan.md`, the complete US-047 file list in `dev_minions/HANDOVER.md`, implementation/tests/schema/migration/docs, and all four binding home-design PNGs.

## Verdict

**PASS**

The implementation satisfies the story's functional, layering, persistence, fallback, bilingual, accessibility, Windows-compatibility, and design-scope requirements. No Critical or High findings were found. The two Low findings below are evidence-quality gaps only; neither identifies a shipped behavior defect.

## Findings

| # | Severity | File(s) | Finding | Disposition |
|---|---|---|---|---|
| 1 | LOW | `app/page.test.tsx`, `components/HomeCustomizePanel.test.tsx` | The page-level tests verify the title/button in RO and EN, while the open-panel/group/checkbox assertions live in the component test. This does not directly prove that the page's mocked loader passes a populated customization model into an initially open panel. | Non-blocking test-coverage gap; component behavior and page wiring are both covered separately, and the production composition is straightforward in `app/page.tsx`. |
| 2 | LOW | `app/home-display-actions.pglite.test.ts` | The action integration tests assert `result.ok` and then verify the reloaded loader state, but do not directly assert that the successful action's returned `result.display` equals the validated saved state. | Non-blocking assertion gap; `saveHomeDisplay` itself has direct read-back/return assertions and the action returns `result.display` on its success path. |

## Acceptance-criteria evidence

| AC | Verdict | Evidence inspected |
|---|---|---|
| AC1 | MET | `components/HomeCustomizePanel.tsx` renders the title row, accessible expandable button (`aria-expanded`/`aria-controls`), three `fieldset` groups in ETF/value/change order, labelled checkboxes, and no Save button. `components/HomeCustomizePanel.test.tsx` HP-1/HP-2 covers RO/EN, group order, seven checkbox states, translated labels, and closed/open states. The panel receives the loader model from `app/page.tsx`. No admin section was added. |
| AC2 | MET | `lib/config/home-display.ts` normalizes and validates the full input before writes; it rejects invalid input, unknown/inactive ETFs, unknown fields, duplicate fields, duplicate positions, and uses closed result codes. The three deletes and replacement inserts are passed together to `BatchRunner` at line 167, whose production implementation is `db.batch` (`lib/ingestion/store.ts`), preserving atomic Neon HTTP transaction semantics. `home-display.pglite.test.ts` HD-C2 through HD-C5 cover replacement, validation, rollback, labels, and returned display. `app/home-display-actions.ts` contains no SQL and revalidates `/`. |
| AC3 | MET | `lib/monitoring/home.ts` applies saved ETF visibility and saved column positions, reads labels from the deduplicated catalogue, reads values from the newest `ok` report regardless of tracked-field membership, creates blank cells for missing values, and computes per-column effective switches with overrides taking precedence. `home-display.pglite.test.ts` HD-H2 and `app/home-display-actions.pglite.test.ts` HD-A1/HD-A2/HD-A3/HD-A4 cover the saved model and each toggle path. `HomeTable.tsx` independently suppresses absolute/percent parts when their effective flags are false; arrow remains carried in the model for US-036 as specified. |
| AC4 | MET | With no settings row, `buildViewModel` selects the tracked-field union, all active ETFs, and all three change parts enabled. HD-H1 verifies the exact default columns, rows, untracked cells, and default panel state. Existing table behavior remains the default path. |
| AC5 | MET | `isMissingHomeDisplayTable` accepts only `42P01` for one of the three home-display relations. The loader logs one sanitized line and calls the default-view path; unrelated errors are rethrown. HD-H3 covers each missing table and one log line; HD-H4 covers propagation. HD-A5/HD-A6 cover sanitized action failure and missing-table action handling. `app/page.tsx` catches page-load errors and renders the translated safe error state. |
| AC6 | MET | HD-A1 covers hide/show ETF; HD-A2 covers add/remove column; HD-A3 separately parameterizes all three global switches; HD-A4 covers a per-column override. `home-display-state.test.ts` HD-S1–HD-S4 covers toggle transitions, append/remove ordering, switch state, serialization, and override preservation. |
| AC7 | MET | New UI/action strings are under `HomeDisplay` in both `messages/en.json` and `messages/ro.json`. HP-1 and the home-page tests exercise both locales and reject the other locale's differing title/text. Catalogue labels are selected from `label_ro`/`label_en`. |
| AC8 | MET | `lib/db/schema.ts` declares the three requested tables, single-row check, unique position, nullable overrides, and ETF cascade FK. `drizzle/0002_home_display_settings.sql` creates only the three tables and one cascade FK, with no destructive operation. Journal order and migration structure are pinned in `lib/db/schema.test.ts`; PGlite applies journal order and verifies all schema tables plus ETF cascade in `test/helpers/pglite.migrations.test.ts`. `data-model.md` documents the tables, atomic writer/read boundary, missing-table fallback, and DEC-023 deploy migration rule. No live migration was run. |
| AC9 | MET | `lib/config/home-display.ts` is the only non-schema writer and `lib/monitoring/home.ts` is the only non-schema reader. BC-9/BC-10 in `lib/config/boundaries.test.ts` pin this. The only new client component is `HomeCustomizePanel.tsx`; `HomeTable.tsx` remains server-renderable. `app/actions.boundary.test.ts` includes the new action and enforces no SQL/disallowed imports. |
| AC10 | MET for implementation scope; MANUAL-QA remains for runtime screenshots | I opened `mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`, and `mockup-home-phone.png`. The title row alignment and closed/open panel structure match: title left, Customize button right, three desktop groups, one-column phone stack. `app/globals.css` adds only scoped title/panel rules and a responsive breakpoint. The phone reference's crowded header is outside this story and is already corrected under US-035. The handover records per-image MATCH results. Codex runtime screenshot comparison remains a separate QA step as required by the story. |
| AC11 | MET based on recorded implementation evidence; not independently rerun in this shell | The handover records focused tests (113/113), full tests (191 files/1926 tests), typecheck, lint with zero errors, and offline build with required environment variables unset; no dependency or lockfile changes were made. An independent rerun was attempted but `pnpm` was unavailable on this review shell, so I do not claim a newly produced test transcript. |

## Cross-cutting review

- **Transaction correctness:** The production dependency factory uses `neonBatchRunner`, which delegates to `db.batch`; the config function performs validation reads before the single replacement batch. The injected PGlite failure test confirms prior state survives a failed write batch.
- **Validation:** Input shape, booleans, safe integer/non-negative positions, duplicate fields, duplicate positions, active ETF membership, and catalogue membership are checked before replacement statements are constructed.
- **Saved/default/fallback paths:** The saved path filters hidden active ETFs and uses configured columns; the no-settings path retains today's tracked union; missing display relations fall back only for `42P01`; unrelated errors propagate. Missing report-link handling remains separately scoped and does not weaken the new display fallback.
- **Toggle behavior:** ETF, value-column, absolute, percent, arrow, and per-column override paths are all represented in source and tests. New columns append and removed columns preserve remaining order.
- **Bilingual UI/accessibility:** All new visible strings are translated in both catalogues. `fieldset`/`legend`, explicit labels, native checkboxes, `aria-expanded`, and `aria-controls` provide a sound accessible structure. Pending saves disable the groups and failures use `role="alert"`.
- **Windows compatibility:** The implementation uses normal TypeScript/Next APIs and SQL, not shell/path assumptions. The existing boundary scan was explicitly normalized with `path.sep` for Windows, and the generated migration/journal are path-independent. No POSIX-only runtime path was introduced.
- **Design-scope compliance:** Changes are limited to the home title row, Customize panel, scoped panel CSS, display state/action/config/read model, schema/migration, translations, docs, and relevant tests. No admin page/nav entry, login, reorder UI, per-column UI, or US-036 arrow rendering was added.

## Denied or attempted commands

No git command, migration against a live database, secret read, or `.env*` read was attempted. I attempted the focused Vitest command with `pnpm exec vitest ...`, but this review shell reported `pnpm` was not recognized; therefore the command produced no test result and was not retried in another form.

