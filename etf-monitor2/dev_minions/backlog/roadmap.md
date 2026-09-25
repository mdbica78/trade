# Sprint roadmap

Sprints are sized by content, not by calendar. Story states are on the `status.md` Story board; this file only lists scope. Ordering follows dependencies, so each sprint leaves the system in a verifiable state.

**Stories are written in full detail only for the sprint about to start.** Later sprints list their intended stories as titles. This is deliberate: detailing Sprint 5 now would bake in assumptions that Sprints 2–4 are likely to change, and the work would be thrown away.

---

## Sprint 1 — Foundation *(delivered)*
**Goal:** a deployed, bilingual skeleton connected to Neon, and certainty about PDF text extraction.
**Epic:** EPIC-01

| Story | Title |
|---|---|
| US-001 | Spike: validate PDF text extraction from a BRD depositary report |
| US-002 | Project scaffold (Next.js + TypeScript + Tailwind + Vitest) |
| US-003 | Database schema and Drizzle/Neon setup |
| US-004 | Bilingual (RO/EN) infrastructure and language switcher |
| US-005 | Seed the ETF registry and field catalogue |
| US-006 | Deploy to Vercel with a health-check page |

---

## Sprint 2 — Extraction core *(delivered)*
**Goal:** given an ETF, produce correct field values from its latest report, proven against committed fixtures.
**Epic:** EPIC-02

- US-007 — Report discovery: find the latest report link on a BVB instrument page
- US-008 — PDF download and text extraction service
- US-009 — Adapter interface and registry
- US-010 — BRD depositary adapter (units in circulation, net asset, VUAN, investor counts)
- US-011 — Test fixtures: committed sample reports and adapter unit tests

---

## Sprint 3 — Automation & persistence *(delivered)*
**Goal:** history accumulates unattended; failures are visible.
**Epic:** EPIC-03

- US-012 — Ingestion pipeline: discover → download → extract → persist, per ETF
- US-013 — Daily cron endpoint and Vercel Cron configuration
- US-014 — Missing report, parse failure, and no-adapter handling
- US-015 — Job run logging

---

## Sprint 4 — Monitoring UI *(delivered)*
**Goal:** the user can see current values, deltas, and history.
**Epic:** EPIC-04

- US-016 — Home table with configurable columns and PDF links
- US-017 — Day-over-day delta calculation (absolute and percentage)
- US-018 — ETF detail page: historical values table
- US-019 — ETF detail page: time-series charts for tracked fields

---

## Sprint 5 — Administration panel *(next — not detailed yet)*
**Goal:** configuration and operational visibility without touching code.
**Epic:** EPIC-05

- US-020 — Admin: ETF management (add, remove, activate)
- US-021 — Admin: tracked-field management per ETF
- US-022 — Admin: AI provider and API key settings
- US-023 — Admin: cron hour setting
- US-024 — Admin: operational dashboard (job runs, last successful extraction, parse errors)

---

## Sprint 6 — AI natural-language configuration *(not detailed yet)*
**Goal:** configuration by conversation, provider-agnostic.
**Epic:** EPIC-06

- US-025 — Pluggable LLM provider adapter interface
- US-026 — Two concrete free providers behind that interface
- US-027 — Intent extraction: natural language → configuration action
- US-028 — Chat surface wired to the configuration actions (RO and EN)

---

## Sprint 7 — Hardening *(not detailed yet)*
**Goal:** arbitrary ETFs either work or fail visibly and correctly.
**Epic:** EPIC-07

- US-029 — Investigate and implement ICBETNETF report access (currently a submit-button download, mechanism unknown)
- US-030 — No-adapter degradation path, end to end
- US-031 — End-to-end verification on the real deployment

---

## Carry-forward notes for Sprints 5–7

Read these before detailing a sprint. They come from the sprint files' forward notes and the sprint audits
(`verification/SPRINT-0N-audit.md`); none is recorded as fixed yet.

**Sprint 5 (admin panel)**
- `pnpm db:seed` upserts overwrite user-editable configuration (settings, `display_order`, ETF names, labels) and
  re-insert tracked fields the user removed (Sprint 1 audit W2). Resolve with or before the first admin story.
- US-021 edits the rows that drive the home-table columns: columns are the union of active ETFs' tracked fields,
  ordered by the lowest `display_order` (Sprint 4 decision 3); `display_order` is per ETF, columns are shared.
- US-023: the cron schedule lives in `vercel.json` and changes only on redeploy (Vercel Hobby). The story must say
  how `settings.cron_hour_utc` reaches Vercel (FR12).
- US-024 is where `parse_error` reports become visible (product decision P4) and where the outcome codes US-015
  writes into `job_runs.log` get translated (FR8.1). `ingest-etf.ts` maps a throwing `registry.get` to `no_adapter`
  and has an unreachable `persist_error` catch (Sprint 3 audit N4) — fix before the dashboard displays these codes.
- Reuse the read layer from Sprint 4 (`BatchRunner` + PGlite tests) for admin reads.

**Sprint 6 (AI configuration)**
- The AI module is a pluggable provider adapter plus capability plugins; configuration is the only capability now
  (FR5, FR6, requirements design note). API keys are live steps for the user, never handled by agents.

**Sprint 7 (hardening)**
- US-030 adds the report link for ETFs without an adapter; US-016 already lists them as "extraction unavailable" without a link.
- Column labels: the home table uses the alphabetically-first `adapter_key`, the history page the ETF's own
  `adapter_key` (Sprint 4 audit N3). Reconcile when a second adapter defines a shared `field_key`.

**Any sprint**
- Numbers follow DEC-007; dates and deltas follow product decisions P5/P7 (`status.md`) once confirmed.
- Small test debts, fix when the file is next touched: `FieldChart` tooltip wiring untested (Sprint 4 W3);
  `/health` has no test for a missing `DATABASE_URL` and no query timeout (Sprint 1 W4, W6); README says db scripts
  load `.env.local`, they don't (Sprint 1 W5); test IF-8c depends on test order (Sprint 3 N5).

