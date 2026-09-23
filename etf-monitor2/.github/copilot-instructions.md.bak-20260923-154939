# Copilot instructions — etf-monitor2

Follow `AGENTS.md` (repo root). It is the single rulebook for every agent on this repo.

At the start of every chat: read `dev_minions/HANDOVER.md`, then `dev_minions/.checkpoint.md` if present, then `dev_minions/status.md`. Continue the story in flight from its recorded phase; never restart it.

Critical rules (details in AGENTS.md):
- PDF extraction is a deterministic, label-based parser. Never AI.
- Never run git (the user does all version control), deploy, run Neon migrations, change Vercel settings, or read `.env*`.
- Never weaken or delete tests; never mark a story Done.
- Product/design choice not covered by `dev_minions/requirements/` → write a PROPOSED decision file and stop.
- Update `dev_minions/HANDOVER.md` (including "Files changed") at the end of every phase.

Prompts: `/resume-from-handover`, `/deliver-story`, `/review-story` (run review in a separate chat).
