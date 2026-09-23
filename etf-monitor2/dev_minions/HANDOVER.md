# HANDOVER — live state of automated delivery
_Last updated: 2026-09-23 by Technical Lead (kit install)_

Read this first, whatever agent you are (Claude Code, GitHub Copilot). Rules: AGENTS.md. Agents never run git; the user does.

## Active story
- Story: none — US-001 delivered, Awaiting QA. Next eligible: US-002 (Project scaffold), blocked on ADR-001 confirmation (still PROPOSED per status.md).
- Phase: —
- Round: —

## Acceptance criteria (active story)
- —

## Files changed (active story)
- —

## Failing / open
- —

## Exact next step
- US-001 is Awaiting QA — user to review dev_minions/verification/US-001-qa.md and commit. US-002 cannot start until ADR-001 (tech stack) is confirmed by the Technical Lead — see status.md "Open decisions". If ADR-001 gets confirmed, US-002 becomes the next eligible story.

## Waiting on the user
- QA: US-001 — see dev_minions/verification/US-001-qa.md; commit the "Files changed" list there when ready.
- Decisions: ADR-001 (tech stack) still PROPOSED, blocks US-002 onward (pre-existing, not new this session).
- Escalations: —
- Denied permissions: —

## Log (newest first, one line each)
- 2026-09-23 — US-001 delivered: both story-reviewer and story-tester PASS round 1 (unanimous, no fix loop needed). Findings: use unpdf, no OCR needed, comma/dot number formatting, two adapter traps documented (VUAN value precedes its label; filing-stamp date vs footer report date). Added root .gitignore (node_modules/.next/.env*) per reviewer warning about spikes/pdf-extraction/node_modules being untracked. Status: Awaiting QA.
- 2026-09-23 — Picked US-001 (only eligible story). This Windows machine has no Node.js; user directed use of WSL1 "Ubuntu" distro (node v20.20.2, pnpm 12.5.1) instead of installing Node on Windows.
- 2026-09-23 — Automation kit v2 installed (DEC-005, no git). ADR-001 accepted per user.
