# US-008 QA checklist — PDF download and text extraction service

Round 1: tests PASS, review FAIL (Critical: `pnpm-workspace.yaml`'s `allowBuilds.canvas` left as
unresolved placeholder text broke a clean `pnpm install --frozen-lockfile`). Fixed (`canvas: false`,
verified with a genuine `rm -rf node_modules && pnpm install --frozen-lockfile`) plus a Warning
(missing `toHaveBeenCalledTimes(1)` in 5 test cases, added). Round 2: review PASS, tests PASS
(143/143 incl. 39 new, all four commands green from a clean install).

Acceptance criteria AC1-AC6 are the story's own (not agent-drafted this time — `backlog/stories/US-008.md`
already had them at detail time), so no PO confirmation of criteria wording is needed here.

## Manual checks

None required. This story has no MANUAL-QA step of its own — the live download-and-extract check
against a real bvb.ro PDF is deferred to US-011 AC7 (`pnpm report:latest <SYMBOL>`).

## Non-blocking notes

- A pre-existing `.pnpmrc` line is malformed/inert (predates this story, not touched here) —
  flagged by the round-2 reviewer only for future cleanup awareness, not an action item.
- `unpdf` is pinned to `0.11.0` (the spike's validated version), not the latest (`1.8.1`), because
  `1.8.1` inserts `\n` between text items and breaks US-010's flattened-text contract (AC2's
  no-`\n` guard caught it, exactly as the plan's R1 risk anticipated). Recorded in HANDOVER.md.
  Revisit only if a future story needs a newer unpdf feature — re-test AC2 unchanged first.

## Files changed

- `package.json`, `pnpm-lock.yaml` (changed — `unpdf@0.11.0` added as a runtime dependency)
- `pnpm-workspace.yaml` (changed — `allowBuilds.canvas` set to `false`)
- `lib/extraction/pdf.ts` (new)
- `lib/extraction/pdf.test.ts` (new)
