#!/usr/bin/env bash
# Unattended run: Claude Code works through the sprint until the goal is met.
# Recommended: run inside tmux so it survives closing the terminal:
#   tmux new -s etf 'bash scripts/claude/run-sprint.sh'
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
PF="dev_minions"
mkdir -p "$PF/automation/logs"
LOG="$PF/automation/logs/run-$(date +%Y%m%d-%H%M%S).jsonl"
GOAL="$(cat "$PF/automation/goal.txt")"
echo "Goal run started. Full log: $LOG"

claude -p "/goal $GOAL" \
  --model sonnet \
  --permission-mode auto \
  --permission-prompts none \
  --output-format stream-json --verbose \
| tee "$LOG" \
| if command -v jq >/dev/null 2>&1; then
    jq -rj 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text + "\n"'
  else
    cat >/dev/null; echo "(install jq to see live progress: sudo apt install jq)"
  fi

if command -v jq >/dev/null 2>&1; then
  tail -n 1 "$LOG" | jq -r '"\nFinished: \(.subtype // "?") | estimated cost: \(.total_cost_usd // "n/a") USD"' 2>/dev/null
fi
echo "Next: read $PF/HANDOVER.md (section 'Waiting on the user')."
