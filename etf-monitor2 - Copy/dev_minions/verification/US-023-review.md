# US-023 review — Admin: cron hour setting

## Round 1 — 2026-09-26

Verdict: PASS

Reviewer: story-reviewer (independent, fresh context). Read: `AGENTS.md`, `CLAUDE.md`,
`dev_minions/backlog/stories/US-023.md`, `dev_minions/verification/US-023-plan.md`,
`dev_minions/architecture/data-model.md` (cron_hour_utc row), sprint-05.md decision #11 (referenced from
the plan; not separately re-read line-by-line), and every file listed under "Files changed" for the
active story in `dev_minions/HANDOVER.md`. Ran `pnpm typecheck`, `pnpm lint`, the full `pnpm test`
suite, and `env -u DATABASE_URL pnpm build` myself in this round (all green — see command evidence
below); I did not re-run anything from a prior round.

### Scope check
`grep -rl` for the new symbols (`CronAdmin`, `effectiveSchedule`, `scheduleChangeNeeded`,
`suggestedScheduleLine`, `createCronConfigDeps`, `cron_hour_utc`, `cronHourResultToState`) across the
repo returns exactly the files on the HANDOVER "Files changed" list, plus three pre-existing files that
already referenced `cron_hour_utc`/`createCronConfigDeps` before this story (`lib/db/schema.ts`,
`lib/db/schema.test.ts`, `app/admin/ai/actions.test.ts` — the last is an unrelated US-022 "extra form
field is ignored" fixture). `vercel.json` itself is untouched (still `"0 10 * * *"`, confirmed by
reading the file). `app/api/cron/daily/route.ts` and `lib/cron/*`/`lib/ingestion/*` contain no
`cron_hour_utc`/`cronHourUtc` reference (grep, and BC-8 test, both confirm). No scope creep found.

### Acceptance criteria

- **AC1 (view effective time)** — MET. `lib/config/cron.ts:45-47` `effectiveSchedule()` reads only the
  statically-imported `vercelConfig` (`import vercelConfig from "../../vercel.json"`, line 4), never
  `fs` at request time. Test `VJ-1` (`lib/config/cron.test.ts:113-125`) reads the repo's own
  `vercel.json` with `node:fs` and asserts `effectiveSchedule()` equals the file's own schedule field.
  Unrecognised-schedule path: `CG-4`/`CG-4b` (`app/admin/cron/page.test.tsx:69-86`) assert the
  translated `unrecognisedSchedule` message and no `HH:00–HH:59` window. I re-ran `CP-1`/`CP-2`
  (`lib/config/cron.test.ts:16-47`) and they pass for the whitespace-tolerant and rejection cases.
- **AC2 (adjust desired hour)** — MET. `setCronHour`/`getCronHour` (`lib/config/cron.ts:69-117`) do a
  single upsert naming only `cron_hour_utc`. PGlite tests `CS-1` (other columns unchanged),
  `CS-2` (row created with column defaults), `CS-3`/`CS-3b` (NULL vs. 0), `CS-4` (invalid input leaves
  the row/table unchanged) — all in `lib/config/cron.pglite.test.ts`, all re-run and green. Validation
  rejection for text/24/-1/decimal is `CV-2` (`lib/config/cron.test.ts:152-176`), zero runner calls
  proven in the same test and by `CS-4`.
- **AC3 (how the change reaches Vercel)** — MET. `suggestedScheduleLine`/`scheduleChangeNeeded`
  (`lib/config/cron.ts:58-67`), tests `CP-4`, `CP-6` (`lib/config/cron.test.ts:79-111`). Render tests
  `CG-1` (match → no notice), `CG-2` (mismatch → notice with the exact escaped line), `CG-3` (not set →
  no notice), `CG-4c` (unrecognised effective + desired → notice still shown), `CG-5` (hour 0 case) —
  all in `app/admin/cron/page.test.tsx`, all re-run and green.
- **AC4 (nothing else changes at runtime)** — MET. `BC-7` (`lib/config/boundaries.test.ts:103-114`)
  allowlists `cron.ts`'s imports to `drizzle-orm`, `../db/index`, `../ingestion/store`,
  `../../vercel.json` only, and greps the source for `fetch(`/`readFile`/`writeFile`/`process.env`.
  `BC-8` (same file, lines 116-135) asserts no file under `app/api/cron/`, `lib/cron/`,
  `lib/ingestion/` mentions `cron_hour_utc`/`cronHourUtc` or imports `config/cron` (≥5 files checked,
  not vacuous — I confirmed this by grepping the same three directories myself). `CS-8`, `CA-5`,
  `CG-10` each stub `fetch` and assert it is never called. All re-run and green.
- **AC5 (still one daily job)** — MET, and the test change is the sanctioned one. The removed test was
  only the fixed-value pin ("schedule is the Decided default (SPRINT-03-review #3)"); the one-entry,
  path, once-a-day shape, and no-extra-key assertions in `lib/cron/vercel-config.test.ts` are
  byte-identical to before (I read the whole file). The plan (`US-023-plan.md` §1, AC5 row) cites
  Sprint 3 decision 3's "before US-023 makes the hour adjustable" wording, matching the story's
  "Notes for verification" instruction. This is a requirement change (FR12), not a weakened test.
- **AC6 (README)** — MET. README "Daily ingestion (cron)" (lines 106-133) documents the
  `/admin/cron` procedure, keeps the Hobby-precision note and the 10:00 UTC rationale, and no longer
  says "Until US-023 ships…" (confirmed by reading the section myself). `RD-1`
  (`lib/cron/vercel-config.test.ts:57-64`) checks both facts and passes; the three pre-existing README
  tests in the same file are untouched and still pass.
