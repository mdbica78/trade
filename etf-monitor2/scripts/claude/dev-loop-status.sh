#!/usr/bin/env bash
# DEC-014: tells the Codex QA loop whether the Claude Code dev loop is running right now.
#   bash scripts/claude/dev-loop-status.sh
# Prints one line. Exit 0 = RUNNING (QA may continue). Exit 1 = paused, waiting or stopped
# (the QA loop must stop). Reads dev_minions/automation/dev-loop.state, which only
# scripts/claude/autopilot.sh writes (with a heartbeat every 5 minutes). No git.
cd "$(dirname "$0")/../.." || exit 1
F="dev_minions/automation/dev-loop.state"
MAX_AGE_MIN="${MAX_AGE_MIN:-15}"

if [ ! -f "$F" ]; then
  echo "STOPPED — no $F: the autopilot has not run since DEC-014 was installed"
  exit 1
fi
line="$(head -n 1 "$F")"
state="${line%% *}"
age_min=$(( ( $(date +%s) - $(stat -c %Y "$F") ) / 60 ))

if [ "$state" = "RUNNING" ] && [ "$age_min" -le "$MAX_AGE_MIN" ]; then
  echo "$line"
  exit 0
fi
if [ "$state" = "RUNNING" ]; then
  echo "STOPPED — heartbeat is ${age_min} min old (autopilot killed, or the PC slept): $line"
  exit 1
fi
echo "$line"
exit 1
