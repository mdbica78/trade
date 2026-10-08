# Decisions — index

One file per decision, never deleted. **Current** = in force today. **History** = replaced; read only to understand why.
Stack decision: `architecture/ADR-001-tech-stack.md` (Decided). Open product questions: `status.md` → Product decisions.

| DEC | Subject | Status | Today |
|---|---|---|---|
| 001 | Node 22 LTS on WSL1 (newer Node crashes) | Decided | Current — environment |
| 002 | Trust the Zscaler TLS proxy (`NODE_EXTRA_CA_CERTS`, npm `cafile`) | Decided | Current — environment |
| 003 | `~/.profile` was overwriting nvm's PATH | Decided | Current — environment |
| 004 | Three standing chats (PO, Technical Lead, Troubleshoot) | Superseded | History — the three chats remain; their jobs are as in `process.md` §2 |
| 005 | Claude Code implements and orchestrates via reviewer/tester subagents; Copilot fallback | Decided | Current, amended by 009, 013, 015 |
| 006 | Technical Lead chat gets file access | Decided | Current |
| 007 | Number display: no thousands separator; comma (RO) / dot (EN) | Decided | Current — implemented (`lib/format/number.ts`); not yet in `requirements/` (PO to-do) |
| 008 | Webpack instead of Turbopack locally; export `NODE_EXTRA_CA_CERTS` | Decided | Current — environment |
| 009 | Autopilot across sprints with in-loop `tech-lead` | Decided | Current; QA part replaced by 013, product-question handling by 015 |
| 010 | US-003 schema: FK nullability, Neon driver; report + values written atomically | Decided | Current — binding for DB writes |
| 011 | Autopilot resilience: file-write log, exact usage-limit waits, network back-off | Decided | Current |
| 012 | QA as a Claude Code subagent (`qa-runner`) | Superseded by 013 | History — never ran |
| 013 | Separate Codex loop for QA and deploy-noticing; dev loop stops at Awaiting QA; no agent runs git | Decided | Current, amended by 014, 015 |
| 014 | The Codex QA loop runs only while the dev loop runs (`dev-loop.state`, stops instead of waiting) | Decided | Current |
| 015 | Secrets beyond `.env*`, disclose denied commands, verifiers cite only their own evidence, one verdict vocabulary, product questions ship isolated defaults, kit hygiene | Decided | Current |
| 016 | One shared configuration-write layer (`lib/config/`) for admin forms and the Sprint 6 chat; adapter detection at add time | Decided | Current — binding for configuration writes |
| 017 | AI provider layer: one adapter interface, closed error codes, no SDK, key reaches adapters through one wiring module, capability plugins | Decided | Current — binding for AI providers and capabilities |
| 018 | Report access (non-link access in discovery, same-origin, bounded), `etf_report_links` table, shared `field_key` labels identical across adapters, daily-run deadline guard (`not_attempted`) | Decided | Current — binding for report access, adapters and the cron budget; §5 amended 2026-09-28 for several reports per filing (Sprint 9 review T-1) |
| 019 | Sanitised `[load-error]` log for every page load failure, `/health` schema-drift check, `etf_report_links` optional for the home table, pre-deploy gate script, named test time limits | Decided | Current — binding for page error handling and `/health` |
| 020 | Visual layer: tokens in `app/globals.css`, dark-slate + light themes (switchable), WCAG AA tested, chart colours from tokens, exact-markup tests changed only inside named design stories, header navigation stays | Decided | Current — binding for `components/` and `app/globals.css` |
| 021 | AI provider keys stored in the app (FR16): write-only from `/admin/ai`, AES-256-GCM, key derived from the existing `CRON_SECRET` (optional `AI_KEY_MASTER_KEY`), stored before env fallback, presets only (no custom base URL), chat never handles keys | Decided; no user step | Current from Sprint 10 — overrides Sprint 5 decision 9, amends DEC-017 §4 and AGENTS.md Secrets |
| 022 | History widget definition (FR18): closed set (operation, field, period), never code; table `etf_widgets`, one validator, chat capability with add/update/clear/replace; up to five actions per chat message | Decided | Current from Sprint 11 — amends DEC-017 §5 |
| 023 | Database migrations are applied by the production build (`tsx scripts/migrate-on-deploy.ts && next build`), production only, expand-only migrations; agents generate files but never run against Neon; no manual `pnpm db:migrate` | Decided | Current from US-048 — supersedes the "migrate by hand, then deploy" order (US-033 AC7, README) |
| 024 | US-052 source line-count baseline unavailable | Decided — accepted by the user (2026-10-05) | US-052 may proceed to QA with the missing pre-edit baseline disclosed; no before/after reduction is claimed |
| 025 | Chat understanding: existing custom values and tracked fields in the prompt, `*` = all ETFs, clear/update by description, default scope all ETFs, 6-turn history, clarifying question shown, server-built explanations, tolerant normalisation | Decided | Current from Sprint 13 — amends DEC-017 (sprint-06 decision 7) and DEC-022 §7 |
| 026 | More AI providers: named OpenAI-compatible presets, custom OpenAI-compatible provider stored in the DB with a URL-bound key, stronger model suggestions, test connection | Decided | Current from Sprint 13 — amends DEC-021 §8 and US-041 D-1 |
| 027 | Conversational assistant: model reply shown as plain text with the server result list as truth, envelope `{reply, actions, question}` with native JSON-schema output and fallback, one self-correction round (max 2 model calls), server-signed plan token for confirmations (exact plan, state fingerprint, 10 min), 21-message history budget, injection posture | Decided | Current from US-055/US-058 — revokes DEC-017 sprint-06 decision 7, replaces DEC-025 §5 |

Technical decisions made inside sprint reviews (without a DEC file, DEC-015 point 6) are recorded in the sprint files'
"Decisions needed" tables, e.g. Sprint 3: cron `0 10 * * *` UTC, no `reports` row without a PDF date,
partial values kept under `parse_error`; Sprint 4: union of tracked fields as columns, `Europe/Bucharest` time zone,
one chart per field.
