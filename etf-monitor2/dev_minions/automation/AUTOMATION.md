# Automation — how to run it

## Start (Claude Code, WSL terminal)
    cd /mnt/c/_mystaff/myG/trade/etf-monitor2
    claude

First launch: accept the workspace trust prompt (hooks and project subagents need it). Check with `/context` that CLAUDE.md and AGENTS.md loaded, and `/usage` for your limits.

- Supervised, one story: `/deliver-story`
- Unattended, whole sprint (interactive): type `/goal ` and paste the text of `goal.txt`
- Unattended, headless: `tmux new -s etf 'bash scripts/claude/run-sprint.sh'`

## Watch
- `dev_minions/HANDOVER.md` — state and what waits on you
- `dev_minions/verification/` — plan, review, tests, QA per story

## Your part
- QA: run `verification/US-XXX-qa.md`, then tell the PO chat to mark the story Done (or give Claude Code the failed step as a fix).
- Decisions (`decisions/DEC-XXX` PROPOSED): answer them; technical ones go to the Technical Lead chat.
- Escalations (`escalations/ESC-XXX`): take them to Troubleshoot or the Technical Lead chat.
- Git is yours: commit the files listed at the end of each QA checklist, push when you want Vercel to deploy.

## Budget ran out → GitHub Copilot
1. In Claude Code, if it's still responding: `/handover`. If not, the Stop hook already wrote `dev_minions/.checkpoint.md`.
2. Open the repo in VS Code, Copilot Chat in Agent mode, run `/resume-from-handover`.
3. For the independent review, open a NEW Copilot chat and run `/review-story`.
4. Copilot updates HANDOVER.md at every phase. When Claude Code is back, `/deliver-story` resumes from it.
