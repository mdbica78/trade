# US-045 independent test verdict

## Round 2 — 2026-10-03

**Verdict: PASS.** AC1–AC8: MET. This is independent test verification after the round-2 review fix; no source, test, review, status-board, or Codex-log file was edited.

### Commands and results

All commands ran in Windows PowerShell after removing `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, and `GROQ_API_KEY` from the command process, without inspecting or printing their values:

```powershell
@('DATABASE_URL','CRON_SECRET','VERCEL_ENV','AI_KEY_MASTER_KEY','GEMINI_API_KEY','GROQ_API_KEY') | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
```

| Command | Exit | Independently observed result |
|---|---:|---|
| `corepack pnpm exec vitest run lib/ai/capabilities/action-list.test.ts lib/ai/capabilities/registry.test.ts lib/ai/capabilities/boundaries.test.ts lib/ai/capabilities/configuration/intent.test.ts lib/ai/capabilities/configuration/grounding.test.ts lib/ai/capabilities/configuration/prompt.test.ts lib/ai/capabilities/configuration/interpret.test.ts lib/ai/capabilities/configuration/interpret.pglite.test.ts lib/ai/capabilities/widgets/intent.test.ts lib/ai/capabilities/widgets/execute.test.ts lib/ai/capabilities/widgets/execute.pglite.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/ai/boundaries.test.ts app/chat/actions.test.ts app/chat/actions.pglite.test.ts app/chat/reply-messages.test.ts components/chat/ChatReply.test.tsx components/chat/ChatView.test.tsx` | 0 | 19 files, 294 tests passed. |
| `corepack pnpm typecheck` | 0 | `tsc --noEmit` passed. |
| `corepack pnpm lint` | 0 | 0 errors, 9 warnings. |
| `corepack pnpm test` | 0 | 214 files, 2203 tests passed. |
| `corepack pnpm build` | 0 | Next production build completed TypeScript, static-page generation and build traces; 12 dynamic routes listed, including `/chat` and `/etf/[symbol]`. Build-process deployment and database variables were removed as above. |

### Acceptance criteria

| Criterion | Independent evidence |
|---|---|
| **AC1 — MET** | Focused `widgets/intent.test.ts` accepts add, update, clear-one, clear-all and replace (including empty), rejects unknown actions/properties, malformed definitions, unknown fields/ETFs and excess capacity; `widgets/execute.test.ts` and `widgets/execute.pglite.test.ts` exercise all four config-owned writes and reject an invalid write without changing the local database. All passed in the 294-test run. |
| **AC2 — MET** | `configuration/prompt.test.ts` checks the system prompt's JSON data block contains symbols and catalogue keys/labels, excludes stored ETF names, and keeps the user message outside the system prompt. `action-list.test.ts`, `widgets/intent.test.ts`, `chat.test.ts` and capability boundary tests reject malformed/unsupported model data and forbidden SQL/provider imports; the chat test confirms one mocked generation call and closed provider-error handling. Passed offline. |
| **AC3 — MET** | `action-list.test.ts` proves the one-item and five-item list shapes and a fixed six-item refusal; `configuration/intent.test.ts`, `configuration/interpret.test.ts` and `chat.test.ts` exercise single-action configuration regression and shared mixed-capability lists. Passed. |
| **AC4 — MET** | `chat.test.ts` preflights invalid actions in each of the first, middle and last positions and asserts zero configuration/widget executor calls. `chat.pglite.test.ts` checks a later invalid widget action prevents an earlier tracked-field database write; the all-valid mixed case writes both. Passed. |
| **AC5 — MET** | `chat.test.ts` verifies mixed-action call order and injected runtime failures in each list position (`done`, `failed`, `not_run`). Its new four-case returned-configuration-failure test checks `add_rejected`, `not_found`, `field_not_available`, and `not_tracked` stop execution after two calls, mark the second `failed`, and leave the third `not_run`; the three intentional no-op outcomes remain successful. `reply-messages.test.ts` checks a single failure retains its specific reply and partial-list failures show the statuses. PGlite widget tests exercise replacement via the atomic config write. All passed after the review fix. |
| **AC6 — MET** | `chat.test.ts` checks configuration→widget and widget→configuration execution order, and validation-before-write for mixed lists; `chat.pglite.test.ts` observes the actual combined tracked-field/widget database writes and invalid-later-action no-write behavior. Passed. |
| **AC7 — MET** | `ChatView.test.tsx` checks both catalogues contain the four closed widget operations and five-action guidance, renders them in Romanian and English across availability states, and checks instruction text excludes unsupported raw-field/formula claims. `reply-messages.test.ts` checks both locales' status placeholders and action results. Passed. |
| **AC8 — MET** | The focused tests and full suite passed with fake providers/local PGlite and the six environment variables removed; `lib/ai/capabilities/boundaries.test.ts`, `lib/ai/boundaries.test.ts`, and the full-suite `app/actions.boundary.test.ts` exercise SQL/import/key boundaries. The single-action regression, typecheck, lint and offline production build passed. No live service, migration, secret read or git command was used. |

**Denied or attempted commands:** none.
