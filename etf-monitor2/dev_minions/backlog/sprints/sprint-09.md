# Sprint 9 — Look, home table and ingestion fixes

> Detailed by agent (story-planner), 2026-09-28 — PO to confirm at demo.
> Source of every scope line below: `verification/SPRINT-09-review.md` (Technical Lead chat, APPROVED before detailing). This file carries
> that review over; it re-decides nothing. US-048 was written by the Technical Lead chat (`stories/US-048.md`) and is referenced, not rewritten.

**Epic:** EPIC-08 (roadmap; see open point O-1: EPIC-08 is not yet in `backlog/epics.md`) · **Status:** see the `status.md` Story board
**Requirements:** `requirements/etf-monitoring-requirements.md` §8 (FR3.1, FR7.1, FR7.2, FR7.3, FR8.2, FR15)
**Binding inputs:** DEC-020 (visual layer; §10 makes `backlog/home-design/` binding for US-035, US-036, US-047), DEC-023 (migrations applied by the deploy), DEC-018 §5 as amended 2026-09-28 (run budget), DEC-010 (write rules), DEC-019 (load-error fallback), DEC-016 (config-write layer), DEC-007 (numbers).
**Blocked by:** nothing. No story waits on a user step (review §6; user's rule of 2026-09-28).

## Why this sprint exists

The user looked at the live app for the first time and gave feedback. The PO wrote it as requirements §8 (2026-09-28):
- **The look.** An outside designer restyled the app on 2026-09-28 without a record (`backlog/ui-design-adoption.md`). The result is dark only. `--text-dim` fails contrast. `FieldChart` hard-codes hex values. Some selectors depend on cell position. The user wants a lighter "trader" look plus a light theme, switchable, WCAG AA (FR15). The PO then approved a concrete design, `backlog/home-design/` (spec + four PNGs + working mockup). DEC-020 makes it binding.
- **The home table.** The symbol should open the detail page, not the PDF. The PDF becomes a small button. The whole row is clickable. There is no "History" link (FR7.1). A change is measured against the previous *available* report, with arrows (FR7.2). The user chooses which ETFs, value columns and change parts the table shows (FR7.3).
- **Ingestion.** A Monday filing holds the Friday, Saturday and Sunday reports. Today only the newest one is stored. Every report in the newest filing must be stored, with every field the adapter extracts (FR3.1; answers P1 and P2).
- **Charts.** The user chooses the chart type per chart. A single point must show clearly (FR8.2).
- **Production.** `drizzle/0001_etf_report_links.sql` was never applied on Neon, and the user wants no manual `pnpm`/Neon step. From now on the production build applies migrations (DEC-023, US-048). US-048 goes first because US-047's new tables ride on it.

## Goal

A readable trader-style UI in two themes, a home table that shows what the user chose with deltas against the previous available report, and every weekend report stored (roadmap, Sprint 9).

## Build order (review §1; it differs from the roadmap listing on purpose)

**US-048 → US-035 → US-037 → US-047 → US-036 → US-038 → US-039**

- **US-048 first.** The deploy applies migrations by itself (DEC-023). This also repairs production (`0001` was never applied). Every later migration depends on it, US-047's first.
- **US-035 next.** Tokens and the two themes are the base of every later look change (DEC-020).
- **US-037** is data-only and independent of the look. It goes before US-047 so the "value columns" switches can show fields that are now stored (FR7.3 "every extracted field is stored and the display choice only filters").
- **US-047, then US-036.** US-047 changes *what* `lib/monitoring/home.ts` reads. US-036 then changes what the table looks like and how a delta is computed. Both edit `lib/monitoring/home.ts` and `components/HomeTable.tsx`, so they run **one after the other, never in parallel**.
- **US-038** needs US-035's token palette.
- **US-039** is last. It is Codex's visual baseline of the finished look.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-048 | Migrations applied by the production deploy (DEC-023) | nothing | mid model, medium. Small → plan yourself (≤15 lines). Written by the Technical Lead chat: `stories/US-048.md` |
| US-035 | Adopt the visual layer: lighter trader palette plus light theme, contrast fixes, DEC-020 | US-048 (build order only), US-016, US-019, US-024 | strong model, high thinking. Complex (every stylesheet token, a theme mechanism in the root layout, header rework, new contrast and literal-scan tests, design reference, 11 ACs) → `story-planner` plan |
| US-037 | Ingest every report in the newest filing (Mon = Fri+Sat+Sun) and store every extracted field | US-035 (build order only), US-012, US-014, US-029, US-030 | strong model, high thinking. Complex (report discovery, the ingestion outcome path, the cron run budget, DEC-018 amendment, 10 ACs) → `story-planner` plan |
| US-047 | Home display settings (FR7.3): choose which ETFs, which value columns and their order, which change columns (absolute, percent, arrow) from the "Customize view" panel on the home page (per the design reference; no separate admin page); the home table shows exactly that; tests prove each switch | US-048, US-035, US-037, US-033 | strong model, high thinking. Complex (DB schema + migration, a new config-write module, a client panel with a server action, design reference, 11 ACs) → `story-planner` plan |
| US-036 | Home table look: symbol opens the detail page (whole row clickable), small "PDF" button, no "History" link, delta vs previous available report with arrows, phone scroll wrapper | US-047 (same files, sequential), US-035, US-017, US-030 | strong model, high thinking. Complex (a read-model SQL change, the delta rule, deliberate exact-markup changes, design reference, the D-7 QA render harness, 13 ACs) → `story-planner` plan |
| US-038 | Charts: type selector (line, dots, columns, area), palette, single-point display | US-035, US-019 | mid model, high thinking. One component plus a small pure module, but 8 ACs → `story-planner` plan (CLAUDE.md complexity rule) |
| US-039 | Visual QA baseline (RO/EN, 375 px and 1280 px, contrast check) | US-035, US-036, US-038, US-047 | mid model, low thinking. No code; the deliverable is the Codex QA procedure → plan yourself (≤15 lines) |

## Decisions needed

### Settled by the Sprint 9 review (carried, not re-decided)

| # | Story | Type | Question | Resolution | Isolated default possible? |
|---|---|---|---|---|---|
| T-1 | US-037 | TECHNICAL | Several reports per filing: discovery, unique key, per-link skip, every field, ETF outcome, budget | **Decided (review §3 T-1; DEC-018 §5 amended).** `findLatestFilingLinks` returns every link of the newest row, capped at `MAX_REPORTS_PER_FILING = 4` (the detail says `truncated`). `findLatestReportLink` stays as a wrapper. Per link: skip with no request when an `ok` report with that `source_url` exists (one `source_url = any(...)` query per ETF). Otherwise download, extract, and write through DEC-010, one batch per report. `select-values.ts` returns every extracted value. ETF outcome priority: failure code > `not_attempted` > `ok`. `MAX_REQUESTS_PER_ETF = 1 + MAX_REPORTS_PER_FILING`. `canStartEtf` checks the minimum (2 requests). New `canStartDownload`. The timeout/reserve constants do not change. | n/a |
| T-2 | US-036 | TECHNICAL | What is "previous available report"? | **Decided (review §3 T-2).** Per field: the newest earlier `ok` report of the same ETF that has a value for that field. `computeCellDelta` drops the `previousCalendarDay` check. Exact bigint maths and the zero-divisor rule stay. The previous date goes in the cell's `title`. Only `home.ts` and `delta.ts` change. The delta tests are rewritten on purpose. | n/a |
| T-3 | US-047 | TECHNICAL | Where do the home display settings live? | **Decided (review §3 T-3).** Three new tables in one expand-only migration: `home_display_settings` (single row), `home_display_columns`, `home_display_etfs`. Separate tables, so a missing table affects only the home display query, which falls back on 42P01. The column set is the `field_catalog` keys, not the tracked union. With nothing saved, the table is today's table. Writes go through `lib/config/home-display.ts`, and `saveHomeDisplay` replaces all three tables in one batch. The UI is the home page's Customize panel: one server action per change, and the action returns the saved state. | n/a |
| — | US-036 | TECHNICAL | Whole-row click without a client component | **Decided (review §2).** The symbol is a real `Link`. A stretched `a::after` (on a row with `position: relative`) makes the whole row the target. The PDF button has a higher `z-index`. There is no `onClick`, and the table stays a server component. | n/a |

### Product defaults (review §4; none blocks a story; `NEEDS USER` only if the user disagrees)

| # | Story | Type | Question | Shipped default | Isolated default possible? (code that holds it) |
|---|---|---|---|---|---|
| P-1 | US-047 | PRODUCT | What does the home table show when nothing has been chosen yet? | Same as today (tracked union, all active ETFs, every change part on) | Yes — the "nothing saved" branch in `lib/monitoring/home.ts` / `lib/config/home-display.ts` |
| P-2 | US-036 | PRODUCT | Flat value marker | Neutral `–`, no arrow (FR7.2) | Yes — the change-line renderer in `components/HomeTable.tsx` |
| P-3 | US-037 | PRODUCT | Backfill older reports with the untracked fields? | No. New reports store every field. Old ones keep what they had. | Yes — nothing is built; `lib/ingestion/select-values.ts` affects new writes only |
| P-4 | US-038 | PRODUCT | Chart type default and memory | Line; remembered per browser only (`localStorage`) | Yes — the chart-type module and `components/FieldChart.tsx` |
| P-5 | US-035 | PRODUCT | Default theme with no saved choice | Follows the browser; dark slate when the browser says nothing | Yes — one line in the theme module / root-layout inline script |
| P-6 | US-047 | PRODUCT | Does the Customize panel save one shared view for all visitors? | Yes, shared and saved on change (spec rule 6) | Yes — `lib/config/home-display.ts` + the home server action; per-browser would move it to `localStorage` |

### Open items found while detailing (settled by the in-loop `tech-lead`, 2026-09-28)

The review left each of these open. The in-loop `tech-lead` settled every TECHNICAL row in place during the sprint review (`verification/SPRINT-09-review.md` §7). No row blocks a story. The PRODUCT rows ship their isolated default.

| # | Story | Type | Question | Resolution | Isolated default possible? |
|---|---|---|---|---|---|
| D-1 | US-037 | TECHNICAL | T-1 says `findLatestReportLink` "stays as a wrapper returning the first link". Today it returns the **last** link of the newest row (fixtures README §2: links are in ascending date order, and the later link wins). In what order does `findLatestFilingLinks` return links, and which links does the cap of 4 drop? | **Decided — newest first (tech-lead, 2026-09-28).** Return the newest row's links **newest first** (reverse row order, the same comparator `findLatestReportLink` sorts by today, `lib/extraction/discovery.ts:135-136`). The first element is then exactly today's `findLatestReportLink` result, and existing discovery tests stay unchanged. Downloads follow that order, so the deadline guard only ever skips the *older* reports. The cap keeps the 4 newest links and drops the oldest. "Newest" is row order only. Each stored report's date still comes from its own PDF text (DEC-010). | n/a (technical) |
| D-2 | US-037 | TECHNICAL | T-1's priority (failure > `not_attempted` > `ok`) does not name `already_ingested`. What is the ETF outcome when every link was already stored, or when some were stored and the rest were already stored? | **Decided — as recommended, plus two tie-breaks (tech-lead, 2026-09-28).** Priority: failure code > `not_attempted` > `ok` > `already_ingested`. The outcome is `ok` when at least one new report was stored and nothing failed or was skipped (the rest may be already stored). It is `already_ingested` when every kept link was already stored, so a second identical run logs what it logs today. The `ok` outcome's `reportDate`/`sourceUrl` are those of the newest report stored in this run, and its `valuesWritten` is the sum over the reports stored in this run. **Tie-break 1:** when several links fail with different codes, the ETF's code is the first failure in processing order (newest link first). Its `reportDate` is set when that link produced one. **Tie-break 2:** `already_ingested`'s `reportDate` is the newest kept link's stored date. The detail always carries "stored N, already stored M, failed K, not attempted J" (plus `truncated` when the cap applied). The code list is unchanged. | n/a (technical) |
| D-3 | US-037 | TECHNICAL | Once every extracted value is stored, what still decides `ok` vs `parse_error`? Today: a tracked key the adapter did not return → `parse_error` (US-014 AC5). | **Decided — status rule unchanged (tech-lead, 2026-09-28).** A tracked key missing from the adapter's values still makes the report `parse_error`, and every found value is stored. Only the stored value set grows. This changes nothing for any existing ETF whose tracked fields are all found. | n/a (technical) |
| D-4 | US-047 | TECHNICAL | How is "nothing saved yet" (P-1 default) told apart from "saved, with these columns"? What order does the panel list value columns in, and what position does a newly ticked column get? | **Decided — as recommended (tech-lead, 2026-09-28).** The single `home_display_settings` row existing means "a view was saved". Once saved, `home_display_columns` is exactly the chosen set (possibly empty), and `home_display_etfs` rows are the explicit hide/show choices (no row = visible). The panel lists the columns currently shown first, in table order, then every other catalogue key in catalogue order (lowest `field_catalog.id` per `field_key`), as `mockup-home-dark-customize.png` shows. Ticking a column appends it at the end, and unticking removes it. **First click from "nothing saved":** the panel's starting state is the default view (P-1: the tracked-union columns in today's order, all ETFs visible, all switches on). The first save writes that state plus the one change, so the first click never reorders the table. This reconciles review §2 US-047 (1)'s "catalogue order unless the settings say otherwise" (catalogue order is for keys not yet shown) with P-1. | n/a (technical) |
| D-5 | US-035 | TECHNICAL | DEC-020 §1 lists the token names. The current sheet also uses `--warn`, `--accent-soft`, `--accent-strong`, `--bg-elevated`, `--border-strong`, `--gain-soft`, `--loss-soft`, `--warn-soft` (warning notices, tints, tooltip/menu surfaces). Do they survive? | **Decided — as recommended (tech-lead, 2026-09-28).** Keep only what a current state needs, **defined in both theme blocks**. `--warn` stays as a named extra token (the cron notice and the "adapter missing" flag use it) and is added to the contrast test as a text colour. Tints are expressed from §1 tokens where possible (e.g. `color-mix` on `--accent`). Otherwise they stay as extra tokens in both blocks. The plan lists each extra token and its reason. Where a text token sits on an extra surface token (e.g. `--warn` text on a warning tint that is itself a token), that pair joins the contrast test. The three names DEC-020 calls old (`--text-dim`, `--bg-panel`, `--border`) and every other renamed one (`--text-muted`→`--muted`, `--bg-hover`→`--hover`) are gone, with no alias. | n/a (technical) |
| D-6 | US-038 | PRODUCT | FR8.2 lists "line" and "line with dots" as two types. Today's line already draws a dot on every stored day (US-019). What does "line" draw? | Isolated default: "line" draws the line with no per-day dots, **except** a point with no neighbour on either side (a single point, or a day between two gaps). That point keeps a dot, so no stored value becomes invisible (FR8.2 single-point clause, P11). "Line with dots" draws a dot on every point. The default type is "line" (P-4). **Ships the default (tech-lead, 2026-09-28).** | Yes — the series renderer in `components/FieldChart.tsx`. **NEEDS USER** only if the user wants "line" to keep every dot |
| D-7 | US-039 (and the QA checklists of US-035/036/047) | TECHNICAL | DEC-020 §10 asks Codex QA to capture the **filled** home table from "seeded PGlite data". But `scripts/claude/qa-serve.sh` serves the app with no database, the app reads Neon through `getDb()` only, and no path serves the app from PGlite. How does Codex see a filled table (and the open Customize panel with data)? | **Decided — option (a), the render harness, built in US-036 (tech-lead, 2026-09-28).** A **test-support render harness** under `scripts/qa/` (never imported by `app/` or `lib/`). It renders the shipped home composition (title row, Customize panel open, card, `HomeTable`) with a committed fixture view model into standalone HTML files, one per theme and locale, that link the stylesheet `pnpm build` produced. Codex screenshots those files next to the live empty/error states. This is how "seeded data for the filled table" (DEC-020 §10) is met: the fixture view model stands in for seeded PGlite rows, because no path serves the app from PGlite and a fixture mode in the app (b) would put a test path in production code. The header in the design captures comes from the live app. The harness may render `AppHeader` too, but only if that needs no Next.js runtime (`usePathname`). If running the harness through `tsx` hits a JSX or tsconfig limit, the plan may run the same render function through a dedicated `vitest` entry instead, with the same output and no new dependency. | n/a (technical) |
| D-8 | US-038 | PRODUCT | Is a remembered chart type shared across ETFs, or one choice per ETF symbol and field? | Isolated default: **one stored choice per ETF symbol and field key** (the literal FR8.2 "choose the type per chart" reading: each chart on each detail page is its own chart). It lives in the chart-type module's storage-key builder only. The alternative (per field key, shared across ETFs) is a one-line change there. **Ships the default (tech-lead, 2026-09-28).** | Yes — the key builder in the chart-type module (US-038 Task 1). **NEEDS USER** only if the user wants one choice per field shared across ETFs |
| D-9 | US-039 | TECHNICAL | No headless browser is in the repo for screenshots and the in-page contrast check. Which one does Codex use? | **Decided — use one the QA environment already has; nothing enters the project (tech-lead, 2026-09-28).** The checklist uses a headless browser **already available** in Codex's environment (e.g. a system Chrome/Chromium, or a Playwright/Puppeteer install that lives outside this repo). Nothing is added to `package.json`, `pnpm-lock.yaml` or the repo's `node_modules`. No browser is downloaded or installed during the QA run (a denied install is never retried in another form, DEC-015). Theme via stored `etf-theme`, the `NEXT_LOCALE` cookie and the in-page contrast snippet all need a **scriptable** browser (one that can set storage/cookies and evaluate a script). The checklist handles three cases. **Scriptable:** every capture and contrast check is `AUTO`. **Screenshot-only** (e.g. `chromium --headless --screenshot`): the captures run, and the in-page contrast check plus any theme/locale that cannot be set become one `AUTO-PARTIAL` line. **None:** the US-039 Task 6 fallback applies. In every case the offline token contrast test of US-035 is quoted with its command and exit code. Adding Playwright as a dev dependency would need its own decision, and it is not taken here (DEC-020 "No new dependency"). | n/a (technical) |
| D-10 | US-039 (and the QA checklists of US-035/036/047) | TECHNICAL | The review asks for 375/1280 px baseline captures, but DEC-020 §10 asks for about 1200×560 and 390 px design captures. Which sizes? | **Decided — both (tech-lead, 2026-09-28).** The baseline matrix is 375 and 1280 px (review §2 US-039 (1), DEC-020 Consequences): 10 routes × 2 locales × 2 widths × 2 themes = 80 captures. The design comparison of `/` adds the four DEC-020 §10 captures at the reference sizes (about 1200×560 light, dark, and dark with the panel open; 390 px wide), each paired with its PNG, in **EN** (the PNGs' language). The two sets have different purposes, so this is no conflict. The QA checklists of US-035, US-036 and US-047 use the four design sizes only. | n/a (technical) |

### Open points for the PO (information, nothing blocks)

- **O-1** — The roadmap puts Sprints 9–11 under **EPIC-08**, but `backlog/epics.md` has no EPIC-08 section. The PO adds it (agents do not edit `epics.md` in this mode).
- **O-2** — FR7.3 says the user chooses the value columns "and in what order", and the change parts "globally and per column". The review (§2, US-047 AC1) builds neither a reorder UI nor a per-column UI: `position` and the per-column overrides are stored and honoured, but the panel exposes only tick/untick and the three global switches (as the reference PNG shows). The PO confirms at the demo, or asks for a follow-up story.
- **O-3** — Chat control of the home display settings ("later" in FR7.3) is in no roadmap story (review T-3). The PO decides whether to add it.
- **O-4** — FR7.1 says the PDF link becomes "a small icon". The design reference and DEC-020 §10 replace it with a small bordered "PDF" button. The reference wins (DEC-020 §10), and US-036 builds the button. This is noted so the PO can align the FR wording.

## Design reference procedure (DEC-020 §10; US-035, US-036, US-047)

- While planning, and again before closing the story, the dev loop opens `backlog/home-design/home-design-spec.md` and the four PNGs (`mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`, `mockup-home-phone.png`). In the story's HANDOVER section it writes one line per PNG: `MATCH` or `DEVIATION: <what, why>`. It never writes MATCH without having looked. If it cannot view images, it says so and leaves one JUDGMENT item.
- Where the reference and a shipped rule differ, the shipped rule wins and it is **not** a deviation: colour values are AA-adjusted (DEC-020 §3), and sign and number format follow DEC-007/P7, the date follows P5, and the full name comes from `etfs.name`.
- Corrections the spec demands, not to be copied: the phone header must not overlap, and numeric and date cells must not wrap (the phone PNG shows both defects).
- The story's QA checklist tells Codex QA to capture the running app at about 1200×560 in light and dark, in dark with the Customize panel open, and at 390 px wide. Codex compares each capture with the matching PNG and records `MATCH`/`DEVIATION`, or one JUDGMENT item if it cannot view images.
- Each exact-markup test a design story changes is listed in its HANDOVER section as `deliberate markup change: <test>, <old>, <new>, <reason>` (DEC-020 §6). A behaviour assertion (text shown, link target, role, `data-*` value) is never dropped.

## Sprint Definition of Done

- All seven stories reviewed and tested (PASS/PASS), Awaiting QA, then accepted by the user.
- `pnpm test` runs fully offline and proves the following:
  - **US-048:** the migration script's skip/run/retry/safe-output rules, and the expand-only guard over `drizzle/*.sql`.
  - **US-035:** both token blocks and the WCAG AA contrast test in both themes. No colour literal outside the token blocks, no old token name, and no positional selector carrying meaning. The theme resolver tolerates blocked storage. The header keeps its five items in order.
  - **US-037:** three links produce three reports, and every extracted field is stored. A repeat run is a no-op. A partly failed run completes on re-run. `ok` is never downgraded. The deadline guard holds, and the budget test is expressed over the constants.
  - **US-047:** the migration applies on PGlite. The save is atomic and validated. One test per switch. With nothing saved the table is today's table. A missing table falls back.
  - **US-036:** the delta against the previous available report (PGlite). Row, symbol and PDF link targets. Arrow, tone and switch rendering in RO and EN.
  - **US-038:** each chart type, the stored choice with blocked storage, the single-point display, and a palette from tokens only.
- **One schema change:** US-047's three tables in one migration. It is generated locally (`pnpm db:generate`) and expand-only (US-048 guard). **No agent applies it to Neon.** The production build applies it (DEC-023).
- No new runtime dependency (DEC-020 "No new dependency"). Interactive logic (theme, Customize panel, chart type) lives in pure modules tested without a DOM, as in the `components/chat/chat-state.ts` pattern. A DOM test environment would be a dev dependency the plan must justify with an exact version.
- Every UI string is in both `messages/ro.json` and `messages/en.json`, and the key-parity test passes (FR8.1). Values follow DEC-007 and P7, dates follow P5.
- Design stories (US-035, US-036, US-047) have a MATCH/DEVIATION line per PNG in HANDOVER, and every deliberate markup change is listed.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test` pass with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV` and every provider key variable unset.

## Manual QA / live steps for the user

**None required** (review §6). A `git push` to the production branch is the whole procedure: the Vercel build applies pending migrations (US-048, DEC-023) and deploys.

Optional, never blocking:
1. **After the push:** open `/health`. It shows no schema line, and `/` loads (US-048 observation). The home table then shows every monitored ETF.
2. **Look (JUDGMENT, after US-039):** compare `/` in both themes and on a phone with `backlog/home-design/`, and say "looks right" or what to change. US-039's Codex report lists every screenshot.
3. **First Monday after the push:** `/admin/operations` shows each BRD ETF's line as "stored 3" (or "stored N, already stored M"). The ETF detail page has rows for Friday, Saturday and Sunday (US-037).
4. **Customize view:** untick an ETF and a value column, reload, and the table shows exactly that. Then tick them back (US-047). This is a shared view: every visitor sees it (P-6).
5. Answer P-1..P-6, D-6, D-8 or O-1..O-4 only if you disagree with a default.

## Carry-forward notes: how this sprint handles them

- **Roadmap "Any sprint":**
  - "Numbers follow DEC-007; dates and deltas follow P5/P7": applied in US-036 AC5 and US-038 (tooltip unchanged).
  - Test debts (FieldChart tooltip W3, `/health` W4/W6, README `.env.local`, IF-8c): all already closed (Sprint 5 audit, US-031). Nothing to do.
- **Roadmap Sprint 7 note, "Column labels … reconcile when a second adapter defines a shared `field_key`":** closed by DEC-018 §3 (US-029). US-047's value-column list relies on it (labels are identical across adapters).
- **`ui-design-adoption.md` defects:**
  - `--text-dim` contrast, the home-table scroll wrapper, the table radius, `FieldChart` hex literals, positional selectors and the dark-only theme: all in US-035 (AC1–AC7).
  - The "designer's written review" (bigger markup changes: sortable/sticky table, card layout, sparklines, KPI tiles): out of scope (DEC-020 §9).
- **`data-model.md` line "Migrations … applied to Neon only by the user":** superseded by DEC-023. US-047 rewrites it when it adds its tables (US-048 is fixed as written and does not list `data-model.md`).
- **Sprint 8 audit:**
  - W2 (PDC-3 guard test weak) and W3/W4 (tester evidence): kit/tooling items for the Technical Lead chat, not story work.
  - N3 (`/health` HC-6 test title vs the accepted P15): the user's P15 answer is pending, so nothing changes.
  - N4 (`lib/ai/chat.ts` swallows five error paths with no log): out of scope. It is a hardening candidate, not Sprint 9 scope.
- **Open product items P12–P15:** unchanged, and not Sprint 9 scope. US-036 keeps the P12 rule for the PDF button: no button when no URL is known.

## Out of scope for Sprint 9

- Sortable or sticky tables, a mobile card layout, sparklines and KPI tiles (DEC-020 §9).
- A drag/reorder UI for value columns, and a per-column change-part UI (review §2, O-2).
- Chat control of home display settings (O-3).
- Backfilling untracked fields into reports stored before US-037 (P-3).
- Fetching a deadline-skipped weekend link on the next daily run. It is fetched by a same-day manual run from `/admin/cron` (review T-1 "known limit").
- Raising `maxDuration` above 60.
- Login (standing user rule, 2026-09-28: never propose it).

## Notes for Sprints 10–11

Review §5 holds the risk notes. Before each of those sprints is detailed, the in-loop `tech-lead` writes `SPRINT-10-review.md` / `SPRINT-11-review.md` (HANDOVER "Exact next step" 4). A widget on a field that became stored only with US-037 shows `insufficient_history` until enough new days exist (P-3).
