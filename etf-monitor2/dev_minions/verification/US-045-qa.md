# US-045 QA checklist — multi-action widget chat

Development round 2 review PASS and independent tests PASS: AC1–AC8 MET.
Codex QA is separate and does not gate the next development story.

## Offline checks

1. With DB, deployment and provider-key variables removed from the process
   without printing them, run `pnpm install --frozen-lockfile`,
   `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Expect a
   non-production migration skip and all commands to pass.
2. Run `pnpm exec vitest run lib/ai/capabilities/action-list.test.ts
   lib/ai/capabilities/widgets/intent.test.ts
   lib/ai/capabilities/widgets/execute.pglite.test.ts
   lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts
   app/chat/reply-messages.test.ts components/chat/ChatView.test.tsx
   lib/ai/capabilities/boundaries.test.ts app/actions.boundary.test.ts`.
   Expect one-to-five action validation, mixed capability order, no writes
   on any invalid action, and stopped execution with `done` / `failed` /
   `not_run` after a returned configuration failure or thrown error.
3. Check both RO/EN instructions and replies describe all four widget
   operations and the five-action limit. Confirm the key-request refusal
   remains pre-provider and returned text never contains provider data.

## Post-push MANUAL-QA

4. When a provider is already configured, try chat requests to add, update,
   clear and replace one ETF's catalogue-based widgets. Confirm persistence
   on its detail page. No real provider key is pasted into chat or tests.
5. Try a mixed configuration-and-widget request, then a six-action request.
   Confirm ordered per-action results for the former and a safe split-request
   response for the latter. Live provider interpretation is a judgment item,
   not proof of deterministic parser correctness. Do not run a live migration,
   seed secret tables or select stored key values.

PO to confirm drafted AC1–AC8 (FR17–FR19; DEC-022).

## Files changed

- `dev_minions/verification/US-045-plan.md`,
  `dev_minions/verification/US-045-review.md`,
  `dev_minions/verification/US-045-tests.md`,
  `dev_minions/verification/US-045-qa.md`,
  `dev_minions/status.md`, `dev_minions/HANDOVER.md`
- `lib/ai/capabilities/action-list.ts`,
  `lib/ai/capabilities/action-list.test.ts`,
  `lib/ai/capabilities/types.ts`, `lib/ai/capabilities/registry.ts`,
  `lib/ai/capabilities/registry.test.ts`,
  `lib/ai/capabilities/boundaries.test.ts`,
  `lib/ai/capabilities/configuration/intent.ts`,
  `lib/ai/capabilities/configuration/intent.test.ts`,
  `lib/ai/capabilities/configuration/grounding.ts`,
  `lib/ai/capabilities/configuration/prompt.ts`,
  `lib/ai/capabilities/configuration/prompt.test.ts`,
  `lib/ai/capabilities/configuration/interpret.ts`,
  `lib/ai/capabilities/configuration/interpret.test.ts`,
  `lib/ai/capabilities/configuration/interpret.pglite.test.ts`,
  `lib/ai/capabilities/configuration/capability.ts`,
  `lib/ai/capabilities/configuration/execute.ts`
- `lib/ai/capabilities/widgets/capability.ts`,
  `lib/ai/capabilities/widgets/context.ts`,
  `lib/ai/capabilities/widgets/intent.ts`,
  `lib/ai/capabilities/widgets/intent.test.ts`,
  `lib/ai/capabilities/widgets/execute.ts`,
  `lib/ai/capabilities/widgets/execute.test.ts`,
  `lib/ai/capabilities/widgets/execute.pglite.test.ts`,
  `lib/ai/chat.ts`, `lib/ai/chat.test.ts`,
  `lib/ai/chat.pglite.test.ts`, `lib/ai/boundaries.test.ts`
- `app/chat/actions.ts`, `app/chat/actions.test.ts`,
  `app/chat/actions.pglite.test.ts`,
  `app/chat/add-paths.pglite.test.ts`,
  `app/chat/reply-messages.ts`, `app/chat/reply-messages.test.ts`,
  `components/chat/chat-state.ts`, `components/chat/ChatReply.tsx`,
  `components/chat/ChatReply.test.tsx`,
  `components/chat/ChatView.tsx`, `components/chat/ChatView.test.tsx`,
  `messages/en.json`, `messages/ro.json`
