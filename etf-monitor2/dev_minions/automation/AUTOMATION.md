# Automation — how to run it (autopilot, DEC-009)

## Start the autopilot (WSL terminal)
    cd /mnt/c/_mystaff/myG/trade/etf-monitor2
    bash scripts/claude/install-kit.sh        # once, and after any kit update in pending-kit/
    tmux new -s etf 'bash scripts/claude/autopilot.sh'

`install-kit.sh` copies the agent/skill files from `dev_minions/automation/pending-kit/`
into `.claude/` and `.github/`, backing up the old ones. The Technical Lead chat can't
write those folders remotely (they're protected), so kit updates arrive there for you to
review and install. The autopilot refuses to start until the kit is installed.

Detach with `Ctrl-b d` (it keeps running); come back with `tmux attach -t etf`.
First launch ever: run `claude` once interactively in this folder and accept the workspace
trust prompt (hooks and project subagents need it).

It works through every eligible story, across sprints, detailing new sprints from the
roadmap by itself. Each cycle is a fresh Claude Code session; the script restarts it until
`dev_minions/HANDOVER.md` says:
- `Automation state: STOPPED-FOR-USER` — nothing left it can do without you, or
- `Automation state: ALL-DONE` — the whole roadmap is Awaiting QA or Done.

It also stops after two cycles with no progress, or after `MAX_CYCLES` working cycles
(default 12). Usage limits are waited out automatically: it sleeps until the exact reset
time shown in the log, and waiting doesn't count as a cycle. If the reset is more than
`MAX_LIMIT_WAIT_HOURS` (default 12) away, e.g. the weekly limit, it stops and tells you (DEC-011).
Example: `MAX_CYCLES=20 bash scripts/claude/autopilot.sh`.

After each story passes review and tests, the `qa-runner` agent (DEC-012) executes its QA
checklist itself (commands, the app served locally without a database, live bvb.ro reads) and
writes `verification/US-XXX-qa-run.md`. The demo file then lists only what it couldn't settle
for you: wording, drafted criteria, live-database steps, your accounts.

Every file an agent writes is logged automatically to `dev_minions/.files-touched.log`
(PostToolUse hook), so a session cut off by a limit resumes with a complete file list.

Other ways to run:
- Interactive, continuous: `claude`, then `/goal ` + the text of `goal.txt`
- Interactive, one story: `/deliver-story`
- Single cycle, headless: `bash scripts/claude/run-sprint.sh` (older runner, one cycle)

## When it stops — your part
Open the newest `dev_minions/verification/DEMO-*.md`. It holds everything in one place:
1. **Decisions only you can make** — answer in the DEC file (set it Decided, or write your choice) or in the demo file.
2. **Live steps, in order** — create Neon / Vercel, env vars, migrations + seed, deploy, API keys.
3. **Stories to check** — tick `- [x] US-XXX` to accept (the agent then marks it Done), or `- [!] US-XXX` + a note to send it back.
4. **Escalations** it could not solve.
5. **Decided on your behalf by tech-lead** — technical calls it made without you; read them if you want.
6. **Files changed since the last demo** — commit them (git is yours). You may commit at any time, even mid-run.

Then start the autopilot again: it reads your answers first.

## Watch (optional)
- `dev_minions/HANDOVER.md` — `Automation state:` line, active story, what waits on you
- `dev_minions/verification/` — plan, review, tests, QA per story; `SPRINT-0N-review.md` / `-audit.md`
- `dev_minions/automation/logs/` — full stream log per cycle

## Budget ran out → GitHub Copilot
1. If Claude Code still responds: `/handover`. If not, the Stop hook already wrote `dev_minions/.checkpoint.md`.
2. Open the repo in VS Code, Copilot Chat in Agent mode, run `/resume-from-handover`.
3. For the independent review, open a NEW Copilot chat and run `/review-story`.
4. Copilot stops for any decision (it has no tech-lead subagent) and sets `Automation state: PAUSED — Copilot`. When Claude Code is back, start the autopilot again.
