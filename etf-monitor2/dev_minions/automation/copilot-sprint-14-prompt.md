# Copilot handoff — deliver Sprint 14

Paste the prompt below into Copilot Chat in **Agent** mode, with the `etf-monitor2` repository open. It is model-neutral; select any model available to you. Continue in this chat through Sprint 14, resuming from `HANDOVER.md` after a context reset.

---

You are the delivery agent for Sprint 14 in this repository. Deliver the entire sprint, not just a plan or the first story. Start now and continue through the approved story order. Follow `AGENTS.md` and the process source of truth in `dev_minions/`.

## Read first and resume, do not restart

Read in this order:
1. `dev_minions/HANDOVER.md`
2. `dev_minions/.checkpoint.md`, if present
3. `dev_minions/status.md`
4. The newest `dev_minions/verification/DEMO-*.md`
5. `dev_minions/backlog/sprints/sprint-14.md`
6. `dev_minions/verification/SPRINT-14-tech-lead-brief.md` and `SPRINT-14-review.md`
7. The active story, its acceptance criteria, and its `verification/US-XXX-plan.md`
8. `dev_minions/process.md` and applicable sections of `AGENTS.md`

The Technical Lead has already settled Sprint 14's technical choices. Do not repeat planning, change scope, or ask the user to reconfirm a settled decision. Respect any newer user acceptance/rejection in the newest demo and resume the recorded phase.

## Required order

Deliver these stories in this exact order:

**US-063 → US-060 → US-061 → US-062 → US-059**

US-063 is already implemented by the PO. Resume it at independent verification, round 1; do not rewrite or revert its implementation. The user reports 260 test files / 2,813 tests passed. The previous session also ran typecheck PASS, lint PASS (0 errors, 21 warnings), and offline build PASS (12 dynamic routes, migration skipped). These are historical/user-provided evidence, not tests you personally ran; identify them accurately in verdicts.

After each story's local gates and independent review/test both pass:
- Write/update that story's QA checklist and board state to `Awaiting QA`.
- Update HANDOVER and immediately begin the next story in the order above.
- Do not wait for Codex QA or user acceptance between stories.
- Do not set `Automation state: PAUSED` just because a story ended or the next story is ready.

At the end of US-059, complete the Sprint 14 audit, resolve any Critical finding using the documented reopen/fix process, write a consolidated Sprint 14 demo, update status and HANDOVER, and stop only when no Sprint 14 story remains eligible. Use `ALL-DONE` only if every roadmap story is Awaiting QA or Done; otherwise use `STOPPED-FOR-USER` with the demo path.

## Independent verification is mandatory

Implementation context must not write its own independent review/test verdict.

- If this environment offers independent reviewer/tester agents, use them only after the relevant story's implementation and local gates are complete. Give them the story ID, round number, and ask them to write their own verdict files from their own evidence.
- If independent agents are unavailable, use distinct fresh Copilot chats for the reviewer and tester. Do not claim either gate passed until those chats return verdicts. Use the copy-paste templates at the end of this file. Then resume this delivery chat, apply any findings, and continue. Keep the session active at a story verification handoff; do not mark it Awaiting QA until both independent verdicts pass.
- A review or test chat must be independent: it cannot rely on this implementation chat's assertions as its evidence.
- Any FAIL: fix only the findings, rerun the failed gate(s), and repeat independent verification in the next round. Follow the repo's maximum-round/escalation process.

## Per-story delivery loop

For each story:
1. Record story, phase, round, criteria done/remaining, failing tests (or `none known`), complete files changed, and exact next step in `dev_minions/HANDOVER.md`. Follow the repository's Copilot state convention (`PAUSED — Copilot`) in the handover; that status is a host/automation marker, not an instruction to stop story delivery. Continue to the next eligible story after each Awaiting QA handoff.
2. Read and follow the existing plan. Make precise changes and add the planned tests. Preserve existing behavior except where the story explicitly changes it. Do not weaken, skip, or delete tests.
3. Run focused relevant tests and the project gates required by the plan: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and offline `pnpm build`. Before any build, ensure it cannot apply a production migration. Record exact command/result and distinguish personally run evidence from prior/user-provided evidence.
4. Get independent review and independent tests. Fix any findings and repeat only failing gates.
5. On both PASS, write the QA checklist with live steps and a complete files-changed list; update only the active story's status row; then continue directly to the next story.
6. Update HANDOVER after every phase and at least before any long-running command. Never write to HANDOVER's `## QA/Deploy log (Codex)` section.

