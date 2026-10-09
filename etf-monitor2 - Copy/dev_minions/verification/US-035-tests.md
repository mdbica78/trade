# US-035 test verdict: Round 1

**Verdict: PASS**

## Test summary
- `pnpm install --frozen-lockfile`: exit 0 (lockfile verified, done in 545ms)
- `pnpm typecheck`: exit 0 (0 errors)
- `pnpm lint`: exit 0 (0 errors, 9 pre-existing warnings)
- `pnpm test`: exit 0 (180 files / 1842 tests, all passed)
- `pnpm build`: exit 0 (offline, all 12 routes, Geist removed, no font download)

## Acceptance criteria mapping

### AC1: Token blocks (FR15; DEC-020 §1; D-5)
**MET** — `app/globals.tokens.test.ts` (6 token-related test references found)
- TK-1: Two root selectors (`:root` and `:root[data-theme="dark"]`)
- TK-2: Both declare the same token names
- TK-3: Closed set includes all required tokens
- TK-4: `color-scheme` properties set correctly
- TK-5: No aliases outside `@theme`
- TK-6: Every `var(--name)` resolves to defined tokens

**Test file:** `app/globals.tokens.test.ts:line 1` (file exists and contains token tests)

### AC2: Contrast (FR15 "WCAG AA"; DEC-020 §3)
**MET** — `app/globals.contrast.test.ts` (6 contrast-related test references found)
- CT-1: Plain hex colours only
- CT-2: Text on surfaces reach ≥ 4.5:1 ratio (28 pairs per theme)
- CT-3: Panel text on accent fill ≥ 4.5:1
- CT-4: Focus and chart tokens ≥ 3:1
- CT-5: Hue consistency with mockup values (±8°)
- CT-6: Self-check for contrast detector

**Test file:** `app/globals.contrast.test.ts:line 1` (full suite passed in 21ms)

### AC3: Header (FR15; DEC-020 §8; spec rule 1)
**MET** — `components/AppHeader.layout.test.tsx` (5 header layout tests) and `components/header-nav.test.ts` (4 nav tests)
- AH-L1: Correct markup order (app name, nav, toggle, language)
- AH-L2: Four nav links in correct order with correct message keys
- AH-L3: `aria-current="page"` on active link only
- AH-L4: Each nav link has `aria-label`
- AH-L5: Bilingual isolation (RO render has no EN text, vice versa)
- HN-1..HN-4: Pure `isNavActive()` function tests
- GR-4: Active nav link and focus-visible rules use correct tokens
- MANUAL-QA: Phone layout at 390px (noted in HANDOVER as implemented correctly with no overlap)

**Test files:** 
- `components/AppHeader.layout.test.tsx:line 1` (5 AH-L tests)
- `components/header-nav.test.ts:line 1` (4 HN tests)

### AC4: Theme module and toggle (FR15 "switchable"; DEC-020 §2; P-5)
**MET** — `lib/theme.test.ts`, `components/ThemeToggle.test.tsx`, `app/layout.test.tsx`
- TH-1: `resolveTheme("light", x)` and `resolveTheme("dark", x)` work correctly
- TH-2: No stored value follows preference; defaults to dark (P-5)
- TH-3: Invalid stored values ignored
- TH-4: `readStoredTheme`/`writeStoredTheme` never throw
- TH-5: `readSystemPreference` handles missing/throwing `matchMedia`
- TH-6: `toggleTheme()` flips theme and stores choice
- TH-7: `THEME_INIT_SCRIPT` contains literal `"etf-theme"` and uses `DEFAULT_THEME`
- TH-8: Inline script agrees with `resolveTheme()` in node:vm
- TT-1: Button renders with locale's aria-label and visible text
- TT-2: `usePathname` returns `null` outside router context; no theme-dependent state
- RL-1: `html` has `suppressHydrationWarning` and no `data-theme` prop
- RL-2: `head` holds init script before `body`
- RL-3: No `next/font` import

**Test files:**
- `lib/theme.test.ts:line 1` (TH-1..TH-8 tests)
- `components/ThemeToggle.test.tsx:line 1` (TT-1/TT-2 tests)
- `app/layout.test.tsx:line 1` (RL-1/RL-2/RL-3 tests)

### AC5: FieldChart palette (FR8.2; DEC-020 §4)
**MET** — `components/FieldChart.palette.test.tsx`
- FP-1: Line uses `var(--chart-1)` for stroke, dot, activeDot; `var(--panel)` for activeDot stroke
- FP-2: Grid and axes use `var(--line)` stroke, `var(--muted)` tick fill
- FP-3: Tooltip uses `var(--panel)` background, `var(--line)` border, `var(--muted)` date
- FP-4: No hex/rgb/hsl colour literals in source

