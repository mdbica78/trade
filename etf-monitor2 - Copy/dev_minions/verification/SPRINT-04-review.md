# Sprint 4 review: Monitoring UI

Reviewer: tech-lead subagent (in-loop, DEC-009), 2026-09-25.

Scope: `backlog/sprints/sprint-04.md` and `backlog/stories/US-016.md` to `US-019.md`, all drafted by `story-planner`.

I checked them against:
- `requirements/etf-monitoring-requirements.md` (FR2, FR4, FR4.1, FR4.2, FR7, FR8, FR8.1, FR10, FR13, section 3);
- `backlog/roadmap.md` and `epics.md` (EPIC-04 "Done when");
- `architecture/data-model.md` and ADR-001 (Recharts);
- DEC-007 and DEC-010;
- `SPRINT-01-audit.md` N2/N3 and `sprint-03.md`'s forward notes (parse_error display, "previous day", timeZone);
- the code the stories build on:
  - `lib/db/{schema,seed-data}.ts`;
  - `lib/ingestion/{load-etfs,store}.ts` (`BatchRunner`, `rowsOf`);
  - `lib/extraction/adapters/default-registry.ts`;
  - `i18n/request.ts`;
  - `app/{layout,page,page.test}.tsx`;
  - `messages/*.json`;
  - `lib/format.ts`;
  - `package.json`;
  - `pnpm-workspace.yaml`.

Independent checks:
- **The worked numbers are correct.** I recomputed every example by hand:
  - US-017 AC1/AC2: `0.006`, `-30000`, `0.50`, `0.000`, `0.05`, `-0.08`, `0.02`, `-0.02`;
  - US-016 AC6: the DEC-007 outputs;
  - US-017 AC3: the calendar boundaries, including 2028 as a leap year.
- **The seed matches sprint QA steps 1 and 4.** Every seeded ETF tracks `units_in_circulation` (order 0) and `nav_per_unit` (order 1). The seed has these catalogue labels:
  - "Unități de fond în circulație" / "Units in circulation";
  - "Valoare unitară a activului net (VUAN)" / "Net asset value per unit".
- **Step 5 is right as written.** `net_asset` is in the catalogue but not tracked. Under US-012 PRODUCT 1 (tracked fields only), it has no stored values.
- **The registry import is pure.** `default-registry.ts` imports only text-parsing modules: no `unpdf`, no network. US-016's `adapterAvailable` can use it on the page.
- **Dependency states.** US-004 and US-005 are Done. US-012 and US-014 are Awaiting QA. So US-016 is eligible now, and the chain US-017/US-018 → US-019 is correct.
- **Recharts was already chosen.** ADR-001 lists Recharts, so US-019 needs no new DEC.

I ran no git command and read no `.env*` file.

Verdict: APPROVED

## Per story

- **US-016: APPROVED, with one note added in place.**
  - Every AC cites FR7, FR8.1, section 3, DEC-007, the data model or an AGENTS.md rule, and each is testable.
  - Decision 3 **Decided: A**, the union of tracked fields. Under the intersection, a field the user chose would not show.
  - Decision 4 **Decided** as written. `timeZone: "Europe/Bucharest"` closes Sprint 1 audit N2. Report dates are formatted without `Date` parsing.
  - Added note:
    - `lib/format.ts` (the US-002 scaffold) already exports a `formatNumber(value: number)` that calls `toFixed(2)`. That breaks DEC-007.
    - The story now says it must be replaced, so exactly one DEC-007 `formatNumber` remains and no `lib/format.ts` shadows `lib/format/number.ts`.
    - Replacing the scaffold test is not weakening a test: it tested only the placeholder.
  - Decisions 1, 2 and 5 are PRODUCT (see below).
- **US-017: APPROVED after two small in-place fixes (`## Tech-lead review` appended).**
  - Task 2 asked for the previous-day row "in the same batch". That cannot work: the previous date depends on `valueDate` from the same query, and a Neon `db.batch` statement cannot read another statement's result.
    - The plan now either computes the date in SQL (`report_date - 1`) or runs a second read.
    - If it uses SQL, AC3 now requires the calendar boundaries to be proven through the PGlite read model, so a test cannot pass against a `previousCalendarDay` helper that is off the production path.
  - AC5 now says the sign follows the displayed, rounded value, so `-0,00%` can never appear. This applies decision 2's existing "zero shows no sign" rule.
  - Decisions 1 and 2 are PRODUCT.
