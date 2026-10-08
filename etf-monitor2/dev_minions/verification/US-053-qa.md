# US-053 — QA checklist

## Checks for Codex QA

1. Run the frozen install and project gates with database, cron, deployment, master-key and
   provider variables unset: `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm lint`;
   `pnpm test`; `pnpm build`. Expect all gates to pass, lint to report no new errors (same 11
   pre-existing warnings), 224 test files / 2341 tests to pass, and the offline build to generate
   all 12 dynamic routes without applying a production migration.
2. Run the focused US-053 regression: `lib/ai/chat.test.ts`, `lib/ai/chat.pglite.test.ts`,
   `lib/ai/capabilities/action-list.test.ts`, `lib/ai/capabilities/configuration/prompt.test.ts`,
   `lib/ai/capabilities/widgets/intent.test.ts`, `lib/ai/capabilities/widgets/execute.test.ts`,
   `lib/ai/capabilities/widgets/execute.pglite.test.ts`, `lib/ai/capabilities/widgets/context.test.ts`,
   `lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`,
   `app/chat/reply-messages.test.ts`, `app/chat/actions.test.ts`. Expect all to pass.
3. MANUAL-QA (needs a configured live provider and Neon, per the plan §8): on the deployed app
   with at least two active ETFs, in `/chat` send "add max value for units in circulation for last
   30 days" (no ETF named) — expect each active ETF's detail page to show the new custom value,
   and a deactivated ETF not to receive one. Then send "clear max value for units in circulation
   for last month for all etf" — expect it to disappear on every ETF that had it, and an ETF that
   never had it to show a "No custom value matched for …" line in the reply.
4. Serve locally without a database and spot-check `/chat` in Romanian and English: the existing
   static instruction area and safe no-database/unavailable states are unchanged (this story adds
   no new chat UI, only server-side prompt/validation changes).
5. No live BVB, Vercel, or stored-key step is required beyond item 3.

## Files changed

Plan/process: `dev_minions/verification/US-053-plan.md`, `dev_minions/verification/US-053-review.md`,
`dev_minions/verification/US-053-tests.md`, `dev_minions/verification/US-053-qa.md`,
`dev_minions/HANDOVER.md`, `dev_minions/status.md`.

Source: `lib/ai/capabilities/configuration/context.ts`, `lib/ai/capabilities/widgets/context.ts`,
`lib/ai/capabilities/widgets/intent.ts`, `lib/ai/capabilities/widgets/execute.ts`,
`lib/ai/capabilities/action-list.ts`, `lib/ai/capabilities/configuration/prompt.ts`,
`lib/ai/chat.ts`, `app/chat/reply-messages.ts`, `messages/en.json`, `messages/ro.json`.

Tests: new `lib/ai/capabilities/widgets/context.test.ts` (WC-1); additions to
`lib/ai/capabilities/configuration/prompt.test.ts` (CP-5..CP-8), `lib/ai/capabilities/widgets/intent.test.ts`
(WI-M1..WI-M6), `lib/ai/capabilities/widgets/execute.test.ts` (WE-S1..WE-S3),
`lib/ai/capabilities/widgets/execute.pglite.test.ts` (WEP-S1), `lib/ai/capabilities/action-list.test.ts`
(RT-1..RT-6), `lib/ai/chat.test.ts` (CE-P1, CE-A1..CE-A6, CE-W3), `lib/ai/chat.pglite.test.ts`
(`describe("US-053 …")`: T-1..T-8), `app/chat/reply-messages.test.ts` (RM-I1, RM-N1, RM-K1),
`app/chat/actions.test.ts` (AT-E1); deliberate changes to `lib/ai/chat.test.ts` (CE-W1) and
`lib/ai/capabilities/configuration/prompt.test.ts` (CP-3), both reasoned in HANDOVER.md.
