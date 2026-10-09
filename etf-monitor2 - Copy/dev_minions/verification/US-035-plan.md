# US-035 plan: adopt the visual layer (tokens, two themes, contrast, header, chart colours)

> story-planner, 2026-09-28. Binding text: DEC-020 §1–§8 and §10 (Decided), sprint-09 "Decisions needed" P-5 (isolated
> default) and D-5 (Decided). The design reference `backlog/home-design/` was opened while planning: the spec, the four
> PNGs and `mockup-home.html` (the source of the token values).
> No schema change, no migration, no new dependency (no theme library, no DOM test environment, no CSS parser package).

Nothing TECHNICAL is open, and P-5 ships its isolated default. **Not blocked.**

## 0. What the reference shows (the parts US-035 owns)

Looked at `mockup-home-light.png`, `mockup-home-dark.png`, `mockup-home-dark-customize.png` and `mockup-home-phone.png`.
- **Header** (about 58 px tall, `--panel` background, `--line` bottom border, padding about 12×24 px). On the left, the app name
  in bold with **no logo mark**. In the middle: Home, Chat, Administration, System status. The active item is a pill with the
  `--head` background and bold `--accent` text (the mockup CSS is `.navl.on{background:var(--head);color:var(--accent);font-weight:600}`;
  this is how spec rule 1's "filled pill in the accent colour" is drawn). On the right: a bordered "Light / Dark" button and a
  bordered "RO | EN" control.
- **Page**: `--bg` background. The content column is about 1000 px wide (`main{max-width:1000px;padding:0 16px}`).
- **Card**: `--panel`, a 1 px `--line` border, a 12 px radius, and the table inside it. The head row has a `--head`
  background and 12 px uppercase `--muted` labels.
- **Not owned here**: the "Monitored ETFs" title and Customize button (US-047), the Customize panel (US-047), and the row and
  cell content, PDF button and change line (US-036).
- **Phone PNG**: the header crowds and overlaps at 390 px. That is **not** approved (spec rule 1, DEC-020 §8). Below it
  gets its own layout (§2.4). This is a correction the spec demands, not a deviation.

## 1. Acceptance criteria → tests

Test ids are new. Existing tests stay as they are, except for the named markup assertions in §5 (AC8).
Shared helper: `test/helpers/css.ts` (new, pure, no dependency), described in §2.6.

### AC1: token blocks (FR15; DEC-020 §1; D-5) → `app/globals.tokens.test.ts` (new)
- **TK-1** `app/globals.css` has exactly two rules whose selector is `:root` or `:root[data-theme="dark"]` (after whitespace
  and quote normalisation), one of each.
- **TK-2** Both blocks declare the same set of `--*` names.
- **TK-3** That set contains `--bg --panel --head --line --text --muted --accent --gain --loss --flat --hover --radius
  --focus --chart-1 … --chart-6` (DEC-020 §1) and `--warn` (D-5). No other name is allowed (the list is closed, so a
  forgotten tint fails the test instead of slipping in).
- **TK-4** The light block sets `color-scheme: light` and the dark block sets `color-scheme: dark`. No other rule sets
  `color-scheme` (the old `html { color-scheme: dark }` is gone).
- **TK-5** No alias: outside the two token blocks, a custom property may be declared only inside `@theme`, and only a
  `--font-*` name. So `--background`, `--foreground`, `--color-background` and so on cannot come back.
- **TK-6** Every `var(--name)` used in `app/globals.css`, `app/**/*.tsx` and `components/**/*.tsx` (not tests) resolves
  to a name defined in the token blocks or `@theme`. This is the mechanical proof that the rename (§3) covers every use.
- The "no old token name anywhere" part of AC1 is **CL-3** (below).

### AC2: contrast (FR15 "WCAG AA"; DEC-020 §3) → `app/globals.contrast.test.ts` (new)
- **CT-1** Every token used in a pair is a plain hex colour (`#rgb` or `#rrggbb`). A `color-mix(...)` or `var(...)` value
  fails, so no token can dodge the check.
- **CT-2** For each theme: each text token `--text --muted --accent --gain --loss --flat --warn` on each surface
  `--bg --panel --head --hover` must reach **≥ 4.5:1**. That is 28 pairs per theme.
- **CT-3** For each theme: `--panel` text on an `--accent` fill (primary submit buttons, §2.5) must reach **≥ 4.5:1**. This
  is D-5's "text on an extra surface" pair.
- **CT-4** For each theme: `--focus` on each of the four surfaces must reach **≥ 3:1**, and each `--chart-1..6` on `--panel`
  must reach **≥ 3:1**.
- **CT-5** "Adjusted, keeping the hue": for each DEC-020 §1 colour token that also appears in the spec's token line, the
  shipped value either equals the mockup value or has the same HSL hue within ±8°. The mockup values sit in the test as a
  table copied from `home-design-spec.md`. A failure message lists every failing pair with its ratio, so one run shows
  everything that needs to change.
- **CT-6** Self-check: the same pair checker, run on a synthetic token map `{text:"#777777", bg:"#888888"}`, reports a
  failure. `contrastRatio("#000000","#ffffff")` is 21 (±0.01), `contrastRatio("#777777","#ffffff")` is 4.48 (±0.01, the
  known WCAG example), and the old `#566173` on `#10151d` is below 4.5.

### AC3: header (FR15; DEC-020 §8; spec rule 1) → `components/AppHeader.layout.test.tsx` (new) + `components/header-nav.test.ts` (new)
The render tests mock `next/navigation`'s `usePathname`, in RO and EN.
- **AH-L1** Markup order is: the app-name link, then `<nav data-app-nav>`, then the theme toggle (`data-theme-toggle`), then
  the language `<form aria-label=…>`. Checked by `indexOf`.
- **AH-L2** The nav holds exactly four links in the order `/`, `/chat`, `/admin`, `/health`, with the texts
  `Nav.home/chat/admin/health` of that locale. The key set in the catalogues is unchanged.
- **AH-L3** For `usePathname()` equal to `/`, `/chat`, `/admin/etfs` and `/health`, exactly one nav link carries
  `aria-current="page"`: Home, Chat, Administration and System status in turn. For `/etf/BTBETRETF` and for `null`, no link
  carries it.
- **AH-L4** Each nav link has `aria-label="<label>"`, so the accessible name survives when the visible label is hidden on a
  phone.
- **AH-L5** The RO render contains none of the EN nav or toggle texts, and the EN render contains none of the RO ones.
- **HN-1..HN-4** (`header-nav.test.ts`) test the pure `isNavActive(href, pathname)`. `/` is active only for exactly `/`.
  Any other href is active for itself and its sub-paths (`/admin` for `/admin/cron`), but not for a prefix clash (`/adminx`).
  A `null` pathname makes nothing active.
- **Stylesheet part** (`app/globals.rules.test.ts`, **GR-4**): a rule `[data-app-nav] a[aria-current="page"]` sets `background`
  to `var(--head)` and `color` to `var(--accent)`, and a `:focus-visible` rule sets `outline` using `var(--focus)`.
- **MANUAL-QA**: at 390 px, the labels collapse to icons and nothing overlaps. Compared with `mockup-home-phone.png` under AC9.

### AC4: theme module and toggle (FR15 "switchable"; DEC-020 §2; P-5) → `lib/theme.test.ts` (new), `components/ThemeToggle.test.tsx` (new), `app/layout.test.tsx` (new)
- **TH-1** `resolveTheme("light", x)` returns `light` and `resolveTheme("dark", x)` returns `dark`, whatever the system
  preference `x` is.
- **TH-2** With no stored value (`null`), it follows the preference (`light` or `dark`). With no preference either, it
  returns `dark` (P-5).
- **TH-3** An invalid stored value (`"blue"`, `""`, `"DARK"`) is ignored, and the preference or default applies.
- **TH-4** `readStoredTheme` returns `null` and does not throw in two cases: a `getStorage` that throws (as `window.localStorage`
  does when storage is blocked), and a storage whose `getItem`, `setItem` and `removeItem` all throw. `writeStoredTheme` does
  not throw with either.
- **TH-5** `readSystemPreference` returns `null` with no `matchMedia`, and also when `matchMedia` throws. It returns
  `light` or `dark` from the fake matches.
- **TH-6** `toggleTheme({ root, getStorage })` works on a fake root. From `dark` it sets `light`. From `light`, a missing
  attribute or an invalid attribute it sets `dark` (a missing attribute means the `:root` light block is showing). It stores
  the new value. With a throwing storage it still flips the attribute and does not throw.
- **TH-7** `THEME_INIT_SCRIPT` contains the literal `"etf-theme"` and uses `DEFAULT_THEME` (checked by interpolation, not by
  a copy).
- **TH-8** Equivalence: the script runs in `node:vm` against a fake `window`/`document` for a matrix of cases: stored
  valid/invalid/none × preference light/dark/none × storage ok/throwing × `matchMedia` present/absent/throwing. The
  `data-theme` it sets equals `resolveTheme(...)` for the same inputs, and it never throws. This proves the inline script is
  "built from the same module" in behaviour, not just by name.
- **TT-1** (`ThemeToggle.test.tsx`) In RO and EN it renders a `<button type="button" data-theme-toggle …
  aria-label="<Theme.toggleLabel>">` with the visible `Theme.toggleText`, and not the other locale's text.
- **TT-2** Source scan: `components/ThemeToggle.tsx` starts with `"use client"`, imports `toggleTheme` from `@/lib/theme`,
  and has no `useState`/`useEffect` that depends on the theme. Its render does not depend on the theme, so there is no
  hydration mismatch (§2.3).
- **RL-1** (`app/layout.test.tsx`) This test mocks `next-intl/server` and `@/components/AppHeader`. The element returned by
  `RootLayout` is `html` with `suppressHydrationWarning === true` and **no** `data-theme` prop, so React never owns the
  attribute.
- **RL-2** Its `<head>` child holds a `<script>` whose `dangerouslySetInnerHTML.__html === THEME_INIT_SCRIPT`, and that
  script comes before `<body>`.
- **RL-3** `app/layout.tsx` has no `next/font` import (the system UI font, §2.1).

### AC5: `FieldChart` palette (FR8.2; DEC-020 §4) → `components/FieldChart.palette.test.tsx` (new), same Recharts mock as the existing file
- **FP-1** The `Line` has `stroke` `var(--chart-1)`, a `dot.fill` of `var(--chart-1)`, an `activeDot.fill` of
  `var(--chart-1)` and an `activeDot.stroke` of `var(--panel)`.
- **FP-2** `CartesianGrid.stroke` is `var(--line)`. On `XAxis` and `YAxis`, `stroke` is `var(--line)` and `tick.fill` is
  `var(--muted)`.
- **FP-3** The tooltip markup (from `ChartTooltipContent`) uses `var(--panel)` for its background, `var(--line)` for its
  border and `var(--muted)` for the date.
- **FP-4** Source scan of `components/FieldChart.tsx` finds no hex, `rgb(`, `rgba(`, `hsl(`, `hsla(` or `oklch(`. This
  overlaps with CL-1 on purpose: AC5 names the file.
- The existing `components/FieldChart.test.tsx`, including FC-TT1..4, stays **unedited** and must pass.

### AC6: no positional meaning (DEC-020 §5) → `app/globals.rules.test.ts` (new) + two hook tests (new files)
- **GR-1** Some rules have a selector containing `:nth-child`, `:nth-of-type`, `:first-child`, `:last-child`,
  `:nth-last-child`, `:only-child` or `:not([class])`. None of them sets `color`, `background` or `background-color`, or any
  `border*` or `outline*` property whose value contains `var(--` or a colour literal. That last part goes beyond the story
  (it adds and drops nothing).
- **GR-2** Hook rules exist:
  - `tr[data-run-end="running|did-not-finish|finished"] [data-run-status]` sets `color` to `var(--accent)`, `var(--loss)`
    and `var(--gain)` respectively;
  - `[data-extraction-unavailable]` sets `color` to `var(--warn)`.
- **GR-5** Self-check: GR-1's checker flags the old rule `td:first-child > span:not([class]) { color: var(--warn) }` when
  given it as a string.
- **OH-1** (`components/admin/OperationsDashboard.hooks.test.tsx`) Each run row's status cell carries `data-run-status`, and
  the cell text is still the translated status label (same fixture shape as the existing test).
- **HH-1** (`components/HomeTable.hooks.test.tsx`) The no-adapter row's marker `<span>` carries `data-extraction-unavailable`
  and still contains ` (<Home.extractionUnavailable>)`, in RO and EN.
- The existing `OperationsDashboard.test.tsx` `data-run-end`/`data-run-id` regexes and the `HomeTable.test.tsx` text
  assertions pass unchanged. The one exception is the exact-markup string in §5.

### AC7: scroll wrapper (DEC-020 §7) → `app/page.wrapper.test.tsx` (new) + `app/globals.rules.test.ts`
- **PW-1** With the loader mocked to return one row, the page HTML has a `<div data-table-scroll="">` that opens before
  `<table` and closes after `</table>`.
- **PW-2** The error and empty states render inside the same wrapper. This goes beyond the story, following spec rule 8
  ("Empty and error states use the same card").
- **GR-3** The `[data-table-scroll]` rule sets `overflow-x: auto`, `border-radius: var(--radius)`, a `border` with
  `var(--line)` and `background: var(--panel)`. `[data-table-scroll] > table` sets a `min-width`. The bare `table` rule
  has no `border-radius` and no `overflow`.

### AC8: existing tests unchanged except named markup (DEC-020 §6) → review check, plus the full `pnpm test`
- The expected deliberate markup changes are listed in §5. The implementer records each one in HANDOVER as
  `deliberate markup change: <test>, <old>, <new>, <reason>`.
- No other existing test file is edited. New tests go in **new files**, so FieldChart, OperationsDashboard and HomeTable
  tests stay untouched apart from §5.

### AC9: design reference (DEC-020 §10) → dev-loop check + MANUAL-QA
- Before closing, the dev loop opens the four PNGs again and writes four lines in the story's HANDOVER section. They cover
  only the header, the page background, the theme colours and the card/table frame (story AC9 scope). §0 lists what each
  PNG is compared on. Expected lines:
  - light: MATCH;
  - dark: MATCH;
  - dark-customize: MATCH for the header, background and card; the panel is US-047's;
  - phone: MATCH, with the header on two rows as the spec requires. Not a deviation.
- Any real difference is written as `DEVIATION: <what, why>`.
- **MANUAL-QA (Codex)**: capture `/` in EN at about 1200×560 in light and in dark, and at 390 px wide (the panel capture is
  US-047's; for this story it is the dark capture with the panel closed). Compare each capture with its PNG and record
  MATCH/DEVIATION, or one JUDGMENT item if images cannot be viewed. Then check that:
  - the toggle flips the theme with no reload;
  - the choice survives a reload;
  - a reload shows no flash of the other theme;
  - with site storage blocked the page still loads and the toggle still flips the theme (the choice is not remembered);
  - Tab shows a visible focus ring on nav links, the toggle and the RO/EN buttons.

### AC10: bilingual (FR8.1) → TT-1, AH-L5, and the existing `i18n/messages.test.ts` (key parity) unchanged and green
New keys, in both catalogues:

| Key | en | ro |
|---|---|---|
| `Theme.toggleText` | `Light / Dark` | `Luminos / Întunecat` |
| `Theme.toggleLabel` | `Light / Dark: switch the colour theme` | `Luminos / Întunecat: schimbă tema de culori` |

The accessible name starts with the visible text (WCAG 2.5.3, label in name).

### AC11: gates → full run by the tester
- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
  `GEMINI_API_KEY` and `GROQ_API_KEY` unset.
- `package.json` and `pnpm-lock.yaml` are not in "Files changed".
- Removing `next/font/google` also removes the build's font download.

### Literal scan (story Task 5; carried by AC1/AC5) → `app/colour-literals.test.ts` (new)
- **CL-1** Scope: `app/**/*.{css,ts,tsx}` and `components/**/*.{ts,tsx}`, minus `*.test.*` files. For CSS, the bodies of
  the two token blocks are removed first. The scan fails on a hex colour (`#` + 3, 4, 6 or 8 hex digits, not preceded by a
  word character) and on `rgb(`, `rgba(`, `hsl(`, `hsla(`, `hwb(`, `lab(`, `lch(`, `oklab(`, `oklch(` or `color(`.
- **CL-2** In CSS colour properties (`color`, `background*`, `border*`, `outline*`, `fill`, `stroke`, `box-shadow`,
  `text-decoration-color`, `caret-color`, `accent-color`), it also fails on a named colour keyword (`white`, `black`, `red`,
  `green`, `blue`, `gray`, `grey`, `orange`, `yellow`, `purple`, `cyan`, `magenta` …). `transparent`, `currentColor`,
  `inherit`, `none` and `var(--…)` are allowed.
- **CL-3** Old token names are gone. The pattern has `(?![\w-])` after each name: `--bg-panel`, `--bg-elevated`,
  `--bg-hover`, `--border`, `--border-strong`, `--text-muted`, `--text-dim`, `--accent-strong`, `--accent-soft`,
  `--gain-soft`, `--loss-soft`, `--warn-soft`, `--background`, `--foreground`, `--color-background`, `--color-foreground`,
  `--font-geist-sans`, `--font-geist-mono`.
- **CL-4** In TSX, it fails on Tailwind palette classes
  (`(text|bg|border|ring|fill|stroke|outline|divide|from|via|to|shadow|decoration|caret|accent)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?`).
  This is review N1, added.
- **CL-5** Self-check: each detector flags a synthetic offending string (a hex outside a token block, `rgba(0,0,0,.5)`,
  `color: white`, `var(--text-dim)`, `bg-slate-800`). The scan also found at least one file of each kind (css, ts, tsx),
  so it is not vacuous.

## 2. Files and boundaries

### 2.1 `app/globals.css` (rewritten)
Order in the file:
1. `@import "tailwindcss";`
2. `@theme { --font-sans: system-ui, "Segoe UI", Roboto, Arial, sans-serif; --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }`.
   Font stacks only.
3. The `:root` (light) token block.
4. The `:root[data-theme="dark"]` token block.
5. Rules.

Each token block holds every name in TK-3, plus `color-scheme`. **Guidance values** follow; the test decides, and the
implementer adjusts any value the test flags while keeping the hue (CT-5). Values marked * differ from the mockup. The
planner's computed ratios are in brackets.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#eef1f6` | `#1c2433` |
| `--panel` | `#ffffff` | `#232d40` |
| `--head` | `#f5f7fb` | `#293449` |
| `--line` | `#dde3ee` (decorative, exempt, §3) | `#36435c` |
| `--hover` | `#f1f5fd` | `#2b374e` |
| `--text` | `#1b2433` | `#e8edf6` |
| `--muted`, `--flat` | `#56647a`* (mockup `#5d6b82` gives only 4.77:1 on `--bg`; `#56647a` gives about 5.3, which meets DEC-020 §3's "5.0:1 or better") | `#a3b0c6` (≈ 5.4 on `--hover`) |
| `--accent`, `--focus` | `#1a5fd0`* (DEC-020 §3 guidance) | `#6aa9ff` (≈ 4.96 on `--hover`) |
| `--gain` | `#0b7a42`* (DEC-020 §3 guidance) | `#3fcf8e` |
| `--loss` | `#c42836`* (**not in DEC-020's list**: the mockup's `#d1323f` gives only ≈ 4.38:1 on `--bg`, where the `[role=alert]` text sits) | `#ff7f8a`* (DEC-020 §3 guidance) |
| `--warn` | `#8a5a00` (≈ 5.2 on `--bg`) | `#f5a524` (≈ 5.8 on `--hover`) |
| `--chart-1..6` | `#1a5fd0 #c2410c #7c3aed #0f766e #be185d #4d7c0f` (each ≈ 5–6 on `--panel`) | `#6aa9ff #fb923c #c4b5fd #2dd4bf #f472b6 #a3e635` |
| `--radius` | `12px` | `12px` |

Rules. Every colour comes from `var(--…)`, and the only literals left are lengths and keywords.
- **Base**
  - `body`: `--bg` background, `--text` colour, `font-family: var(--font-sans)`, `font-size: 15px`, `line-height: 1.4`,
    and `font-variant-numeric: tabular-nums` (replaces `font-feature-settings`).
  - `* { border-color: var(--line) }`.
  - Links: `--accent`. On hover they underline, with no second accent shade (`--accent-strong` is dropped).
  - `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }`.
- **Labels**: `h3` and `thead th` use 12 px (spec "12 px labels"), uppercase, `--muted`.
- **Tables**: the bare `table` rule keeps `--panel` and a 1 px `--line` border for the admin tables. It loses
  `border-radius` and `overflow: hidden`.
  - `thead th`: background `--head`, bottom border `--line`.
  - `tbody td`: `font-family` inherited, no mono (the reference uses the system font with tabular digits).
  - `tbody tr:hover > td`: background `--hover`.
  - Padding stays as it is: the row padding is US-036's.
- **Card**:
  - `[data-table-scroll]`: `overflow-x: auto`, `background: var(--panel)`, `border: 1px solid var(--line)`,
    `border-radius: var(--radius)`;
  - `[data-table-scroll] > table`: `min-width: 640px`, `margin: 0`, `border: 0`, `background: transparent`;
  - `[data-table-scroll] > p`: `margin: 0`, `padding: 16px`.
- **Hooks**: GR-2's rules, which replace both positional rules.
  - `span[data-extraction-unavailable]` keeps the italic, 0.8125rem and left margin.
  - `li[data-log-entry="stale"]` becomes `--muted` plus italic, so it still reads differently from `etf` entries, which are
    `--muted` too.
  - `.delta-flat` becomes `--flat`.
  - The other `data-*` hooks keep their rules, with the tokens renamed.
- **Buttons** (mockup `button` rule):
  - `button`: `font: inherit`, `--text` on `--panel`, 1 px `--line` border, 8 px radius, padding 6×12, `--hover` on hover.
  - Primary submits (`form:not([aria-label]) button[type="submit"]`) keep today's accent fill: `--accent` background,
    `--panel` text (CT-3). The `#04141a` literal is removed. On hover they change only the text decoration or opacity, with
    no extra token.
  - Language switcher (`form[aria-label]`): one bordered group (`--line`, 8 px radius, `--panel`), with a `--line` divider
    between its two buttons. The current locale (`button[aria-current="true"]`) uses `--head` and `--accent`, like the nav
    pill.
- **Form controls**: `--panel` background, a 1 px `--muted` border (WCAG 1.4.11 non-text contrast; `--muted` is already
  ≥ 4.5:1, so there is no extra token) and 8 px radius. On focus they use the `--focus` outline, which replaces the
  `--accent-soft` shadow.
- **Header hooks**:
  - `[data-app-nav] a`: `--muted`, padding 6×12, 8 px radius, no underline;
  - `[data-app-nav] a:hover`: `--hover` background, `--text` colour;
  - `[data-app-nav] a[aria-current="page"]`: `--head` background, `--accent` colour, `font-weight: 600`;
  - `[data-theme-toggle]`: the base `button` look.
  - These live in the stylesheet, not in Tailwind utilities, because unlayered global rules (`a`, `a:hover`, `button`) beat
    Tailwind's layered utilities. That is why the designer needed `!text-…` today.

### 2.2 `lib/theme.ts` (new, pure; no `window` or `document` at import)
- Constants and types: `THEMES = ["light","dark"] as const`, `type Theme`, `THEME_STORAGE_KEY = "etf-theme"` and
  `DEFAULT_THEME: Theme = "dark"`. `DEFAULT_THEME` is the **P-5 isolated default, in one line**.
- `isTheme(v)` and `resolveTheme(stored: unknown, preference: Theme | null): Theme`.
- `readStoredTheme(getStorage)` and `writeStoredTheme(getStorage, theme)`: every storage access, including the
  `getStorage()` call itself, is inside try/catch.
- `readSystemPreference(matchMedia?)`: tries `(prefers-color-scheme: dark)`, then `light`, inside try/catch.
- `nextTheme(currentAttr)` and `toggleTheme({ root, getStorage })`.
- `THEME_INIT_SCRIPT: string`: a hand-written IIFE. Its only interpolations are `JSON.stringify(THEME_STORAGE_KEY)` and
  `JSON.stringify(DEFAULT_THEME)`, so it contains no user data and has no injection surface. It reads storage and
  `matchMedia` inside try/catch and always sets `document.documentElement`'s `data-theme`. TH-8 pins it to `resolveTheme`.

### 2.3 `components/ThemeToggle.tsx` (new, `"use client"`)
- It renders one `<button type="button" data-theme-toggle aria-label={t("Theme.toggleLabel")}>` containing a single
  theme-independent "half circle" SVG (`aria-hidden`, shown below `sm`) and `<span className="hidden sm:inline">{toggleText}</span>`.
- `onClick = () => toggleTheme({ root: document.documentElement, getStorage: () => window.localStorage })`.
- **Hydration**: the component holds no theme state, and its markup is the same in both themes. It reads the current
  `data-theme` only at click time, from the DOM. So it has nothing to hydrate differently and does not need `useEffect`.

### 2.4 Header: `components/AppHeader.tsx` (changed, stays a server component) + `components/HeaderNav.tsx` (new, `"use client"`) + `components/header-nav.ts` (new, pure)
- **`AppHeader`** renders, in this markup order:
  - the app-name `Link` to `/`: bold text, and the logo mark is removed to match the PNG;
  - `<HeaderNav />`;
  - `<div data-header-controls>` holding `<ThemeToggle />` and the unchanged `<LanguageSwitcher />`.
  - Background `--panel`, border `--line`, `sticky top-0`.
- **Layout**:
  - `sm` and up: a three-column grid (`1fr auto 1fr`) with the nav centred and the controls right-aligned.
  - Below `sm`: `flex-wrap`, with CSS `order` putting the name and the controls on the first row and the icon-only nav on a
    full-width second row. The markup order stays name → nav → controls (AH-L1). This removes the overlap at 390 px.
  - If the RO labels ("Starea sistemului", "Luminos / Întunecat") do not fit at `sm` to `md` widths, the implementer
    moves the label breakpoint to `md` or `lg` and says so in HANDOVER. The rule is no overlap at any width.
- **`HeaderNav`** keeps the four icons from `AppHeader` and the same `links` array order and message keys.
  - It uses `usePathname()` and `isNavActive` from `components/header-nav.ts`, and renders `<nav data-app-nav>`.
  - Each `Link` gets `aria-label={label}` and `aria-current={active ? "page" : undefined}`. The label span keeps
    `hidden sm:inline`.
  - `usePathname` has to be client-side because the root layout does **not** re-render on client navigation, so a
    server-derived active state would go stale.
  - The client part is only the nav. The name link and the language form stay server-rendered.

### 2.5 Token renames in components (story Task 1; the grep of `var(--…)` in `app/` and `components/` is in §3)
- `app/health/page.tsx`, `components/EtfDetail.tsx`, `components/admin/{AiSettingsAdmin,EtfAdmin,CronAdmin,AdminNav,ActionMessage}.tsx`,
  `components/chat/{ChatView,ChatPanel,ChatReply}.tsx`: class-string renames only.
- In chat, the user bubble moves from `--accent-soft` to `--hover` (text contrast is tested), and the reply bubble moves from
  `--bg-elevated` to `--head`.

### 2.6 `components/FieldChart.tsx` (changed)
- Its colour props take `var(--…)` strings (FP-1/FP-2), and the tooltip classes are renamed (FP-3).
- DEC-020 §4 says the colours arrive "through `style` props so they follow a theme switch without a re-render". Recharts
  forwards these props to SVG presentation attributes, and the browser resolves `var()` there at paint time. So the
  purpose of §4 (no re-render on a theme switch) is met without wrapping Recharts in `style` objects that it does not
  forward on every element.
- This is the planner's reading of §4. Codex QA's toggle check confirms the chart recolours live.

### 2.7 Other changes
- **`components/admin/OperationsDashboard.tsx`**: the status cell becomes `<td data-run-status="">` (attribute only).
- **`components/HomeTable.tsx`**: the marker becomes `<span data-extraction-unavailable>` (attribute only, the same hook
  EtfDetail uses). No other change: the rows and cells are US-036's.
- **`app/page.tsx`**: the column changes from `max-w-6xl` to `max-w-[1000px]` and from `py-10` to `py-6` (the reference
  column). `HomeTable` goes inside `<div data-table-scroll="">`.
- **`app/layout.tsx`**:
  - drop `Geist` and `Geist_Mono`;
  - `<html lang={locale} className="h-full antialiased" suppressHydrationWarning>`;
  - `<head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>`;
  - body unchanged.
- **`test/helpers/css.ts`** (new):
  - `stripComments`;
  - `parseRules(css)`: a brace-matching scanner that flattens `@media` and `@theme` and records the at-rule prelude;
  - `getTokenBlocks(css)` and `removeTokenBlocks(css)`;
  - `hexToRgb`, `relativeLuminance` (WCAG 2.x sRGB linearisation, threshold 0.04045), `contrastRatio` and `hslHue`.
  - It is self-tested by **CSS-H1..H3** in `test/helpers/css.test.ts`: the parser works on a small fixture with a comment
    containing `{`, and the known contrast values match.
- **Messages**: `messages/en.json` and `messages/ro.json` get the `Theme` namespace (AC10).

**Boundaries**
- `lib/theme.ts` imports nothing from the app.
- `components/ThemeToggle.tsx` and `HeaderNav.tsx` import only `lib/theme`, `components/header-nav`, `next-intl`,
  `next/link` and `next/navigation`.
- Nothing under `app/` or `lib/` imports `test/helpers/css.ts`.

## 3. Rename list (grep of `var(--…)` in `app/**/*.tsx` and `components/**/*.tsx`, 2026-09-28)

| Old | New | Occurrences |
|---|---|---|
| `--bg-panel` | `--panel` | health/page 24; EtfDetail 52; AppHeader 50; AiSettingsAdmin 33; EtfAdmin 91; CronAdmin 23; ChatView 21 |
| `--border` | `--line` | health/page 24, 34, 46, 50; EtfDetail 52; AppHeader 50; AiSettingsAdmin 33; EtfAdmin 91; CronAdmin 23; ChatView 21; ChatPanel 44; AdminNav 9; FieldChart 38 |
| `--text-muted` | `--muted` | health/page 35, 47, 51, 70; EtfDetail 30; AppHeader 65; AdminNav 14 |
| `--text-dim` | `--muted` | FieldChart 39 (CSS: `thead th`, `li[data-log-entry=stale]`; `.delta-flat` → `--flat`) |
| `--bg-hover` | `--hover` | AppHeader 65; AdminNav 14 |
| `--bg-elevated` | `--head` (`--panel` for the chart tooltip, DEC-020 §4) | ActionMessage 15; ChatReply 25; FieldChart 38 |
| `--accent-soft` | `--hover` (chat bubble); removed (AppHeader logo mark) | ChatPanel 32; AppHeader 52 |
| unchanged | `--radius --text --accent --gain --loss --warn` | health/page, EtfDetail, TrackedFieldsAdmin 51, ChatPanel 33, … |

CSS-only old names (`--border-strong`, `--accent-strong`, `--gain-soft`, `--loss-soft`, `--warn-soft`, `--background`,
`--foreground`, `--color-*`, `--font-geist-*`) are removed as described in §2.1. TK-6 and CL-3 make this list mechanical,
not a promise.

**D-5 outcome.** The only extra token is `--warn`, a text colour tested on all four surfaces. Every tint is replaced by a
§1 surface (`--head` or `--hover`) or by the `--focus` outline, so there is no `color-mix` and review N2 does not apply.

## 4. Data model

None. No schema change and no migration.

## 5. Deliberate markup changes expected (AC8; the implementer confirms each against the real render)

1. `components/HomeTable.test.tsx:52`
   - old: `"<td>NOADAPTER<span>"`
   - new: `"<td>NOADAPTER<span data-extraction-unavailable=\"true\">"` (React renders a boolean `data-*` as `="true"`; check
     the actual string)
   - reason: DEC-020 §5 hook (Task 7).
2. `components/AppHeader.test.tsx` — **only if** `usePathname` throws outside a Next router context. It returns `null` from
   an empty context in `next@16.3.6`'s `navigation.js`, so it is not expected to throw. If it does throw, the change is to
   add `vi.mock("next/navigation", () => ({ usePathname: () => "/" }))`. No assertion changes.
   - reason: header rework (DEC-020 §8).

No other existing assertion is expected to change. If one does, the implementer stops and checks that it is on the markup
AC8 names before editing.

## 6. Risks and the smallest design

- **Light theme for most first-time visitors.** Browsers nearly always report `light` or `dark` (the `no-preference` value
  has left the spec). So P-5's "dark when the browser says nothing" is reached only without `matchMedia`, and a visitor with
  a light OS gets the light theme on first visit. That is the literal P-5 and DEC-020 §2 rule. DEC-020's aside "no visible
  change for anyone who does nothing" therefore does not hold for light-OS users; an information note for the PO is in §7.
- **JavaScript disabled**: no `data-theme`, so the `:root` light block shows. This is acceptable: the two-block shape is
  fixed by DEC-020 §1, and a third `@media` token block would break TK-1.
- **Unlayered CSS beats Tailwind utilities.** Header and toggle styles go through hooks in `globals.css` (§2.1). The
  implementer does not add `!important` utilities for colours.
- **`--muted` and `--flat` share a value.** They stay separate names (DEC-020 §1), so US-036 can change one.
- **Admin tables lose their (never-working) rounded corners.** Only the home card is rounded. Other wrappers are
  `overflow-x-auto` divs, and restyling them is outside this story (DEC-020 §7 names the home table).
- **Recharts `var()` props** (§2.6): if Codex sees the chart not recolouring on a toggle, the fallback is CSS rules in
  `globals.css` on Recharts' `.recharts-cartesian-grid line` and similar. That would be a DEVIATION note, not a new token.
- **Scope held back**:
  - no title row, panel, row click, PDF button or change line (US-047/US-036);
  - no sticky or sortable tables;
  - no per-user theme storage on the server (DEC-020 §2, story Out of scope).

## 7. Decisions needed

| # | Type | Question | Resolution |
|---|---|---|---|
| — | TECHNICAL | Which extra tokens survive (D-5) | Decided in sprint-09 D-5. Applied in §3: only `--warn`, tested on all surfaces. |
| — | PRODUCT | Default theme with no saved choice (P-5) | The isolated default ships: `DEFAULT_THEME = "dark"` and the resolver in `lib/theme.ts`, which the inline script embeds. **Information for the PO, not a new question:** because browsers almost always report a preference, a light-OS visitor sees the light theme on first visit (§6). If the PO wants dark for everyone until they toggle, that is a one-line change to `resolveTheme` (ignore the preference). NEEDS USER only if the PO disagrees. |
| — | TECHNICAL (planner reading, no DEC change) | DEC-020 §4 "style props" for Recharts | Read as the `var(--…)` colour props, which meet §4's stated purpose (§2.6). The reviewer may object; it is not open. |
| — | TECHNICAL (planner reading) | Spec rule 1 "filled pill in the accent colour" | Drawn as the mockup CSS and PNG show: `--head` fill with `--accent` bold text (§0). The token source is binding (DEC-020 §10). |

Nothing TECHNICAL is open.

## 8. Implementation order
1. `test/helpers/css.ts` + CSS-H tests.
2. `app/globals.css` rewrite.
3. TK, CT, GR and CL tests. Iterate the token values until CT passes, and record the final ratios for the four adjusted
   light tokens and the dark `--loss` in HANDOVER.
4. `lib/theme.ts` + TH tests.
5. `app/layout.tsx` + RL tests.
6. `header-nav.ts`, `HeaderNav.tsx`, `ThemeToggle.tsx`, `AppHeader.tsx`, messages, then the AH-L, HN and TT tests.
7. The renames (§3).
8. FieldChart + FP tests.
9. OperationsDashboard and HomeTable hooks + OH-1/HH-1, and the §5 change.
10. `app/page.tsx` wrapper + PW tests.
11. Full gates (AC11) with the variables unset.
12. Open the four PNGs and write the four MATCH/DEVIATION lines (AC9) and the §5 list in HANDOVER.

## 9. Files changed (expected)
- **new**:
  - `lib/theme.ts`, `lib/theme.test.ts`
  - `components/ThemeToggle.tsx`, `components/ThemeToggle.test.tsx`
  - `components/HeaderNav.tsx`, `components/header-nav.ts`, `components/header-nav.test.ts`
  - `components/AppHeader.layout.test.tsx`, `components/FieldChart.palette.test.tsx`
  - `components/admin/OperationsDashboard.hooks.test.tsx`, `components/HomeTable.hooks.test.tsx`
  - `app/layout.test.tsx`, `app/page.wrapper.test.tsx`
  - `app/globals.tokens.test.ts`, `app/globals.contrast.test.ts`, `app/globals.rules.test.ts`, `app/colour-literals.test.ts`
  - `test/helpers/css.ts`, `test/helpers/css.test.ts`
- **changed**:
  - `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/health/page.tsx`
  - `components/AppHeader.tsx`, `components/FieldChart.tsx`, `components/EtfDetail.tsx`, `components/HomeTable.tsx`
  - `components/admin/{OperationsDashboard,AiSettingsAdmin,EtfAdmin,CronAdmin,AdminNav,ActionMessage}.tsx`
  - `components/chat/{ChatView,ChatPanel,ChatReply}.tsx`
  - `messages/en.json`, `messages/ro.json`
  - `components/HomeTable.test.tsx` (§5, one assertion), and possibly `components/AppHeader.test.tsx` (§5, mock only)
- **not touched**: `package.json`, `pnpm-lock.yaml`, `components/FieldChart.test.tsx`,
  `components/admin/OperationsDashboard.test.tsx`, `components/LanguageSwitcher.tsx`, `drizzle/`, `lib/db/`.
