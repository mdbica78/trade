# Sprint 14 — Admin and chat usability (PO, 2026-10-09)

Source: the user's five improvement requests of 2026-10-09. These are the binding business requirements; story acceptance criteria were technically reviewed and linked to the relevant FRs in the Technical Lead planning pass.

| Story | Title | Notes |
|---|---|---|
| US-063 | Job runs table scrolls in a fixed-height box | Small, CSS/markup only. Build first |
| US-060 | `/admin/etfs` redesign; add ETF by symbol only | Name auto-detected from BVB, fallback symbol |
| US-061 | `/admin/ai` provider dropdown; nicer custom provider section | Markup/UX only |
| US-062 | Daily job hour editable in the app | DEC-030, external hourly ping |
| US-059 | Chat answers "list …" requests | Model-based, as today (user's choice); improve context and help text, add regression fixtures |

Build order: US-063 → US-060 → US-061 → US-062 → US-059. US-062 requires the expand-only migration specified in DEC-030 and its plan; generate it with `pnpm db:generate` and never apply it to Neon. Deliberate golden-snapshot changes are logged in HANDOVER.

## Decisions
| # | Question | Default |
|---|---|---|
| D-1 | List commands: server-side deterministic or model | Model-based (user's choice 2026-10-09); no new action |
| D-2 | Add ETF name | Symbol only; name read from the BVB page, fallback the symbol (user's choice) |
| D-3 | Schedule product choice | External hourly ping; editable hour in the app (user's choice) |
| D-4 | Visual language | DEC-020 tokens, both themes, WCAG AA; no PNG reference |
| D-5 | Race-safe once-per-UTC-day schedule claim | Decided in DEC-030: nullable `job_runs.scheduled_date_utc`, unique index, and `started_at` index; expand-only migration via DEC-023 |

## Technical review
Reviewed by the Technical Lead on 2026-10-09: [`verification/SPRINT-14-review.md`](../../verification/SPRINT-14-review.md). Binding schedule semantics and the required `job_runs` migration/indexes are in [DEC-030](../../decisions/DEC-030-user-editable-cron-hour.md); its former “no migration” statement is superseded.
