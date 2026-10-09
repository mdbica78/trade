# UI design review — sync note for the Technical Lead, QA and dev loop

*Written by the PO chat, 2026-09-28. Read by: Technical Lead chat, Codex QA loop, dev loop (via `status.md`).*

## What happened
On 2026-09-28 at about 06:56 the user had an independent UI designer restyle the app. Nobody told the Technical Lead,
QA or the dev loop. The work is in the tree and shows up as one batch of file writes within about 8 seconds that no
agent recorded:

- `app/globals.css` (new dark "trading terminal" theme: colour tokens, table, form and status styling) and `app/admin/layout.tsx`
- `components/`: `AppHeader`, `HomeTable`, `EtfDetail`, `FieldChart`, `admin/*` (Nav, ActionForm, ActionMessage, EtfAdmin,
  TrackedFieldsAdmin, AiSettingsAdmin, CronAdmin, OperationsDashboard), `chat/*` (ChatPanel, ChatReply, ChatView)
- `app/page.tsx`, `app/health/page.tsx`, `app/etf/[symbol]/page.tsx` (later overwritten by the US-032 dev-loop run)

No test file was touched by the designer.

## Correction to the Sprint 8 record
`sprint-08.md`, `HANDOVER.md`, `US-032.md` and `DEMO-20260928-1300.md` say five `app/` files were rewritten "by
something that is not an agent (most likely a git operation by the user)". That is very likely the designer, not git.
The build failure has the same origin: the designer's `app/health/page.tsx` was built from a copy that predates US-031,
so it lost the timeout branch (`TS2339` on `status.error`). The Technical Lead's one-line patch and US-032 repaired it.
The cross-check in US-032 AC4 only covers files from US-029..031, so it did not look at the roughly 17 component files.

## Is there a collision? Verdict: no functional collision, but three process gaps
Checked, with evidence:

| Check | Result |
|---|---|
| Tests | The user's own `pnpm test` (`pnpm_test.ouput`, about 07:35, after the restyle): 1680 passed, 3 failed. The 3 are `HP-F2` (ro, en), fixed by US-032, and `CPS-1` (5 s timeout under load), addressed by US-034. None is caused by the design. |
| Designer's method | CSS-first. Global rules on bare elements and existing `data-*` attributes, `className` only where tests allow. This is why nothing broke. |
| Codex QA | Every UI story's QA PASS (US-016..031) ran before the restyle (last ones about 06:52). No QA run has seen the new look. |
| Requirements | FR8 asks for charts "similar stylistically to bvb.ro". The chart is now cyan on near-black. Already an open user judgment call in `status.md`. |

Gaps:
1. **Record.** No DEC or requirement describes the theme, so the next agent may "fix" the look back or fight it.
2. **QA coverage.** No verified check for the new look in RO/EN, on a phone width, or on the admin and chat pages.
3. **Design ceiling.** Exact-markup tests (e.g. `HomeTable.test.tsx:168` expects `<td>11.171</td></tr>`) stop any change beyond CSS.

## Defects found in the designer's work (small, fixable in one story)
- `--text-dim` (`#566173`) has contrast 2.9:1 on panels and 2.8:1 on table headers. It is used for the 11 px uppercase
  table headers, "flat" deltas (`.delta-flat`), stale log entries and the chart tooltip date. WCAG AA needs 4.5:1.
  `#78849a` gives about 4.6:1 to 4.9:1 on the same backgrounds.
- The home table has no horizontal-scroll wrapper (`app/page.tsx`; the history table on the detail page has one).
  With several tracked fields the page scrolls sideways on a phone.
- `table { overflow: hidden; border-radius }` most likely does not round the corners, because the table uses
  `border-collapse: collapse`. Cosmetic.
- `FieldChart.tsx` hard-codes the theme hex values instead of using the tokens; they will drift.
- Some selectors depend on cell position (`tr[data-run-end] td:nth-child(3)`, `td:first-child > span:not([class])`).
  Any column reorder in the operations dashboard silently changes the colouring.
- The theme is dark only (`color-scheme: dark`). Fine if intended, but it was not a decision.

I did not render the pages, so this is from code and colour maths, not from looking at them.

## PO decision
1. **Keep the restyle.** Do not revert it and do not start a full design sprint now.
2. **Adopt it formally** with a small sprint (proposed below), because it needs a decision record and QA coverage.
3. **A bigger design sprint happens only if the designer's written review asks for markup or layout changes**
   (sortable or sticky table, mobile card layout, sparklines in the home table, KPI tiles). That review is not in the
   repo. Give it to the PO and the Technical Lead first. If it contains those, the sprint is: Technical Lead reviews
   the spec, stories update the exact-markup tests on purpose, dev loop builds.

## Proposed Sprint 9 — UI adoption (PROPOSED, not in `roadmap.md`, do not start until the user confirms)
- **US-035 — Adopt the visual layer.** Technical Lead records DEC-020: design tokens live in `globals.css`; where a test
  fixes the markup, style through the stylesheet; changing exact-markup tests is allowed only inside a design story.
  Fix: `--text-dim` contrast, a scroll wrapper on the home table, `FieldChart` colours read from the tokens.
- **US-036 — Visual QA baseline.** Codex captures the RO and EN views of `/`, `/etf/<symbol>`, `/admin/*`, `/chat`,
  `/health` at 375 px and 1280 px, plus the axe or Lighthouse contrast result, and leaves the "does it look right" question
  to the user as one `JUDGMENT` item. Only needs `qa-serve.sh`, no database.
- **US-037 — Only if the designer's review asks for it.** Markup-level design changes, detailed after the Technical Lead
  reads that review.

## Who does what
- **User:** hand over the designer's written review if one exists; confirm Sprint 9; tell any agent if the theme
  (dark only, cyan accent) was deliberate.
- **Technical Lead chat:** correct the Sprint 8 attribution; review this note; write DEC-020 if the user confirms.
- **Codex QA:** nothing to change now. When US-032..034 are QA'd, note that the look changed since earlier PASS runs.
- **Dev loop:** do not restyle or "restore" anything under `components/` or `app/globals.css` until US-035 is detailed.