## Settled requirements and constraints

- **US-059:** List answers are generated by the model from supplied context. Do not add deterministic list commands or actions. Respect chat safety and the CP-12/CP-18 prompt-size bounds.
- **US-060:** Add by symbol only. Keep `etfs.name NOT NULL`; deterministically extract a name from the BVB instrument page, with normalized symbol fallback. Re-detection updates the name only when a valid fresh name exists. Ignore any model-supplied name.
- **US-061:** UI redesign only. Reuse DEC-029's per-provider model storage and existing custom-provider/key data. Keys are write-only and must never appear in client props, rendered UI, logs, errors, or test output.
- **US-062 / DEC-030:** `NULL` cron hour means 10 UTC; persist integer 0–23; gate at/after the saved UTC hour. Any job run started during the current UTC date counts, regardless of status; no same-day retry. Unauthorized, before-hour, and already-run requests must create no run row. Authenticate before settings/database work. Keep Vercel's daily safety-net call and add the documented hourly GitHub Actions workflow. Add nullable `job_runs.scheduled_date_utc`, its unique index, and a `started_at` index for historical-day checks. Generate the expand-only migration only with `pnpm db:generate`; never run migrations against Neon. The production build applies migrations under DEC-023. Do not print or request real secret values.
- **US-063:** Retain the PO's UI. Verify bounded vertical and horizontal scrolling, sticky header, keyboard focus, localized region label, and themes; browser-only interaction checks belong in its QA checklist.
- Every UI string must use next-intl in Romanian and English. Follow DEC-020 tokens, theme/contrast rules and snapshot discipline.
- Follow extraction rules: PDF parsing is deterministic, never AI.
- Use mocked external resources in tests. No test may call live Neon, Vercel, BVB, or an AI provider.
- Never run any Git command. Never deploy, apply a migration to Neon, change Vercel settings, access live services, read `.env*` or credential files, or print environment-variable values. Never mark a story Done; only the user accepts it.
- Never edit requirements or accepted ADRs, or another agent's verdict file. Do not make unrelated changes. If a genuinely unresolved product decision with no isolated default arises, document it and block only the affected story; continue other eligible work.

## Independent reviewer prompt (copy into a fresh chat)

> You are the independent reviewer for **US-XXX, round N** in this repository. Read `AGENTS.md`, `dev_minions/HANDOVER.md`, the story, its plan, and the complete changed files. Do not run Git or access secrets/live services. Review every acceptance criterion and the code for correctness, regressions, security/privacy, localization, and plan compliance. Verify claims yourself; do not trust the implementation chat. Do not edit application code or tests. Write your independent verdict to `dev_minions/verification/US-XXX-review.md` using the project's round format, cite concrete file/line evidence, list Critical/Warning/Note findings, accurately state gates you did not run, and report denied/attempted commands. Return PASS or FAIL plus the verdict path.

## Independent tester prompt (copy into another fresh chat)

> You are the independent tester for **US-XXX, round N** in this repository. This must be a separate context from implementation and review. Read `AGENTS.md`, `dev_minions/HANDOVER.md`, the story, plan, and existing tests. Do not run Git or access secrets/live services. Run focused tests and the required typecheck, lint, full suite, and offline build (prevent production migration execution); report exact commands, exits, and outputs. Map each acceptance criterion to tests/evidence you personally produced as `MET`, `NOT MET`, or `MANUAL-QA`. Do not edit code/tests, weaken tests, or rely on another agent's unverified claims. Write `dev_minions/verification/US-XXX-tests.md` using the round format, include files changed and denied/attempted commands, and return PASS or FAIL plus the verdict path.
