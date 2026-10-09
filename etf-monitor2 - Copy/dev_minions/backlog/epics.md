# Epics

Seven epics covering the full current scope of `requirements/etf-monitoring-requirements.md`. Roadmap items (auth, AI news feed, notifications) are deliberately absent — they are out of scope.

---

## EPIC-01 — Foundation & infrastructure
Project scaffold, database schema, bilingual UI infrastructure, and a deployed skeleton that proves Vercel + Neon are wired together. Also de-risks the single biggest technical unknown: whether the depositary PDFs yield extractable text.

**Covers:** ADR-001, data model, FR8.1
**Done when:** a deployed page reads from Neon, the language switch works, and the PDF extraction approach is proven.

---

## EPIC-02 — Report ingestion & extraction
Discovering the latest report link on a BVB instrument page, downloading the PDF, and extracting field values through an adapter. Includes the adapter framework and the first adapter (BRD depositary format, covering BTBETRETF / TVBETETF / PTENGETF).

**Covers:** FR3, section 3 (adapter system)
**Done when:** given an ETF symbol, the system produces correct field values for the latest report, verified against fixtures.

---

## EPIC-03 — Scheduled automation & persistence
The once-daily Vercel Cron job that walks every active ETF, ingests its report, stores values, and records the run. Includes missing-report and no-adapter handling.

**Covers:** FR4, FR4.1, FR4.2, FR13 (job run log)
**Done when:** the daily job runs unattended, history accumulates, and failures are visible rather than silent.

---

## EPIC-04 — Monitoring UI
The home table (clickable symbol → PDF, configurable columns, today's value plus absolute and percentage change vs. the previous day) and the ETF detail page (history table plus time-series charts limited to tracked fields).

**Covers:** FR7, FR8
**Done when:** the user can see current values, day-over-day deltas, and historical charts for every monitored ETF.

---

## EPIC-05 — Administration panel
Structured (form-based) control over the same configuration the conversational interface manipulates, plus operational settings and visibility.

**Covers:** FR9, FR10, FR11, FR12, FR13
**Done when:** ETFs, tracked fields, AI provider, and cron hour are all manageable without touching code, and job/parse failures are visible.

---

## EPIC-06 — AI natural-language configuration
A pluggable free-LLM adapter and a chat surface that translates natural-language commands ("add ETF X", "also track VUAN") into the same configuration actions the admin panel performs. Explicitly not used for PDF extraction.

**Covers:** FR5, FR6
**Done when:** configuration commands work in both Romanian and English, against at least two interchangeable free providers.

---

## EPIC-07 — Hardening & operability
Cross-cutting work that only makes sense once the system exists: adapter for a second report format (ICBETNETF), graceful behaviour when a newly added ETF has no adapter, and end-to-end verification on the real deployment.

**Covers:** section 3 fallback behaviour, FR13
**Done when:** adding an arbitrary BVB ETF either works or degrades visibly and correctly.
