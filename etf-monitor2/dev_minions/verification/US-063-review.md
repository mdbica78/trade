# US-063 review — Job runs table scrolls

## Round 1

Reviewer: independent (did not write the code). Evidence below is from my own reads and my own run.

Own run: `node_modules\.bin\vitest.cmd run components/admin/OperationsDashboard.test.tsx` → 1 file, 12 tests passed (includes OD-SC1, OD-SC2). Output also shows a next-intl `ENVIRONMENT_FALLBACK` timeZone warning (stderr; pre-existing pattern, not a failure). Typecheck, lint, full suite, offline build: not re-run (tester's gate).

### Acceptance criteria
- **AC1 — MET.** `components/admin/OperationsDashboard.tsx:141` wrapper `max-h-96 overflow-auto [&_th]:sticky [&_th]:top-0 [&_th]:bg-[var(--head)]` (max-h-96 = 24rem; overflow-auto scrolls vertically; sticky header cells on the `th` in `thead`, :152-157). Only `thead th` exist in this table (rows use `td`), so the sticky selector hits only the header. Tests: OD-SC1 (`OperationsDashboard.test.tsx:44-47`) and OD-SC2 (`:60-68`) assert `max-h-96`, `overflow-auto`, `[&_th]:sticky`, `[&_th]:top-0`, `[&_th]:bg-[var(--head)]` (passed in my run). Rendered scroll behaviour itself is class-level evidence only → covered by MANUAL-QA below.
- **AC2 — MET (class-level) / MANUAL-QA for rendered overflow.** `overflow-auto` contains both axes, and `table { width:100% }` is inside the region (`app/globals.css:247-254`), so wide log content scrolls in the region rather than growing the page. OD-SC2 pins `overflow-auto` (not `overflow-y-auto`). No test measures real overflow at a narrow width (jsdom/static markup cannot) → narrow-viewport check is MANUAL-QA.
- **AC3 — MET (markup/tokens) / MANUAL-QA for visual focus.** `:141-145`: `role="region"`, `tabIndex={0}`, `aria-label={t("runsScrollLabel")}`. `messages/en.json:207` "Job runs, scrollable"; `messages/ro.json:207` "Rulările jobului, derulabil" — both present. Focus ring comes from global `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }` (`app/globals.css:137-140`); `--focus` is #1a5fd0 light (:33) / #6aa9ff dark (:57); `app/globals.contrast.test.ts:64-67` (CT-4) asserts ≥3:1 on every surface incl. `--head` in both themes (existing test, not re-run by me). Sticky header background uses `var(--head)` token — no raw colour literal added. Keyboard scrolling and visible focus in a browser: MANUAL-QA.
- **AC4 — MET (with Warning W1).** OD-SC1/OD-SC2 cover bounded/vertical, horizontal-capable overflow, sticky header, `tabindex="0"`, `role="region"`, EN+RO label (`:44-49, :52-70`). The intentional markup change (wrapper, focus hook, label, sticky header) is named in `US-063-plan.md` ("Deliberate test / snapshot changes"). Golden: grep shows no admin golden test references `OperationsDashboard`/`data-runs-scroll`, so no snapshot needs updating. Typecheck/lint/full suite/offline build: not re-run by me.

### Findings
- **Warning W1 — OD-SC2's "focus stays visible" claim is weak.** It only asserts the global `:focus-visible` rule exists in `globals.css` by regex (`:69-70`); it does not prove the region is focusable-and-not-overridden (no `outline-none`/`focus:outline-0` on the region — I verified by reading :141 that none exists) nor that the rule isn't shadowed elsewhere. Acceptable given CT-4 plus MANUAL-QA, but not a direct proof. Non-blocking.
- **Warning W2 — sticky header + `border-collapse: collapse`.** `table` uses `border-collapse: collapse` (`globals.css:249`) and `thead th` carries `border-bottom` (:256-261). In collapsed-border tables, a sticky `th`'s bottom border does not travel with the cell, so the separator line under the header may disappear while scrolling (rows scroll under a header with no divider). Cosmetic only; background is opaque `--head` so no row bleed-through. Verify visually in MANUAL-QA; fix (if wanted) would be a `box-shadow`/pseudo-element divider. Non-blocking.
- **Note N1 —** Global `table { margin: 0.5rem 0 1.5rem }` (`globals.css:250`) applies inside the scroll region, adding ~1.5rem blank space at the bottom of the scroll area and 0.5rem above the header. Cosmetic.
- **Note N2 —** The second/third tables in the same file still use `overflow-x-auto` wrappers (:177, :200) — out of scope of US-063 (only the run-history table is specified).
- **Note N3 —** No `z-index` on sticky `th`; the only positioned/hover-styled cells are `td` with no `position`, so no overlap seen in the markup. No Critical issue found.
- No hard-coded colour literals, no missing locale string, no Critical bugs found.

### MANUAL-QA (for the QA checklist)
1. ≥ ~20 runs: region caps at ~24rem, vertical scroll, header stays pinned in light and dark.
2. Narrow viewport (≈375px): the wide log column scrolls horizontally inside the region; the page itself does not scroll horizontally.
3. Tab to the region: visible focus ring in both themes; arrow/PageUp/PageDown scroll it; screen reader announces the localized label (RO and EN).
4. Check the header divider line while scrolled (W2).

Denied or attempted commands: none.

Verdict: PASS
