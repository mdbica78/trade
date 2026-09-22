# Status

*Last updated: 2026-09-22*

## Current phase

Planning complete. Sprint 1 is defined and ready to start, pending one decision (see below).

## Done

- Functional requirements defined and validated with the user — `requirements/etf-monitoring-requirements.md`.
- Confirmed live on bvb.ro that report formats differ between issuers: BTBETRETF / TVBETETF / PTENGETF share the BRD depositary format with direct PDF links; ICBETNETF uses a different format and a submit-button download whose mechanism is still unknown.
- Hosting direction chosen: new Vercel project (Hobby) + Vercel Cron (once daily) + Neon Postgres (free tier).
- Working process defined — `process.md`, with role briefs in `roles/`.
- Backlog defined — 7 epics (`backlog/epics.md`), 7 sprints (`backlog/roadmap.md`), Sprint 1 fully detailed (6 stories, US-001…US-006).
- Data model specified — `architecture/data-model.md`.

## Open decisions awaiting user validation

- **ADR-001 — technology stack** (`architecture/ADR-001-tech-stack.md`): Next.js + TypeScript + Drizzle + Tailwind + Recharts + next-intl + Vitest + pnpm. **Status: PROPOSED.** US-002 through US-006 are blocked until this is confirmed. US-001 is not blocked and can start immediately.

## Next step

Start **US-001** — the PDF extraction spike. It is deliberately first: if the depositary PDFs do not yield extractable text, the extraction approach changes fundamentally, and that is a direction decision for the user. Cheapest possible moment to find out.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Ready |
| US-002 | Project scaffold | Blocked — ADR-001 |
| US-003 | Database schema and Drizzle/Neon setup | Blocked — ADR-001, US-002 |
| US-004 | Bilingual (RO/EN) infrastructure | Blocked — ADR-001, US-002 |
| US-005 | Seed ETF registry and field catalogue | Blocked — US-003 |
| US-006 | Deploy to Vercel with health check | Blocked — US-003 |

## Notes for whoever picks this up next

- The local `etf-monitor2` folder is not yet a git repository connected to the GitHub repo of the same name. The user runs `git init` / `git remote add` / the first commit themselves — this session has no shell access to their machine.
- Root-level `README.md` and `etf-monitoring-requirements.md` are earlier drafts. US-002 replaces the README; the current requirements live under `dev_minions/requirements/`.
- The cloud sandbox used by the verification coworkers cannot reach bvb.ro. All extraction testing uses committed fixtures; live checks are the user's manual step.
