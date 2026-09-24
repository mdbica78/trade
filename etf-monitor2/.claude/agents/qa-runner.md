---
name: qa-runner
description: RETIRED by DEC-013. Do not use. QA now runs in a separate Codex loop (dev_minions/roles/qa.md), not as a Claude Code subagent. This file is an inert stub kept only because Claude can't delete files in the user's connected folder remotely; safe to delete by hand.
tools: Read
model: haiku
effort: low
---

This subagent is retired. See `dev_minions/decisions/DEC-013-split-autopilots.md` and
`dev_minions/roles/qa.md`. Nothing in the `deliver-story` skill delegates to `qa-runner`
anymore — if you were invoked, that's a stale reference somewhere; do nothing and return
"qa-runner is retired, see DEC-013."
