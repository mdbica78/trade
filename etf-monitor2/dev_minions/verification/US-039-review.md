# US-039 independent review — Round 1

**Verdict: FAIL**

This was a documentation-only review of the story, plan, QA procedure, and
route inventory. The four design PNGs were opened to verify the stated
pairings. No screenshots, project tests, production resources, or application
behavior were run or treated as evidence.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC1 — Capture matrix | PASS | The route inventory contains the same ten routes as the ten `app/**/page.tsx` files, including concrete `BTBETRETF` examples for both dynamic routes. The table is numbered 01–80 with eight combinations per route (RO/EN × 375/1280 × light/dark); locale cookie, stored theme, toggle/reload, no-DB server, and external screenshot paths are specified (`US-039-qa.md`, §§1–2). |
| AC2 — Contrast algorithm | **FAIL** | The snippet includes sRGB linearisation, WCAG ratio calculation, thresholds, alpha compositing of colors, per-element checks, and a focus-outline check (`US-039-qa.md`, §4). However, it does not account for CSS `opacity` on an element or any ancestor. This makes the calculated foreground/background differ from their rendered colors and can produce a false PASS, including on disabled submit buttons which the current stylesheet renders with `opacity: 0.5` (`app/globals.css:510`). See R1 below. |
| AC3 — Design comparisons | PASS | D1–D4 each name the correct reference PNG and size/theme; the instructions combine the fixture harness with the live no-DB header/card. Required/non-required comparisons, shipped-rule differences, phone-header correction, and no-wrap checks are listed (`US-039-qa.md`, §3). All four PNGs were opened; this verifies the pairings, not that the application matches them. |
| AC4 — Honest verdict/evidence | PASS | The procedure prohibits `MATCH` without opening the image, prescribes `DEVIATION` or unverified results when appropriate, gives the run-verdict table fields, and requires command, exit code, and output evidence for AUTO/AUTO-PARTIAL checks (`US-039-qa.md`, §§3, 5). |
| AC5 — User judgment | PASS | One exact, non-blocking visual JUDGMENT question is required under “For the user,” with actual screenshot paths or unavailable stated (`US-039-qa.md`, §5). |
| AC6 — No-browser fallback | PASS | The no-browser path labels captures and in-page contrast as one AUTO-PARTIAL item, requires per-route RO/EN `qa-serve.sh get` checks and the named offline contrast test, prohibits fabricated MATCH, and forbids adding browser tooling to project manifests (`US-039-qa.md`, §5). |
| AC7 — No application-code change | PASS* | HANDOVER records the US-039 deliverables as the plan and QA procedure; no application or test change is reported. This review made no application-code changes. The independent tester’s typecheck/lint/test gate remains pending and is not claimed as passed here. |

## Finding

### R1 — Medium — AC2 contrast results ignore CSS opacity

`US-039-qa.md` §4 composites `backgroundColor` ancestor layers and text
color alpha, but never reads the computed `opacity` of the text element or
its ancestors. CSS `opacity` affects the rendered foreground and background
as a composited group; checking the unmodified colors can overstate their
contrast. This is not merely hypothetical for this app: the disabled-submit
rule sets `opacity: 0.5` (`app/globals.css:510`). The procedure therefore does
not yet meet AC2's requirement for an effective-surface contrast result on
every capture.

**Required before PASS:** account for element and ancestor opacity when
compositing both text and its surface (including the focus outline), or
explicitly classify affected measurements as unverified/failing rather than
reporting a contrast PASS. Do not weaken the thresholds.

## Scope and command record

- Route list checked against an independent `app/**/page.tsx` inventory.
- All four PNG files were viewed and their pairings checked.
- No tests, builds, browser runs, git commands, secret access, or production
  access were performed.
- Denied or attempted commands: none.

## Round 2 — AC2 only

**Verdict: PASS.** R1 is resolved for the reviewed acceptance criterion.
`US-039-qa.md` §4 now walks the text element's ancestor chain and, when any
computed `opacity` is below 1, records an unverified failure with
`ratio: null`, the route/theme/selector and colors, and an explanation that
the uncomposited ratio is not rendered contrast. The same guard applies to
the first focus-visible element and its outline. The procedure explicitly
forbids treating these cases as PASS and directs the QA runner to inspect
the actual composite or report the capture as AUTO-PARTIAL. Thus group
opacity cannot produce a false numeric pass; unaffected elements still use
the stated WCAG thresholds and background/text alpha compositing.

This re-review was limited to AC2 and R1. AC1 and AC3–AC7 retain their
Round 1 results; the independent tester gates are outside this review and
remain unverified here.
