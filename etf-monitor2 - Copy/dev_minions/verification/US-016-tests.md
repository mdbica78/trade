# US-016 — Home table with configurable columns and PDF links — Independent Test Verdict

## Round 1 — 2026-09-25

Runner: GitHub Copilot, fresh chat (`/review-story`), independent from the implementing context
(Copilot fallback — no `story-tester` subagent available; `process.md`'s fallback note assigns
this role to "Troubleshoot", not present as a separate chat here, so it is done in this same
independent-review chat).

## Commands run (WSL, `NODE_EXTRA_CA_CERTS` exported per AGENTS.md)

- `pnpm typecheck` — PASS, 0 errors.
- `pnpm lint` — PASS, exit 0. 3 pre-existing warnings, none in files this story touches
  (`lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`,
  `lib/ingestion/load-etfs.test.ts`).
- `pnpm test` — first aggregate run: **649/650 passed, 48/49 files**. The single failure was
  `app/api/cron/daily/route.test.ts > ... > RT-6` with `Test timed out in 5000ms` — a file
  belonging to US-015, not touched by US-016. Re-ran that file alone:
  `pnpm vitest run app/api/cron/daily/route.test.ts` → **7/7 passed** in 1.24s. This confirms
  the aggregate failure was an environmental/transient WSL timeout (the same class already
  logged for US-013's QA run), not a regression introduced by this story. No file this story
  added or edited failed in either run.
- `pnpm build`, with `DATABASE_URL` explicitly unset — PASS. Route table shows `ƒ /` (dynamic,
  server-rendered per request), confirming the home page never touches the database at build
  time (AC10).

SUITE: 649 passed, 1 failed (confirmed transient, unrelated file, isolated rerun 7/7 passed), 0
skipped, on 650 total tests across 49 files.

## Coverage of this story's acceptance criteria

- **AC1** — covered by `lib/monitoring/home.pglite.test.ts` "AC1: one row per active ETF ordered
  by symbol; inactive excluded; no-report and null-adapter ETFs still get a row".
- **AC2** — covered by 6 tests in `home.pglite.test.ts`: column add/remove via a live
  `tracked_fields` insert/delete, the cross-ETF `display_order` tie-break, the
  tracked/untracked cell distinction, the field-key label fallback, and the alphabetical
  adapter-key label tie-break. Locale-specific header rendering additionally covered by
  `components/HomeTable.test.tsx`.
- **AC3** — covered by 3 tests in `home.pglite.test.ts`: newest-`ok`-wins with a missing field
  never backfilled from an older report, no-`ok`-report gives empty cells and no date, and a
  newer `parse_error` row (with stored values) changes nothing — inserted through the real
  `createDrizzleReportStore.saveReport` Sprint-3 code path, not a hand-built row.
- **AC4** — covered by 2 tests in `home.pglite.test.ts` (any-status newest link wins over an
  older `ok` link; no report row gives no link) and 1 test in `HomeTable.test.tsx` (exactly one
  `<a target="_blank">` in a two-row fixture, the no-link row rendered as plain text).
- **AC5** — covered by 1 combined test in `home.pglite.test.ts` (`NULL` key, unregistered key,
  and the seeded registered key asserted together) and by `HomeTable.test.tsx`'s marker
  assertion.
- **AC6** — covered by 7 cases (+1 parametrised over both locales) in `lib/format/number.test.ts`,
  reproducing every literal example from the story text plus a length-triggered
  `Intl`-grouping adversarial case.
- **AC7** — covered by `lib/format/date.test.ts`: both locale formats, the 3 boundary dates from
  the story (including the 2028 leap day), and a direct `process.env.TZ` flip to two extreme
  offsets (UTC+14, UTC-12) asserting identical output.
- **AC8** — covered by `i18n/messages.test.ts` (key-parity, still green with the new/removed
  `Home.*` keys) and by both `HomeTable.test.tsx` and `app/page.test.tsx`'s
  `it.each(["ro","en"])` render tests, each asserting the other locale's text is absent.
- **AC9** — covered by `app/page.test.tsx`: empty-state in both locales, and a rejecting loader
  whose thrown message contains a fake connection string and the word "secret", asserting none
  of it (nor `postgres://`) reaches the rendered HTML.
- **AC10** — covered structurally (`home.pglite.test.ts` executes the production SQL statements
  against PGlite with the shipped migration, never a mocked re-implementation) and directly
  (the `pnpm build` run above, with `DATABASE_URL` unset).
- **AC11** — covered by running all four commands directly, as recorded above.

No acceptance criterion is uncovered. No test was found that merely asserts "the code runs"
without checking the actual behaviour described by its AC — each PGlite test asserts on real
rows/columns/values read back from Postgres-compatible SQL, and each render test asserts on
literal rendered text, not just absence of a thrown error.

VERDICT: PASS
