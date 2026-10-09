# US-035 QA checklist — Adopt the visual layer (DEC-020)

Round 1: review PASS (`US-035-review.md`), tests PASS (`US-035-tests.md`). All 11 acceptance
criteria MET (AC9 also carries the MANUAL-QA item below). No new dependency.

## Automated gates (already run by the dev loop, re-run here for the record)
1. `pnpm install --frozen-lockfile` — expect exit 0.
2. `pnpm typecheck` — expect 0 errors.
3. `pnpm lint` — expect 0 errors (9 pre-existing warnings unrelated to this story are acceptable).
4. `pnpm test` — expect all green (180 files / 1842 tests at time of writing).
5. `pnpm build` (offline, `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`GEMINI_API_KEY`/`GROQ_API_KEY`
   unset) — expect exit 0, all 12 routes, no font download (Geist removed).

## MANUAL-QA (Codex, live app) — AC9 design reference + interaction checks
Design reference: `dev_minions/backlog/home-design/` (`home-design-spec.md` +
`mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png`,
`mockup-home-phone.png`). Scope for this story only: header, page background, theme colours,
card/table frame — not the title row/Customize panel (US-047) or row/cell content (US-036).

1. Serve the app, open `/` in EN.
2. Capture at about 1200×560 in **light** theme. Compare header, page background and card frame
   against `mockup-home-light.png`. Record MATCH or `DEVIATION: <what, why>`.
3. Toggle to **dark** theme (click the toggle in the header — no reload). Capture at the same
   size. Compare against `mockup-home-dark.png`, then against `mockup-home-dark-customize.png`
   (header/background/card only — the Customize panel itself is out of scope). Record
   MATCH/DEVIATION for each.
4. Resize/capture at **390px** wide. Compare the header against `mockup-home-phone.png` — expect
   the implementation's corrected two-row header (name + controls on row 1, icon-only nav on row
   2), NOT the PNG's crowded/overlapping single row (that crowding is explicitly not approved,
   DEC-020 §8). Record MATCH (for "no overlap, nothing missing") or DEVIATION.
5. Reload the page after toggling to dark — expect the choice survives the reload with **no
   flash** of the other theme before paint.
6. Block site storage (e.g. block cookies/site data for this origin in the browser, or open a
   private window with storage disabled) and reload — expect the page still loads and the toggle
   still flips the theme live, even though the choice is not remembered across reloads.
7. Tab through the header (nav links, the theme toggle, the RO/EN buttons) — expect a visible
   focus ring (`--focus`) on every stop.
8. Confirm the chart (`/etf/<symbol>`) recolours live when the theme is toggled, with no page
   reload.
9. If any image cannot be viewed, record one JUDGMENT item instead of guessing MATCH.

## Not covered here (other stories)
- Home table row/cell markup, PDF button, change line — US-036.
- Title row, Customize panel — US-047.
- Chart type selector, single-point display — US-038.

## Files changed
- new: `lib/theme.ts`, `lib/theme.test.ts`, `components/ThemeToggle.tsx`, `components/ThemeToggle.test.tsx`,
  `components/HeaderNav.tsx`, `components/header-nav.ts`, `components/header-nav.test.ts`,
  `components/AppHeader.layout.test.tsx`, `components/FieldChart.palette.test.tsx`,
  `components/admin/OperationsDashboard.hooks.test.tsx`, `components/HomeTable.hooks.test.tsx`,
  `app/layout.test.tsx`, `app/page.wrapper.test.tsx`, `app/globals.tokens.test.ts`,
  `app/globals.contrast.test.ts`, `app/globals.rules.test.ts`, `app/colour-literals.test.ts`,
  `test/helpers/css.ts`, `test/helpers/css.test.ts`, `test/helpers/walk-files.ts`
- changed: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/health/page.tsx`,
  `components/AppHeader.tsx`, `components/FieldChart.tsx`, `components/EtfDetail.tsx`,
  `components/HomeTable.tsx`,
  `components/admin/{OperationsDashboard,AiSettingsAdmin,EtfAdmin,CronAdmin,AdminNav,ActionMessage}.tsx`,
  `components/chat/{ChatView,ChatPanel,ChatReply}.tsx`, `messages/en.json`, `messages/ro.json`
- deliberate markup change: `components/HomeTable.test.tsx` line ~52, old
  `"<td>NOADAPTER<span>"` → new `'<td>NOADAPTER<span data-extraction-unavailable="true">'`,
  reason: DEC-020 §5 hook (positional selector removed).
- no change needed to `components/AppHeader.test.tsx` (plan §5 contingency): `usePathname()`
  returns `null` outside a router context in this Next version rather than throwing.

## Note for the PO (not a new decision, informational)
Browsers almost always report a light or dark preference, so a light-OS visitor sees the light
theme on first visit even though P-5's isolated default is dark. Only NEEDS USER if the PO
disagrees with this reading of P-5/DEC-020 §2.

## Stray file (not part of this story's declared change, flagged by review round 1)
`dev_minions/.HANDOVER.md.swp` is an untracked editor swap file in the working tree — harmless,
no secret, no test impact, but should be deleted before the user commits (a version-control
matter, not an agent action).
