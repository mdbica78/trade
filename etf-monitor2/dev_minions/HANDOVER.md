# HANDOVER — live state of automated delivery
_Last updated: 2026-09-26 14:05 by Claude Code (autopilot, /goal)_
Automation state: RUNNING

Read this first, whatever agent you are (Claude Code, GitHub Copilot). Rules: AGENTS.md and `dev_minions/process.md` §5. Agents never run git — not even read-only; the user does.

## Active story
- none — US-023 closed out this round (Awaiting QA); picking the next eligible story next.

## Acceptance criteria (active story)
- n/a

## US-023 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-023-review.md`, W1/N1 non-blocking notes), tests PASS
(`US-023-tests.md`, 1078/1078). QA checklist written (`US-023-qa.md`). status.md →
`Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
Files changed for US-023 (final):
- `dev_minions/verification/US-023-plan.md` (new, by story-planner)
- `lib/config/cron.ts` (new — `parseDailySchedule`, `findDailySchedule`, `effectiveSchedule`, `formatHourWindow`, `suggestedScheduleLine`, `scheduleChangeNeeded`, `getCronHour`, `setCronHour`; static import of `vercel.json`)
- `lib/config/default-deps.ts` (added `createCronConfigDeps`)
- `lib/config/cron.test.ts`, `lib/config/cron.pglite.test.ts` (new)
- `lib/config/boundaries.test.ts` (BC-7, BC-8 added for cron.ts and the cron/ingestion boundary)
- `components/admin/CronAdmin.tsx` (new)
- `components/admin/sections.ts` (added `/admin/cron` section)
- `components/admin/ActionMessage.test.tsx` (AM-4 case added)
- `app/admin/cron/page.tsx`, `app/admin/cron/actions.ts`, `app/admin/cron/result-messages.ts` (new)
- `app/admin/cron/page.test.tsx`, `app/admin/cron/actions.test.ts`, `app/admin/cron/result-messages.test.ts` (new)
- `app/admin/layout.test.tsx` (AL-4 added for the cron nav link)
- `lib/cron/vercel-config.test.ts` (removed the value-pin test per Sprint 3 decision 3's "before US-023" wording; added RD-1 README test)
- `messages/en.json`, `messages/ro.json` (new `Admin.nav.cron`, `Admin.cron.*`, `Admin.messages.{cronSaved,cronCleared,invalidHour}`)
- `README.md` (cron section rewritten to point at `/admin/cron`; "Administration" section extended)
- `dev_minions/architecture/data-model.md` (`cron_hour_utc` note updated, no rule change)
- `dev_minions/backlog/stories/US-023.md` (drafted by story-planner)

Local gates green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 pre-existing warnings), `pnpm test` (1078/1078, 93 files), `env -u DATABASE_URL pnpm build` (offline, includes new `/admin/cron` route). `vercel.json` itself was not edited.

## US-022 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-022-review.md`, W1/N1 non-blocking notes), tests PASS
(`US-022-tests.md`, 1022/1022). QA checklist written (`US-022-qa.md`). status.md →
`Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
Files changed for US-022 (final):
- `dev_minions/verification/US-022-plan.md` (new, by story-planner)
- `lib/ai/provider-catalog.ts` (new — static `PROVIDER_CATALOG`, `PROVIDER_IDS`, `findProvider`)
- `lib/ai/key-status.ts` (new — `getKeyStatuses`, the only file reading a provider key env var)
- `lib/ai/settings-deps.ts` (new — `createAiSettingsDeps`, wiring; keeps `lib/config` free of `/ai/` imports per DEC-016 §1 / BC-1)
- `lib/config/ai-settings.ts` (new — `getAiSettings`, `setAiSettings`, `AI_MODEL_MAX_LENGTH`)
- `lib/ai/provider-catalog.test.ts`, `lib/ai/key-status.test.ts`, `lib/ai/boundaries.test.ts`, `lib/ai/env-example.test.ts` (new)
- `lib/config/ai-settings.test.ts`, `lib/config/ai-settings.pglite.test.ts` (new)
- `lib/config/boundaries.test.ts` (BC-6 added for ai-settings.ts)
- `components/admin/AiSettingsAdmin.tsx` (new)
- `components/admin/sections.ts` (added `/admin/ai` section)
- `components/admin/ActionMessage.test.tsx` (AM-3 case added)
- `app/admin/ai/page.tsx`, `app/admin/ai/actions.ts`, `app/admin/ai/result-messages.ts` (new)
- `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts`, `app/admin/ai/result-messages.test.ts` (new)
- `app/admin/layout.test.tsx` (AL-3 added for the AI nav link)
- `messages/en.json`, `messages/ro.json` (new `Admin.nav.ai`, `Admin.ai.*`, `Admin.messages.{aiSaved,aiCleared,unknownProvider,invalidModel}`)
- `.env.example` (four provider API key variables, each commented)
- `README.md` (env var section + `/admin/ai` note in "Administration")
- `dev_minions/backlog/stories/US-022.md` (drafted by story-planner)

Local gates green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 pre-existing warnings), `pnpm test` (1022/1022, 88 files), `env -u DATABASE_URL pnpm build` (offline, includes new `/admin/ai` route).

## US-020 / US-021 — earlier this sprint (Awaiting QA, Codex QA PASS for both)
Full "Files changed" lists are on the status.md Story board and in `US-020-qa.md`/`US-021-qa.md`;
trimmed here to keep this file short. US-021 also fixed 3 pre-existing TypeScript errors in
`lib/config/tracked-fields.pglite.test.ts` that had blocked US-020's Codex QA.

## Failing / open
- US-020, US-021, US-022: none — Awaiting QA (Codex QA already PASS for all three, see log).
- US-023: none — closed out this round, Awaiting QA.

## Exact next step
- Pick US-024 (operational dashboard, last Sprint 5 story): dependencies US-020 (Awaiting QA), US-014 (Awaiting QA, Codex PASS), US-015 (Done) all satisfied. Delegate to `story-planner`: "plan US-024" (complex story per its own header — ingestion outcome vocabulary change, log parser, 11 ACs).

## Waiting on the user
- Consolidated list (security, product decisions, acceptances, live checks, git): `status.md` → "Waiting on you". The PO keeps that list; add only **new** items below, one line each.
- Kit update (DEC-014, DEC-015): run `bash scripts/claude/install-kit.sh` before restarting the autopilot; start Codex with `automation/qa-goal.txt` right after.
- Sprint 5 decision #9 (US-022, API keys): default ships (provider/model selection in full; keys stay as Vercel env vars, page shows only set/unset). Confirm, or ask for in-app key entry (would need its own credentials DEC).
- Sprint 5 decision #11 (US-023, cron hour): default ships (admin stores the hour, shows the exact `vercel.json` line to change; takes effect after your commit + redeploy). Confirm, or ask for an automatic path (would need a Vercel token/credential).

## Log (newest first, one line each)
- 2026-09-26 — US-023 (cron hour setting) round 1: review PASS (W1/N1 non-blocking), tests PASS (1078/1078); QA checklist written; status.md → Awaiting QA. New `lib/config/cron.ts` (effective schedule read from a static `vercel.json` import, never `fs` at runtime; the cron route never reads `cron_hour_utc`, BC-8) plus `/admin/cron`; removed Sprint 3's fixed-schedule-value test per its own "before US-023" wording. Picking US-024 (operational dashboard) next, the last Sprint 5 story.
- 2026-09-26 — US-022 (AI provider/API key settings) round 1: review PASS (W1/N1 non-blocking), tests PASS (1022/1022); QA checklist written; status.md → Awaiting QA. New `lib/ai/` module (provider catalogue, key-status, settings-deps) plus `/admin/ai`; DEC-016 §1 respected (allowed provider ids injected, `lib/config/ai-settings.ts` never imports `lib/ai`). Picking US-023 (cron hour) next.
- 2026-09-26 — US-021 (tracked-field management) round 1: review PASS (W1/N1/N2 non-blocking), tests PASS (960/960); QA checklist written; status.md → Awaiting QA. Fixed 3 pre-existing typecheck errors in `lib/config/tracked-fields.pglite.test.ts` that had blocked US-020's Codex QA (`US-020-qa-run.md`) — US-020 unblocked for re-QA. Picking next Sprint 5 story (US-022/023/024).
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
- 2026-09-26 12:42 — dev loop not running (`WAITING-LIMIT`; resumes about 2026-09-26 13:51:30); QA loop stopped before starting US-020.
- 2026-09-26 12:53 — US-020 QA BLOCKED (user-requested exception to the dev-loop gate): 119 focused seed/config/detection/admin/bilingual tests and frozen install passed; lint had 0 errors. Project typecheck and local QA-server build are blocked by three TypeScript errors in in-progress US-021 test file `lib/config/tracked-fields.pglite.test.ts` (lines 149, 167, 288), so no US-020 failure was found. Re-run after US-021 resolves the shared typecheck blocker; details in `US-020-qa-run.md`.
- 2026-09-26 14:22 — US-020 QA PASS: the formerly blocked shared gates now pass: typecheck plus the full suite (960/960), lint (0 errors; 3 existing warnings), and production build. Local `/admin` plus `/admin/etfs` in RO and EN returned HTTP 200 with safe no-database states; server stopped. Awaiting user acceptance; live Neon/BVB checks remain in `US-020-qa-run.md`.
- 2026-09-26 14:26 — US-021 QA PASS: 77 focused tracked-field/admin/i18n tests, typecheck plus full suite (960/960), lint (0 errors; 3 existing warnings), and production build passed. Local Fields page in RO and EN returned HTTP 200 with translated safe no-database states; server stopped. Awaiting user acceptance; live Neon and next-cron checks remain in `US-021-qa-run.md`.
- 2026-09-26 15:25 — US-022 QA PASS: 93 focused AI-settings/privacy/i18n tests, typecheck plus full suite (1078/1078), lint (0 errors; 3 existing warnings), and production build passed. Local `/admin/ai` in RO and EN returned HTTP 200, displayed only key names and safe `not set` markers, and exposed no values; server stopped. Ready for the user to commit and push; live Neon/Vercel and product-decision checks remain in `US-022-qa-run.md`.
- 2026-09-26 15:34 — US-023 QA PASS: 92 focused cron/config/page/i18n tests, typecheck plus full suite (1078/1078), lint (0 errors; 3 existing warnings), and production build passed. Local `/admin/cron` in RO and EN returned HTTP 200 with the effective UTC window and translated safe no-database states; server stopped. Ready for the user to commit and push; live Neon/Vercel and product-decision checks remain in `US-023-qa-run.md`.
- 2026-09-26 15:35 — dev loop not running (`WAITING-LIMIT 2026-09-26 15:29:40 — Claude usage limit, resumes about 2026-09-26 18:51:30`); QA loop stopped.
