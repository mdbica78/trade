# Sprint 2 review — Extraction core

Reviewer: tech-lead subagent (in-loop, DEC-009), 2026-09-23.
Scope: `backlog/sprints/sprint-02.md` and `backlog/stories/US-007.md` … `US-011.md`, all
drafted by `story-planner`. Checked against `requirements/etf-monitoring-requirements.md`
(FR3, FR4, FR4.1, FR5, FR7, FR10, FR13, section 3), `backlog/roadmap.md` and `epics.md`
(EPIC-02), `architecture/data-model.md`, ADR-001, `spikes/pdf-extraction/FINDINGS.md`,
`lib/db/seed-data.ts` and `SPRINT-01-audit.md`.

As an independent check of the extraction rules, I ran the spike's own `unpdf` 0.11.0
(`spikes/pdf-extraction/node_modules`) on the three committed fixtures. All five labels that
US-008 AC2 requires are present in each. The VUAN gap holds exactly one number in each
fixture (`11.091`, `54.1373`, `14.8856`). Both "din care" breakdowns sum exactly
(BTBETRETF 29733778+7736222=37470000 and 18631+77=18708; TVBETETF 27044585+1175415=28220000
and 52122+190=52312; PTENGETF 7915920+724080=8640000 and 11668+49=11717). The footer date is
21.09.2026 and the filing stamp is 22.09.2026 in all three. The BTBETRETF values in US-010
AC4 and US-011 Task 1 match the extracted text.

No git command was run. No `.env*` file was read.

Verdict: APPROVED

## Per story

- **US-007** — APPROVED. Every AC cites FR3/FR4.1/FR7/FR13 or an AGENTS.md rule, and each is testable offline with injected `fetch`. The live-page unknowns (postback/XHR/headless) are routed correctly: headless browser means a TECHNICAL DEC, and an unreachable bvb.ro blocks this story only, with the user contingency in sprint manual QA step 4. The report date is explicitly never taken from the page (FINDINGS trap 2). No invented product choice.
- **US-008** — APPROVED. It stays inside ADR-001 (`unpdf`; `pdfjs-dist`/`pdf-parse` excluded because of the FINDINGS version-clash trap). `not_pdf` detection uses the `%PDF-` signature, and there is a single attempt (FR4.1). AC2's five labels were verified against the real fixtures.
- **US-009** — APPROVED. The contract maps onto `reports.report_date` / `report_values.numeric_value, raw_value`. `get(null|unknown)` returns `undefined` and never falls back to another adapter (section 3, "unavailable"). An ambiguous `detect` counts as no match. Persisting "all fields vs tracked fields" is left open and flagged for Sprint 3 as a product decision, not decided here.
- **US-010** — APPROVED after an in-place fix (see the `## Tech-lead review` section in the story). Task 2's sub-label rule was unbounded: with the units block's `Persoane fizice` missing, it would have silently taken the investors block's value. AC7 ("any label removed → only that field missing") also contradicted the dependent anchors. I bounded the units sub-labels by `Numar investitori, din care:`, ruled out a `net_asset` fallback to the "clasa UF" line, and rewrote AC7 as six explicit cases. Still 10 ACs, and no product choice involved.
- **US-011** — APPROVED after a small in-place fix. AC6's failure list now matches Task 4: it adds a discovery `error` and a text-extraction `unreadable` error. The manifest must be transcribed independently of the adapter, and the two-way fixture-set check with the recorded temporary-change proof is a sound guard against rubber-stamping.

## Sprint file

- Scope matches the roadmap's Sprint 2 titles and EPIC-02's "Done when". Nothing is persisted, and there is no UI or cron.
- Dependencies and order are correct. US-007 and US-008 depend on US-002 (Done). US-009 depends on US-005 (Awaiting QA, which satisfies the dependency rule). US-010 depends on US-009. US-011 depends on US-007, US-008 and US-010.
- The forward notes for Sprint 3 flag, but do not decide, the persist-all-vs-tracked-fields PRODUCT question and DEC-010 binding note 2. That is correct.

## Notes (not blocking)

- N1 — Several ACs cite ADR-001 or AGENTS.md rather than an FR (US-008 AC1/AC5/AC6, the `pnpm …` gate ACs, US-009 AC3). These are technical or tooling criteria that trace to accepted rules, not product choices. Accepted.
- N2 — `architecture/data-model.md:85` still says `.` is the thousands separator (Sprint 1 audit N6). US-010 correctly tells the implementer to follow FINDINGS. The data-model note is for the chat Technical Lead or the PO to correct. This subagent does not edit architecture docs.
- N3 — US-011 `consistency checks` sum values such as `28220000.00`. The plan should use exact decimal or integer arithmetic on the canonical strings, not a float comparison with tolerance.
