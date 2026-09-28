# DEC-020 — Visual layer: design tokens, two themes, contrast, chart colours

Status: **Decided** (Technical Lead chat, 2026-09-28). Binding for every story that touches `app/globals.css`, `components/` or chart colours.
Inputs: FR15 and FR8.2 (requirements §8), `backlog/ui-design-adoption.md` (the designer's restyle and its defects), the approved
look `backlog/home-design/` (spec `home-design-spec.md`, four PNGs, `mockup-home.html`; user, 2026-09-28; binding, see §10). Scope of change: Sprint 9 stories US-035, US-036, US-038, US-039.

## Context
An outside designer restyled the app on 2026-09-28 (about 06:56) with a CSS-first method: global rules on bare elements and
existing `data-*` attributes. Nothing broke and tests still pass. But no record describes it, it is dark only, `--text-dim`
has 2.9:1 contrast, `FieldChart` hard-codes hex values, and some selectors depend on cell position. The user has approved
a lighter slate look and a light theme, switchable (FR15). Without a rule, the next agent will either fight the look or
restyle around exact-markup tests.

## Decision
1. **Tokens live in one place: `app/globals.css`.** Two blocks define the same custom properties: `:root` (light) and
   `:root[data-theme="dark"]` (lighter dark-slate, not near-black). Names follow the approved mockup: `--bg`, `--panel`,
   `--head`, `--line`, `--text`, `--muted`, `--accent`, `--gain`, `--loss`, `--flat`, `--hover`, plus `--radius`, `--focus`
   and a chart palette `--chart-1` … `--chart-6`. Old names (`--text-dim`, `--bg-panel`, `--border`) are renamed in the same
   story; no alias block may survive US-035. No component and no other stylesheet declares a colour literal.
2. **Two themes, switchable.** A small client component in the header toggles `data-theme` on `<html>` and stores the choice in
   `localStorage` under `etf-theme` (read and written inside try/catch; it must work when storage is blocked). First visit:
   follow `prefers-color-scheme`; when the browser gives none, use dark slate (today's look, so no visible change for
   anyone who does nothing). An inline script in the root layout sets the attribute before first paint (no flash), so
   `<html>` gets `suppressHydrationWarning`. `color-scheme` follows the theme. This default is a technical choice; changing it is one line.
3. **WCAG AA contrast is a tested property, not a review opinion.** Text and delta colours ≥ 4.5:1 against every surface they
   sit on (`--bg`, `--panel`, `--head`, `--hover`), in both themes; borders and chart lines ≥ 3:1 against `--panel` only where
   they carry meaning (a decorative `--line` is exempt). A new unit test parses the two token blocks from `app/globals.css`,
   computes the ratios and fails below the limit. This test is new; it weakens nothing.
   The mockup's palette is the starting point, **but it does not pass**: in the light theme `--gain #0f8a4b` is 4.41:1 on
   `--panel` and 4.04:1 on `--hover`, and `--accent #1f6feb` is 4.32:1 on `--head` and 4.24:1 on `--hover`; in the dark theme
   `--loss #ff6b78` is 4.34:1 on `--hover`. The story must adjust those tokens to pass, keeping the hue. Values that were
   computed to pass (guidance, the test decides): light `--gain #0b7a42`, `--accent #1a5fd0`; dark `--loss #ff7f8a`. The old
   `--text-dim #566173` is removed; `--muted` replaces it (5.0:1 or better on all surfaces in both themes).
4. **`FieldChart` reads its colours from the tokens.** No hex or `rgb(` literal remains in `components/FieldChart.tsx`; series
   colours, grid, axis text and tooltip use `var(--chart-n)`, `var(--line)`, `var(--muted)`, `var(--panel)`, applied through
   `style` props so they follow a theme switch without a re-render of the chart. A test greps the file for colour literals.
   US-038's chart types (line, dots, columns, area) and the single-point display use the same palette.
5. **Exact-markup tests and the stylesheet.** Where a test fixes exact markup (for example `HomeTable.test.tsx` expecting
   `<td>11.171</td></tr>`), the look is achieved with selectors on elements, classes and `data-*` attributes, never by
   changing the markup. **Positional selectors (`:nth-child`, `:first-child > span:not([class])`) are not allowed for meaning**
   (gain/loss colour, status colour, run-end marker): use a `data-*` hook or a class. The designer's existing positional
   selectors (operations dashboard) are converted in US-035 without changing behaviour.
6. **Changing an exact-markup test is allowed only inside a design story, on purpose.** The stories are US-035, US-036 and
   US-038, plus US-047 for the home page's "Customize view" button and panel, and only for the markup the story names (US-036: the home table row and cells; US-038: the chart wrapper; US-047: the home page title row and panel).
   Each changed assertion is listed in HANDOVER as "deliberate markup change: test, old, new, reason". A behaviour assertion
   (text shown, link target, role, `data-*` value) is never dropped; a test is never edited to make a failing behaviour pass.
   Outside a design story the rule stays: do not touch the markup, style through the stylesheet.
7. **Tables scroll, they do not overflow the page.** Every wide table sits in a wrapper with `overflow-x: auto` (the home
   table gets the wrapper; the detail-page history table already has one) and a `min-width` on the table. Rounded corners and
   the border go on the wrapper, not on `<table>` (`border-collapse` ignores the radius).
8. **The header navigation stays:** Home, Chat, Administration, System status and the RO/EN switch, same order and same
   message keys. Layout as in the design reference (§10): app name left, navigation in the middle with the active page as a filled accent pill, theme toggle and RO/EN on the right. The theme toggle has an `aria-label` in both languages.
   On a phone the labels collapse to icons (the existing icons may stay) and the header must not overlap: the phone PNG shows crowding at 390 px that is **not** approved. Focus is always visible
   (`:focus-visible` uses `--focus`, 3:1 against its surface).
9. **Out of scope here:** sortable or sticky tables, mobile card layout, sparklines, KPI tiles. If the designer's written
   review asks for them, that is a separate design story after the Technical Lead reads the review (`ui-design-adoption.md`).

10. **Binding design reference: `backlog/home-design/`** (approved by the user 2026-09-28; the PO's `home-design-spec.md` and four PNGs plus the working mockup `mockup-home.html`, whose CSS is the token source):
    `mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`, `mockup-home-phone.png`. It binds **US-035, US-036 and US-047**. The old `backlog/mockup-home.html` is replaced by the copy in that folder.
    - The dev loop opens the PNGs (an agent can read images) and the spec while planning, and again before it closes each of the three stories; the story's HANDOVER section states, per PNG, `MATCH` or `DEVIATION: <what and why>`.
    - Codex QA does the same: it captures the running app (`qa-serve.sh`, no database needed for the empty/error states; seeded PGlite data for the filled table) at about 1200×560 in light and dark, dark with the Customize panel open, and 390 px wide, and compares each with the matching PNG. Verdict per screenshot `MATCH` or `DEVIATION` with a note. If the QA agent cannot view images it says so and records one JUDGMENT item for the user; it never writes MATCH without having looked (DEC-015).
    - **What must match:** layout, order of elements, spacing rhythm, hierarchy, alignment (numbers right-aligned with tabular digits), what is on the second line of each cell, states (hover, active pill). **Not required:** exact pixels, the illustration's made-up sample changes, the "Illustration only" note.
    - **Where the reference and the shipped rules differ, the shipped rule wins, and the difference is not a deviation:** (a) colour values are the mockup's, minimally adjusted to pass AA (§3); (b) the sign character and number format come from the existing formatters (DEC-007, P7) — the mockup's typographic minus is not required; (c) the date follows the language (RO `22.09.2026`, EN `2026-09-22`, P5); (d) the ETF's full name under the symbol comes from the `etfs` table.
    - **Corrections the spec itself demands:** the phone header must not overlap, and numeric and date cells do not wrap (the phone PNG shows `2026-09-` / `24` broken; that is a defect to fix, not to copy). The PDF control is a small bordered "PDF" button with an accessible name in both languages (it replaces the earlier icon idea); it opens the report in a new tab and does not trigger the row click.
    - A design change to these screens after this point is a change to the reference folder first (PO), not an agent decision.

## Consequences
- US-035 renames tokens, adds the light theme, the toggle, the contrast test and the chart-colour test, and converts the positional selectors. Its tests are the contrast test, the no-colour-literal grep, a header test that the five nav items keep order and text, and the toggle test (attribute set, storage failure tolerated).
- US-039 (visual QA baseline, Codex) captures `/`, `/etf/<symbol>`, `/admin/*`, `/chat`, `/health` in RO and EN, at 375 px and 1280 px, in both themes, and runs an automated contrast check. "Does it look right" stays one JUDGMENT item for the user (**NEEDS USER**, non-blocking).
- Nothing under `components/` or `app/globals.css` may be restyled or "restored" by any agent before US-035 is detailed; after it, only inside a story that names the change.
- No new dependency (no theme library, no CSS framework).
