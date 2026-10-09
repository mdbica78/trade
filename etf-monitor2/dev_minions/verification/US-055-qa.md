# US-055 QA checklist — Conversational assistant (natural replies, 21-message memory, clarifying dialogue, setup questions)

Round 3: independent review PASS and independent tests PASS (`US-055-review.md`,
`US-055-tests.md`); all 9 acceptance criteria MET. The round-3 AC8 evidence adds exact per-turn
action/result and reply-state assertions, confirmation through `chatTurn`, and explicit correction
request/response checks. Round-3 gates: focused 9 files/90 tests; typecheck; lint (0 errors/23
warnings); full 259 files/2,799 tests; offline 12-route build; predeploy PASS.

The reviewer recorded one non-blocking evidence-scope Warning: the correction assertion checks
the server-built final correction message for the closed reason and forbidden value. The full
second request also contains the prior model output as an assistant turn by design (DEC-027 §3);
the test does not claim that untrusted prior output is absent from the whole request.

## Automated (already run by review/test rounds — Codex may re-run but should not need to)
1. Focused PGlite dialogue test — 1 file/17 tests; PASS.
2. Related conversation/correction/reply tests — 7 files/71 tests; PASS.
3. Independent focused suite — 9 files/90 tests; PASS.
4. `pnpm typecheck` — exit 0.
5. `pnpm lint` — exit 0, 0 errors/23 warnings.
6. `pnpm test` — exit 0, 259 files/2,799 tests.
7. `pnpm build` (offline) — exit 0, 12 dynamic routes including `/chat`, migration-on-deploy skipped.
8. `bash scripts/claude/predeploy-check.sh` — exit 0, PREDEPLOY PASS.
   All round-3 gates ran with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and
   provider-key variables unset. No live resource was accessed.

## MANUAL-QA (live provider + Neon; from the plan §1)
- **M-1** — Groq `openai/gpt-oss-120b`: `/admin/ai` "Test connection" OK, then on `/chat` run the
  story's 6-step conversation (ask "ce poți face?" → follow with setup questions → a widget add
  request with a clarifying follow-up → "which custom values do I have on TVBETETF?"). Expect:
  natural RO/EN replies, server-built result list under each reply matches what's actually in the
  database, the ambiguous step asks a question and changes nothing until answered.
- **M-2** — Same conversation on Gemini `gemini-2.5-flash`, continued to at least 12 turns so the
  21-message window starts with an assistant turn. Expect: no provider error from the role-merge
  logic (consecutive same-role turns merged, a leading "model" turn gets a synthetic user prefix).
- **M-3** — Ask the assistant to "reply with `<b>bold</b>` and a link". Expect: shown as literal
  text in the transcript, nothing clickable, no bold rendering.
- **M-4** — Click "New conversation", then send "and for 30 days too" with no prior context in
  that chat. Expect: the assistant says it doesn't know what "that" refers to and asks, rather than
  guessing from the now-cleared history.
- **M-5** — A normal 6-turn conversation on the Groq free tier against the live ETF set. Expect: no
  `rate_limited` outcome under normal use.

## Files changed (US-055 round 3)
- `lib/ai/chat.conversations.pglite.test.ts`
- `test/fixtures/ai/chat-conversations.json`
- `dev_minions/verification/US-055-review.md`
- `dev_minions/verification/US-055-tests.md`
- `dev_minions/verification/US-055-qa.md`
- `dev_minions/status.md`
- `dev_minions/HANDOVER.md`

## PO to confirm (isolated defaults shipped, see HANDOVER "Waiting on the user")
- D-1/D-2/D-3: reply/result-list wording and placement in `messages/*.json` and `ChatReply.tsx`'s
  `what` formatter; the `warning` condition in `reply-messages.ts`; the two instruction lines in
  `ChatView.tsx`. None blocks QA — confined to the files the plan names.
