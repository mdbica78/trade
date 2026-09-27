# US-025 QA checklist — Pluggable LLM provider adapter interface

Round 1: review PASS (`US-025-review.md`, W1 non-blocking, N1/N2 notes), tests PASS
(`US-025-tests.md`, 66 story-specific tests, 1187/1187 full suite). All 7 acceptance criteria
drafted by agent (story-planner) — **PO to confirm** at the demo.

## Automated (already run this round, offline/PGlite only)
- `pnpm typecheck` — pass
- `pnpm lint` — pass (0 errors, 3 pre-existing warnings, unrelated)
- `pnpm test` — 1187/1187 (106 test files). One isolated flaky timeout on first run
  (`lib/db/index.test.ts` in this session's own pre-check, `lib/ingestion/default-deps.cron.test.ts`
  in the tester's run — both pre-existing, unrelated to `lib/ai/`, confirmed passing on retry).
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build` — pass

## Manual / live checks (for the user or the Codex QA loop, per AGENTS.md)
None. This story ships no route, no UI and no live call (interface + wrapper + registry +
resolution only, all pure/offline). It is proven live only once US-026 (concrete providers) and
US-028 (chat surface) ship — see `sprint-06.md` steps 2 and 6.

## PO to confirm
- All 7 acceptance criteria in `dev_minions/backlog/stories/US-025.md` (drafted by agent), plus
  the "Tech-lead review 2026-09-26" section it must satisfy.
- Sprint 6 decision #4 (no default AI model) — isolated default shipped: `resolveActiveProvider`
  reports `no_model` until the user picks one in `/admin/ai` (US-022, already shipped). Listed in
  HANDOVER.md "Waiting on the user".

## Notes for QA / the user
- Review round 1 recorded one non-blocking Warning (`US-025-review.md`): **W1** — the tech-lead's
  binding review point 2 asked for the revised `LB-4` to scan the whole `lib/` tree (not just two
  folders) for importers of `key-status`. The shipped `boundaries.test.ts` widens `LB-4` to include
  `lib/ai` itself, but not sibling folders (`lib/config`, `lib/ingestion`, `lib/admin`, `lib/db`,
  `lib/cron`, `lib/extraction`, `lib/format`). The reviewer confirmed by grep that nothing outside
  `lib/ai` currently imports `key-status` or `readApiKey`, so there is no live secrets leak today —
  this is a boundary-test coverage gap versus the tech-lead's literal instruction, not a criterion
  failure (AC5 is still MET). Recommend widening `LB-4`'s scanned directories to the full `lib/`
  tree before or alongside US-026, which adds the second real consumer of this module. Not blocking
  this round; not reopened.
- N1 (non-blocking): `test/helpers/ai-fakes.ts`'s `"throws"` and `"throwsSync"` fake-provider steps
  are functionally identical since `generate` is declared `async` — harmless redundancy, not a defect.
- N2 (process hygiene): `status.md`'s Story board entry updates to `Awaiting QA` with this file.
- This story ships the registry **empty** (by design — US-026 fills it). Resolution therefore
  returns `not_implemented` for every catalogue id until US-026 ships; that is expected, not a bug.

## Files changed
See `dev_minions/HANDOVER.md` → "Files changed" for US-025 (copied there at round 1 close).
