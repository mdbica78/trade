# Sprint 1 audit — Foundation

Auditor: tech-lead subagent (in-loop, DEC-009), 2026-09-23.
Scope: US-001 … US-006 (US-001/002/003 Done, US-004/005/006 Awaiting QA). Read each story, its
plan, review and test verdicts, and the changed code. Checked each acceptance criterion against
the code and tests myself. Ran `pnpm test` once (`env -u DATABASE_URL`, `NODE_EXTRA_CA_CERTS`
exported): **13 files, 56/56 passed**, exit 0. The only stderr output is next-intl's
`ENVIRONMENT_FALLBACK` timeZone warning. I ran no git command and read no `.env*` file other
than the committed template `.env.example`.

Verdict: PASS

No Critical findings, so no story is re-opened. The Warnings below should become follow-up
work (a small fix story, or the first Sprint 2 story that touches the file). None of them makes
an acceptance criterion false today.

## Per story

| Story | ACs checked against code/tests | Result |
|---|---|---|
| US-001 | Fixtures (3 PDFs in `test/fixtures/`), FINDINGS recommendation, OCR = no, number format documented | OK |
| US-002 | Scripts, folder structure, `.env.example`, README | OK |
| US-003 | Schema vs `architecture/data-model.md` column by column, 4 unique constraints, 3 FKs with cascade, `CHECK (id = 1)`, `MissingDatabaseUrlError` | OK |
| US-004 | AC1–AC7 plus task 5 (README convention) | OK. W3 (README convention wrong for async components) |
| US-005 | AC1–AC5. Seed values match the story tables exactly (symbols, names, URLs, 8 labels, units, tracked 0/1, settings) | OK. W1, W2, W5 |
| US-006 | AC1–AC6 | OK. W3, W4, W6 |

## Critical

None.

## Warning

- **W1 — US-005: AC1/AC2 marked "MET" with no evidence, and no test exercises `seed()`.**
  `dev_minions/verification/US-005-review.md:15` and `:25` mark AC1 and AC2 as "MET (manual QA)".
  Nothing was verified: the live run has not happened yet. The correct wording is "UNVERIFIED —
  MANUAL-QA". The only automated check is `lib/db/seed-data.test.ts:24-28`, which checks array
  lengths. `lib/db/seed.ts` itself has no test. All 56 tests would still pass if `seed()` dropped
  the tracked-fields loop, used the wrong conflict target or skipped the settings row. A
  mocked-`Db` test is cheap and needs no live resource: record the `insert().values()` and
  `onConflictDoUpdate({ target })` calls, then assert 3 + 8 + 6 + 1 rows and the correct targets.
  It would give AC1/AC2 real pre-QA evidence. The story-tester also cites a non-existent
  `onConflictDoNothing` path (`US-005-tests.md:22`). This is a sign it mapped the plan, not the
  code.
- **W2 — US-005: re-running the seed overwrites user configuration.** `lib/db/seed.ts:17-20, 44-47, 54-57`
  use `onConflictDoUpdate`. The story asks for this ("upsert on the unique keys"), and on a fresh
  database a second run is value-identical, so AC2 holds. Once Sprint 5's admin area exists,
  though, `pnpm db:seed` would reset `settings.default_locale`, per-ETF `display_order`, ETF
  names and catalogue labels. It would also re-insert tracked fields the user removed. Fix before
  Sprint 5: either use `onConflictDoNothing` for user-editable tables (`tracked_fields`,
  `settings`, arguably `etfs`), or document in the README that `db:seed` is a first-install
  bootstrap only.
- **W3 — US-006 reviewer Warning #1 is technically wrong, and following it would break `/health`.**
  `dev_minions/verification/US-006-review.md:33` (repeated in `US-006-qa.md:22` and HANDOVER
  "Waiting on the user") tells the next author to switch `app/health/page.tsx` to the sync
  `useTranslations`/`useLocale`. `HealthPage` is an `async` component because it awaits the DB.
  next-intl throws in that case:
  `node_modules/next-intl/dist/esm/development/react-server/useConfig.js:9` — "`useTranslations`
  is not callable within an async component". The change would turn `/health` into a 500, which
  breaks AC2. The implementation is correct. The defect is in `README.md:45-47`, which says
  `next-intl/server` is for `app/layout.tsx` only. Fix: change the README rule to "sync
  components → `useTranslations`/`useLocale`; async server components (and layout/metadata) →
  `getTranslations`/`getLocale` from `next-intl/server`", and withdraw the QA note. Do **not**
  act on the reviewer's recommendation.
