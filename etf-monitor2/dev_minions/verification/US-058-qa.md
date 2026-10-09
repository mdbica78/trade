# US-058 QA checklist — Assistant reliability

## Automated checks

1. In a clean local checkout, run `corepack pnpm install --frozen-lockfile`.
2. With database, cron, Vercel, master-key, and provider-key variables unset, run:
   `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`,
   `corepack pnpm build`, and `bash scripts/claude/predeploy-check.sh` from login Bash.
   Expected: all gates pass; build reports migration skipped outside production.
3. Run the US-058 confirmation, chat, Gemini, model-call, correction, and boundary test selectors,
   including `lib/ai/chat.correction.test.ts`. Expected: confirmation refusals do not execute or
   make provider calls; Gemini request schema allows `slot: "all"`; provider fallback/call-budget
   tests pass; multiple invalid actions all appear in one correction instruction; the real Gemini
   adapter's schema-downgrade + correction path makes exactly three fake-fetch calls.

## Live checks — deployed app

No schema change or production migration is part of US-058. Use the existing deployed app:
`https://etf-monitor2.vercel.app/chat`.

4. With a configured provider and existing active ETFs/widgets, submit
   `șterge valoarea maximă pe 30 de zile la toate ETF-urile`. Confirm that the assistant shows
   every affected active ETF and asks `Continui?`. Answer `nu`; verify no widget changed. Repeat
   and answer `da`; verify the listed widgets are cleared.
5. Submit `remove PTENGETF`. Verify a confirmation plan appears. Answer `no`; verify the ETF
   remains on the home page and no removal is performed.
6. Request an ETF removal, wait more than 10 minutes, then press Confirm. Expected: an expired
   plan refusal and no change to the ETF.
7. Request an ETF removal in two tabs. Confirm in the first tab, then confirm the original plan in
   the second. Expected: the second confirmation reports changed state; the removal is not applied
   twice.
8. If already configured, test structured output using Groq `openai/gpt-oss-120b`, Gemini
   `gemini-2.5-flash`, and OpenAI, Mistral, or Cerebras. Expected: normal answers without provider
   errors. With Groq `llama-3.3-70b-versatile`, allow one additional first-call fallback; later
   calls should work normally. Do not create accounts or enter keys for this check.
9. On the configured Groq free-tier path, exercise a normal six-turn conversation. Expected: no
   increased `rate_limited` errors attributable to the reliability changes.

## Files changed

`lib/ai/providers/types.ts`, `lib/ai/providers/http.ts`, `lib/ai/providers/openai-compatible.ts`,
`lib/ai/providers/gemini.ts`, `lib/ai/provider-catalog.ts`, `lib/ai/capabilities/action-list.ts`,
`lib/ai/capabilities/configuration/interpret.ts`, `lib/ai/capabilities/configuration/prompt.ts`,
`lib/ai/key-store.ts`, `lib/ai/provider-deps.ts`, `lib/ai/chat.ts`, `lib/ai/chat-history.ts`,
`lib/ai/model-call.ts`, `lib/ai/chat-plan.ts`, `lib/ai/correction.ts`,
`lib/ai/chat.regression.test.ts`, `lib/ai/chat.conversations.pglite.test.ts`,
`lib/ai/chat-plan.test.ts`, `lib/ai/correction.test.ts`, `lib/ai/chat.correction.test.ts`,
`lib/ai/model-call.test.ts`, `lib/ai/chat.confirm.test.ts`, `lib/ai/chat.confirm.pglite.test.ts`,
`lib/ai/capabilities/action-list.schema.test.ts`, `lib/ai/key-store.test.ts`,
`lib/ai/provider-deps.test.ts`, `lib/ai/provider-catalog.test.ts`,
`lib/ai/providers/gemini.test.ts`, `lib/ai/providers/openai-compatible.test.ts`,
`lib/ai/providers/errors.test.ts`, `lib/ai/chat.conversation.test.ts`, `lib/ai/chat.pglite.test.ts`,
`app/chat/reply-messages.ts`, `app/chat/actions.ts`, `app/chat/page.tsx`,
`app/chat/reply-messages.confirm.test.ts`, `app/chat/actions.confirm.test.ts`,
`components/chat/chat-state.ts`, `components/chat/transcript.ts`, `components/chat/ChatPanel.tsx`,
`components/chat/ChatReply.tsx`, `components/chat/ChatView.tsx`, `components/chat/confirm.ts`,
`components/chat/ChatPlanControls.tsx`, `components/chat/confirm.test.ts`,
`components/chat/transcript.confirm.test.ts`, `components/chat/ChatReply.confirm.test.tsx`,
`components/chat/ChatPanel.test.tsx`, `messages/en.json`, `messages/ro.json`, `README.md`,
`test/fixtures/ai/chat-conversations.json`, `test/fixtures/ai/README.md`,
`dev_minions/decisions/DEC-028-us-058-json-schema-strictness.md`,
`dev_minions/decisions/README.md`, `dev_minions/verification/US-058-plan.md`,
`dev_minions/verification/US-058-review.md`, `dev_minions/verification/US-058-tests.md`,
`dev_minions/verification/US-058-qa.md`, `dev_minions/status.md`, `dev_minions/HANDOVER.md`.
Round-3 audit-reopen fix adds `lib/ai/chat.correction.test.ts` and changes
`lib/ai/chat.ts`; the round-3 independent AC4 review/test evidence is in the review and test files.
