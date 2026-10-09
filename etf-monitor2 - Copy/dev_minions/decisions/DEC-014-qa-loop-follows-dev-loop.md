# DEC-014 — The Codex QA loop runs only while the Claude Code dev loop runs

- Status: **Decided** — requested by the user, 2026-09-25; design by the Technical Lead chat
- Amends: DEC-013 (the QA loop no longer runs independently of the dev loop)
- Files: `scripts/claude/autopilot.sh`, `scripts/claude/dev-loop-status.sh` (new), `roles/qa.md`,
  `automation/qa-goal.txt`, `automation/AUTOMATION.md`, `.gitignore`

## Context

Under DEC-013 the Codex loop polled `status.md` every few minutes for as long as its session was
open. Nothing told it when the Claude Code autopilot paused (usage limit, network drop) or stopped
(waiting on the user, killed, PC asleep), so it kept waking up and spending Codex tokens with no
new work arriving. The user asked that QA always stop when Claude pauses.

`HANDOVER.md`'s `Automation state:` line cannot carry this: it is written by the Claude session,
which is not running during a usage-limit wait, and it stays `RUNNING` if the runner is killed.

## Decision

1. **A runtime state file, one writer.** `scripts/claude/autopilot.sh` writes
   `dev_minions/automation/dev-loop.state`: one line, `RUNNING` at the start of every run,
   `WAITING-LIMIT` / `WAITING-NETWORK` before it sleeps, `STOPPED — <reason>` on every exit
   (normal stop, limit too far away, no progress, `MAX_CYCLES`, Ctrl-C, tmux killed). No other
   process writes it. It is gitignored.
2. **Heartbeat.** While the runner lives, a background loop touches the file every 5 minutes.
   `RUNNING` older than 15 minutes counts as stopped (runner killed with no chance to clean up,
   or the PC slept).
3. **One check for Codex.** `bash scripts/claude/dev-loop-status.sh` prints the state and exits
   0 only for a fresh `RUNNING`. The QA loop runs it before every cycle and before each story.
4. **Stop, don't wait.** On any non-zero result the QA loop finishes the story it already started,
   logs one line in its `HANDOVER.md` section, and ends its session. It does not sleep and
   re-check, because each re-check is a paid model turn.
5. **Restart is the user's.** The user starts the Codex loop (paste `qa-goal.txt`) whenever they
   start the autopilot. After a usage-limit wait the autopilot resumes by itself, but the QA loop
   stays stopped until the user restarts it. Nothing is lost: stories wait at `Awaiting QA`.

## Consequences

- No Codex tokens are spent while the dev loop is paused, waiting or stopped.
- QA can lag further behind than before: overnight, after a limit wait, stories collect at
  `Awaiting QA` until the user restarts Codex. QA is asynchronous anyway (DEC-013), and sprint
  audits already treat a missing QA run as a Note.
- A story Copilot delivers under the fallback is not QA'd until the autopilot runs again, since
  the Copilot fallback does not go through `autopilot.sh`.
- Running Claude Code interactively (`claude`, then `/goal`) instead of through `autopilot.sh`
  leaves the state `STOPPED`, so Codex will not run alongside it. Use the autopilot when you want QA.
