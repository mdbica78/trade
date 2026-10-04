# US-042 QA checklist — bilingual chat instructions

Development review: round 1 FAIL and round 2 FAIL on AC3; the round-3
independent AC3 re-review PASS closes both findings. Independent test verdict
round 1 PASS remains recorded in `US-042-tests.md`; its original AC3 evidence
covered static guidance but not the request-time refusal. The developer's
post-fix local focused suite (3 files / 83 tests), typecheck, lint (0 errors,
9 existing warnings), full suite (204 files / 2079 tests) and offline build
(12 dynamic routes) passed. Codex should independently verify the final state.

## Codex offline checks

1. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm build` with database, cron, deployment, master-key and
   provider-key variables removed from the process without printing values.
   Expect exit 0 and a skipped non-production migration. Do not contact live
   Neon, BVB, Vercel or AI providers.
2. Run `pnpm test components/chat/ChatView.test.tsx app/chat/page.test.tsx
   lib/ai/chat.test.ts app/chat/reply-messages.test.ts
   components/chat/transcript.test.ts`. Check RO/EN key parity, exactly four
   currently supported actions, no widget/raw-field claims, static rendering
   without provider calls, and the fixed pre-provider key-setting refusal
   including `cheia Gemini/Groq` and generic English/Romanian requests.
   Assert no request/key text reaches the provider or retained transcript.
3. Serve `/chat` locally with test-only/unset configuration in RO and EN.
   Verify the four instructions and `/admin/ai` key-management link appear
   even when chat is unavailable, with no key-entry control. If exercising
   chat, use only an obvious fake placeholder; the response must link to
   `/admin/ai` without echoing the submitted text. Stop the local server.

There is no live BVB/Neon/Vercel/key step for this static feature. Following
the user's normal push, a manual browser check may confirm the RO/EN
instructions and fixed reply; it does not block development. PO to confirm
drafted AC1–AC4 (FR17, FR8.1 and DEC-021 §9). Do not paste a real key into
chat, tests, or QA logs.

## Files changed

- `components/chat/ChatView.tsx`, `components/chat/ChatView.test.tsx`,
  `components/chat/ChatPanel.tsx`, `components/chat/transcript.ts`,
  `components/chat/transcript.test.ts`
- `app/chat/page.test.tsx`, `app/chat/reply-messages.ts`,
  `app/chat/reply-messages.test.ts`
- `lib/ai/chat.ts`, `lib/ai/chat.test.ts`, `messages/en.json`,
  `messages/ro.json`
- `dev_minions/verification/US-042-review.md`,
  `dev_minions/verification/US-042-tests.md`,
  `dev_minions/verification/US-042-fix-strategy-round3.md`,
  `dev_minions/verification/US-042-qa.md`,
  `dev_minions/status.md`, `dev_minions/HANDOVER.md`

No schema, migration, dependency, lockfile or provider endpoint change.
