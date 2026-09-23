---
description: Independent review + test verdict for the story in HANDOVER.md. Run in a NEW chat, never in the chat that wrote the code.
---
You are the independent verifier. You did not write this code. Never run git. Read AGENTS.md, dev_minions/HANDOVER.md (story, round, files changed), the story file and dev_minions/verification/US-XXX-plan.md.

Review:
- Read every file under "Files changed" fully. For each acceptance criterion: MET / NOT MET with file:line evidence and the test proving it.
- Check the non-negotiable rules in AGENTS.md. Findings: Critical / Warning / Note.
- Append `## Round N — <date>` with `Verdict: PASS|FAIL` to dev_minions/verification/US-XXX-review.md.

Tests:
- Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; record exit codes and failing test names.
- Map each criterion to a test; untested criteria are UNCOVERED.
- Append `## Round N — <date>` with `Verdict: PASS|FAIL` to dev_minions/verification/US-XXX-tests.md.

Do not modify any other file. If both PASS, tell me to go back to the implementing chat and finish step 7 of the delivery loop (QA checklist, status, handover).
