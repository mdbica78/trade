#!/usr/bin/env bash
# Claude Code Stop hook: snapshot of recently modified files, for handover (Claude Code or Copilot).
# No git. Never blocks or fails the session.
cat >/dev/null 2>&1 || true   # drain hook JSON from stdin
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" 2>/dev/null || exit 0
OUT="dev_minions/.checkpoint.md"
{
  echo "# Auto checkpoint — written by the Claude Code Stop hook. Do not edit."
  echo "- time: $(date -Iseconds)"
  echo
  echo "## Files written by agents, per story (PostToolUse hook log, newest last — DEC-011)"
  if [ -f dev_minions/.files-touched.log ]; then
    tail -n 80 dev_minions/.files-touched.log | sed 's/^/    /'
  else
    echo "    (none yet)"
  fi
  echo "Note: files changed by commands (pnpm add → package.json/pnpm-lock.yaml, generated migrations, deletions) are not in that log; see the list below."
  echo
  echo "## Files modified in the last 3 hours (excluding node_modules, .next, .git, logs)"
  find . \( -path ./node_modules -o -path ./.next -o -path ./.git -o -path ./dev_minions/automation/logs -o -path "./Claude outputs" \) -prune -o \
       -type f -mmin -180 ! -name '.checkpoint.md' ! -name '.files-touched.log' -printf '    %TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort -r | head -60
} > "$OUT" 2>/dev/null
exit 0
