# US-001 manual QA checklist — Spike: PDF text extraction

Both automated gates PASSED round 1 (see `US-001-review.md`, `US-001-tests.md`). This is a spike, so "QA" here means confirming the decision is one you're happy to build on, not clicking through a UI.

## Checks

1. **Open the three fixtures** in `test/fixtures/` (BTBETRETF, TVBETETF, PTENGETF, all dated 2026-09-21) and confirm they look like the real depositary reports you expect from bvb.ro's "Stiri" tab — not corrupted or truncated.
2. **Read `spikes/pdf-extraction/FINDINGS.md`** and confirm you agree with the recommendation: use `unpdf`, no OCR needed. If you'd rather standardize on `pdf-parse` instead (documented as a viable fallback), say so now — it's cheap to change before any adapter code exists.
3. **Note two things FINDINGS.md flags for the future extraction adapter** (US to be scheduled later, likely Sprint 2+): the VUAN value sits in the text well before its own label, and the report date in the footer is one day behind a filing-stamp date that also appears in the header — both are traps a naive "find label, take next number" parser would fall into.
4. **No live BVB/Neon/Vercel check applies** — this story predates the app scaffold; nothing is deployed yet.

## Before committing

This machine's Windows environment has no Node.js; the spike was built and run via WSL1 "Ubuntu" (node v20.20.2, pnpm 12.5.1). A `.gitignore` was added at the repo root (`node_modules/`, `.next/`, `.env*`) so `spikes/pdf-extraction/node_modules/` (~99 MB) and its lockfile artifacts don't get swept into your first commit — please double-check `git status` before `git add`.

## Files changed
- `test/fixtures/BTBETRETF-2026-09-21.pdf` (new)
- `test/fixtures/TVBETETF-2026-09-21.pdf` (new)
- `test/fixtures/PTENGETF-2026-09-21.pdf` (new)
- `spikes/pdf-extraction/package.json` (new)
- `spikes/pdf-extraction/compare.mjs` (new)
- `spikes/pdf-extraction/FINDINGS.md` (new)
- `.gitignore` (new, repo root)
- `dev_minions/verification/US-001-plan.md` (new)
- `dev_minions/verification/US-001-review.md` (new)
- `dev_minions/verification/US-001-tests.md` (new)
- `dev_minions/verification/US-001-qa.md` (new, this file)
