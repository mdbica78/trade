# US-055 QA checklist — Conversational assistant (natural replies, 21-message memory, clarifying dialogue, setup questions)

Round 1: independent review PASS (`US-055-review.md`), independent tests PASS (`US-055-tests.md`).
253 files / 2743 tests, typecheck/lint/offline build all green.

## Automated (already run by review/test rounds — Codex may re-run but should not need to)
1. `pnpm install --frozen-lockfile` — exit 0.
2. `pnpm typecheck` — 0 errors.
3. `pnpm lint` — 0 errors (23 warnings, pre-existing style).
4. `pnpm test` — 253 files / 2743 tests, all green, with `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/
   `AI_KEY_MASTER_KEY`/every `*_API_KEY` unset.
5. `pnpm build` (offline) — 12 dynamic routes including `/chat`, `migrate-on-deploy: skipped`.

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

## Files changed (US-055)
See `dev_minions/HANDOVER.md` "Files changed (US-055)" for the complete list (21 changed source
files, 3 new source files, 10 new test files, 1 new fixture, 2 doc updates).

## PO to confirm (isolated defaults shipped, see HANDOVER "Waiting on the user")
- D-1/D-2/D-3: reply/result-list wording and placement in `messages/*.json` and `ChatReply.tsx`'s
  `what` formatter; the `warning` condition in `reply-messages.ts`; the two instruction lines in
  `ChatView.tsx`. None blocks QA — confined to the files the plan names.
