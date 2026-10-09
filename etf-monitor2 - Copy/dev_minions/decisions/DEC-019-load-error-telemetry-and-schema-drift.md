# DEC-019 — Diagnosable load failures, schema-drift visibility, pre-deploy gate

- Status: **Decided**
- Decided by the Technical Lead chat, 2026-09-28 (technical; no product, scope, cost or credential choice inside).
- Source: the first real deployment (2026-09-28): Vercel build failed on `app/health/page.tsx(38,94) TS2339`
  and the live home page shows only "Could not load the data". Sprint 8 (`backlog/sprints/sprint-08.md`).
  Binds Sprint 8 and every later page that loads from the database.

## Context
- Every page that reads the database catches all errors and renders a fixed generic text on purpose (AGENTS.md secrets
  rule; US-016 AC9, US-018 AC6, US-028 AC7). That is correct for the HTML, but it also throws the cause away: nobody,
  agent or user, can tell "`DATABASE_URL` missing" from "migration not applied" from "Neon asleep".
- Sprint 7 added `etf_report_links` (DEC-018 §4) and made the home query `left join` it. On a Neon database that has
  not had `drizzle/0001_etf_report_links.sql` applied, that one join fails the whole home table. The migration is a
  user-only step (AGENTS.md: no agent migrates Neon), and Vercel deploys code before anyone can run it.
- `/health` only counts `etfs` and `field_catalog`, so it says "connected" even when the schema is behind.
- The Vercel build failed on a type error the local gates had reported green. The working tree changed after the
  last verified run (`app/health/page.tsx` lacked the US-031 timeout branch its own HANDOVER entry describes).

## Decision
1. **Sanitised server-side log for every load failure.** A new `lib/log/load-error.ts` exports
   `describeLoadError(error)` and `logLoadError(scope, error)`. It walks `error` and up to three `cause` levels
   (Drizzle wraps the driver error) and emits exactly one `console.error` line:
   `[load-error] <scope> name=<ErrorName> code=<SQLSTATE> relation=<identifier>`.
   `code` only when it matches `^[0-9A-Z]{5}$`; `relation` only when it matches `^[a-z_][a-z0-9_]*$` (from the driver's
   `table` field, or parsed from `relation "x" does not exist`). Never the message, stack, cause text, a query, a
   parameter, or any string containing `://` or the value of `DATABASE_URL`. The rendered HTML is unchanged: still the
   generic translated text, no name, no code. Vercel's function logs become the diagnosis surface.
2. **`/health` reports schema drift.** `getHealthStatus` also checks that every table declared in `lib/db/schema.ts`
   exists (tables derived with Drizzle's `getTableName` over the schema exports, never a hand-kept list; one
   `to_regclass` statement; inside the existing 8 s timeout). A missing table is shown as a translated line
   "schema out of date, run `pnpm db:migrate`" plus the table identifiers. Identifiers are not secrets. The raw
   exception text rule (P15) is untouched.
3. **`etf_report_links` is optional enrichment for the home table.** If the home batch fails with SQLSTATE `42P01` and
   relation `etf_report_links`, the loader re-runs the same read without that join (links then come from
   `reports.source_url` only, the pre-US-030 behaviour) and logs the failure through §1. Any other error, and a `42P01`
   on any other relation, still ends in the error state. This is the only table given this treatment: it is the only
   one added after the first deploy and the only one whose absence has a correct degraded reading. A future additive
   table is treated the same way only by amending this DEC.
4. **Pre-deploy gate script.** `scripts/claude/predeploy-check.sh` (kit-owned, written by the Technical Lead) runs
   `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` in that order with `DATABASE_URL`, `CRON_SECRET`,
   `GEMINI_API_KEY`, `GROQ_API_KEY` unset, stops at the first failure and prints one PASS/FAIL line. The user runs it
   before committing. It runs no git, no network call of its own, and prints no variable value.
5. **Test time limits are raised, not test logic.** The two known load-only failures (`app/chat/page.safety.test.tsx`
   CPS-1, PGlite `beforeEach` hooks) are 5 s / 10 s limits hit on a slow drvfs volume. `vitest.config.ts` gets named
   `testTimeout` and `hookTimeout` values with a comment; no assertion is edited, weakened or skipped (Sprint 6 N5).

## Not decided here
- Whether `/health` should stop showing the raw exception text (P15, product; unchanged, default shipped).
- Automatic migration on deploy: needs a Neon credential in the build, so it is a user/credential decision. Not proposed.

## Consequences
- US-033 changes the catch blocks of the pages; their existing tests keep asserting "no exception text in the HTML"
  and add a `console.error` spy assertion with a sentinel that must not appear in the logged line.
- A new table added later must be added to the probe automatically (derived list) and its story states whether it is
  optional enrichment (amend §3) or required (then `/health` flags it and the page errors, as today).
- DEC-015 point 4 still holds: a verifier's verdict cites only what it ran. The Sprint 8 stories add a working-tree
  cross-check (US-032 AC3) because the last gate output and the tree disagreed.
