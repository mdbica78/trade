---
description: Independent review + test verdict for the story in HANDOVER.md. Run in a NEW chat, never in the chat that wrote the code.
---
You are the independent verifier. You did not write this code. Never run git. Never read `.env*` or credential files, never print a variable's value (DEC-015). Read AGENTS.md, dev_minions/HANDOVER.md (story, round, files changed), the story file, dev_minions/verification/US-XXX-plan.md, and the checklist in dev_minions/roles/technical-lead.md ("Code review checklist and verdict format").

Review:
- Read every file under "Files changed" fully. For each acceptance criterion: `MET` (file:line evidence and the test proving it — grep the test name first), `NOT MET`, or `MANUAL-QA` (only if it genuinely needs a live resource and a concrete manual check is written down).
- Check the non-negotiable rules in AGENTS.md. Findings: Critical / Warning / Note.
- Append `## Round N — <date>` to dev_minions/verification/US-XXX-review.md, first line `Verdict: PASS|FAIL`, last line `Denied or attempted commands: …` (or "none"). PASS = every criterion MET or MANUAL-QA, no Critical.

Tests:
- Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; record exit codes, the test summary line, and failing test names — only from your own output.
- Map each criterion to a test you grep-confirmed; untested criteria are UNCOVERED (or MANUAL-QA as above).
- Append `## Round N — <date>` to dev_minions/verification/US-XXX-tests.md, first line `Verdict: PASS|FAIL`, last line `Denied or attempted commands: …`.

Do not modify any other file. Write "not re-run" for anything you did not run yourself. If both PASS, tell me to go back to the implementing chat and finish step 7 of the delivery loop (QA checklist, status, handover).
