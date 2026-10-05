# US-051 — QA checklist

Round 1: independent review PASS (`US-051-review.md`, no Critical/Warning — two non-blocking
Notes: CE-G1's mocked outcome payload doesn't exactly match the action name it's attached to, a
pre-existing test-fixture pattern not a defect; HANDOVER's "before" `wc -l` counts can't be
independently re-verified since git is off-limits, but the "after" counts matched exactly).
Independent tests PASS (`US-051-tests.md`, AC1–AC6 all MET, 222 files / 2285 tests).

This is a pure refactor (no new UI, no new route, no schema/migration change, no message-key
change) with one named allowed behaviour change (C10: widget context is only loaded when a chat
action list contains a widget action) — manual checks are regression-style spot checks, not new
behaviour.

## Checks for Codex QA
1. `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
   expect all green, 222 files / 2285 tests, offline build 12 dynamic routes, with
   `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY`
   unset.
2. Serve locally (no DB) and spot-check `/chat` in RO and EN: unavailable/key-request/admin-link
   replies unchanged (golden-tested against markup captured before the refactor).
3. `/admin/ai` in RO and EN: provider/model fields and key-status rows unchanged
   (`AiSettingsAdmin.tsx`'s type aliases changed, markup did not).
4. C10's allowed change is not independently visible without a live AI provider call and a
   multi-action chat message mixing a configuration action with a widget action — not a
   practical manual check in this QA environment; covered by `chat.test.ts` CE-W1/CE-W2 instead.
5. No live Neon/Vercel/AI provider step needed — this story touches no schema, no env var, no
   route, no message key.

## PO to confirm
- AC1–AC6 are all agent-drafted-and-confirmed against the Technical Lead's own review
  (`CODE-REVIEW-20261004.md` §C), not fresh PO-facing criteria — nothing new to confirm beyond the
  general "does `/chat` and `/admin/ai` still look/behave the same" check in steps 2-3 above.

## Files changed
See `dev_minions/HANDOVER.md`'s "Active story" US-051 section, "Files changed (US-051)" list, for
the full new/changed/test-change file list: `lib/ai/chat.ts`, every file under
`lib/ai/capabilities/`, `lib/ai/providers/{run-generation,resolve}.ts`,
`lib/ai/{provider-deps,key-status,key-store}.ts`, `lib/config/{widgets,ai-settings}.ts`,
`app/chat/reply-messages.ts`, `components/chat/{chat-state,ChatReply}.tsx`,
`components/admin/AiSettingsAdmin.tsx`, plus the two new golden test files (and their committed
`.snap` files) and every new/changed test file listed there.
