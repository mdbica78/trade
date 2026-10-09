# Tech-lead brief — Sprint 14 (PO, 2026-10-09)

Mode: `sprint-review 14`, then detail the technical plan. **Nobody writes code in this step**, not you and not the PO. Your output is the technical detail the dev agent will code from. Read first: `dev_minions/HANDOVER.md`, `backlog/sprints/sprint-14.md`, `backlog/stories/US-059.md`..`US-063.md`, `decisions/DEC-030-user-editable-cron-hour.md`, `architecture/data-model.md`, `lib/db/schema.ts`.

## Your job
1. Treat the five user needs below as the business requirements. The existing story files and DEC-030 were drafted by the PO with technical defaults; they are **suggestions, not decisions**. Keep, change or replace them.
2. For each story write `verification/US-0XX-plan.md`: files to change, data/schema impact (state explicitly "no schema change" or give the migration), test plan (new tests + deliberate test changes), risks, and an order of work.
3. Settle every technical decision (set Decided in the DEC / sprint "Decisions needed" table). Leave PROPOSED / NEEDS USER only for product, cost or credential questions, with an isolated default.
4. Fix the story files so the acceptance criteria are testable, each citing its FR.
5. Return a build order and the dev/QA hand-off (who does what, which gates, which MANUAL-QA steps). Do not mark any story Done.

## Business requirements (from the user)
1. **/chat list commands.** The user can type things like "list all custom values", "list widgets", "list tracked ETFs", "list tracked fields" (or similar) and see the answer. Decided by the user: the AI model answers from its context, as today. No deterministic server-side list commands. Scope: context content, prompt examples, chat help text (ro/en), regression fixtures. Watch the prompt-size tests CP-12/CP-18 (about 7761 of 8000 chars used when empty) and the substrings CP-12 pins.
2. **/admin/etfs looks childish.** Professional look: an ETF symbol dropdown that shows that ETF's menu/details; the "Add an ETF" section redesigned. User decision: add by **symbol only**; the name is auto-detected from the BVB page, falling back to the symbol. Note `etfs.name` is `notNull` (schema.ts line 20): decide fallback-in-code vs schema change, and whether re-detect refreshes the name. Check `lib/config/etfs.ts`, `detect-adapter.ts`, `lib/extraction/discovery.ts` for where the name can be read, and the existing admin tests/golden snapshots.
3. **/admin/ai looks ugly.** Provider/key section as a dropdown-style menu; a better look for "your own provider" (custom providers). Constraint DEC-021: keys stay write-only and are never rendered. Confirm no schema impact (custom-provider tables from migration 0005, per-provider models from 0006/DEC-029).
4. **Daily job hour editable by the user, no developer or Vercel edit.** User decision: an external free scheduler (GitHub Actions or cron-job.org) pings `/api/cron/daily` hourly; the app runs the job only in the hour the user sets in the admin. Facts: `settings.cron_hour_utc` (integer, nullable, schema.ts ~line 123) already exists and nothing reads it; BC-8 in `lib/config/boundaries.test.ts` pins that the route never reads it, so it needs a deliberate test change; today the schedule is a static `vercel.json` import in `lib/config/cron.ts`. Decide and spec: gate rule (hour reached + no run today), what counts as "already ran today" in `job_runs` (any run, or only final ok?) and the UTC-date rule, that a skipped ping writes **no** `job_runs` row, whether `job_runs.started_at` needs an index (if so, expand-only migration via `pnpm db:generate` only), meaning of `NULL` (default 10?), hour-only vs hour+minute, UTC with Bucharest display, whether `vercel.json` cron stays as a safety net, auth on the endpoint (`CRON_SECRET`), and the sample GitHub Actions workflow + README steps. DEC-030 claims "no migration": **verify, do not trust**. Update `architecture/data-model.md` if anything changes.
5. **/admin/operations job runs: scroll, not an infinite table.** A bounded, scrollable region. The PO already wrote a candidate implementation (see below); adopt or discard it in your plan.

## Constraints you must honor
- AGENTS.md: no git, no deploy, no Neon migration run (migrations only via `pnpm db:generate`, expand-only, applied by the production build, DEC-023); never read `.env*`/secrets; PDF extraction stays deterministic; never weaken tests; every UI string via next-intl in ro **and** en; no login, ever.
- DEC-020 styling: tokens in `app/globals.css`, both themes, WCAG AA contrast; golden snapshots in `components/admin/__snapshots__/admin-markup.golden.test.tsx.snap` — any deliberate markup change must be listed.
- DEC-021 key handling; DEC-023 migrations; DEC-029 model per provider.
- Copilot has no subagents: write the plans so the dev agent can implement one story at a time without needing a decision.

## Known state to reconcile
- US-063 was **coded ahead of the plan by the PO** (out of role): `components/admin/OperationsDashboard.tsx` (max-h-96 scroll region, sticky header, `data-runs-scroll`), `Admin.operations.runsScrollLabel` in `messages/en.json`/`ro.json`, test OD-SC1. Focused tests passed (12) and a wider admin run (59); typecheck/lint/full suite/build not confirmed; no independent review. Decide: keep as the implementation (then plan = review + gates) or revert and re-plan.
- No story file currently has a "Data / schema impact" section; add one to each.
- Suggested order (PO view, you may change it): US-063, US-060, US-061, US-062, US-059. US-062 is the riskiest (route behaviour, BC-8, possible migration).

## Output expected
Plans per story, updated story/sprint/DEC files, updated status.md rows, a short hand-off note in HANDOVER.md (keep `Automation state: PAUSED — Copilot`), and the list of anything that truly needs the user.
