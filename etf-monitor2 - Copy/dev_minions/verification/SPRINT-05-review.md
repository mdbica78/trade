# Sprint 5 review: Administration panel

Reviewer: tech-lead subagent (in-loop, DEC-009), 2026-09-26.

Scope: `backlog/sprints/sprint-05.md` and `backlog/stories/US-020.md` to `US-024.md`, all drafted by `story-planner`.

Checked against:
- `requirements/etf-monitoring-requirements.md` (FR1, FR2, FR4.1, FR4.2, FR5, FR6, FR7, FR8.1, FR9–FR13, sections 3, 4, 5, 6);
- `backlog/roadmap.md` (Sprint 5 titles and "Carry-forward notes"), `backlog/epics.md` (EPIC-05 "Done when");
- `architecture/data-model.md`, ADR-001, DEC-007, DEC-010, DEC-015 point 6, `status.md` (P1, P4, P5, story board), `sprint-04.md` decisions 3 and 4;
- the code the stories cite: `lib/db/{seed,seed-data}.ts`, `scripts/db-seed.ts`, `test/helpers/pglite.ts`,
  `lib/ingestion/{store,outcome,ingest-etf,run-daily,job-run-summary,job-runs,load-etfs}.ts`,
  `lib/extraction/adapters/{types,registry,default-registry,brd-depositary}.ts`, `lib/extraction/{discovery,pdf}.ts`,
  `lib/monitoring/home.ts`, `lib/cron/vercel-config.test.ts`, `vercel.json`, `tsconfig.json`,
  `app/api/cron/daily/route.ts`, `components/AppHeader.tsx`, `messages/*.json`, `README.md`, `.env.example` (variable names only).

## Independent checks (what I read myself)
- **Seed counts** (US-020 AC1): `seed-data.ts` has 3 ETFs, 8 catalogue rows, 2 tracked fields per ETF (6 rows), 1 settings row. `seed.ts` uses `onConflictDoUpdate` for all four tables and re-selects the ETF id before inserting tracked fields, which is exactly the W2 defect. The PGlite helper pre-inserts BTBETRETF, as the story's verification note says.
- **Registry** (US-020 AC6/AC7): `registry.detect` returns an adapter only when exactly one `canHandle` matches; `list()` exists. Ingestion checks `canHandle` before `extract` (`ingest-etf.ts`, `format_not_recognised`), so a manual adapter override cannot produce a guessed value.
- **Available fields** (US-021 AC1): `BRD_FIELD_KEYS` has the same 8 keys as the catalogue.
- **Loaders** (US-020 AC5, US-021 AC5/AC6): `buildActiveEtfsStatement` (`home.ts`) and `buildLoadActiveEtfsStatement` (`load-etfs.ts`) exist and both filter `is_active = true`.
- **N4** (US-024 AC1): `ingest-etf.ts` lines 83–91 (throwing `registry.get` → `no_adapter`) and 132–140 (outer catch → `persist_error`) are as the story says; `run-daily.ts` declares its own `InternalErrorOutcome`; `isErrorOutcome` works by exclusion. Cited tests exist: IE-4, IE-6b-iii, IE-6c (`ingest-etf.test.ts`), IF-1a, IF-1b, the trigger map, "registry.get throws", IF-8c (`ingest-etf.failures.test.ts`). **Missed by the draft:** `outcome.test.ts` OC-8a pins the seven-code list with `toEqual`; fixed in place.
- **Log format** (US-024 AC3): `formatEtfLine` writes `<SYMBOL> <code> <date> <detail>` with the date only when the outcome has one; `buildStartRunStatement` inserts a NULL log, so a run swept before finishing has **only** `STALE_RUN_LOG_LINE` (no summary). The draft covered only "stale line appended"; fixed in place.
- **Cron** (US-023): `vercel.json` has a `$schema` key, and `vercel-config.test.ts` already has a once-a-day shape test plus a separate value pin. The draft said "no other top-level key" and "replace the pin with a shape check"; fixed in place. `resolveJsonModule` is on.
- **Durations** (US-020): the cron route exports `maxDuration = 60`; Server Actions inherit the page segment's config, so the admin ETF route needs the same. Added to decision 3 and the story.
- **Dates** (US-024 AC7): 2026-03-29 and 2026-10-25 are the last Sundays of March and October; Bucharest is UTC+3/UTC+2.
- **Dependencies**: US-003/005/007/015 are Done; US-008/009/013/014/016 are Awaiting QA (`status.md`). Order US-020 → {US-021, US-022, US-023, US-024} is right: all four add to US-020's admin layout, nav and `Admin.*` keys.
- **Carry-forward notes**: all five Sprint 5 notes are handled (seed → US-020; column union → US-021 AC5; how `cron_hour_utc` reaches Vercel → US-023 + decision 11; `parse_error` visibility, code translation and N4 → US-024; read layer reuse → every story). "Any sprint" debts picked up where a file is touched: README W5 (US-020), IF-8c (US-024), AppHeader N5 (US-020).
- **Scope** matches the roadmap titles and EPIC-05 "Done when". The only addition beyond the literal FRs is US-020's manual adapter override/re-detect (AC7); it is bounded to registered keys, safe (see Registry), and remains for the PO to confirm at the demo with every other drafted AC.
- **AC counts**: US-020 11, US-021 9, US-022 8, US-023 9 (sprint table said 8; fixed), US-024 11.

## Decisions table
- TECHNICAL #1, #2, #3, #7, #10, #12, #13 and the technical half of #11: **Decided** in place. #2 and #3 bind Sprint 6 → `decisions/DEC-016-shared-configuration-layer.md` (Decided).
- PRODUCT #4, #5, #6, #8, #14, #15, #16: isolated default can ship (literal FR / data-model reading, confined to the code each row names) → `NEEDS USER — default shipped`.
- PRODUCT #9 (API keys): isolated default can ship **partially** — provider/model choice in full; keys as Vercel environment variables with a set/not-set table. In-app key entry is the user's credentials decision. Not blocking.
- PRODUCT #11 (cron hour): isolated default can ship — desired hour stored, effective schedule from `vercel.json`, exact edit shown; takes effect after the user's redeploy. An automatic path is the user's credentials decision. Not blocking.

## Per story
- US-020: APPROVED — wording fixed in place (reactivation makes no network request and keeps name/`adapter_key`; `maxDuration = 60` on the admin ETF route).
- US-021: APPROVED — no change.
- US-022: APPROVED — no change; #9 key entry waits for the user, default ships.
- US-023: APPROVED — wording fixed in place (AC5/Task 3: `$schema` allowed, existing shape test kept, only the value pin removed; sprint table AC count).
- US-024: APPROVED — wording fixed in place (OC-8a added to the tests that change; stale-only log case; `running` row has no end time instead of "did not finish").

No story needs a `## Tech-lead review` section: every problem found was small enough to fix in place.

Denied or attempted commands: none. I ran no git command and read no `.env*` file other than the variable names in `.env.example`, and no credential file.

Verdict: APPROVED
