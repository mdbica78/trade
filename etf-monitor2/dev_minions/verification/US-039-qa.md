# US-039 QA procedure — Sprint 9 visual baseline

Drafted AC1–AC7 (FR15) are for PO confirmation. Codex records results in
`US-039-qa-run.md`; this document is instructions, **not** evidence that captures
or contrast checks have been executed. Do not run git, deploy, touch Neon, read
secrets, or install a browser/package in this project.

## 1. Setup and teardown

From the project root in WSL, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`,
`GEMINI_API_KEY`, `GROQ_API_KEY` unset (do not print values), run `pnpm typecheck`,
`pnpm lint`, `pnpm test`, and `pnpm build`; quote command, exit code and output
tail for each. Build first because both the fixture and server need its CSS.
Run `pnpm exec tsx scripts/qa/render-home.tsx` to generate the four static
RO/EN × light/dark filled-table pages under ignored `.qa-render/home/`.
Run `bash scripts/claude/qa-serve.sh start` for a no-DB app at
`http://127.0.0.1:3100`; use this script only, never `pnpm dev` or `pnpm start`.
**Always** run `bash scripts/claude/qa-serve.sh stop` in cleanup, including
after any failure. A local unavailable DB deliberately shows safe empty/error
states, not live ETF values. Never commit screenshots or use files inside the
project as browser scratch space. Save captures outside the project, e.g.
`/tmp/etf-qa-screens/US-039/` in WSL or the QA browser's external scratch area.

## 2. Eighty individually numbered captures (AC1, AC2)

The ten routes below correspond to every current `app/**/page.tsx`; dynamic
segments use `BTBETRETF`. **Each row is one capture**, not a combined screenshot.
Columns: ID, route, locale, width in px, theme. Height 800 px except the
reference captures in §3. Capture a full page plus note any horizontal overflow.