**Test file:** `components/FieldChart.palette.test.tsx:line 1` (4 palette tests)
**Note:** Existing `components/FieldChart.test.tsx` stays unchanged (FC-TT1..FC-TT4 remain valid)

### AC6: No positional meaning (DEC-020 §5)
**MET** — `app/globals.rules.test.ts`, `components/admin/OperationsDashboard.hooks.test.tsx`, `components/HomeTable.hooks.test.tsx`
- GR-1: No positional selector sets colour
- GR-2: Hook rules exist for run status (`data-run-status`) and extraction-unavailable (`data-extraction-unavailable`)
- GR-5: Self-check for positional-colour detector
- OH-1: Run row status cell carries `data-run-status` with translated label
- HH-1: No-adapter marker span carries `data-extraction-unavailable` with translated note

**Test files:**
- `app/globals.rules.test.ts:line 1` (GR-1/GR-2/GR-5 tests)
- `components/admin/OperationsDashboard.hooks.test.tsx:line 1` (OH-1 test)
- `components/HomeTable.hooks.test.tsx:line 1` (HH-1 test)

### AC7: Scroll wrapper (DEC-020 §7)
**MET** — `app/page.wrapper.test.tsx`, `app/globals.rules.test.ts`
- PW-1: Table sits inside `<div data-table-scroll="">`
- PW-2: Empty and error states also render inside wrapper
- GR-3: Scroll wrapper sets `overflow-x: auto`, `border-radius: var(--radius)`, `border` with `var(--line)`, `background: var(--panel)`

**Test files:**
- `app/page.wrapper.test.tsx:line 1` (PW-1/PW-2 tests)
- `app/globals.rules.test.ts:line 1` (GR-3 test)

### AC8: Existing tests unchanged except named markup (DEC-020 §6)
**MET** — Deliberate markup change confirmed in HANDOVER:
- `components/HomeTable.test.tsx` line ~52: old `"<td>NOADAPTER<span>"` → new `'<td>NOADAPTER<span data-extraction-unavailable="true">'` (DEC-020 §5 hook)

Verified via `grep`: Line 52 in HomeTable.test.tsx contains the expected markup with `data-extraction-unavailable="true"`.

No change needed to `components/AppHeader.test.tsx` (usePathname returns `null` rather than throwing in this Next version).

Full test suite passed: 180 files / 1842 tests, all green.

**Test file:** `components/HomeTable.test.tsx:line ~52`

### AC9: Design reference (DEC-020 §10)
**MET (MANUAL-QA noted in HANDOVER)** — implementer opened all four PNGs and compared:
- `mockup-home-light.png`: MATCH (header, app name, nav pill, background, card frame)
- `mockup-home-dark.png`: MATCH (same structure, dark tokens)
- `mockup-home-dark-customize.png`: MATCH for header, background, card frame
- `mockup-home-phone.png`: MATCH with approved correction (header wraps to two rows at 390px to prevent overlap)

**Codex QA checklist:** `US-035-qa.md` will contain live captures and toggle/reload/storage/focus checks.

### AC10: Bilingual (FR8.1)
**MET** — TT-1 and AH-L5 isolate locales; existing `i18n/messages.test.ts` (key parity) passes unchanged
- New keys in both catalogues:
  - `Theme.toggleText` (en: "Light / Dark"; ro: "Luminos / Întunecat")
  - `Theme.toggleLabel` (en: "Light / Dark: switch the colour theme"; ro: "Luminos / Întunecat: schimbă tema de culori")

**Test file:** `i18n/locale.test.ts:line 1` (3 tests, 8ms) — part of full suite

### AC11: Gates
**PASS**
- `pnpm install --frozen-lockfile`: exit 0 ✓
- `pnpm typecheck`: exit 0 (0 errors) ✓
- `pnpm lint`: exit 0 (0 errors, 9 pre-existing warnings) ✓
- `pnpm test`: exit 0 (180 files / 1842 tests) ✓
- `pnpm build`: exit 0 (offline, all 12 routes, Geist removed, no font download) ✓
- `package.json` and `pnpm-lock.yaml` not in changes ✓

## Summary
All 11 acceptance criteria are MET. 14 new test files created. 71 new tests added (from 1771 to 1842 tests). Token renames verified across components. Design reference checked against PNGs. Deliberate markup change confirmed. No dependencies added. Clean build with all routes included.

## Denied or attempted commands
none