- **W4 — US-006: the most likely real-world failure path has no test.** `app/health/page.tsx:6-12`
  (`loadHealthStatus`) catches `getDb()` throwing `MissingDatabaseUrlError`. That is exactly what
  a fresh Vercel deployment without `DATABASE_URL` hits. `app/health/page.test.tsx:11-12` mocks
  `getDb` to return `{}` and mocks `getHealthStatus`, so the catch is never exercised. Removing
  it leaves all tests green but gives a 500. Add one page test where `getDb` throws and assert
  that the `dbUnreachable` text and the error message render.
  Related: `lib/health.test.ts:14-19` returns `{count: 3}` for both tables. An implementation
  that counted `etfs` twice, or swapped the two fields, would still pass. Use the `table`
  argument the fake already receives to return different counts. `lib/health.test.ts:34` is
  mis-named: it tests a synchronous non-`Error` throw, not "leaking the query builder".
- **W5 — US-005/US-006: `.env.local` is not loaded by `db:seed` or `db:migrate`.**
  `README.md:64-68` says "Copy `.env.example` to `.env.local`… Required to run migrations, the
  seed script". `tsx scripts/db-seed.ts` loads no env file, and drizzle-kit's bundled dotenv reads
  `.env`, not `.env.local`. A user who follows that paragraph gets `MissingDatabaseUrlError`,
  whose message (`lib/db/index.ts:8`) tells them to "Set it in .env.local", which they already
  did. The QA checklists (`US-005-qa.md`, `US-006-qa.md`) and README deployment steps use an
  inline `DATABASE_URL=<url> pnpm …`, which works. So QA is not blocked, but the docs contradict
  each other. Fix: README says the CLI scripts need the variable exported or inline (or
  `tsx --env-file=.env.local`), and the error message mentions both.
- **W6 — US-006: an unreachable-by-timeout database may still produce a 504, not the AC2 failure
  state.** `lib/health.ts:11-14` has no query timeout. A refused connection (the QA step 9 URL
  `127.0.0.1:1`) fails fast and renders correctly. A black-holed host or a very slow Neon wake
  would instead hang until the Vercel function timeout. Consider a `Promise.race` timeout of a
  few seconds that resolves to `{ dbConnected: false, error: "timeout" }`, with a unit test.

## Note

- **N1 — Process, US-006 planned in-session although it is infra.** `US-006-plan.md:3` classifies
  the story as "no … cron/infra change" and skips story-planner. CLAUDE.md's "complex story"
  definition includes cron/infra, and this story is the deployment chain. The outcome was fine.
  Flag it so the classification is not repeated for Sprint 3's cron story.
- **N2 — US-004: no `timeZone` in `i18n/request.ts:9`** (reviewer finding 1, confirmed). The
  warning shows in every render test. Set `timeZone: "Europe/Bucharest"` before the first story
  that formats dates (Sprint 3/4).
- **N3 — US-006: `/health` is dynamic only indirectly**, because the layout reads the locale
  cookie. `app/health/page.tsx` has no `export const dynamic = "force-dynamic"` (or
  `await connection()`). If the locale source ever changes, the page could be prerendered at
  build time with a stale or failing DB result. One line makes the intent explicit.
- **N4 — US-006: the raw driver error is shown on a public page** (`app/health/page.tsx:31`). The
  story explicitly asks for "the error message", so this is not a defect. Revisit when auth
  arrives (roadmap).
- **N5 — US-004: `components/AppHeader.test.tsx:25-29`** does not assert the `Nav.health` link
  added by US-006. Minor coverage gap (reviewer finding 3, confirmed).
- **N6 — Architecture doc contradicts the spike.** `dev_minions/architecture/data-model.md:85`
  says the reports use `.` as thousands separator. `spikes/pdf-extraction/FINDINGS.md:41`
  measured `,` thousands / `.` decimal on all three fixtures. The Sprint 2 adapter must follow
  FINDINGS. The chat Technical Lead or PO should correct the data-model note.
- **N7 — Sprint DoD "US-001 decision recorded in `decisions/`".** It was recorded in
  `architecture/ADR-001-tech-stack.md:20,28` instead (unpdf, OCR not needed). Equivalent. No
  separate DEC needed.
- **N8 — Sprint DoD still open on the user's side:** Vercel URL reachable, `/health` shows a
  successful Neon query, RO/EN switch in a browser, three BRD ETFs seeded. All are in
  `US-004/005/006-qa.md`.

## Process rules

- **git:** I scanned all five `dev_minions/automation/logs/autopilot-20260923-*.jsonl` for Bash
  commands invoking git and found none. Every verdict file for US-003…US-006 states that no git
  was run. The only known breach is US-002's reviewer (read-only `git status/log/diff`). It is
  already logged in HANDOVER, and the kit was hardened after it (DEC-009).
- **`.env*`:** the logs show reads of `.env.example` only (the committed, secret-free template).
  No `.env`/`.env.local` read.
- **Files changed vs `.files-touched.log` (DEC-011):** the US-005 and US-006 QA "Files changed"
  lists match the log. `pnpm-lock.yaml` is written by pnpm, not a tool write, so it is
  legitimately absent from the log.
- **Rubber-stamping:** see W1 (MET used for unverified live criteria) and W3 (a reviewer
  recommendation that is technically wrong went unchallenged into the QA checklist and
  HANDOVER). Otherwise the reviews quote real code and their line references check out.
