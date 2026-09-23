---
name: deliver-story
description: Deliver the next user story of etf-monitor2 end to end (pick, detail, plan, implement, independent review + tests, QA checklist, status, handover). Use when asked to continue the sprint, deliver a story, or work on US-XXX.
---

# Deliver one story

Follow AGENTS.md. This skill is the Claude Code execution of its delivery loop. Never run git: the user handles all version control.

## 0. Resume first
Read `dev_minions/HANDOVER.md` and `dev_minions/.checkpoint.md`. If a story is in flight, continue it from its recorded phase and round.

## 1. Pick
Read `dev_minions/status.md` and the current sprint file in `dev_minions/backlog/`. Take the first story that is Ready/To Do, not Blocked, and whose dependencies are Done or Awaiting QA. If the user named a story, take that one. If nothing is eligible, write that in HANDOVER.md and stop: the sprint is finished or waiting on the user.

## 2. Detail (only if the story is a bare title)
Draft acceptance criteria strictly from `dev_minions/requirements/`, each citing its FR id, marked `DRAFTED BY AGENT — PO to confirm`. If you cannot write them without a product choice, create a PROPOSED decision file and stop this story.

## 3. Plan
Update HANDOVER.md (story, phase=plan, round=0, empty "Files changed").
- Complex story (see CLAUDE.md) → delegate to `story-planner`. If its plan says BLOCKED ON DECISION → decision file, HANDOVER.md, stop this story.
- Otherwise write `dev_minions/verification/US-XXX-plan.md` yourself: criteria → tests, files to touch, 15 lines max.

## 4. Implement
HANDOVER.md phase=implement. Test-first where practical. For extraction work, download real depositary PDFs from bvb.ro into `tests/fixtures/<SYMBOL>/<date>.pdf`. Run `pnpm typecheck && pnpm lint && pnpm test` until green. Add every file you create, modify or delete to "Files changed" in HANDOVER.md as you go.

## 5. Independent verification (round N)
HANDOVER.md phase=review, round=N, "Files changed" complete.
In ONE message, launch in parallel:
- `story-reviewer`: "Review US-XXX, round N."
- `story-tester`: "Test US-XXX, round N."
Wait for both verdict files.

## 6. Fix loop
Any FAIL → fix exactly the findings (Critical first), re-run your local checks, update "Files changed", re-run only the gate(s) that failed, round N+1.
- Before round 3, delegate to `story-planner` for a fix strategy.
- After a 3rd FAIL: write `dev_minions/escalations/ESC-XXX-US-XXX.md` (what fails, what was tried, error excerpt, suspected cause), mark the story Blocked in status.md, update HANDOVER.md, go back to step 1 with the next independent story.

## 7. Ready for QA
Both verdicts PASS in the same round:
1. Write `dev_minions/verification/US-XXX-qa.md`: numbered manual checks for the user (exact commands/URLs, expected result), including every live BVB / Neon / Vercel check, and "PO to confirm drafted criteria" if step 2 was used. End it with the "Files changed" list so the user can commit them.
2. status.md: this story → `Awaiting QA` (only this row).
3. HANDOVER.md: clear the active story, add the QA item under "Waiting on the user", log one line, set the next step.

## 8. Continue
If running under /goal or asked for the whole sprint, return to step 1. Otherwise stop with a 5-line summary.
