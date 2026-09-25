---
description: Deliver the next eligible user story (pick, detail, plan, implement) following AGENTS.md.
---
Read AGENTS.md, dev_minions/HANDOVER.md and dev_minions/status.md. Never run git. If a story is in flight, use /resume-from-handover instead.

Otherwise run steps 1–4 of the delivery loop in AGENTS.md for the next eligible story (or ${input:story:US-XXX, optional}):
- write dev_minions/verification/US-XXX-plan.md (criteria → tests, files to touch),
- implement test-first until `pnpm typecheck && pnpm lint && pnpm test` pass,
- keep "Files changed" in HANDOVER.md accurate, then set phase=review.

Then stop and tell me to run `/review-story` in a NEW chat. Any product or design choice not covered by the requirements: write a PROPOSED decision file and stop.
