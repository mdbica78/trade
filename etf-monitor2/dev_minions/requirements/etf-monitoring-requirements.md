# Requirements — BVB ETF Monitoring

*Working document (V2) — Product Owner draft, 2026-09-22*

## 1. Objective

A generic, extensible web application that monitors ETFs listed on BVB (Bucharest Stock Exchange) on a daily basis, automatically extracts key indicators from the depositary reports published on each instrument's page, and builds a queryable history (tables + charts) of how those indicators evolve over time.

**Core design principle:** the application is not fixed to a static set of ETFs. The user can add or remove any ETF listed on BVB from monitoring, at any time, through a conversational (natural-language) interface. The 4 ETFs discussed initially (TVBETETF, PTENGETF, BTBETRETF, ICBETNETF) are **starting examples**, not a fixed scope.

Continues the broader plan already defined (the "browser app" project): browser-based application, database, free hosting.

## 2. Functional Requirements

### 2.1 ETF monitoring (generic, not limited to the 4 examples)
- **FR1** — The user can add any ETF from the BVB list ([bvb.ro/FinancialInstruments/Markets/FundUnits](https://bvb.ro/FinancialInstruments/Markets/FundUnits)) to monitoring, via natural-language command (e.g., "add ETF XYZ" / "stop tracking ETF ABC").
- **FR2** — The user chooses, also via natural language, which parameters from the daily report to track for each ETF (e.g., "also track VUAN for BTBETRETF").
- **FR3** — The system downloads the most recent depositary report daily for each ETF under monitoring and extracts the selected parameters.
- **FR4** — Extracted data is saved historically (with date), per ETF, per parameter, in a database.
- **FR4.1** — If the daily report is missing or delayed for an ETF, that day remains **blank in the history** (no value) — no automatic retries, no alert. *(decided)*
- **FR4.2** — When a new ETF is added to monitoring, its history **starts empty** from that point on — no backfill from reports already published on BVB. *(decided)*

### 2.2 AI module — natural-language configuration only (current scope)
- **FR5** — The conversational (natural-language) interface is used **exclusively** for configuration: adding/removing ETFs, choosing which parameters to track. The actual extraction of data from PDFs remains a classic parser (predictable, testable), not AI.
- **FR6** — The user can choose which AI model powers the conversational interface, from a list of integrable free options (the architecture must be "pluggable" — a single AI-provider adapter, easy to swap). Multiple viable free options currently exist (Google Gemini, Groq, OpenRouter, Mistral, etc.) — the exact set of supported providers is to be validated at implementation time, since free-tier offerings change frequently.
- **Design note:** although the AI's current scope is strictly configuration (FR5), section 7 (Roadmap) anticipates extending it with additional AI capabilities later. The AI module should be designed as a **capability system** (each capability as a separate "plugin" on top of the chosen AI provider), not as a single hard-coded command-parsing function — otherwise adding new capabilities later would require a rewrite.

### 2.3 Interface — Home page
- **FR7** — A table listing all currently monitored ETFs. Each row:
  - ETF symbol, **clickable**, linking directly to the most recent PDF report
  - Dynamic columns = the parameters the user has chosen to see (not fixed — configurable)
  - For each parameter: today's value + the difference vs. the previous day (both absolute and percentage)

### 2.4 Interface — ETF detail page
- **FR8** — Clicking an ETF in the table opens a dedicated page with:
  - Historical values for the monitored parameters of that ETF (table)
  - Time-evolution charts, styled similarly to the charts on bvb.ro, but limited strictly to the user's parameters of interest (not everything the BVB site offers)

### 2.5 Interface language
- **FR8.1** — The application interface supports **both Romanian and English** (switchable), including the conversational interface. *(decided)*

## 3. Extensibility — data extraction per issuer

By navigating the live pages of the 4 example ETFs, we confirmed that **report format differs between issuers**:

- **BTBETRETF, TVBETETF, PTENGETF** — shared depositary (BRD — Groupe Société Générale), identical report structure, direct and predictable PDF link.
- **ICBETNETF** — different administrator (Intercapital), different terminology ("VAN" instead of "VUAN"), different download mechanism (a submit button, not a direct link) — we were not able to fully confirm its structure yet.

Since the user will be able to add **any** ETF from BVB, not just these 4, data extraction must be designed as a **system of adapters per report format**, not a single rigid parser:

- When a new ETF is added, the system attempts to match it to a known adapter (by issuer/depositary or by report structure).
- If no adapter matches, the ETF is still shown in the list (with a link to its report), but automatic extraction is marked "unavailable" — until a new adapter is added for that format.
- Technical recommendation: where possible, extraction should search for **field labels** (e.g., "NUMAR U.F. in circulatie", "ACTIV NET") in the text, rather than fixed positions on the page — regulated Romanian financial reports tend to reuse the same field names even with a different layout, which can reduce the number of adapters needed.

## 4. Proposed architecture (validated via a quick check of current free options)

- **Application hosting:** a **new Vercel project** (Hobby plan, free) — separate from the user's existing project.
- **Daily automation:** Vercel Cron — the Hobby plan allows free cron jobs **once per day**, which matches exactly the report publication frequency. ([source](https://vercel.com/docs/cron-jobs/usage-and-pricing))
- **Database:** **Neon Postgres** (free tier — native Vercel integration): 0.5 GB storage/project, ~100 compute-hours/month, "sleeps" after 5 minutes of inactivity and auto-resumes on the next query, with no data loss — suitable for a daily job with no manual maintenance. ([source](https://www.sadiqalam.com/insights/best-free-database-hosting-platforms-in-2026-6-free-tiers-compared))
  - Alternative: Supabase (similar free tier, but projects inactive for >1 week require manual restoration — less suitable for an automated job the user isn't attending to daily).
- **AI module (NL configuration):** a pluggable adapter over one of the available free providers (Gemini / Groq / OpenRouter / Mistral, etc.) — chosen by the user from the interface.

*Note: exact free-tier limits change over time; re-verify before starting implementation.*

## 5. Administration / maintenance area

The application has two distinct areas:

- **User area** (sections 2.3 and 2.4) — table + detail pages, plus the conversational interface for quick commands ("add ETF X", "also track VUAN").
- **Administration/maintenance area** — a separate panel, with structured control (forms, not just natural-language commands) over the same configuration data, plus operational settings that don't make sense as conversational commands:

  - **FR9** — ETF management: full list of monitored ETFs, manual add/remove (form), independent of the natural-language command — both paths (chat and form) operate on the same configuration model.
  - **FR10** — Parameter management: per ETF (or per adapter/report type), which fields are available for extraction and which of them are active/tracked.
  - **FR11** — AI module configuration: choice of AI provider (from the list of supported free ones) + entering an API key where required.
  - **FR12** — Cron configuration: view/adjust the time of day the daily extraction job runs. *(Note: the free Vercel Hobby plan allows a single cron job per day — not freely configurable frequency, only the time of day can be adjusted within that limit.)*
  - **FR13** — Operational visibility: history of cron runs (success/failure), last successful extraction per ETF, parsing errors (especially useful for ETFs without a matching adapter, cf. section 3).

  Explicitly **out of scope** for the admin panel: creating a new extraction adapter for an unknown report format remains development work (code), not a UI-configurable action — the admin panel only flags that an adapter is missing (FR13).

## 6. Roadmap — later versions (out of current scope)

Explicitly decided **not** to be part of the current scope, but to be kept in mind architecturally so it isn't blocked later:

- **Authentication/login** — for now the application (including the admin area) remains open, with no login. To be added in a later version.
- **Extended AI capabilities — a news feed correlated with value changes.** Example given: if a tracked parameter (e.g., units in circulation) rises or falls significantly, the system automatically searches for news/information that could explain that market movement and presents it to the user (a kind of contextual "feed").
- **Notifications/alerts** — none for now (neither for a new report nor for significant variations). Possibly added in a later version — not decided whether it will actually be built.
- **Other AI capabilities**, not yet defined — explicitly left open for future versions.

These points are not implemented now, but they motivate the recommendation above (section 2.2) that the AI module be designed for extensibility from the start.

## 7. Still undecided / to revisit

- **Phasing (narrow V1 vs. building everything at once):** remains deferred — to be decided separately, as a process/work-plan discussion, not as a functional requirement.

## 8. Addendum — user feedback after the first live look (PO, 2026-09-28)

Supersedes the wording of FR7/FR8 where they conflict. Every item below is a **user decision** unless marked PROPOSED.

- **FR7.1** — The home-table symbol links to the ETF detail page. The PDF report link becomes a small icon next to the symbol. There is no separate "History" link, and the whole row is clickable. *(decided; replaces product decision P8)*
- **FR7.2** — Each tracked value shows the change against the **previous available report** (not necessarily the calendar day before), as absolute and percent, with an up or down arrow and gain/loss colour; a flat value shows a neutral marker. *(decided; replaces P6 "blank if the calendar day before is missing")*
- **FR7.3** — The user chooses what the home page shows, from a "Home display" settings area (and later by chat): (a) **which ETFs** appear (active ETFs, each with a show/hide switch), (b) **which value columns** appear and in what order, (c) **which change columns** appear: absolute change, percent change, arrow, each switchable, globally and per column. The table shows only what is chosen, plus the symbol and date. Storage is independent of display: every extracted field is stored (FR3.1) and the display choice only filters. *(decided 2026-09-28; the shared column set for all ETFs replaces the per-ETF tracked-field union, blank cell when an ETF has no such field)*
- **FR3.1** — The BVB news list files one entry per day, and a Monday entry holds Fri+Sat+Sun reports ("VAN la data 25/26/27.09.2026"). The system stores **every** report in the newest filing row, each under its own report date, and stores every field the adapter extracts. *(decided; replaces P2 "newest only" and adopts the P1 recommendation)*
- **FR8.2** — Charts let the user choose the type per chart (line, line with dots, columns, area) and use a readable palette. A chart with a single data point still shows that point clearly. *(decided)*
- **FR15** — Look and feel: a "trader" look, not a near-black one. A lighter dark-slate theme and a light theme, switchable, with accessible contrast (WCAG AA). *(decided)*
- **FR16** — AI keys and providers from the browser (testing stage, no login): enter and replace a provider key on `/admin/ai`, write-only (never shown again), stored encrypted; add a provider from a list of presets and a model name. *(decided; overrides Sprint 5 decision 9. Risk accepted by the user: anyone who reaches the URL can change or use the key, until login is added.)* The user confirmed on 2026-09-28: no login for now, and the key is never displayed after saving. A free-form base URL for a custom provider is **not** included until login exists, because it would let a stranger send the key to their own server (PROPOSED, still open).
- **FR17** — The chat page shows an instruction area listing the supported requests, in RO and EN. *(decided)*
- **FR18** — Programmable history area: the user asks the chat for a derived value ("show in history the change between today and one week ago"), it is saved and shown permanently in an area of the ETF detail page until the user updates, clears or replaces it by chat. The AI produces a **structured definition** from a closed set (operation, field, period), never code. *(decided; needs a decision record: DEC for the widget definition)*
- **FR19** — Units and fields must be programmable by request. Today the list of extractable fields is code (each adapter) and the chat can only switch existing fields on or off. FR18 covers derived values. Adding a new **raw** field read from a report label by request is a separate spike (PROPOSED).
