#!/usr/bin/env bash
# Claude Code PostToolUse hook (Write|Edit|MultiEdit|NotebookEdit) — DEC-011.
# Appends every file an agent writes to dev_minions/.files-touched.log, tagged with the
# active story from HANDOVER.md, so "Files changed" survives a session that dies mid-story
# (usage limit, crash). Never blocks or fails the tool call. No git.
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" 2>/dev/null || exit 0
p="$(node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    try { const t=(JSON.parse(s).tool_input)||{}; process.stdout.write(t.file_path||t.notebook_path||""); } catch(e){} })' 2>/dev/null)"
[ -n "$p" ] || exit 0
p="${p#"$ROOT"/}"
case "$p" in
  dev_minions/.files-touched.log|dev_minions/.checkpoint.md) exit 0 ;;
esac
story="$(grep -m1 -oE '^- Story: US-[0-9]+' dev_minions/HANDOVER.md 2>/dev/null | grep -oE 'US-[0-9]+')"
echo "$(date '+%F %T')  ${story:-none}  $p" >> dev_minions/.files-touched.log 2>/dev/null
exit 0
