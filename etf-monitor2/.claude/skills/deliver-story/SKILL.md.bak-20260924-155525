---
name: deliver-story
description: Deliver etf-monitor2 user stories end to end — continuously across sprints under /goal (autopilot, DEC-009), or one story when asked. Pick, detail sprints, plan, implement, independent review + tests, in-loop tech-lead for decisions/escalations/sprint audits, QA checklist, demo file, handover. Use when asked to continue, run the autopilot, deliver a story, or work on US-XXX.
---

# Deliver stories (autopilot, DEC-009)

Follow AGENTS.md. Never run git (not even read-only): the user handles all version control.
`HANDOVER.md` carries one machine-readable line, `Automation state: <STATE>`, where STATE is
`RUNNING` | `PAUSED` | `STOPPED-FOR-USER` | `ALL-DONE`. Keep it accurate: the unattended
runner reads it.

## 0. Resume and take in the user's answers
1. Read `dev_minions/HANDOVER.md` and `dev_minions/.checkpoint.md`. Set `Automation state: RUNNING`.
2. Newest `dev_minions/verification/DEMO-*.md`, if any:
   - `- [x] US-XXX` and the story isn't Done yet → set it to `Done — accepted by the user in <demo file>` in status.md (this records the user's acceptance; you are not self-certifying). Log it.
   - `- [!] US-XXX` with notes → set the story to `Ready — reopened from demo`, and copy the notes into its review file as a new round's findings for you to fix.
3. Decisions: any `decisions/DEC-*.md` that a story is Blocked on and that the user has since set to Decided or answered → unblock that story (`Ready`). Log it.
4. A story in flight → continue it from its recorded phase and round. Never restart it. If HANDOVER.md's "Files changed" is incomplete (a session died mid-story), rebuild it first from `dev_minions/.files-touched.log` (lines tagged with this story; written automatically by the PostToolUse hook, DEC-011) plus the "modified in the last 3 hours" list in `.checkpoint.md` for files changed by commands.

## 1. Pick
Read `dev_minions/status.md` (Story board) and the sprint files in `dev_minions/backlog/sprints/`.
Take the first story, lowest sprint first, that is Ready/To Do (or reopened), not Blocked, and whose dependencies are Done or Awaiting QA. If the user named a story, take that one.
- None eligible, and the roadmap has a sprint with no sprint file yet → **step 1b**.
- None eligible and nothing left to detail → **step 9 (stop)**.

## 1b. Detail the next sprint (title-only in `backlog/roadmap.md`)
1. Delegate to `story-planner`: "detail-sprint N".
2. Delegate to `tech-lead`: "sprint-review N". On `CHANGES`, fix what it lists (small edits yourself, otherwise one more `story-planner` pass on those stories), then run sprint-review once more. A story still failing review after that → Blocked, with the review file as the reason.
3. For every story's `## Decisions needed`: write `decisions/DEC-XXX-<slug>.md` (PROPOSED: context, options, trade-offs, recommendation), then run **step D** on it.
4. Add the new stories to the status.md Story board: `Ready`, or `Blocked — <dependency / DEC-XXX>`. Update HANDOVER.md, then go back to step 1.

## Step D — decisions (used from 1b, 2, 3)
Delegate to `tech-lead`: "decision DEC-XXX".
- `DECIDED` → continue the story with the decision applied.
- `CHANGES` → revise the decision file once and resubmit. A second `CHANGES` counts as `NEEDS USER`.
- `NEEDS USER` → set the story to `Blocked — DEC-XXX (needs user)`, list the DEC under "Waiting on the user", and **go back to step 1 with the next story**. Never stop the whole run for one decision.

## 2. Detail (only if a story is still a bare title)
Draft acceptance criteria strictly from `dev_minions/requirements/`, each citing its FR id, marked `DRAFTED BY AGENT — PO to confirm`. A product choice → step D.

## 3. Plan
Update HANDOVER.md (story, phase=plan, round=0, empty "Files changed").
- Complex story (see CLAUDE.md) → `story-planner`: "plan US-XXX". A plan saying BLOCKED ON DECISION → step D for each decision, then re-plan if they were all DECIDED.
- Otherwise write `dev_minions/verification/US-XXX-plan.md` yourself: criteria → tests (live-only criteria marked `MANUAL-QA` with the exact manual check), files to touch, 15 lines max.

