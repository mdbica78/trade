# US-013 — Independent review

## Round 1 — 2026-09-24

Verdict: PASS

Reviewer: `story-reviewer` subagent (fresh context, did not write this code). No git commands were run (or attempted) during this review — only `pnpm typecheck`/`pnpm lint`/`pnpm test`/`pnpm build` (plus `rm -f .next/lock`, a transient stale build lock, to complete the build verification).

Inputs read: `AGENTS.md`, `dev_minions/backlog/stories/US-013.md`, `dev_minions/verification/US-013-plan.md`, `dev_minions/requirements/etf-monitoring-requirements.md` (FR3, FR4.1/4.2, FR12, FR13), ADR-001, and every file listed under "Files changed" in `HANDOVER.md`. Cross-checked `dev_minions/.files-touched.log` for the US-013 span — every file it lists matches "Files changed" exactly; nothing else was touched for this story (`.env.example` untouched, `package.json`/lockfile untouched, no UI/`messages/*` touched, as the plan requires).

### Acceptance criteria

- **AC1 (auth)** — MET. `handleDailyCron` (`lib/cron/daily-handler.ts:41-63`) checks `cronSecret` unset/blank → `500` before anything else, then a constant-time (SHA-256 digest + `timingSafeEqual`, `daily-handler.ts:11-18`) bearer comparison → `401` on mismatch, only then `deps.run()`. Proved by `lib/cron/daily-handler.test.ts` (H-1a..h, all bad-header cases give 401 with `run` never called; H-1g correct bearer → 200; H-1h unset/empty/whitespace secret → 500, `run` never called even with `Bearer `/`Bearer undefined`) and `app/api/cron/daily/route.test.ts` (RT-1a/b/c against the real route + real env, including proof the secret is read per-request, not at module load). H-1f additionally proves neither `loadEtfs` nor `ingest` runs on bad auth, composed with the real `runDailyIngestion`. One test (H-1e) asserts a trailing-space bearer authenticates rather than 401s; I independently verified this against the real platform `Request`/`Headers` (`node -e 'new Request(...).headers.get(...)'`) — the Fetch `Headers` implementation strips trailing HTTP whitespace before the handler ever sees the value, so the test reflects real platform behaviour, not a weakened check (and is not exploitable: the value the handler receives is normalized to exactly `Bearer <secret>`).
- **AC2 (every active ETF once, tracked keys in order)** — MET. `runDailyIngestion` (`lib/ingestion/run-daily.ts:23-51`) skips `isActive !== true`; `lib/ingestion/load-etfs.ts` filters `is_active = true` in SQL and orders `display_order, field_key`. Proved by `run-daily.test.ts` RD-2a/RD-2d (fake loader, inactive ETF never called or in the summary), `load-etfs.test.ts` (SQL text asserted, grouping/mapping unit test), and `load-etfs.pglite.test.ts` LP-2b (real SQL against PGlite: order-tie-break, no-tracked-fields ETF, inactive-with-tracked-fields ETF excluded) — this is the strongest kind of proof here since it runs the shipped SQL, not a mock.
- **AC3 (isolation)** — MET. `run-daily.ts:40-46` catches both a returned failure and a thrown/rejected `ingest`. `run-daily.test.ts` RD-3a (failed + throw + ok, all three recorded in order, `internal_error` shape for the throw), RD-3b (non-`Error` throw → `String()` detail), and an unlabelled test for a rejected promise. `daily-handler.test.ts` H-3c proves the same mix survives through the handler to a `200` JSON body.
- **AC4 (no retries, sequential)** — MET. Plain `for...of` with `await`, no `Promise.all` (`run-daily.ts:27`). RD-4 checks call counts; RD-4b uses an in-flight counter with a real `setTimeout` to prove the second ETF never starts before the first resolves (`maxInFlight` never exceeds 1) — a real concurrency proof, not just call-order.
- **AC5 (`vercel.json`)** — MET. Exactly one cron entry, `path: "/api/cron/daily"`, `schedule: "0 10 * * *"` (`vercel.json`). `lib/cron/vercel-config.test.ts` VC-5 parses the file from disk, checks field shapes/ranges generically and then pins the exact Decided value, and checks no extra top-level key besides `$schema`.
- **AC6 (responses)** — MET. `jsonResponse`/`redact` (`daily-handler.ts:20-39`) route every response through one redaction helper; `500 not configured`, `401`, `500 run could not start` and `200` all go through it. `daily-handler.test.ts` H-6a/b/c cover all four response shapes, including H-6c which deliberately embeds both the cron secret and a Neon-shaped `DATABASE_URL` inside outcome messages and asserts neither string appears in any of the four response bodies, and that `[redacted]` does appear. `route.test.ts` RT-6 proves the real `getDb()` → `MissingDatabaseUrlError` path is caught, not left unhandled.
- **AC7 (route exports, build)** — MET. `app/api/cron/daily/route.ts` exports exactly `GET`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`, checked structurally by RT-7a (`Object.keys(...).sort()`) so no extra export can silently appear. RT-7b pins the duration-budget arithmetic from the plan's R1 (3 ETFs × 2 × 7000 ms + 15000 ms ≤ 60000 ms). I independently ran `pnpm build` (after clearing a stale `.next/lock` — same transient lock symptom noted in the US-010 QA log, not a code defect) and confirmed the production build succeeds with the real ingestion chain, including `unpdf`; the build output lists `ƒ /api/cron/daily` as a dynamic route.
- **AC8 (README)** — MET. `README.md`'s `CRON_SECRET` entry (lines 69-73) states it is required in production and describes the exact 500/401 contract; the new "Daily ingestion (cron)" section (lines 94-115, read in full) documents the schedule and its source (`vercel.json`), the manual-trigger curl commands (local and deployed), Production-only cron execution, and the US-023 note on changing the hour. `lib/cron/vercel-config.test.ts` VC-8 guards against a regression (no more "Reserved" next to `CRON_SECRET`; the key strings are present).
- **AC9 (MANUAL-QA)** — Correctly deferred. The plan lists concrete deployment-only checks (Vercel Cron Jobs listing, live 401/200 curl calls against the deployment, Neon row verification, next-day unattended-run check) that genuinely need a live Vercel/Neon resource this loop cannot reach. Verdict here: **MET (manual QA)** — pending the `US-013-qa.md` checklist and the Codex QA/Deploy loop, as designed by DEC-013. Not blocking for this gate.
- **AC10 (gates)** — MET, independently re-run in this review (not just trusted from HANDOVER.md): `pnpm typecheck` clean; `pnpm lint` exits 0 with only the two known pre-existing unused-test-parameter warnings (`types.test.ts:10`, and this story's own `load-etfs.test.ts:23` — same style, not a new class of problem); `pnpm test` → 486/486 passed (39 files); `pnpm build` → succeeds (after clearing the stale lock file, a filesystem artifact, not a code issue).

### AGENTS.md non-negotiables

- Deterministic extraction, no AI: unaffected — this story adds no extraction logic, only orchestrates the existing US-012 pipeline. OK.
- One adapter per report format: unaffected, unchanged. OK.
- Empty day on missing report / no retries: `runDailyIngestion` calls `ingest` exactly once per active ETF per request (AC4), matching FR4.1. OK.
- next-intl ro+en for every UI string: the cron response is a JSON API payload, not UI (story Notes explicitly says so) — correctly out of scope. OK.
- Number display per DEC-007: no numbers are formatted for display here (raw JSON). N/A.
- Secrets only in env, server-side, never logged: `readEnv()` reads `process.env` only inside `lib/cron/default-deps.ts` (outside `lib/ingestion`, so the existing `boundaries.test.ts` no-`process.env` scan for `lib/ingestion/**` still holds and now also scans the two new `lib/ingestion` files, `run-daily.ts`/`load-etfs.ts`, confirmed neither imports `next`/`react`/app/AI or reads `process.env`). Console error logging uses `error.name` only, never the message (`daily-handler.ts:58`), so a connection string can't leak into Vercel's function logs either. `.env.example` untouched. OK, no secrets in code or logs.
- No weakened or skipped tests: none found. The one test-expectation change from the plan's original sketch (H-1e, trailing-space bearer) is a correction to match verified real platform behaviour, not a weakening — documented above and independently re-verified by me. No test was deleted or its assertion loosened to force a pass.
- No scope creep: confirmed via `.files-touched.log` cross-check — exactly the files listed in HANDOVER.md's "Files changed" were touched for US-013, nothing else. `job_runs` bookkeeping (US-015), `settings.cron_hour_utc` (US-023) and admin auth are correctly left out of scope, matching the story's own "Out of scope" section.

### Findings

No Critical findings.

No Warning findings.

Notes (non-blocking):
1. `default-deps.cron.test.ts` was split into its own file specifically so its partial `vi.mock("../extraction/discovery", ...)` doesn't disturb the existing `createDefaultIngestDeps` identity test in `default-deps.test.ts` — confirmed both files pass together and in isolation; Vitest's per-file module registry makes this safe, but it's worth a comment in the file itself for the next reader (currently only explained in the plan, not in the test file).
2. The stale `.next/lock` that blocked my first `pnpm build` attempt is the same transient concurrent-build-lock symptom the Codex QA log recorded for US-010 — environmental, not a defect in this story's code; clearing the lock file let the build proceed and pass.
3. `timingSafeEqual` over SHA-256 digests (rather than the plan's literal wording "equal-length buffers") is a slightly stronger implementation than the plan asked for: hashing first guarantees a fixed 32-byte comparison regardless of input length, so there's no length-based branch to worry about at all. This exceeds the (non-AC) "good practice" note in the story, in a good way — flagging only so the next reader understands why it looks different from the plan's literal snippet.

### Gate commands run independently by this review

```
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
pnpm typecheck   # clean
pnpm lint        # 0 errors, 2 known pre-existing-style warnings
pnpm test        # 39 files, 486/486 passed
pnpm build       # passed (after clearing a stale .next/lock)
```
