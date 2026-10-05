# Sprint 12 — Simplification (no new behaviour)

> Detailed and reviewed by the Technical Lead chat, 2026-10-04 (review: `verification/CODE-REVIEW-20261004.md`, APPROVED). Requested by the user: "simplify, simplify, simplify" without affecting functionality.

**Epic:** EPIC-07 · **Blocked by:** nothing. No user step, no migration, no decision needed.

## Stories (build in this order; each touches files the next one also touches)
| Story | Title | Area | Suggested model |
|---|---|---|---|
| US-049 | Simplify ingestion, extraction, cron and health | review §A | strong, medium |
| US-050 | Simplify the home page and monitoring code | review §B | strong, medium |
| US-051 | Simplify the AI chat, capabilities, keys and widgets code | review §C | strong, medium |
| US-052 | Simplify admin, configuration, header and stylesheet | review §D | strong, medium |

## Decisions needed
None. All items are TECHNICAL and settled in the review. The allowed behaviour changes are named in each story; everything else must stay identical. Items that would change behaviour are listed in the review under "Not in Sprint 12" and are not built.

## Sprint audit
After US-052, the in-loop `tech-lead` writes `SPRINT-12-audit.md` and adds the total lines removed (sum of the stories' before/after counts).
