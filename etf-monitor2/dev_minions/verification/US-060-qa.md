# US-060 — QA checklist (/admin/etfs redesign, add by symbol only)

Review: PASS (round 1, `US-060-review.md`). Tests: PASS (round 1, `US-060-tests.md`, 261 files / 2839 tests, typecheck, lint 0 errors, offline build). After the verdicts, one comment-only lint fix (an unused eslint-disable removed in `lib/extraction/discovery.ts`); eslint on that file and its 45 discovery tests re-run green by the implementer. Codex QA not yet run.

## Offline commands
`corepack pnpm typecheck`, `lint`, `test`, `build` with DB/cron/key variables unset. Focused: `components/admin/EtfAdmin.test.tsx`, `app/admin/etfs/page.test.tsx`, `lib/extraction/discovery.test.ts` (parseInstrumentName on four committed BVB pages), `lib/config/detect-adapter.test.ts`, `lib/config/etfs.pglite.test.ts` (CE-A1, CE-N1, CE-N2, CE-M9), `lib/ai/chat.pglite.test.ts` (CEP-5/5b).

## MANUAL-QA (browser, live resources)
1. `/admin/etfs` RO and EN, JavaScript disabled: choose an ETF in the selector, press Show — the URL becomes `?symbol=…` and the panel shows that ETF; an unknown `?symbol=` falls back to the first ETF. (AC1)
2. Panel actions on the selected ETF only: Remove/Activate, adapter Save, Re-detect, Fields link. (AC1)
3. Add form: one symbol input, no name input, hint text visible. Add a real BVB symbol (LIVE-DB + LIVE BVB): stored name equals the BVB page title name; for an unknown/unreachable symbol the name equals the symbol. (AC2, AC3)
4. Chat: "add ETF <symbol>" stores the BVB name (a name written in the message is ignored). (AC4)
5. Re-detect an ETF (LIVE-DB + LIVE BVB): name refreshes when BVB gives one; with BVB unreachable the stored name is kept (the adapter is still cleared, pre-existing behaviour). (AC5)
6. Both themes, keyboard (Tab order, visible focus ring), 375 px width (panel and add card stack, no horizontal overflow). (AC6)

## Deliberate changes
`/admin/etfs` table → selector + detail panel + add card; name input and `Admin.messages.invalidName`/`Admin.etfs.nameLabel` removed; `add_etf` model shape no longer lists `name` (still tolerated, ignored). No golden snapshot covered EtfAdmin, so none was regenerated. Non-blocking review notes: after Add the page stays on the previously selected ETF (N3); failed re-detect clears the adapter (N2, pre-existing).

## Files changed
`lib/extraction/discovery.ts`, `lib/config/detect-adapter.ts`, `lib/config/etfs.ts`, `app/admin/etfs/actions.ts`, `app/admin/etfs/result-messages.ts`, `app/admin/etfs/page.tsx`, `components/admin/EtfAdmin.tsx`, `lib/ai/capabilities/configuration/intent.ts`, `grounding.ts`, `execute.ts`, `prompt.ts`, `messages/en.json`, `messages/ro.json`, `README.md`; tests: `components/admin/EtfAdmin.test.tsx` (new), `app/admin/etfs/page.test.tsx`, `actions.test.ts`, `result-messages.test.ts`, `lib/extraction/discovery.test.ts`, `discovery.icbetnetf.test.ts`, `lib/config/detect-adapter.test.ts`, `etfs.test.ts`, `etfs.pglite.test.ts`, `etfs.report-link.pglite.test.ts`, `lib/ingestion/ingest-icbetnetf.pglite.test.ts`, `request-bound.test.ts`, `lib/ai/capabilities/configuration/execute.test.ts`, `execute.pglite.test.ts`, `grounding.test.ts`, `intent.test.ts`, `lib/ai/chat-plan.test.ts`, `lib/ai/chat.pglite.test.ts`, `test/fixtures/ai/chat-regression.json`; process: `US-060-review.md`, `US-060-tests.md`, `US-060-qa.md`, `dev_minions/status.md`, `dev_minions/HANDOVER.md`.
