# US-049 QA checklist — Simplify ingestion, extraction, cron and health

Sprint 12 (simplification). No behaviour change beyond the one named allowance (A13: fetch error
detail text loses the raw URL/driver message, keeping only stage/kind/HTTP-status). No schema
change, no migration, no new dependency, no message-key change, no UI change. Every criterion was
provable locally; no live BVB/Neon/Vercel/API-key step is needed.

## Automated gates (already run and recorded in HANDOVER.md / US-049-tests.md / US-049-review.md)
1. `pnpm typecheck` — expect exit 0.
2. `pnpm lint` — expect exit 0 (11 pre-existing warnings, 0 errors).
3. `pnpm test` — expect 217 files / 2210 tests, all green. Run with `DATABASE_URL`, `CRON_SECRET`,
   `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset.
4. `pnpm build` — offline, expect `migrate-on-deploy: skipped (not a production build)` then a
   successful build with all 12 dynamic routes.

## Manual/spot-check steps for Codex QA
5. Serve the app offline (no DATABASE_URL) and spot-check `/`, `/etf/<any symbol>`, `/admin/*`,
   `/chat` in both `ro` and `en` — expect the same safe "could not load" translated states as
   before this story (no behaviour change). Compare against the DEC-020 §10 design reference for
   `/` if a screenshot is taken.
6. If a live cron run is ever observed (not required for this story): confirm `job_runs.log` and
   the `/api/cron/daily` JSON response, on any report that fails to fetch, contain only a stage/
   kind/HTTP-status detail (e.g. `discovery network`, `download http_error 404`) — never a raw
   URL or driver/fetch message. This is the one intentionally changed behaviour (A13); it's
   already proven offline by `lib/cron/fetch-detail.test.ts` FD-1..FD-5, so this step is optional
   confirmation only, not a new requirement.

## PO to confirm drafted criteria
AC1–AC6 were drafted by the Technical Lead chat from `CODE-REVIEW-20261004.md`, not by the PO.
No PRODUCT decision is open (DEC-009 technical items only, resolved in the plan's PL-1..PL-6).

## Non-blocking notes carried from independent review round 1 (not reopened)
- W3: `ingestEtf`'s happy path and `ingestNoAdapter`'s no-adapter path still each wrap
  `deps.discover(...)` in their own try/catch. Behaviour and request counts are correct and fully
  tested; the plan's A2 called for reducing this duplication further than it ended up being
  reduced. Cosmetic only.
- Note: `outcome.ts`'s `formatNoAdapterDetail` "discovery_error" case hand-duplicates
  `formatFetchError`'s string shape instead of calling it (byte-identical output).
- A8 (dropping the `isActive`/`parsePgBoolean` run-level filter) was skipped on purpose: AC4
  requires `run-deadline.test.ts` DL-5 and `run-daily.test.ts` RD-2a/RD-4 to stay unchanged, and
  those tests pin the filter. Available later if a future story wants it (`SPRINT-12-audit.md` or
  the tech-lead may revisit).

## Files changed
See `dev_minions/HANDOVER.md`'s "US-049" section for the full finding-by-finding record and the
"Files changed (US-049, this round)" list (this round's own edits — most of findings A1-A13 were
already implemented in an untracked prior session before this round started).