- **AC7 (bilingual)** — MET. New keys exist in both `messages/en.json` and `messages/ro.json` under
  `Admin.nav.cron`, `Admin.cron.*`, `Admin.messages.{cronSaved,cronCleared,invalidHour}` (read both
  files myself). `i18n/messages.test.ts` (key-parity, 4 tests) passes. `CG-8` proves ro/en render their
  own text and not the other's; `CG-7` proves the select has exactly 25 options in order with only one
  named control; `AL-4` (`app/admin/layout.test.tsx`) and `AM-4` (`components/admin/ActionMessage.test.tsx`)
  cover the nav link and the two new result messages in both locales. `pnpm lint` is clean (0 errors),
  so `react/jsx-no-literals` holds on the new `.tsx` files.
- **AC8 (failure states)** — MET, with one Warning (below). `CG-6` (`app/admin/cron/page.test.tsx:102-114`)
  makes `getCronHour` throw an error carrying a connection string and a secret, and asserts the
  translated `loadError`, the still-shown effective window, and no leaked text. `CA-4`
  (`app/admin/cron/actions.test.ts:65-76`) does the equivalent for the save action, asserting the
  generic error state and that `JSON.stringify(state)` contains none of the secret-shaped text.
- **AC9 (gates)** — MET. I ran, myself, in this round: `pnpm typecheck` (clean), `pnpm lint` (0 errors,
  3 pre-existing unrelated warnings in other files), `pnpm test` (93 files, 1078/1078 passed — matches
  the count in HANDOVER.md, and I reproduced it independently), and
  `env -u DATABASE_URL pnpm build` (succeeds; route list includes `ƒ /admin/cron`, confirming the
  static JSON import is embedded at build time with no `DATABASE_URL`). `dynamic = "force-dynamic"` is
  exported at `app/admin/cron/page.tsx:7` and asserted by `CG-9`.

### Non-negotiable rules (AGENTS.md)
- No AI in this story's code path — confirmed (BC-1's generic loop, which covers every `lib/config/*.ts`
  including the new `cron.ts`, forbids AI-shaped imports; it passed).
- One extraction adapter per format — not touched by this story; nothing here changes adapter behaviour.
- Missing report → empty day — not touched.
- Write rules (`data-model.md`) — the upsert names only `cron_hour_utc`; `ok` rows / report writes are
  untouched; no schema migration (the column already existed, confirmed in `drizzle/0000_init.sql:56`
  and `lib/db/schema.ts:112`).
- next-intl ro+en for every string — see AC7 above.
- Number display (DEC-007) — not applicable; only integer hours are shown, formatted as a fixed
  `HH:MM` string, not through the shared number formatter, which is correct here (not a "value" the
  DEC-007 comma/dot rule targets).
- No secrets in code or logs — see AC8; also grepped `lib/config/cron.ts` for `process.env` myself
  (none).
- No weakened or skipped tests — see AC5; the only removal is the sanctioned value-pin, with
  everything else in that file byte-identical.
- No scope creep — see "Scope check" above.

### Findings
- **Warning (W1):** the plan (`US-023-plan.md` §1, AC8 row) specifies `CG-6b` ("`createCronConfigDeps`
  (or `getDb`) throws `MissingDatabaseUrlError` → same [load error]") and `CA-4b` ("the deps factory
  throwing gives the same generic error state") as tests that isolate the deps-factory-throw code path
  specifically, as opposed to `getCronHour`/`setCronHour` throwing. The implemented `CA-4b`
  (`app/admin/cron/actions.test.ts:78-83`) exists by name but actually mocks `setCronHour` to reject
  with a differently-worded error — it does not make the deps factory itself throw, so it is really a
  restatement of `CA-4`, not new coverage. There is no `CG-6b` in `app/admin/cron/page.test.tsx` at all
  (only `CG-6`, which throws from `getCronHour`). The production code's `try { ... } catch` blocks in
  both `app/admin/cron/page.tsx:16-23` and `app/admin/cron/actions.ts:18-24` do structurally wrap both
  `getDb()`/`createCronConfigDeps()` and the config-layer call, so the failure-handling behaviour AC8
  asks for is still met by `CG-6`/`CA-4` (a thrown error, from wherever, produces the translated
  message, no secret text). This is a completeness gap against the plan's own test list, not a missed
  acceptance criterion — recommend adding the two isolated tests in a follow-up, not blocking this
  round.
- **Note (N1):** `status.md`'s Story board still shows `US-023 | ... | Ready` (not yet moved to an
  in-review/awaiting-QA state) — expected, since that update happens after both verification files are
  in and the round is closed; not a code issue.

### Files changed — reviewed
Every file under the "Files changed (active story)" list in `dev_minions/HANDOVER.md` (US-023 section)
was read in full this round: `lib/config/cron.ts`, `lib/config/cron.test.ts`,
`lib/config/cron.pglite.test.ts`, `lib/config/default-deps.ts`, `lib/config/boundaries.test.ts`,
`components/admin/CronAdmin.tsx`, `components/admin/sections.ts`, `components/admin/ActionMessage.test.tsx`,
`app/admin/cron/page.tsx`, `app/admin/cron/actions.ts`, `app/admin/cron/result-messages.ts`,
`app/admin/cron/page.test.tsx`, `app/admin/cron/actions.test.ts`, `app/admin/cron/result-messages.test.ts`,
`app/admin/layout.test.tsx`, `lib/cron/vercel-config.test.ts`, `messages/en.json`, `messages/ro.json`,
`README.md`, `dev_minions/architecture/data-model.md`, `dev_minions/backlog/stories/US-023.md`.

Denied or attempted commands: none.
