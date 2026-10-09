#!/usr/bin/env bash
# Installs the automation kit files the Technical Lead chat cannot write remotely (.claude/ and
# .github/ are protected), and tidies the kit (DEC-009, DEC-015). Review
# dev_minions/automation/pending-kit/ first, then run from WSL, in the project folder:
#   bash scripts/claude/install-kit.sh
# - Replaced files are kept under dev_minions/_obsolete/kit-backups/<time>/ (not as *.bak next to them).
# - Retired kit files are moved there too.
# - A working file with an identical archived copy at the same path under dev_minions/_obsolete/
#   is removed (the PO already archived it). Nothing without an archived copy is deleted.
# No git.
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 1
SRC="dev_minions/automation/pending-kit"
TS="$(date +%Y%m%d-%H%M%S)"
OBS="dev_minions/_obsolete"
BK="$OBS/kit-backups/$TS"
[ -d "$SRC" ] || { echo "Nothing to install: $SRC not found."; exit 1; }

keep() {  # <file>: move it under $BK, keeping its path
  mkdir -p "$BK/$(dirname "$1")"
  mv -f "$1" "$BK/$1"
}
install_one() {  # <source> <destination>
  [ -f "$1" ] || { echo "  missing in pending-kit: $1"; return 0; }
  mkdir -p "$(dirname "$2")"
  if [ -f "$2" ]; then
    if cmp -s "$1" "$2"; then echo "  unchanged  $2"; return 0; fi
    mkdir -p "$BK/$(dirname "$2")"; cp -p "$2" "$BK/$2"
  fi
  cp "$1" "$2"
  echo "  installed  $2"
}

echo "Installing the automation kit…"
install_one "$SRC/claude/agents/tech-lead.md"            ".claude/agents/tech-lead.md"
install_one "$SRC/claude/agents/story-planner.md"        ".claude/agents/story-planner.md"
install_one "$SRC/claude/agents/story-reviewer.md"       ".claude/agents/story-reviewer.md"
install_one "$SRC/claude/agents/story-tester.md"         ".claude/agents/story-tester.md"
install_one "$SRC/claude/skills/deliver-story/SKILL.md"  ".claude/skills/deliver-story/SKILL.md"
install_one "$SRC/claude/skills/handover/SKILL.md"       ".claude/skills/handover/SKILL.md"
install_one "$SRC/claude/settings.json"                  ".claude/settings.json"
install_one "$SRC/github/copilot-instructions.md"        ".github/copilot-instructions.md"
for p in "$SRC"/github/prompts/*.prompt.md; do
  if [ -f "$p" ]; then install_one "$p" ".github/prompts/$(basename "$p")"; fi
done

echo "Retiring kit files no longer used (DEC-013, DEC-015)…"
for f in .claude/agents/qa-runner.md "$SRC/claude/agents/qa-runner.md" scripts/claude/run-sprint.sh; do
  if [ -f "$f" ]; then keep "$f"; echo "  retired    $f"; fi
done

echo "Removing working copies already archived identically in $OBS…"
find "$OBS" -path "$OBS/kit-backups" -prune -o -type f -print 2>/dev/null |
while IFS= read -r a; do
  w="dev_minions/${a#"$OBS"/}"
  if [ -f "$w" ] && cmp -s "$a" "$w"; then rm -f "$w"; echo "  removed    $w (identical to $a)"; fi
done
if [ -f etf-monitoring-requirements.md ] && [ -f "$OBS/etf-monitoring-requirements.root-copy.md" ] \
   && cmp -s etf-monitoring-requirements.md "$OBS/etf-monitoring-requirements.root-copy.md"; then
  rm -f etf-monitoring-requirements.md
  echo "  removed    etf-monitoring-requirements.md (identical to $OBS/etf-monitoring-requirements.root-copy.md)"
fi

echo "Moving old *.bak-* backups out of the way…"
find .claude .github scripts/claude dev_minions -path "$OBS" -prune -o -type f -name '*.bak-*' -print 2>/dev/null |
while IFS= read -r f; do keep "$f"; echo "  moved      $f"; done
for f in AGENTS.md.bak-* CLAUDE.md.bak-*; do
  if [ -f "$f" ]; then keep "$f"; echo "  moved      $f"; fi
done

chmod +x scripts/claude/*.sh 2>/dev/null || true
echo "Done. Replaced and retired files: $BK (if anything was replaced)."
echo "Next: tmux new -s etf 'bash scripts/claude/autopilot.sh'   then start Codex with dev_minions/automation/qa-goal.txt"
