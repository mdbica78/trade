## QA run 1 — 2026-10-04 18:09
Verdict: PASS
Machine checks: 7/7   Left for the user: 1

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` (Windows pnpm.cmd, database/deploy/key variables removed; run immediately before this story) → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 1.1s`. No dependency manifest change. |
| 2 | Current guidance and refusal regressions (qa.md #2; AC1–AC4) | AUTO | PASS | `pnpm test components/chat/ChatView.test.tsx app/chat/page.test.tsx lib/ai/chat.test.ts app/chat/reply-messages.test.ts components/chat/transcript.test.ts` (eleven database/deploy/key variables removed) → 0 → `Test Files 5 passed (5); Tests 120 passed (120)`. This run included tests for ten English/RO key-request variants, provider not called, key-free fixed reply, and hidden submitted text. |
| 3 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` (eight database/deploy/key variables removed; earlier in this QA cycle) → 0 → `$ tsc --noEmit`. |
| 4 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` (same variables removed; earlier in this QA cycle) → 0 → `9 problems (0 errors, 9 warnings)`. |
| 5 | Full suite (qa.md #1) | AUTO | PASS | `pnpm test` (same variables removed; earlier in this QA cycle) → 0 → `Test Files 214 passed (214); Tests 2203 passed (2203)`. |
| 6 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build` (same variables removed; earlier in this QA cycle) → 0 → `migrate-on-deploy: skipped (not a production build)`; 12 dynamic routes including `/chat`. |
| 7 | No-database RO/EN chat guidance (qa.md #3; AC1–AC3) | AUTO-PARTIAL | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh start'` (eleven variables removed) → 0 → `QA server ready ... (database: none)`; `bash -lc 'bash scripts/claude/qa-serve.sh get /chat'` → 0 → `STATUS 200`, RO `Nu lipi chei de furnizor în chat` and `Deschide Administrare → AI`; `bash -lc 'bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en'` → 0 → `STATUS 200`, EN `Do not paste provider keys into chat` and `Open Administration → AI`. Browser snapshot showed a labelled instruction region, link `/admin/ai`, safe load-error alert and no composer/key-entry control while DB is absent. `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped`. |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm the agent-drafted AC1–AC4 and the wording of the RO/EN guidance at demo. On this later worktree, US-045 has already expanded the shipped capability: the page now advertises four original configuration actions plus four widget actions and 1–5-action requests. The old US-042 checklist's "exactly four" describes the earlier pre-US-045 state, not this current supported capability.

The no-database page deliberately has no chat composer, so an HTTP/browser send was not attempted. The focused offline tests independently exercised the pre-provider fixed refusal using obvious fake text; no live AI provider or real key was used. There is no live-resource step for this story.

### Failures (if any)
- None.

No git command, credential file, live database, provider, Vercel setting, or secret value was accessed. No application code or tests edited.