- **US-018: APPROVED, no change.**
  - The ACs trace to FR8, FR4, FR4.1, FR4.2 and FR8.1. AC4 (no carried-forward value) and AC5 (`ok` only) are testable on PGlite.
  - The Next.js 16 async `params` note and the bound-parameter note are correct.
  - Decisions 1, 2 and 3 are PRODUCT.
- **US-019: APPROVED after small in-place fixes.**
  - AC2's "a `parse_error` report contributes no value" could not be tested on the pure builder, whose input holds `ok` rows only. It is now a test from a PGlite read model that contains a `parse_error` row with a stored value.
  - AC2 now requires a dot on every point with a value. With `connectNulls={false}` and no dots, a single stored day draws nothing. That is the normal state of a newly added ETF (FR4.2) and of any day isolated between gaps.
  - AC6 now allows a peer dependency that `recharts` itself declares (for example `react-is`) if pnpm does not install it. Without that, the "only new runtime dependency" wording could make the criterion unmeetable.
  - I added a note on the pnpm minimum-release-age setting (`pnpm-workspace.yaml` has a `minimumReleaseAgeExclude` list).
  - Decision 1 **Decided: A**, one chart per field. The units (`RON`/`count`) and the magnitudes (10¹ to 10⁸) differ too much for one axis.
  - Decision 2 is PRODUCT.

## Sprint file

- The scope matches the roadmap's Sprint 4 titles and EPIC-04's "Done when". It has:
  - no writes and no schema change;
  - no admin UI and no chat;
  - no colour, alerts or range selector (section 6, and the decision 12 follow-up).
- The order and dependencies are correct: US-016 first, US-017 and US-018 on US-016, US-019 on US-018.
- Manual QA steps 1 to 8 cover every live criterion and the PO confirmation. Steps 3 and 5 correctly state their preconditions (consecutive days; tracked-only storage).
- I added a line under "Decisions needed" that records #3, #4 and #11 as Decided.

## Needs the user (non-blocking, for the demo)

No product choice was invented as final. Each story ships the literal FR reading where one exists (#1 option B would always be empty, #6 "previous day", #8 the only way to satisfy both FR7 and FR8), or one isolated default where none exists. Every item is listed in sprint-04.md for PO confirmation. None blocks a story.

- #1 "today's value" = the newest `ok` report, with its date shown.
- #2 show `ok` rows only; parse errors go to US-024.
- #5 date format: `ro` `22.09.2026`, `en` ISO.
- #6 previous calendar day, blank if missing.
- #7 delta precision, rounding and sign.
- #8 a separate "Istoric" / "History" link.
- #9 omit missing days from the history table.
- #10 an inactive ETF's page is reachable by URL.
- #12 break the line at gaps; no range selector.

The two open Sprint 3 items (US-012 PRODUCT 1 and 2) directly change how #6, #9 and #12 look every week. They are best answered at the same demo.

## Notes (not blocking)

- N1: The ETF column labels come from two different rules:
  - US-016 heads a column with the label of the alphabetically first `adapter_key`;
  - US-018 uses the ETF's own `adapter_key`.

  Today they give identical labels, because there is one adapter. If a second adapter ever labels the same `field_key` differently, the home table and the detail page could differ. Acceptable now. Revisit with US-029 (the second adapter).
- N2: US-018 AC6 does not say which message wins when an ETF has neither tracked fields nor `ok` reports. The plan should pick one and test it.
- N3: Sprint 1 audit N3 applies to `/` and `/etf/[symbol]`, since both read the database. US-016's note already asks the plan to state how dynamic rendering is guaranteed. An explicit `await connection()` / `dynamic = "force-dynamic"` is the robust choice.
- N4: The gate ACs (US-016 AC10/AC11, US-017 AC7/AC8, US-018 AC9/AC10, US-019 AC7/AC8) cite AGENTS.md or ADR-001 rather than an FR. These are technical criteria traced to accepted rules. Accepted, as in the Sprint 2 and Sprint 3 reviews.
