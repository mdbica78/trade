# Sprint 1 — Foundation

**Epic:** EPIC-01
**Status:** see the `status.md` Story board

## Goal

A deployed, bilingual Next.js skeleton that reads from Neon Postgres, plus a definitive answer on whether the depositary PDFs yield extractable text.

## Why this order

US-001 comes first on purpose. If no Node library can extract text from the BRD report, the extraction approach changes fundamentally (OCR, or a different source entirely) — that is a direction decision for the user, and it is far cheaper to discover it now than after four sprints of scaffolding.

## Stories

| Story | Title | Depends on | Suggested model / thinking |
|---|---|---|---|
| US-001 | Spike: validate PDF text extraction | — | strong model, high thinking |
| US-002 | Project scaffold | ADR-001 | cheap model, low thinking |
| US-003 | Database schema and Drizzle/Neon setup | US-002 | mid model, medium thinking |
| US-004 | Bilingual (RO/EN) infrastructure | US-002 | cheap model, low thinking |
| US-005 | Seed ETF registry and field catalogue | US-003 | cheap model, low thinking |
| US-006 | Deploy to Vercel with health check | US-003 | mid model, medium thinking |

## Sprint Definition of Done

- All six stories Done (reviewed, tests pass, user confirmed manually).
- The app is reachable at a Vercel URL.
- The health-check page shows a successful Neon query.
- The UI switches between Romanian and English.
- US-001 has produced a written decision recorded in `decisions/`.

## Manual QA the user must perform in this sprint

1. Open the deployed Vercel URL; confirm the page loads.
2. Confirm the health-check page reports a successful database connection.
3. Switch language RO ↔ EN; confirm labels change and the choice persists across a reload.
4. Confirm the seeded ETF list shows the three BRD-format ETFs.
