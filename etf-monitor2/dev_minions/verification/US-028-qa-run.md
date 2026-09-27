## QA run 1 — 2026-09-27 10:49
Verdict: PASS
Machine checks: 6/6 AUTO or AUTO-PARTIAL passed   Left for the user: 5

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Focused chat, action, configuration, safety, bilingual and boundary behaviour (AC1–AC10) | AUTO-PARTIAL | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run app/chat/page.test.tsx app/chat/page.safety.test.tsx app/chat/actions.test.ts app/chat/actions.pglite.test.ts app/chat/reply-messages.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/ai/capabilities/configuration/execute.test.ts lib/ai/capabilities/configuration/execute.pglite.test.ts app/actions.boundary.test.ts components/chat/ChatReply.test.tsx components/chat/ChatPanel.test.tsx components/chat/ChatView.test.tsx components/chat/transcript.test.ts components/AppHeader.test.tsx app/admin/ai/page.test.tsx lib/ai/boundaries.test.ts lib/ai/capabilities/boundaries.test.ts i18n/messages.test.ts --reporter=dot --silent` → 1 → 18/19 files, 236/237 tests; only CPS-1 timed out under concurrent PGlite load. Isolated retry `pnpm exec vitest run app/chat/page.safety.test.tsx --reporter=dot --silent` → 0 → 1 file, 5 tests passed. |
| 2 | Typecheck and full suite (AC11) | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck && env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test -- --silent` → 0 → `Test Files 136 passed (136)`; `Tests 1478 passed (1478)`. A preceding full run had the same isolated CPS-1 timeout; retry was green. |
| 3 | Lint (AC11) | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm lint` → 0 → `5 problems (0 errors, 5 warnings)`; warnings are in unrelated existing test files. |
| 4 | Offline production build (AC1, AC11) | AUTO | PASS | `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` → 0 → dynamic route list includes `/chat`. |
| 5 | `/chat` locally, RO and EN (AC1, AC6–AC8) | AUTO | PASS | `qa-serve.sh start; qa-serve.sh get /chat; qa-serve.sh get /chat NEXT_LOCALE=en; qa-serve.sh stop` → 0 → both `STATUS 200`; translated Chat heading/copy and no-database safe state shown. |
| 6 | `/admin/ai` link and key-safe state, RO and EN (AC7, AC10) | AUTO | PASS | `qa-serve.sh get /admin/ai; qa-serve.sh get /admin/ai NEXT_LOCALE=en` (in the same server session) → 0 → both `STATUS 200`; Gemini and Groq are shown only as unset and the translated chat link is present. Server stopped. |

The repeated CPS-1 full-suite timeout is an intermittent concurrent-load timing issue: it passed
alone (5/5) and on the succeeding full-suite retry (1478/1478). It is retained as a non-blocking
reliability note; no safety assertion was bypassed or changed during QA.

### For the user (only what a machine couldn't settle)

- [JUDGMENT] Confirm the RO/EN wording and presentation of the chat messages are appropriate.
- [JUDGMENT] Confirm the shipped defaults: unnamed ETFs use the symbol as name; commands execute immediately; `/chat` is in the user area.
- [LIVE-ACCOUNT] In Vercel, configure a Gemini or Groq key and model, then redeploy. The public chat endpoint has no login and can consume the selected provider's free-tier quota.
- [LIVE-DB] On deployed `/chat`, send real RO and EN add/remove/track commands and verify the home page and `/admin/etfs` reflect the change without a manual reload.
- [LIVE-ACCOUNT] Exercise a bad key and invalid model name live; confirm the translated replies point to Administration → AI and reveal no provider text.
