# Sprint roadmap

Sprints are sized by content, not by calendar — a sprint ends when its stories are Done (code + automated verification + the user's manual confirmation). Ordering follows dependencies, so each sprint leaves the system in a verifiable state.

**Stories are written in full detail only for the sprint about to start.** Later sprints list their intended stories as titles. This is deliberate: detailing Sprint 5 now would bake in assumptions that Sprints 2–4 are likely to change, and the work would be thrown away.

---

## Sprint 1 — Foundation *(detailed, ready)*
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

## Sprint 2 — Extraction core
**Goal:** given an ETF, produce correct field values from its latest report, proven against committed fixtures.
**Epic:** EPIC-02

- US-007 — Report discovery: find the latest report link on a BVB instrument page
- US-008 — PDF download and text extraction service
- US-009 — Adapter interface and registry
- US-010 — BRD depositary adapter (units in circulation, net asset, VUAN, investor counts)
- US-011 — Test fixtures: committed sample reports and adapter unit tests

---

## Sprint 3 — Automation & persistence
**Goal:** history accumulates unattended; failures are visible.
**Epic:** EPIC-03

- US-012 — Ingestion pipeline: discover → download → extract → persist, per ETF
- US-013 — Daily cron endpoint and Vercel Cron configuration
- US-014 — Missing report, parse failure, and no-adapter handling
- US-015 — Job run logging

---

## Sprint 4 — Monitoring UI
**Goal:** the user can see current values, deltas, and history.
**Epic:** EPIC-04

- US-016 — Home table with configurable columns and PDF links
- US-017 — Day-over-day delta calculation (absolute and percentage)
- US-018 — ETF detail page: historical values table
- US-019 — ETF detail page: time-series charts for tracked fields

---

## Sprint 5 — Administration panel
**Goal:** configuration and operational visibility without touching code.
**Epic:** EPIC-05

- US-020 — Admin: ETF management (add, remove, activate)
- US-021 — Admin: tracked-field management per ETF
- US-022 — Admin: AI provider and API key settings
- US-023 — Admin: cron hour setting
- US-024 — Admin: operational dashboard (job runs, last successful extraction, parse errors)

---

## Sprint 6 — AI natural-language configuration
**Goal:** configuration by conversation, provider-agnostic.
**Epic:** EPIC-06

- US-025 — Pluggable LLM provider adapter interface
- US-026 — Two concrete free providers behind that interface
- US-027 — Intent extraction: natural language → configuration action
- US-028 — Chat surface wired to the configuration actions (RO and EN)

---

## Sprint 7 — Hardening
**Goal:** arbitrary ETFs either work or fail visibly and correctly.
**Epic:** EPIC-07

- US-029 — Investigate and implement ICBETNETF report access (currently a submit-button download, mechanism unknown)
- US-030 — No-adapter degradation path, end to end
- US-031 — End-to-end verification on the real deployment
