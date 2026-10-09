# US-022 QA checklist — Admin: AI provider and API key settings

Round 1: review PASS (`US-022-review.md`, W1/N1 non-blocking notes), tests PASS
(`US-022-tests.md`). All 8 acceptance criteria drafted by agent (story-planner) — **PO to
confirm** at the demo.

## Automated (already run this round, offline/PGlite only)
- `pnpm typecheck` — pass
- `pnpm lint` — pass (3 pre-existing warnings, unrelated)
- `pnpm test` — 1022 passed / 1022 (88 test files; 58 of them new for this story)
- `env -u DATABASE_URL pnpm build` — pass (new route `/admin/ai` present)

## Manual / live checks (for the user or the Codex QA loop, per AGENTS.md)
Codex can serve the app locally (`scripts/claude/qa-serve.sh`) and confirm `/admin/ai` shows a
translated error (not a crash) when `DATABASE_URL` is unset — no live resource needed for that
part (MQ-2). Never print an environment value while doing this (DEC-015).

The check below needs the deployed app with Neon and Vercel (sprint-05.md "Manual QA" step 4,
**yours to run**):

1. **Save / key visibility, live (MQ-1).** Open `/admin/ai`, pick a provider (e.g. Groq), type a
   model name, save — expect a success message. In the Neon SQL editor:
   `select ai_provider, ai_model, cron_hour_utc, default_locale from settings;` — the new
   provider/model are stored, `cron_hour_utc` and `default_locale` are unchanged. In the Vercel
   project's environment variables, set the matching key variable (e.g. `GROQ_API_KEY`), redeploy,
   reload `/admin/ai` — that row now shows "set". View the page source and confirm the key value
   is nowhere in it. Then clear the provider (select "(none)", save) — both `ai_provider` and
   `ai_model` become NULL.

## PO to confirm
- All 8 acceptance criteria in `dev_minions/backlog/stories/US-022.md` (drafted by agent).
- Sprint-05 decision #9 (API keys stay as Vercel env vars; page shows only set/unset, no in-app
  key entry) — isolated default shipped, listed in HANDOVER.md "Waiting on the user". Decision
  #10 (static provider catalogue until Sprint 6) — already Decided.

## Notes for QA / the user
- Review round 1 recorded one non-blocking finding (`US-022-review.md`): W1 — the plan named a
  `PA-6b` test (`getDb` throwing) that was not separately written in `page.test.tsx`; AC7 is still
  MET because production code wraps `getDb`, `createAiSettingsDeps` and `getAiSettings` in one
  `try` block already exercised by `PA-6`. Coverage gap versus the plan's own list, not a
  criterion failure. No story reopened.
- FR11's "entering an API key" is met only as "set where required, shown as set/not set" (sprint
  decision #9). Not a failed criterion — it's the open PRODUCT question listed for the user.

## Files changed
See `dev_minions/HANDOVER.md` → "Files changed" for US-022 (copied there at round 1 close).
