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

Technical decisions made inside sprint reviews (without a DEC file, DEC-015 point 6) are recorded in the sprint files'
"Decisions needed" tables, e.g. Sprint 3: cron `0 10 * * *` UTC, no `reports` row without a PDF date,
partial values kept under `parse_error`; Sprint 4: union of tracked fields as columns, `Europe/Bucharest` time zone,
one chart per field.
