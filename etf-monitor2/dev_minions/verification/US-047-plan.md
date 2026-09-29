# US-047 plan

Copilot fallback plan (no story-planner subagent); Sprint 9 review and story decisions are binding.

1. AC8: add the three Drizzle tables and generate one expand-only migration; update schema/journal/PGlite tests, including ETF cascade.
2. AC2/AC8: implement `lib/config/home-display.ts` with closed result codes, validation, atomic whole-state batch writes and reads; wire `lib/config/default-deps.ts`.
3. AC3-5: extend `lib/monitoring/home.ts` to read catalogue, settings and visibility; preserve the unsaved default; honor overrides and fall back only on 42P01 with one sanitized log.
4. AC1/AC6/AC7/AC10: add the home title row and sole client Customize panel, pure state transitions, one server action per change, translations, and design-reference comparison.
5. AC3/AC4: preserve `HomeTable`'s existing output when defaults apply; render selected columns and effective change switches only.
6. AC2/AC6: PGlite tests cover invalid ETF/field/duplicate position, atomic saves, toggles through action/config/loader, and default-vs-saved semantics.
7. AC5: test each missing display table, sanitized single-line fallback, page rendering, and non-42P01 error propagation; test missing-table action feedback.
8. AC9: add boundary tests proving config-only writes, monitoring-only reads, and no new client component beyond Customize.
9. AC7: verify RO/EN text and locale-key parity; AC10: compare the title/panel against all four approved PNGs and record per-image results in HANDOVER.
10. AC11: run focused tests, then `pnpm typecheck`, `pnpm lint`, `pnpm test`, and offline `pnpm build` with the required variables unset.
11. Expected files: `lib/db/schema.ts`, generated `drizzle/0002_*` and `drizzle/meta/*`, `lib/config/{home-display,default-deps}.ts`, `lib/monitoring/home.ts`, `app/page.tsx`, new home-display UI/action/state modules, translations, tests, and `dev_minions/architecture/data-model.md`.
12. Never run a migration against Neon; production build applies the generated migration under DEC-023.