| ID | Route | Locale | Width | Theme |
|---:|---|---|---:|---|
| 01 | `/` | ro | 375 | light |
| 02 | `/` | ro | 375 | dark |
| 03 | `/` | ro | 1280 | light |
| 04 | `/` | ro | 1280 | dark |
| 05 | `/` | en | 375 | light |
| 06 | `/` | en | 375 | dark |
| 07 | `/` | en | 1280 | light |
| 08 | `/` | en | 1280 | dark |
| 09 | `/etf/BTBETRETF` | ro | 375 | light |
| 10 | `/etf/BTBETRETF` | ro | 375 | dark |
| 11 | `/etf/BTBETRETF` | ro | 1280 | light |
| 12 | `/etf/BTBETRETF` | ro | 1280 | dark |
| 13 | `/etf/BTBETRETF` | en | 375 | light |
| 14 | `/etf/BTBETRETF` | en | 375 | dark |
| 15 | `/etf/BTBETRETF` | en | 1280 | light |
| 16 | `/etf/BTBETRETF` | en | 1280 | dark |
| 17 | `/admin` | ro | 375 | light |
| 18 | `/admin` | ro | 375 | dark |
| 19 | `/admin` | ro | 1280 | light |
| 20 | `/admin` | ro | 1280 | dark |
| 21 | `/admin` | en | 375 | light |
| 22 | `/admin` | en | 375 | dark |
| 23 | `/admin` | en | 1280 | light |
| 24 | `/admin` | en | 1280 | dark |
| 25 | `/admin/etfs` | ro | 375 | light |
| 26 | `/admin/etfs` | ro | 375 | dark |
| 27 | `/admin/etfs` | ro | 1280 | light |
| 28 | `/admin/etfs` | ro | 1280 | dark |
| 29 | `/admin/etfs` | en | 375 | light |
| 30 | `/admin/etfs` | en | 375 | dark |
| 31 | `/admin/etfs` | en | 1280 | light |
| 32 | `/admin/etfs` | en | 1280 | dark |
| 33 | `/admin/etfs/BTBETRETF/fields` | ro | 375 | light |
| 34 | `/admin/etfs/BTBETRETF/fields` | ro | 375 | dark |
| 35 | `/admin/etfs/BTBETRETF/fields` | ro | 1280 | light |
| 36 | `/admin/etfs/BTBETRETF/fields` | ro | 1280 | dark |
| 37 | `/admin/etfs/BTBETRETF/fields` | en | 375 | light |
| 38 | `/admin/etfs/BTBETRETF/fields` | en | 375 | dark |
| 39 | `/admin/etfs/BTBETRETF/fields` | en | 1280 | light |
| 40 | `/admin/etfs/BTBETRETF/fields` | en | 1280 | dark |
| 41 | `/admin/ai` | ro | 375 | light |
| 42 | `/admin/ai` | ro | 375 | dark |
| 43 | `/admin/ai` | ro | 1280 | light |
| 44 | `/admin/ai` | ro | 1280 | dark |
| 45 | `/admin/ai` | en | 375 | light |
| 46 | `/admin/ai` | en | 375 | dark |
| 47 | `/admin/ai` | en | 1280 | light |
| 48 | `/admin/ai` | en | 1280 | dark |
| 49 | `/admin/cron` | ro | 375 | light |
| 50 | `/admin/cron` | ro | 375 | dark |
| 51 | `/admin/cron` | ro | 1280 | light |
| 52 | `/admin/cron` | ro | 1280 | dark |
| 53 | `/admin/cron` | en | 375 | light |
| 54 | `/admin/cron` | en | 375 | dark |
| 55 | `/admin/cron` | en | 1280 | light |
| 56 | `/admin/cron` | en | 1280 | dark |
| 57 | `/admin/operations` | ro | 375 | light |
| 58 | `/admin/operations` | ro | 375 | dark |
| 59 | `/admin/operations` | ro | 1280 | light |
| 60 | `/admin/operations` | ro | 1280 | dark |
| 61 | `/admin/operations` | en | 375 | light |
| 62 | `/admin/operations` | en | 375 | dark |
| 63 | `/admin/operations` | en | 1280 | light |
| 64 | `/admin/operations` | en | 1280 | dark |
| 65 | `/chat` | ro | 375 | light |
| 66 | `/chat` | ro | 375 | dark |
| 67 | `/chat` | ro | 1280 | light |
| 68 | `/chat` | ro | 1280 | dark |
| 69 | `/chat` | en | 375 | light |
| 70 | `/chat` | en | 375 | dark |
| 71 | `/chat` | en | 1280 | light |
| 72 | `/chat` | en | 1280 | dark |
| 73 | `/health` | ro | 375 | light |
| 74 | `/health` | ro | 375 | dark |
| 75 | `/health` | ro | 1280 | light |
| 76 | `/health` | ro | 1280 | dark |
| 77 | `/health` | en | 375 | light |
| 78 | `/health` | en | 375 | dark |
| 79 | `/health` | en | 1280 | light |
| 80 | `/health` | en | 1280 | dark |

Before navigation set the `NEXT_LOCALE=ro` or `NEXT_LOCALE=en` cookie for
`127.0.0.1`; for the theme set `localStorage.setItem('etf-theme','light')`
or `'dark'` on that origin and **reload**. Confirm `<html data-theme>` matches.
Once per theme, use the header toggle and reload to prove persistence; restore
the theme before the next capture. Never use a query parameter as a locale
substitute. Screenshot path: `<external scratch>/US-039/<ID>.png`.

## 3. Four design-reference captures (AC3, AC4)

Use English (`NEXT_LOCALE=en`) for all four, in addition to the 80 captures.
After `pnpm build`, open `.qa-render/home/home-en-light.html` and
`home-en-dark.html` (with the copied `build-*.css`) for the filled table and
open Customize panel; capture the live `/` through `qa-serve.sh` for the
header and the empty/error card. Pair reference captures as follows:

| ID | Size, state and sources | Approved PNG |
|---|---|---|
| D1 | ~1200×560 light; fixture table + live `/` header/card | `dev_minions/backlog/home-design/mockup-home-light.png` |
| D2 | ~1200×560 dark; fixture table + live `/` header/card | `dev_minions/backlog/home-design/mockup-home-dark.png` |
| D3 | ~1200×560 dark with Customize open; fixture panel/table + live header | `dev_minions/backlog/home-design/mockup-home-dark-customize.png` |
| D4 | 390 px wide dark; fixture panel/table + live header | `dev_minions/backlog/home-design/mockup-home-phone.png` |

