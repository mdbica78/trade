# Automation — how to run it (two separate loops, DEC-009 + DEC-013)

Development and QA/deploy are two independent loops now, run by two different tools, handing
off only through files under `dev_minions/` (there is no direct channel between Claude Code
and Codex). Start both if you want continuous delivery; either one is fine to run alone.

## 1. Dev autopilot (Claude Code) — plan, implement, review, tests, decisions

    cd /mnt/c/_mystaff/myG/trade/etf-monitor2
    bash scripts/claude/install-kit.sh        # once, and after any kit update in pending-kit/
    tmux new -s etf 'bash scripts/claude/autopilot.sh'

`install-kit.sh` copies the agent/skill files from `dev_minions/automation/pending-kit/` into
`.claude/` and `.github/`, backing up the old ones. The Technical Lead chat can't write those
folders remotely (they're protected), so kit updates arrive there for review and install. The
autopilot refuses to start until the kit is installed.

Detach with `Ctrl-b d` (it keeps running); come back with `tmux attach -t etf`. First launch
ever: run `claude` once interactively in this folder and accept the workspace trust prompt
(hooks and project subagents need it).

It works through every eligible story, across sprints, detailing new sprints from the roadmap
by itself. Each cycle is a fresh Claude Code session; the script restarts it until
`dev_minions/HANDOVER.md` says:
- `Automation state: STOPPED-FOR-USER` — nothing left it can do without you, or
- `Automation state: ALL-DONE` — the whole roadmap is Awaiting QA or Done.

It also stops after two cycles with no progress, or after `MAX_CYCLES` working cycles (default
12). Usage limits are waited out automatically: it sleeps until the exact reset time shown in
the log, and waiting doesn't count as a cycle; a network outage backs off and retries (DEC-011).
Example: `MAX_CYCLES=20 bash scripts/claude/autopilot.sh`.

**Since DEC-013, this loop stops at `Awaiting QA` — it does not run QA itself and does not
wait for a QA verdict before moving to the next story or closing a sprint.** That's the QA
loop's job, below. The one thing this loop still watches for is a story the QA loop reopens
(`Ready — reopened by QA` in `status.md`), which it treats as ordinary eligible work.

Every file an agent writes is logged automatically to `dev_minions/.files-touched.log`
(PostToolUse hook), so a session cut off by a limit resumes with a complete file list.

Other ways to run the dev loop:
- Interactive, continuous: `claude`, then `/goal ` + the text of `goal.txt`
- Interactive, one story: `/deliver-story`
- Single cycle, headless: `bash scripts/claude/run-sprint.sh` (older runner, one cycle)

## 2. QA/Deploy autopilot (Codex) — DEC-013

Start a Codex session yourself and paste in the contents of
`dev_minions/automation/qa-goal.txt`. Its entire brief is `dev_minions/roles/qa.md` — read
that for the full behaviour; the summary:

- Polls `status.md`'s Story board for stories `Awaiting QA` with no
  `verification/US-XXX-qa-run.md` yet, or reopened-and-redelivered ones.
- Runs the same machine-checkable QA that DEC-012 originally specified: commands, the app
  served locally via `scripts/claude/qa-serve.sh` (no database, or a deliberately unreachable
  one), live bvb.ro reads. Writes `verification/US-XXX-qa-run.md`.
- **Never fixes anything itself.** A `FAIL` reopens the story
  (`Ready — reopened by QA` in `status.md`) for the Claude Code dev loop to fix; Codex moves on
  without waiting.
- **Never touches git, not even to push.** "No agent runs git" has zero exceptions in this
  project, Codex included (DEC-013). It has no way to check what's committed or pushed, so
  instead: whenever a story just PASSes QA, it logs one line naming that story as ready for you
  to push whenever you choose. When it happens to notice the deployed site has changed, it
  smoke-checks `/health` and logs the result.
- **Never blocks waiting for you.** Anything it needs from you — a story ready to push, a
  judgment call, missing credentials — becomes one line in `## QA/Deploy log (Codex)` at the
  bottom of `HANDOVER.md`, and it moves on to other eligible work.
- Its write scope is exactly three things: a story's `US-XXX-qa-run.md`, that story's Story
  board row, and its own log section in `HANDOVER.md`. It never touches decisions,
  escalations, sprint files, or anything else in `HANDOVER.md`.

Run it in whatever way keeps a Codex session alive continuously on your machine (its own
`tmux` session, a persistent terminal, whatever Codex's own tooling gives you) — there's no
Claude-side script for this loop since it isn't Claude Code.

## When the dev loop stops — your part
Open the newest `dev_minions/verification/DEMO-*.md`. It holds everything in one place:
1. **Decisions only you can make** — answer in the DEC file (set it Decided, or write your choice) or in the demo file.
2. **Live steps, in order** — create Neon / Vercel, env vars, migrations + seed, deploy, API keys. (Check `HANDOVER.md`'s QA/Deploy log first — the Codex loop may already have flagged stories as ready for you to push.)
3. **Stories to check** — tick `- [x] US-XXX` to accept (the agent then marks it Done), or `- [!] US-XXX` + a note to send it back. Check `US-XXX-qa-run.md` for what Codex already covered, if it's reached that story yet.
4. **Escalations** it could not solve.
5. **Decided on your behalf by tech-lead** — technical calls it made without you; read them if you want.
6. **Files changed since the last demo** — commit and push them; git is entirely yours, no agent (including the Codex loop) ever touches it. You may commit at any time, even mid-run.

Then start the dev autopilot again: it reads your answers first.

## Watch (optional)
- `dev_minions/HANDOVER.md` — `Automation state:` line, active story, what waits on you, and (at the bottom) the Codex loop's own log
- `dev_minions/status.md` — Story board, including rows the QA loop has reopened
- `dev_minions/verification/` — plan, review, tests, QA-run per story; `SPRINT-0N-review.md` / `-audit.md`
- `dev_minions/automation/logs/` — full stream log per dev-loop cycle

## Budget ran out → GitHub Copilot
1. If Claude Code still responds: `/handover`. If not, the Stop hook already wrote `dev_minions/.checkpoint.md`.
2. Open the repo in VS Code, Copilot Chat in Agent mode, run `/resume-from-handover`.
3. For the independent review, open a NEW Copilot chat and run `/review-story`.
4. Copilot stops for any decision (it has no tech-lead subagent) and sets `Automation state: PAUSED — Copilot`. When Claude Code is back, start the autopilot again. The Codex QA/Deploy loop is unaffected either way — it doesn't care which tool is driving development.
