# DEC-031 — Vercel-native daily schedule (build-time `vercel.ts` + Deploy Hook), no external ping

Status: **Decided** by the Technical Lead chat (2026-10-12), **conditional on spike S1** (US-064 AC0, a live check only the user can run). Supersedes DEC-030 §5 and §8 (external hourly ping, GitHub Actions). DEC-030 §1–4, §6, §7 (hour-only UTC setting, catch-up gate, atomic per-day claim, bearer check first) stay in force.

## Context
The user does not want GitHub Actions in the schedule path ("save the time in the system and let Vercel do it", 2026-10-12). Vercel facts, checked in the Vercel docs on 2026-10-12:
- A cron schedule exists only in the deployment's config. It changes only by redeploying; there is no API or CLI to edit a schedule on its own.
- Hobby: once per day, and Vercel may fire it anywhere inside the chosen hour (`0 8 * * *` = 08:00–08:59). Pro: per-minute, hourly crons allowed. An hourly expression on Hobby fails the deployment.
- `vercel.ts` (replaces `vercel.json`; only one of the two may exist) is executed **at build time** and may use `process.env` and `fetch`, so the `crons` entry can be computed from data.
- Deploy Hooks: a secret URL, `POST` triggers a rebuild of the hook's branch, no payload, 5 per project, 60 triggers per hour per project, build cache on by default.

## Options considered
| | Option | Verdict |
|---|---|---|
| A | Hourly GitHub Actions ping (DEC-030) | Rejected by the user |
| B | **Saved hour in the DB → `vercel.ts` reads it at build → app calls a Deploy Hook after each change** | **Chosen** — free, Vercel-only, one source of truth (the DB), one secret |
| C | Vercel Pro and `0 * * * *` with the existing gate | Valid, zero redeploys, exact-minute; costs money. Switch to it whenever the user upgrades: `vercel.ts` returns `0 * * * *`, the gate is already built |
| D | Vercel Workflow `sleep` loop or Queues delayed message | Rejected: Queues is beta; runs stay pinned to the deployment that created them (old code keeps running after each deploy; deleted deployments strand them) |
| E | Store the hour in a Vercel env var through the REST API, then Deploy Hook | **Plan B** if S1 fails (needs a Vercel API token = NEEDS USER) |

## Decision
1. **One config file.** Add `vercel.ts`; delete `vercel.json`. The only cron entry is `{ path: "/api/cron/daily", schedule: "0 <hour> * * *" }`, minute fixed at 0, hour = the saved UTC hour. No new dependency: `vercel.ts` exports a plain `config` object typed with a local structural type.
2. **Hour at build time.** A pure module `lib/config/cron-build.ts` (relative imports only, Neon HTTP driver, no `@/` alias, no Drizzle) runs `select cron_hour_utc from settings where id = 1`.
   - Invalid, NULL or no row → 10. Table does not exist (SQLSTATE 42P01, first ever deploy) → 10.
   - Production build and the query fails → retry 3 times (cold Neon), then **throw so the build fails**: the previous deployment stays live and keeps its schedule. This matches DEC-023, where the build already needs the database.
   - Not production, or no `DATABASE_URL` → 10, without touching the network.
   - Log one line `[vercel.ts] daily cron hour <h> UTC (source: db|default)`; never log the connection string.
3. **Apply on save.** After `setCronHour` writes, and only when the stored hour actually changed, the server action POSTs `VERCEL_DEPLOY_HOOK_URL` (server-side env var, 10 s timeout, injectable `fetch`). The save never rolls back because of the hook. Result states shown in `/admin/cron`: `applying` (redeploy started, active in about 2 minutes), `not_configured` (variable missing: applies at the next normal deploy), `failed` (hook error: same fallback). The URL is a secret: never logged, never returned to the browser.
4. **Gate and claim stay.** They are still needed: Hobby jitter inside the hour, duplicate cron delivery, the minutes between saving and the redeploy finishing (an old schedule can fire after the new hour was saved), and Run now. Nothing changes in the route, the handler or `job_runs`.
5. **Remove the external ping.** Delete `.github/workflows/daily-ping.yml` and its repository-root copy; remove the ping text, the safety-net text and the `vercel.json` import from `/admin/cron` and `lib/config/cron.ts` (`effectiveSchedule`, `findDailySchedule`); README stops listing the repository secrets.
6. **Honest UI text.** `/admin/cron` states: "Vercel runs the job once a day at some point between HH:00 and HH:59 UTC (HH:00–HH:59 Bucharest)". Moving the hour to one earlier than the current time means the first run is tomorrow; Run now covers today.
7. **User step (credential, DEC-015), one time:** Vercel → Settings → Git → Deploy Hooks → create "schedule" on the production branch → add its URL as Production env var `VERCEL_DEPLOY_HOOK_URL`. `DATABASE_URL` must be available to the build, which DEC-023 already requires. No GitHub secrets.

## Spike S1 (first item of US-064, user-run, cannot be proven offline)
On Vercel, confirm that a `vercel.ts` with top-level `await` (a) is accepted, (b) sees `DATABASE_URL`, (c) shows the computed schedule in Settings → Cron Jobs and in the build log line above. If (a) or (b) fails: Plan B (option E), then option C if the user prefers to pay. Agents write and test everything offline first; S1 is the user's acceptance check after the first push.

## Consequences
- Saving a new hour costs one extra build (about 1–3 minutes), and it deploys the newest commit of the hook's branch, so anything pushed is live.
- Hobby precision is "somewhere in the hour". The DEC-030 ping ran at the top of each hour; this is a small, documented regression and the price of staying free and Vercel-only.
- No schema change, no migration.
- US-062 (Awaiting QA) stays valid for the gate and claim. Its AC3 and AC4 (ping guidance, GitHub workflow, README secrets) are replaced by US-064.
