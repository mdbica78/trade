# US-059 — QA checklist (chat answers "list …" requests)

Review: PASS (round 1, `US-059-review.md`). Tests: PASS (round 1, `US-059-tests.md`, 265 files / 2905 tests, typecheck, lint 0 errors, offline build). Codex QA not yet run.

## Offline commands
`corepack pnpm typecheck`, `lint`, `test`, `build` (must print `migrate-on-deploy: skipped`) with DB/cron/key variables unset. Focused: `lib/config/latest-report-dates.pglite.test.ts` (LR-1..5), `lib/ai/chat.list-queries.pglite.test.ts` (LQ-0..3, fixture `test/fixtures/ai/chat-list-queries.json`), `lib/ai/capabilities/configuration/context.pglite.test.ts` (CC-6), `prompt.test.ts` (CP-7b, CP-7c, CP-12, CP-18), `components/chat/ChatView.test.tsx`.

## MANUAL-QA (live provider + key; model-quality check only)
With a configured provider and a larger model (see the `/admin/ai` model hint), ask in both Romanian and English and compare with the real state (`/admin/etfs`, `/admin/ai`-independent; latest dates against `/admin/operations`):
1. "list the active ETFs" / "listează ETF-urile active"; "which ETFs are inactive?" / "ce ETF-uri sunt inactive?". (AC1)
2. "what fields does <SYMBOL> track?" / "ce câmpuri urmărește <SIMBOL>?" — including an inactive ETF. (AC1)
3. "what custom values does <SYMBOL> have?" / "ce valori personalizate are <SIMBOL>?". (AC1)
4. "what is the latest report date of each ETF?" / "care este data ultimului raport pentru fiecare ETF?" — the date must be the newest *successful* report (a newer parse_error/missing day must not appear); an ETF with none should be described as having none. (AC1, AC2)
5. A report-value question (e.g. "what was the NAV yesterday?") is still declined, and no list question ever changes configuration. (AC1)
6. `/chat` (RO and EN): the help area shows the new list examples; both themes, keyboard and 375 px layout. (AC3)

## Deliberate changes
No schema/migration. `lib/ai` context now includes the newest ok report date per ETF (one extra read query per message); prompt data block gains `latest_report` and `inactive_state` (only when dates were loaded). To fit the CP-12 (8000) / CP-18 (12000) caps, non-pinned prompt prose was shortened (redundant operation-name sentence removed, confirm/split/match/data-header lines tightened) and the English list conversation example was replaced by a Romanian one; every pinned substring and cap is unchanged. CP-18's realistic fixture now carries `lastReportDate` (stricter). Allowlists for `lib/config/latest-report-dates` added to the two AI boundary tests. Review notes (non-blocking): the worst-case CP-18 fixture has no `lastReportDate`/inactive ETFs; no fixture row asks about an inactive ETF's widgets; no English list example remains in the full-answer examples.

## Files changed
`lib/config/latest-report-dates.ts` (new), `lib/ai/capabilities/configuration/context.ts`, `prompt.ts`, `components/chat/ChatView.tsx`, `messages/en.json`, `messages/ro.json`, `test/fixtures/ai/chat-list-queries.json` (new), `test/fixtures/ai/README.md`; tests `lib/config/latest-report-dates.pglite.test.ts` (new), `lib/ai/chat.list-queries.pglite.test.ts` (new), `context.pglite.test.ts`, `prompt.test.ts`, `lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`, `components/chat/ChatView.test.tsx`; process `US-059-review.md`, `US-059-tests.md`, `US-059-qa.md`, `dev_minions/status.md`, `dev_minions/HANDOVER.md`.
