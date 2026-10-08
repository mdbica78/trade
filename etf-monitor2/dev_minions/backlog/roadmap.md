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

## Sprint 8 — Stabilisation after the first real deployment *(detailed — `sprints/sprint-08.md`)*
**Goal:** the app builds on Vercel, and a failing page or a schema that is behind can be diagnosed without leaking anything.
**Epic:** EPIC-07

- US-032 — Hotfix: `/health` timeout state, deploy-gate parity, working-tree cross-check
- US-033 — Diagnosable load failures and schema-drift visibility (DEC-019)
- US-034 — Test stability under load and the pre-deploy gate (DEC-019)

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


---

## Sprint 9 — Look, home table and ingestion fixes *(added by PO 2026-09-28 from user feedback; not detailed yet)*
**Goal:** a readable trader-style UI, a home table that shows what the user chose with deltas, and every weekend report stored.
**Epic:** EPIC-08 · Requirements: `requirements/etf-monitoring-requirements.md` §8 (FR3.1, FR7.1–7.3, FR8.2, FR15)

*Reviewed by the Technical Lead chat 2026-09-28: `verification/SPRINT-09-review.md` (APPROVED). **Build order: US-048 -> US-035 -> US-037 -> US-047 -> US-036 -> US-038 -> US-039.** The design folder `backlog/home-design/` (spec + PNGs) is binding for US-035, US-036 and US-047 (DEC-020 §10).*

- US-048 — Migrations applied by the production deploy (DEC-023; written: `stories/US-048.md`); no manual `pnpm`/Neon step for the user, ever
- US-035 — Adopt the visual layer: lighter trader palette plus light theme, contrast fixes, DEC-020 (see `backlog/ui-design-adoption.md`)
- US-036 — Home table look: symbol opens the detail page (whole row clickable), small "PDF" button, no "History" link, delta vs previous available report with arrows, phone scroll wrapper. Binding design reference: `backlog/home-design/` (spec + PNGs, approved by the user 2026-09-28)
- US-047 — Home display settings (FR7.3): choose which ETFs, which value columns and their order, which change columns (absolute, percent, arrow) from the "Customize view" panel on the home page (per the design reference; no separate admin page); the home table shows exactly that; tests prove each switch
- US-037 — Ingest every report in the newest filing (Mon = Fri+Sat+Sun) and store every extracted field
- US-038 — Charts: type selector (line, dots, columns, area), palette, single-point display
- US-039 — Visual QA baseline (RO/EN, 375 px and 1280 px, contrast check)

## Sprint 10 — AI setup in the browser *(not detailed yet)*
**Goal:** set an AI key and choose a provider and model without touching Vercel. **Epic:** EPIC-08 · FR16, FR17

- US-040 — Store provider keys from `/admin/ai` (write-only, encrypted; DEC-021 decided, key derived from the existing `CRON_SECRET`, no user step)
- US-041 — Provider presets (OpenAI-compatible list) and model picker; no free-form URL (presets only)
- US-042 — Chat page instruction area (RO and EN)

## Sprint 11 — Programmable history area *(not detailed yet)*
**Goal:** the user defines derived values by chat and they persist on the ETF detail page. **Epic:** EPIC-08 · FR18, FR19

- US-043 — Schema, validator and config functions for the widget definition (DEC-022 decided: closed operation set, table `etf_widgets`; migration applied by the deploy, DEC-023)
- US-044 — Widget engine and history-area rendering
- US-045 — Chat capability: add, update, clear, replace widgets; several actions per message
- US-046 — Spike: user-defined raw field from a report label (decide, do not build)

## Sprint 12 — Simplification *(detailed and reviewed by the Technical Lead 2026-10-04)*
**Goal:** the same app with less code: no dead code, no duplication, no contradictions, fewer database requests. No new behaviour. **Epic:** EPIC-07 · Review: `verification/CODE-REVIEW-20261004.md` · Sprint file: `sprints/sprint-12.md`

- US-049 — Simplify ingestion, extraction, cron and health
- US-050 — Simplify the home page and monitoring code
- US-051 — Simplify the AI chat, capabilities, keys and widgets code
- US-052 — Simplify admin, configuration, header and stylesheet

## Sprint 13 — A smarter chat assistant and more AI providers *(detailed and reviewed by the Technical Lead 2026-10-05; PO review with the user 2026-10-05)*
**Goal:** a chat **assistant** that turns plain RO/EN requests into app instructions (all ETFs, clear/update by description), talks back in natural language, remembers the last 21 messages, asks when unclear and confirms before big changes; and the user can pick more providers or add an OpenAI-compatible one. **Epic:** EPIC-08 · DEC-025, DEC-026, DEC-027 (Technical Lead) · Sprint file: `sprints/sprint-13.md`

Build order (PO):
- US-053 — Chat sees the current state; "all ETFs"; clear/update by description
- US-054 — Better prompt and tolerant normalisation for small models
- US-056 — More provider presets, stronger model suggestions, test connection
- US-057 — Custom OpenAI-compatible provider with a URL-bound key
- US-055 — Conversational assistant: natural replies, 21-message memory, clarifying dialogue, questions about the setup *(re-scoped by the PO)*
- US-058 — Assistant reliability: confirm before big changes, self-correction, structured output *(new)*

Later, not planned: questions about the data values in the chat (e.g. "what was the NAV of TVBETETF last Friday?").
