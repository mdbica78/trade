# HANDOVER — live state of automated delivery
_Last updated: 2026-09-23 by Technical Lead (ADR-001 written up as Decided; DEC-006)_

Read this first, whatever agent you are (Claude Code, GitHub Copilot). Rules: AGENTS.md. Agents never run git; the user does.

## Active story
- Story: none — US-002 delivered, Awaiting QA. Next eligible: US-003 (DB schema/Drizzle/Neon) and US-004 (bilingual infra), both depend only on US-002 which is now Awaiting QA (counts as unblocked per AGENTS.md step 1: "dependencies Done or Awaiting QA").
- Phase: —
- Round: —

## Acceptance criteria (active story)
- —

## Files changed (active story)
- —
(US-002's full file list, for the user's commit, is in dev_minions/verification/US-002-qa.md)

## Failing / open
- —

## Exact next step
- US-002 is Awaiting QA — user to review dev_minions/verification/US-002-qa.md and commit. US-003/US-004 are next eligible once the user picks up delivery again.

## Waiting on the user
- QA: US-001 — see dev_minions/verification/US-001-qa.md. QA: US-002 — see dev_minions/verification/US-002-qa.md. Both stories' "Files changed" lists need committing; check `git status` first since US-001's fixtures/spike and US-002's full scaffold are both currently uncommitted together.
- Decisions: —
- Escalations: —
- Denied permissions: —

## Log (newest first, one line each)
- 2026-09-23 — US-002 delivered: both story-reviewer and story-tester PASS round 1. Scaffolded Next.js 16 App Router + TS + Tailwind + Vitest + pnpm; all 7 ACs green (install/dev/test/lint/build, folder structure, .env.example, README). Two environment fixes documented in new DEC-008: Turbopack's persistent cache crashes on this WSL1/DrvFs mount (fixed via `--webpack` in dev/build scripts), and NODE_EXTRA_CA_CERTS must be exported explicitly per non-interactive WSL command. Reviewer flagged (Warning, non-blocking) a `.gitignore`/`.claude/settings.json` `.env.*` coverage gap — fixed immediately after the PASS verdict. Note: the story-reviewer subagent self-reported running 3 read-only `git status`/`git log`/`git diff` commands during review, which AGENTS.md forbids for any agent — no state was changed, flagging for awareness, no action taken. Status: Awaiting QA.
- 2026-09-23 — Technical Lead (now a persistent, file-access role per DEC-006) wrote ADR-001's Decided status and validation rationale to disk (previously only validated verbally in a prior, file-less chat); updated status.md's ADR-001 wording to Decided and cleared it from this file's "Waiting on the user". US-002 (Project scaffold) is next eligible.
- 2026-09-23 — US-001 delivered: both story-reviewer and story-tester PASS round 1 (unanimous, no fix loop needed). Findings: use unpdf, no OCR needed, comma/dot number formatting, two adapter traps documented (VUAN value precedes its label; filing-stamp date vs footer report date). Added root .gitignore (node_modules/.next/.env*) per reviewer warning about spikes/pdf-extraction/node_modules being untracked. Status: Awaiting QA.
- 2026-09-23 — Picked US-001 (only eligible story). This Windows machine has no Node.js; user directed use of WSL1 "Ubuntu" distro (node v20.20.2, pnpm 12.5.1) instead of installing Node on Windows.
- 2026-09-23 — Automation kit v2 installed (DEC-005, no git). ADR-001 accepted per user.
