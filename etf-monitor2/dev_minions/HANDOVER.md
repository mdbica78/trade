# HANDOVER — live state of automated delivery
_Last updated: 2026-09-26 09:44 by Claude Code (autopilot resumed under /goal)_
Automation state: RUNNING

Read this first, whatever agent you are (Claude Code, GitHub Copilot). Rules: AGENTS.md and `dev_minions/process.md` §5. Agents never run git — not even read-only; the user does.

## Active story
- US-021 — Admin: tracked-field management per ETF
- Phase: plan (about to delegate to story-planner; complex story per CLAUDE.md — DB writes that drive the home table and daily job, 9 ACs)

## Acceptance criteria (active story)
- Not detailed yet in HANDOVER terms — see `dev_minions/backlog/stories/US-021.md` for its drafted ACs.

## Files changed (active story)
- none yet

## US-020 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-020-review.md`), tests PASS (`US-020-tests.md`, 901/901). QA checklist written (`US-020-qa.md`). status.md → `Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`. Files changed for US-020 (final):
- `dev_minions/verification/US-020-plan.md` (new, by story-planner)
- `lib/db/seed.ts` (rewrite: insert-if-absent, one BatchRunner call)
- `lib/db/seed.pglite.test.ts` (new)
- `scripts/db-seed.ts` (uses neonBatchRunner)
- `test/helpers/pglite.ts` (added `createEmptyTestDatabase`; `createTestDatabase` now wraps it)
- `README.md` (env var CLI note, seed re-run note, new "Administration" section)
- `lib/ingestion/load-etfs.ts` (export `parsePgBoolean`, no behaviour change)
- `lib/config/detect-adapter.ts` (new)
- `lib/config/detect-adapter.test.ts` (new)
- `lib/config/etfs.ts` (new)
- `lib/config/etfs.test.ts` (new)
- `lib/config/etfs.pglite.test.ts` (new)
- `lib/config/default-deps.ts` (new)
- `lib/config/boundaries.test.ts` (new)
- `test/helpers/module-specifiers.ts` (new, shared with lib/ingestion's existing boundary test pattern)
- `messages/ro.json`, `messages/en.json` (new `Admin` namespace)
- `components/admin/sections.ts`, `AdminNav.tsx`, `action-state.ts`, `ActionMessage.tsx`, `ActionMessage.test.tsx`, `ActionForm.tsx`, `EtfAdmin.tsx` (new)
- `components/AppHeader.tsx` (added `/admin` nav link)
- `components/AppHeader.test.tsx` (N5 assertions for Admin + Health hrefs)
- `app/admin/layout.tsx`, `app/admin/layout.test.tsx` (new)
- `app/admin/page.tsx`, `app/admin/page.test.tsx` (new)
- `app/admin/etfs/page.tsx`, `app/admin/etfs/page.test.tsx` (new)
- `app/admin/etfs/actions.ts`, `app/admin/etfs/actions.test.ts` (new)
- `app/admin/etfs/result-messages.ts`, `app/admin/etfs/result-messages.test.ts` (new)

## Failing / open
- US-020: none — closed out this round, Awaiting QA.
- US-021: nothing yet, plan not started.

## Exact next step
- Delegate to `story-planner`: "plan US-021" (complex story, sprint-05.md).

## Waiting on the user
- Consolidated list (security, product decisions, acceptances, live checks, git): `status.md` → "Waiting on you". The PO keeps that list; add only **new** items below, one line each.
- Kit update (DEC-014, DEC-015): run `bash scripts/claude/install-kit.sh` before restarting the autopilot; start Codex with `automation/qa-goal.txt` right after.
- Sprint 5 decision #9 (US-022, API keys): default ships (provider/model selection in full; keys stay as Vercel env vars, page shows only set/unset). Confirm, or ask for in-app key entry (would need its own credentials DEC).
- Sprint 5 decision #11 (US-023, cron hour): default ships (admin stores the hour, shows the exact `vercel.json` line to change; takes effect after your commit + redeploy). Confirm, or ask for an automatic path (would need a Vercel token/credential).

## Log (newest first, one line each)
- 2026-09-26 — US-020 (admin ETF management) round 1: review PASS, tests PASS (901/901); QA checklist written; status.md → Awaiting QA. Picked US-021 (tracked-field management) next, dependency (US-020) satisfied by Awaiting QA.
- 2026-09-25 — Technical Lead review of decisions, planning and code-review kit: DEC-014 (Codex QA loop runs only while the dev loop runs: `dev-loop.state` written by `autopilot.sh`, checked with `scripts/claude/dev-loop-status.sh`), DEC-015 (secrets beyond `.env*` + deny rules, disclose denied commands, verifiers cite only their own evidence, one verdict vocabulary, product questions ship isolated defaults, installer tidies backups and archived duplicates). Updated AGENTS.md, CLAUDE.md, roles/qa.md, roles/technical-lead.md, data-model.md, pending-kit; old DECs got amendment notes; `status.md` only in its Technical Lead section plus "Waiting on you" item 5. No code, story state, requirements or backlog touched.
- 2026-09-25 — PO docs cleanup: rewrote `status.md`, `process.md`, `README.md`, this file, `roles/`, `backlog/README.md`, `verification/README.md`; added `decisions/README.md` and roadmap carry-forward notes; old versions and the full per-story log moved to `_obsolete/`. No code touched.
- 2026-09-25 — Sprint 4 (US-016..019, monitoring UI) delivered; US-016 via the Copilot fallback. Audit: FINDINGS — C1 token printed into two local logs (user action), W1–W4 process/test notes; no story reopened.
- 2026-09-25 — Sprint 3 (US-012..015, cron + persistence) delivered. Audit reopened US-015 (AC4 test missing); fixed in round 2; US-015 accepted by the user after checking the Vercel cron logs.
- 2026-09-24 — DEC-013: QA and deploy-noticing moved to a separate Codex loop; this loop stops at Awaiting QA.
- 2026-09-24 — Sprint 2 (US-007..011, extraction core) delivered, audit PASS. `unpdf` pinned to 0.11.0 (1.8.1 breaks the flattened-text contract).
- 2026-09-23 — Sprint 1 (US-001..006, foundation) delivered, audit PASS; deployed to Vercel + Neon by the user.
- 2026-09-23 — Autopilot kit installed (DEC-009), made resilient to usage limits and network drops (DEC-011).
- Full per-story log before 2026-09-25 23:00: `_obsolete/HANDOVER-2026-09-25.md`.

## QA/Deploy log (Codex)
_Owned by the separate Codex QA/Deploy loop (DEC-013) — it appends here only, newest last, and
never edits anything above this line. The dev loop (Claude Code) never writes to this section.
Entries up to 2026-09-25 16:25 (US-008..US-018 QA PASS, pushes, `/health` check) are archived in
`_obsolete/HANDOVER-2026-09-25.md`; their results are on the `status.md` Story board._
- 2026-09-25 23:38 — dev loop not running (`WAITING-LIMIT`; resumes about 2026-09-26 01:31:30); QA loop stopped.
- 2026-09-26 12:12 — US-019 QA PASS: 66 focused chart/PGlite/component/boundary checks, frozen install, typecheck, lint, and an offline production build passed. One concurrent full-suite timeout in an existing home-page test passed on isolated retry; one concurrent build lock cleared on retry. Local RO/EN ETF pages returned HTTP 200 with translated safe no-database states; server stopped. Ready for the user to commit and push. Live chart visual/tooltip checks remain in `US-019-qa-run.md`.
