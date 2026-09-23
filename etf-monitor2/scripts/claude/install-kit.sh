#!/usr/bin/env bash
# Installs the DEC-009 autopilot files that the Technical Lead chat is not allowed to write
# remotely (.claude/ and .github/ are protected). Review them first in
# dev_minions/automation/pending-kit/, then run from WSL, in the project folder:
#   bash scripts/claude/install-kit.sh
# Existing files are backed up as <file>.bak-<timestamp>. No git.
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 1
SRC="dev_minions/automation/pending-kit"
TS="$(date +%Y%m%d-%H%M%S)"
[ -d "$SRC" ] || { echo "Nothing to install: $SRC not found."; exit 1; }

install_one() {  # <source> <destination>
  mkdir -p "$(dirname "$2")"
  if [ -f "$2" ]; then cp -p "$2" "$2.bak-$TS"; fi
  cp "$1" "$2"
  echo "  installed $2"
}

echo "Installing autopilot kit (DEC-009)…"
install_one "$SRC/claude/agents/tech-lead.md"            ".claude/agents/tech-lead.md"
install_one "$SRC/claude/agents/story-planner.md"        ".claude/agents/story-planner.md"
install_one "$SRC/claude/agents/story-reviewer.md"       ".claude/agents/story-reviewer.md"
install_one "$SRC/claude/agents/story-tester.md"         ".claude/agents/story-tester.md"
install_one "$SRC/claude/skills/deliver-story/SKILL.md"  ".claude/skills/deliver-story/SKILL.md"
install_one "$SRC/claude/skills/handover/SKILL.md"       ".claude/skills/handover/SKILL.md"
install_one "$SRC/github/copilot-instructions.md"        ".github/copilot-instructions.md"
if [ -f "$SRC/claude/settings.json" ]; then
  install_one "$SRC/claude/settings.json"                 ".claude/settings.json"
fi
echo "Done. Backups end in .bak-$TS."
echo "Next: tmux new -s etf 'bash scripts/claude/autopilot.sh'"
