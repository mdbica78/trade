#!/usr/bin/env bash
# Autopilot (DEC-009, DEC-011): runs Claude Code in cycles until it stops for the user.
# Each cycle is a fresh Claude Code session, so each starts with a fresh context. A cycle
# ends itself after ~120 turns with "Automation state: PAUSED"; this script then starts
# the next cycle. It stops when HANDOVER.md says STOPPED-FOR-USER or ALL-DONE, after two
# cycles with no progress, or after MAX_CYCLES working cycles.
#
# Usage limits: when a cycle ends because the plan's limit was hit, the script reads the
# reset time from the log and sleeps until then (+90 s). Waiting doesn't count as a cycle.
# If the reset is more than MAX_LIMIT_WAIT_HOURS away (e.g. the weekly limit), it stops
# and tells you instead.
#
# Run inside tmux so it survives closing the terminal (WSL):
#   cd /mnt/c/_mystaff/myG/trade/etf-monitor2
#   tmux new -s etf 'bash scripts/claude/autopilot.sh'
# Detach: Ctrl-b d   Re-attach: tmux attach -t etf
#
# Network drops ("Can't reach the API server") back off 5→30 min and retry, up to
# NET_MAX_WAIT_HOURS; they do not count as cycles either.
#
# Tunables (env vars): MAX_CYCLES=12  PAUSE_SECONDS=60  LIMIT_WAIT_SECONDS=1800 (fallback)
#                      MAX_LIMIT_WAIT_HOURS=12  NET_MAX_WAIT_HOURS=10
# No git anywhere in here: the user does all version control.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
PF="dev_minions"
HO="$PF/HANDOVER.md"
MAX_CYCLES="${MAX_CYCLES:-12}"
PAUSE_SECONDS="${PAUSE_SECONDS:-60}"
LIMIT_WAIT_SECONDS="${LIMIT_WAIT_SECONDS:-1800}"
MAX_LIMIT_WAIT_HOURS="${MAX_LIMIT_WAIT_HOURS:-12}"
NET_MAX_WAIT_HOURS="${NET_MAX_WAIT_HOURS:-10}"   # give up after this long without the API
mkdir -p "$PF/automation/logs"
# DEC-002 / DEC-008: non-interactive WSL shells don't pick this up from /etc/environment.
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/certs/ca-certificates.crt}"

if [ ! -f .claude/agents/tech-lead.md ]; then
  echo "The DEC-009 kit is not installed yet (.claude/agents/tech-lead.md missing)."
  echo "Review dev_minions/automation/pending-kit/, then run: bash scripts/claude/install-kit.sh"
  exit 4
fi

state()       { grep -m1 -oE 'Automation state: *[A-Z-]+' "$HO" 2>/dev/null | sed 's/.*: *//'; }
fingerprint() { cat "$HO" "$PF/status.md" 2>/dev/null | md5sum | cut -d' ' -f1; }

# Prints the epoch (seconds) at which the limit resets if the cycle ended on a usage
# limit; prints nothing otherwise. Uses the last rate_limit_event in the stream log.
limit_reset_epoch() {
  local log="$1" r=""
  if command -v node >/dev/null 2>&1; then
    r="$(grep '"rate_limit_event"' "$log" 2>/dev/null | tail -n 1 | node -e '
      let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
        try { const i=JSON.parse(s).rate_limit_info||{};
              if (i.status==="rejected" && i.resetsAt) process.stdout.write(String(i.resetsAt)); } catch(e){} })' 2>/dev/null)"
  fi
  if [ -z "$r" ] && tail -n 6 "$log" 2>/dev/null | grep -qiE 'hit your (session|usage|weekly) limit|usage limit reached'; then
    r=$(( $(date +%s) + LIMIT_WAIT_SECONDS ))
  fi
  printf '%s' "$r"
}

GOAL="$(cat "$PF/automation/goal.txt")"
no_progress=0
cycle=0
attempt=0

while [ "$cycle" -lt "$MAX_CYCLES" ]; do
  attempt=$((attempt + 1))
  before="$(fingerprint)"
  LOG="$PF/automation/logs/autopilot-$(date +%Y%m%d-%H%M%S)-a${attempt}.jsonl"
  echo "=== Autopilot run $attempt (working cycles so far: $cycle/$MAX_CYCLES) — $(date '+%F %T') — log: $LOG"

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

  s="$(state)"
  echo "--- run $attempt ended — Automation state: ${s:-unknown}"

  case "$s" in
    STOPPED-FOR-USER|ALL-DONE)
      demo="$(ls -t "$PF"/verification/DEMO-*.md 2>/dev/null | head -1)"
      printf '\a'
      echo "Autopilot stopped for you ($s). Open: ${demo:-$HO}"
      exit 0 ;;
  esac

  reset="$(limit_reset_epoch "$LOG")"
  if [ -n "$reset" ]; then
    now=$(date +%s); wait_s=$(( reset - now + 90 )); [ "$wait_s" -lt 60 ] && wait_s=60
    if [ "$wait_s" -gt $(( MAX_LIMIT_WAIT_HOURS * 3600 )) ]; then
      printf '\a'
      echo "Usage limit reached; it resets $(date -d "@$reset" '+%F %T'), more than ${MAX_LIMIT_WAIT_HOURS}h away."
      echo "Stopping. Run the same command again after that time (or use the Copilot fallback)."
      exit 5
    fi
    echo "Usage limit reached — sleeping until $(date -d "@$(( now + wait_s ))" '+%T') (limit resets $(date -d "@$reset" '+%T'))."
    sleep "$wait_s"
    continue            # waiting for a limit is not a working cycle
  fi

  # Network outage (PC asleep, Wi-Fi/VPN drop): back off and retry; not a working cycle.
  if tail -n 4 "$LOG" 2>/dev/null | grep -qE "API Error: |Can't reach the API server|EAI_AGAIN|ENOTFOUND|ECONNRESET|ETIMEDOUT"; then
    net_waited=$(( ${net_waited:-0} + ${net_wait:-300} ))
    if [ "$net_waited" -gt $(( NET_MAX_WAIT_HOURS * 3600 )) ]; then
      printf '\a'
      echo "Stopping: no connection to the Claude API for over ${NET_MAX_WAIT_HOURS}h. Run the same command again when you're back online."
      exit 6
    fi
    echo "Can't reach the Claude API — retrying in ${net_wait:-300}s (waited ${net_waited}s so far)."
    sleep "${net_wait:-300}"
    net_wait=$(( ${net_wait:-300} * 2 )); [ "$net_wait" -gt 1800 ] && net_wait=1800
    continue
  fi
  net_wait=300; net_waited=0

  cycle=$((cycle + 1))
  if [ "$(fingerprint)" = "$before" ]; then
    no_progress=$((no_progress + 1))
    echo "No progress in HANDOVER.md/status.md this cycle ($no_progress/2)."
    if [ "$no_progress" -ge 2 ]; then
      printf '\a'
      echo "Stopping: two cycles without progress. Read $HO and $LOG."
      exit 2
    fi
  else
    no_progress=0
  fi
  sleep "$PAUSE_SECONDS"
done

printf '\a'
echo "Stopping: reached MAX_CYCLES=$MAX_CYCLES working cycles. Run the same command again to continue."
exit 3
