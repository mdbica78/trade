# US-034 QA checklist — Test stability under load and the pre-deploy gate

Round 1: review PASS (`US-034-review.md`, no Critical, no Warning, one non-blocking Note — the
reviewer wanted the three `pnpm test` run transcripts quoted separately rather than summarised;
the exact counts/exit codes are in HANDOVER and this file below). Tests PASS (`US-034-tests.md`,
all 5 acceptance criteria MET, three consecutive `pnpm test` runs each 164 files / 1749 tests exit
0, `pnpm build`/`typecheck`/`lint` green, `predeploy-check.sh` PASS).

All acceptance criteria were drafted by the Technical Lead chat directly in the sprint-08 story
file from DEC-019 §4-§5 (Decided) — no PO confirmation flag needed.

## Automated (already run, not manual)
1. `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck && pnpm
   lint && pnpm build` — PASS (0 typecheck errors, 0 lint errors / 9 pre-existing warnings, build
   green offline).
2. `pnpm test` — run three times in a row this round, each exit 0, each 164 test files / 1749
   tests (identical counts across all three; no PGlite/CPS-1 timeout in any run).
3. `bash scripts/claude/predeploy-check.sh` — exit 0, final line `PREDEPLOY: PASS — typecheck,
   lint, build and tests are green. Safe to commit and push.`

## Manual checks (for the Codex QA loop / the user)
1. Confirm on your own machine (a different filesystem than this WSL1 drvfs sandbox) that `pnpm
   test` still completes without the CPS-1 / PGlite-hook timeouts this story targeted (Sprint 6
   N5, Sprint 7 W5). If it still times out there, the story's fix (raising the two named 30s
   limits) may need a further increase — file a new finding, don't just re-run.
2. Note for the tech-lead sprint-8 audit: the story-tester's round-1 report attributed its
   "Files changed" list to "from git status" while also stating "Denied or attempted commands:
   none" in the same report. AGENTS.md bans every agent from running git, read-only included, with
   zero exceptions. This session did not re-run git to verify the claim (that would repeat the
   same violation); the file list itself matches this story's actual changes exactly, cross-checked
   independently by the reviewer via `.files-touched.log`. Flagging for the sprint-8 audit to look
   at, not treating it as a blocking finding on its own since no evidence of the tester writing or
   pushing anything was found.

## Files changed (US-034, final)
- new: `vitest.config.test.ts`, `scripts/claude/predeploy-check.test.ts`,
  `dev_minions/verification/US-034-plan.md`
- changed: `vitest.config.ts` (named `TEST_TIMEOUT_MS`/`HOOK_TIMEOUT_MS` constants),
  `README.md` ("Before you push" paragraph + one blank-line Markdown fix left over from US-033)
- `dev_minions/verification/US-034-review.md`, `US-034-tests.md`, `US-034-qa.md` (this file, new)
