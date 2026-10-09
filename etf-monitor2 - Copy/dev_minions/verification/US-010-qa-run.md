## QA run 1 — 2026-09-24 16:25

Verdict: PASS
Machine checks: 10/10   Left for the user: 0

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | Adapter key and field keys match the seeded BRD catalogue (AC1) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 2 | Default registry resolves the BRD adapter for every seeded ETF (AC2) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 3 | Report date comes from the footer, never the filing stamp (AC3) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 4 | Label-anchored values are extracted without confusing units and investors blocks (AC4) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 5 | VUAN gap rule extracts only one valid value and otherwise leaves it missing (AC5) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 6 | Report-number parser accepts canonical BRD values and rejects malformed values (AC6) | AUTO | PASS | `numbers.test.ts` passed in the focused 86/86 run. |
| 7 | Removing labels yields missing fields rather than borrowed values (AC7) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 8 | BRD detection is specific and every result satisfies the adapter contract (AC8) | AUTO | PASS | `brd-depositary.test.ts` passed in the focused 86/86 run. |
| 9 | Adapter code remains deterministic and free of DB, network and PDF-library imports (AC9) | AUTO | PASS | `boundaries.test.ts` passed in the focused 86/86 run. |
| 10 | Typecheck, lint and production build succeed without `DATABASE_URL` (AC10) | AUTO | PASS | `pnpm typecheck` exit 0; `pnpm lint` exit 0 (one known unused test-parameter warning); retry `pnpm build` exit 0 after a transient concurrent-build lock cleared. |

### For the user (only what a machine couldn't settle)

- None. This story has no MANUAL-QA, live-service or user-judgment item.