## 4. Implement
HANDOVER.md phase=implement. Test-first where practical. Fixtures live in `test/fixtures/` (e.g. `test/fixtures/BTBETRETF-2026-09-21.pdf`); you may download fresh depositary PDFs from bvb.ro. Use mocks for Neon, Vercel and AI providers: no live calls in tests. Run `pnpm typecheck && pnpm lint && pnpm test` until green (export `NODE_EXTRA_CA_CERTS` if needed, DEC-002/DEC-008). The PostToolUse hook logs every Write/Edit to `dev_minions/.files-touched.log` automatically; you still copy them into "Files changed" in HANDOVER.md **at least every ~10 file edits and before every long command**, and add what commands changed (`pnpm add` → package.json + pnpm-lock.yaml, generated migrations, deleted files), which the hook can't see. A usage limit can end the session between two tool calls.

## 5. Independent verification (round N)
HANDOVER.md phase=review, round=N, "Files changed" complete — cross-check it against this story's lines in `dev_minions/.files-touched.log` before launching the verifiers.
In ONE message, launch in parallel:
- `story-reviewer`: "Review US-XXX, round N."
- `story-tester`: "Test US-XXX, round N."
Wait for both verdict files.

## 6. Fix loop
Any FAIL → fix exactly the findings (Critical first), re-run your local checks, update "Files changed", re-run only the gate(s) that failed, round N+1.
- Before round 3, `story-planner`: "fix-strategy US-XXX round 3".
- After a 3rd FAIL: write `dev_minions/escalations/ESC-XXX-US-XXX.md` (template in that folder), then `tech-lead`: "escalation ESC-XXX".
  - `AGENT-FIXABLE` → one more round (round 4) following its plan exactly.
  - `NEEDS-USER`, or round 4 fails → status.md `Blocked — ESC-XXX`, list it under "Waiting on the user", **go back to step 1**.

## 7. Ready for QA
Both verdicts PASS in the same round:
1. Write `dev_minions/verification/US-XXX-qa.md`: numbered manual checks (exact commands/URLs, expected result), every live BVB / Neon / Vercel / API-key step, and "PO to confirm drafted criteria" where criteria were agent-drafted. End it with the "Files changed" list.
2. status.md: this story → `Awaiting QA` (only this row).
3. HANDOVER.md: clear the active story, add the story to "Waiting on the user → QA", log one line, set the next step.

## 8. Sprint close
When every story of sprint N is Awaiting QA, Done or Blocked and `verification/SPRINT-0N-audit.md` does not exist yet → `tech-lead`: "sprint-audit N".
- `FINDINGS` with Critical items → set those stories to `Ready — reopened by sprint audit`, copy the Critical findings into their review file as the next round's findings. Warnings go into HANDOVER.md's log.
Then go back to step 1: the next sprint is picked or detailed automatically.

## 9. Continue or stop
- Under `/goal` (autopilot): go back to step 1 after every story.
- **Cycle limit:** after about 120 turns in this session, or when the context is getting long, finish the current phase, run the `handover` skill with `Automation state: PAUSED`, and stop. The runner restarts you with a fresh context.
- **Nothing eligible** (step 1): write the demo file below, set `Automation state: STOPPED-FOR-USER`, or `ALL-DONE` if every roadmap story is Awaiting QA or Done, run the `handover` skill, and stop.
- Not under `/goal` and asked for one story: stop after step 7 with a 5-line summary.

### Demo file — `dev_minions/verification/DEMO-YYYYMMDD-HHMM.md`
```
# Demo — <date time>
How to answer: tick [x] each story you accept, or write [!] and a note to send it back.
Answer decisions in their DEC files (or here) and tell Claude Code to continue.

## 1. Decisions only you can make
- DEC-XXX — <question> — options — recommendation — blocks US-…

## 2. Live steps, in order
(from QA files and sprint files: create Neon DB, create Vercel project, set env vars,
 run migrations + seed, deploy, enter API keys — exact commands, expected result)

## 3. Stories to check
- [ ] US-XXX — <title> — checks: <inline, or link to US-XXX-qa.md>

## 4. Escalations waiting on you
## 5. Decided on your behalf by tech-lead (review if you want)
- DEC-XXX — <one line> ; sprint audits: SPRINT-0N-audit.md verdicts
## 6. Files changed since the last demo (for your commit)
```
