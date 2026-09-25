---
description: Continue exactly where Claude Code (or a previous chat) stopped, using dev_minions/HANDOVER.md.
---
Read AGENTS.md, dev_minions/HANDOVER.md, dev_minions/.checkpoint.md (if present) and dev_minions/status.md. Never run git.

1. Tell me in 5 lines: active story, phase, round, files changed so far, exact next step.
2. Continue from the recorded phase following the delivery loop in AGENTS.md. Do not restart the story.
3. Keep "Files changed" in HANDOVER.md accurate as you work.
4. When implementation is green (`pnpm typecheck && pnpm lint && pnpm test`), set HANDOVER.md phase=review and tell me to run `/review-story` in a NEW chat. Do not review your own code.
5. Update HANDOVER.md at the end of every phase.
