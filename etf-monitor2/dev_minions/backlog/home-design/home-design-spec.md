# Home page design spec (approved by the user 2026-09-28)

Reference files, in this folder: `mockup-home.html` (the working mockup, its CSS is the token source),
`mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`, `mockup-home-phone.png`.
Agents: open the PNGs (you can read images) and compare your result to them. Match the layout and spacing; exact pixels are not required.

## Rules
1. Header: app name left, navigation in the middle (Home, Chat, Administration, System status), theme toggle and RO/EN right. The
   active page is a filled pill in the accent colour. The existing icons may stay. On a phone the labels collapse to icons only and the
   header must not overlap (the phone PNG shows the mockup's header crowding on 390 px: that part is NOT approved, fix it).
2. Page title "Monitored ETFs" left, a "Customize view" button right.
3. One rounded card holds the table. Header row: small uppercase muted labels. Body rows: 14 px vertical padding, thin dividers, the row
   is clickable and highlights on hover.
4. First cell: the ETF symbol in the accent colour and bold, a small bordered "PDF" button next to it, the full ETF name in small muted
   text under it. Symbol and row open the ETF detail page. The PDF button opens the latest report PDF in a new tab and does not
   trigger the row click. There is no "History" link.
5. Numeric cells are right-aligned with tabular digits. Under each value, one small line: arrow (▲ gain, ▼ loss, – flat), absolute
   change, percent change, in green, red or muted grey. Each of the three parts can be switched off. The change is against the previous
   available report. Numbers follow DEC-007 (no thousands separator).
6. "Customize view" opens a panel above the table with three groups of switches: ETFs, value columns, changes (absolute, percent,
   arrow). Choices are saved (US-047) and the table shows exactly what is chosen.
7. Themes: a light theme and a dark slate theme (not near-black), switchable, remembered. Both pass WCAG AA contrast.
8. Empty and error states use the same card, with a short message and no raw exception text.

## Tokens (from the mockup, light / dark)
bg #eef1f6 / #1c2433 · panel #ffffff / #232d40 · table head #f5f7fb / #293449 · line #dde3ee / #36435c · text #1b2433 / #e8edf6 ·
muted #5d6b82 / #a3b0c6 · accent #1f6feb / #6aa9ff · gain #0f8a4b / #3fcf8e · loss #d1323f / #ff6b78 · hover #f1f5fd / #2b374e ·
radius 12 px card, 8 px buttons · system UI font, 15 px base, 12 px labels.