**Open each PNG and compare its corresponding capture before saying MATCH.**
Inspect layout/order, spacing rhythm, hierarchy, table header/body alignment,
first-cell symbol/PDF/name, change-line second row, hover and active nav pill.
Exact pixels, sample values, and the illustration note need not match.
AA-adjusted colours, DEC-007 and P7 number signs/decimals, P5 date locale,
and the real `etfs.name` are shipped rules, not deviations. Two explicit phone
corrections: header never overlaps, and dates/numbers never wrap (the phone
PNG's broken date is a defect, not a target). For **each** D1–D4 record
`MATCH` or `DEVIATION: <what, why>`; when images cannot be viewed, record
one JUDGMENT item and **no** MATCH.

## 4. In-page contrast for each of the 80 captures (AC2)

In a scriptable browser, run this complete browser-evaluate snippet **after
each capture**, supplying `route` and `theme` as page-evaluate arguments. For
example, `await page.evaluate(({route, theme}) => { /* body below */ },
{route, theme})`. The following is the full body, not a project file:

```js
const failures = [];
const rgb = (s) => {
  const m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/);
  if (!m) throw new Error(`Unsupported computed colour: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
};
const over = (front, back) => {
  const a = front[3], opacity = a + back[3] * (1 - a);
  return [0, 1, 2].map((i) => (front[i] * a + back[i] * back[3] * (1 - a)) / opacity)
    .concat(opacity);
};
const surface = (el) => {
  const ancestors = [];
  for (let node = el; node; node = node.parentElement) ancestors.unshift(node);
  let colour = [255, 255, 255, 1]; // canvas behind transparent <html>
  for (const node of ancestors) colour = over(rgb(getComputedStyle(node).backgroundColor), colour);
  return colour;
};
const luminance = (colour) => {
  const c = colour.slice(0, 3).map((n) => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
};
const ratio = (a, b) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const selector = (el) => {
  const parts = [];
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    parts.unshift(`${node.localName}:nth-child(${Array.from(node.parentElement.children).indexOf(node) + 1})`);
  }
  return `body > ${parts.join(" > ")}`;
};
const visible = (el) => {
  const s = getComputedStyle(el);
  return el.getClientRects().length > 0 && s.visibility === "visible" && s.display !== "none";
};
const translucentGroup = (el) => {
  for (let node = el; node; node = node.parentElement) {
    if (Number(getComputedStyle(node).opacity) < 1) return node;
  }
  return null;
};
for (const el of document.body.querySelectorAll("*")) {
  if (!visible(el) || !Array.from(el.childNodes).some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
  const style = getComputedStyle(el), bg = surface(el), fg = over(rgb(style.color), bg);
  const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
  const floor = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
  const measured = ratio(fg, bg);
  const group = translucentGroup(el);
  if (group) {
    failures.push({route, theme, selector: selector(el), text: el.textContent.trim().slice(0, 60),
      foreground: style.color, background: bg, ratio: null, required: floor,
      error: `Unverified group opacity at ${selector(group)}; computed contrast ${measured.toFixed(2)} is not rendered contrast`});
    continue;
  }
  if (measured < floor) failures.push({route, theme, selector: selector(el), text: el.textContent.trim().slice(0, 60),
    foreground: style.color, background: bg, ratio: +measured.toFixed(2), required: floor});
}
// Press Tab from the page before this evaluation; the first focusable must match :focus-visible.
const focus = document.activeElement;
if (!focus || focus === document.body || !focus.matches(":focus-visible")) {
  failures.push({route, theme, selector: "first focusable", error: "Tab did not produce visible keyboard focus"});
} else {
  const style = getComputedStyle(focus), bg = surface(focus), outline = rgb(style.outlineColor);
  const measured = ratio(over(outline, bg), bg);
  const group = translucentGroup(focus);
  if (group) {
    failures.push({route, theme, selector: selector(focus), foreground: style.outlineColor,
      background: bg, ratio: null, required: 3,
      error: `Unverified focus group opacity at ${selector(group)}; computed contrast ${measured.toFixed(2)} is not rendered contrast`});
  } else if (style.outlineStyle === "none" || parseFloat(style.outlineWidth) === 0 || measured < 3) {
    failures.push({route, theme, selector: selector(focus), foreground: style.outlineColor,
      background: bg, ratio: +measured.toFixed(2), required: 3, error: "focus-visible outline"});
  }
}
return failures;
```

The snippet implements WCAG 2.x sRGB linearisation and `(L1+0.05)/(L2+0.05)`.
It composites computed backgrounds from the root to the element (including
translucent backgrounds) against a white browser canvas and composites text
alpha against that surface. Large text means ≥24 px or ≥18.66 px bold; below
4.5:1 normal, 3:1 large, or 3:1 keyboard-focus outline is **FAIL**. Include
route, theme, selector, colours and ratio for every failure. If the browser
cannot execute this evaluation, **do not assert a contrast pass**. Group
opacity on the element or any ancestor changes the rendered colour of both
text and its surface: the snippet deliberately reports such measurements
(including focus outlines) as unverified failures with `ratio: null`, never
as a false PASS. Inspect the actual composite and fix the contrast, or report
the affected capture as AUTO-PARTIAL; do not report a PASS from the
uncomposited ratio. Any element without opacity remains subject to the
normal numeric thresholds.

## 5. Verdict, three browser environments and fallback (AC4–AC7)

In `US-039-qa-run.md` write **one row per 01–80 plus D1–D4** with ID, route,
locale, width, theme, screenshot path, contrast PASS or failing elements,
and D1–D4 `MATCH`/`DEVIATION: <what, why>` (or unverified). For each AUTO or
AUTO-PARTIAL check quote exact command, exit code and output tail, not someone
else's counts. A contrast failure is a **FAIL**, reopens US-039 and is fixed
in the development loop by adjusting the responsible token in `app/globals.css`
and adding that pair to US-035's contrast test; if no token pair caused it,
use the smallest stylesheet correction instead, never weaken a test.

- **Scriptable browser already available outside the project:** run all 80
  screenshots, set locale/theme, press Tab, run §4 on every capture. Repeat
  the contrast evaluation on the four design captures when possible.
- **Screenshot-only browser:** capture what it can; report locale/theme cases
  it cannot set and the unrun in-page contrast as **one AUTO-PARTIAL** item,
  specifying precisely which captures/checks remain. Do not infer contrast
  from screenshots. Run the offline contrast test below.
- **No browser:** report the entire capture matrix, interactive theme/locale
  and in-page contrast as **one AUTO-PARTIAL** item, with paths absent. Still
  run `bash scripts/claude/qa-serve.sh get <each route>` twice for every route
  (default RO and `NEXT_LOCALE=en`), record exit/`STATUS 200` and translated
  safe visible text; run the offline contrast test below. No fabricated MATCH.

In **every** branch run
`pnpm exec vitest run app/globals.contrast.test.ts` and quote its own result.
Do not install Playwright/browser tools into `package.json`, the lockfile or
the repository. A screenshot-only or no-browser result does not claim
unmeasured contrast passed; report the unverified work as AUTO-PARTIAL, not
as a false FAIL. End the "For the user" section with **one non-blocking
JUDGMENT**: "Does the app look right in both themes and on a phone, compared
with `backlog/home-design/`? (screenshots: <actual external paths, or unavailable>)".
Never block the dev story on this preference.

## Files changed (US-039)

- `dev_minions/verification/US-039-plan.md`
- `dev_minions/verification/US-039-qa.md`
- `dev_minions/verification/US-039-review.md` and `US-039-tests.md` after
  independent gates; `dev_minions/status.md`, `dev_minions/HANDOVER.md` for
  delivery state. Codex later writes only `US-039-qa-run.md`, its own board
  row and its HANDOVER log section. No application, tests, migration,
  dependency manifest or lockfile changed for this story.
