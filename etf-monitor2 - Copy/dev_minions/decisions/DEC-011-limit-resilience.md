# DEC-011 — Autopilot resilience to usage limits: file tracking hook, exact limit waits

- Status: **Decided** — Technical Lead, 2026-09-23, from the first autopilot run's evidence
- Amends: DEC-009 (runner and handover mechanics only; no process or product change)

## Context

First autopilot run (2026-09-23, Claude Pro): cycle 1 delivered US-003 (review + tests PASS
round 1) and wrote all of US-004's code and tests, then hit the 5-hour usage limit at 16:21
(52% → 100% of the window in ~21 minutes). Two weaknesses showed up:

1. **"Files changed" was not recorded as the agent worked.** HANDOVER.md still said
   US-004 "Files changed: —" with ~25 files written. A new cycle would have had to guess what
   the dead session touched, and the reviewer relies on that list.
2. **The runner's limit detection was a text heuristic.** It missed the limit on cycle 1 (it
   started cycle 2 after 60 s, which failed immediately), caught it on cycle 2, and then waited
   a fixed 30 minutes, which doesn't line up with the real reset (17:00). It also counted
   limit waits as working cycles, and could mistake a normal cycle end for a limit.

## Decision

1. **PostToolUse hook** `scripts/claude/track-files.sh` (matcher `Write|Edit|MultiEdit|NotebookEdit`,
   in `.claude/settings.json`) appends `time  US-XXX  path` to `dev_minions/.files-touched.log`
   for every file an agent writes, whatever happens to the session afterwards. The Stop hook
   (`checkpoint.sh`) includes the log's tail in `.checkpoint.md`.
2. `deliver-story` / `handover` skills: rebuild "Files changed" from that log when resuming,
   cross-check it before launching the verifiers, update HANDOVER.md at least every ~10 file
   edits, and add command-made changes by hand (package.json/pnpm-lock.yaml after `pnpm add`,
   generated migrations, deletions), since the hook doesn't see those.
3. **Runner (`autopilot.sh`)**: detects a limit from the last `rate_limit_event` in the stream
   log (`status: "rejected"`), and sleeps until its `resetsAt` + 90 s. It falls back to
   text matching ("hit your session limit") with a 30-minute wait. Limit waits no longer count
   toward `MAX_CYCLES`. A reset more than `MAX_LIMIT_WAIT_HOURS` (default 12) away (the weekly
   limit) stops the runner with a message instead of sleeping for days.
4. `.gitignore`: `dev_minions/automation/logs/` (stream logs, ~1–2 MB per cycle),
   `dev_minions/.files-touched.log`, and `Claude outputs/` (copies the Claude desktop app
   saves into the project folder).

## Consequences

- A session killed mid-story can be resumed exactly, and the reviewer gets a complete file list.
- The `.claude/settings.json` change goes through `pending-kit/` + `install-kit.sh` (protected
  folder). Until the user re-runs the installer, the hook is inactive; the other fixes work
  without it.
- Throughput on Claude Pro is bound by the 5-hour window: roughly 1–1.5 stories per window
  at the current story size. The weekly window (26% used after the first run) will become the
  binding limit if the autopilot runs every window.

## Amendment 2026-09-24 — network outages

Overnight run: at 03:21 the Claude API became unreachable (`EAI_AGAIN`, most likely the PC
sleeping or the network dropping). The runner counted the two failed runs as "no progress" and
stopped at ~03:30, so the night after that was lost. The runner now recognises API connection
errors ("Can't reach the API server", `EAI_AGAIN`, `ENOTFOUND`, `ECONNRESET`, `ETIMEDOUT`),
backs off 5 → 10 → 20 → 30 min and retries, without counting a cycle or a no-progress. It gives
up after `NET_MAX_WAIT_HOURS` (default 10). Takes effect the next time the autopilot is started.
Keeping the PC awake while the autopilot runs (Windows power settings) avoids most of these.
