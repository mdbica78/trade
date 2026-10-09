# Sprint 14 technical review

Date: 2026-10-09

## Authority and scope

The PO's `verification/SPRINT-14-tech-lead-brief.md` defines the five user's needs as binding business requirements. The earlier story drafts and DEC-030's technical details were proposals only. The updated story criteria below use existing FRs for product/language constraints and explicitly identify their Sprint 14 business requirement (BR1–BR5). Requirements source was not edited.

## Story review

- **US-059 — BR1, chat list questions:** Model-based answers from supplied context only, no new deterministic action. Covers active/inactive ETF list, tracked fields, widgets/custom values and latest successful report date. Existing context boundary and prompt safety are retained. Tests remain offline and prompt limits are explicit.
- **US-060 — BR2, ETF admin:** Symbol-only add, deterministic name extraction from BVB instrument metadata and symbol fallback preserve `etfs.name NOT NULL`; successful explicit re-detect refreshes only a valid extracted name. Existing field/adapter/active operations remain available. Native GET selection meets no-JS fallback.
- **US-061 — BR3, AI admin:** UI-only redesign reuses 0003/0005/0006 data, server actions and key-free projections. Keys remain write-only; provider-specific model association remains DEC-029.
- **US-062 — BR4, editable daily hour:** Reuses existing setting, but DEC-030's no-migration claim is not correct for a race-safe once-per-UTC-day claim. A nullable date marker plus unique index is required so simultaneous external/Vercel calls cannot both start. Also add a `started_at` index for the check against historical rows. Expand-only migration follows DEC-023. The binding gate/catch-up/status/auth semantics are settled in DEC-030 below.
- **US-063 — BR5, bounded run-history viewport:** Keep the PO's implementation. It fits the requirement and is already localized/focusable; full-suite/build and independent review/test remain to be completed.

## Technical decisions settled

1. **US-060 names:** retain required `etfs.name`; deterministic BVB instrument-page title/header parse; fallback to normalized symbol. Re-detection replaces a name only when a valid fresh name is present. Chat's supplied name is ignored.
2. **US-061 persistence:** no schema change; reuse provider-specific model map and existing key/custom-provider tables/projections.
3. **US-062 schedule:** UTC hour, default 10 when DB setting is `NULL`, required saved integer 0–23, `nowHour >= targetHour` catch-up, any same-day `job_runs` row counts, no same-day retry, no row for skipped pings, bearer authentication before any config/DB work, Vercel daily cron retained as safety net, GitHub Actions hourly sample. Atomic claim requires schema migration and indexes (details in DEC-030 and US-062 plan).
4. **US-063:** retain the code already written by the PO; no code is authorized in this planning phase.
5. **US-059:** context values are model-visible data only; no direct command handling or additional actions.

No remaining product/scope/cost/credential question blocks planning. User-only actions after delivery: adding repository secrets for the sample workflow and live QA.

## Build order and dependencies

**US-063 → US-060 → US-061 → US-062 → US-059**, no dependency change. US-063 is first because the existing edit is already in the tree and needs closure. US-060 then shares ETF config/discovery surfaces with chat add. US-061 is presentation-only. US-062 is last among operational changes because it modifies route behavior and schema. US-059 follows last because it touches the shared chat context and prompt budget.

Detailed implementation plans: `US-063-plan.md`, `US-060-plan.md`, `US-061-plan.md`, `US-062-plan.md`, `US-059-plan.md`.

## Dev / QA hand-off

Copilot delivers one story at a time, using each plan and stopping for any newly uncovered product decision. Do not start continuous autopilot. For each story: focused tests, `pnpm typecheck`, `pnpm lint`, `pnpm test`, offline `pnpm build`; US-062 additionally generates but never applies the migration to Neon, and runs `test/helpers/pglite.migrations.test.ts`; the final US-062 gate also runs `bash scripts/claude/predeploy-check.sh` where its documented shell/toolchain is available. Independent review and test evidence precede Awaiting QA. Codex QA is separate.

Manual-QA: US-059 real-model answer grounding; US-060 live BVB symbol add/name and re-detect; US-061 browser provider/key selection without showing keys; US-062 external repository secret setup, UTC/Bucharest display and once-per-day live gate; US-063 narrow-screen keyboard/scroll and sticky header in both themes. No login is proposed.

## PO implementation disposition

US-063 stays. Its source/test changes are pre-implemented by the PO and are listed as existing implementation, not tech-lead-authored code. Only tests/review/gates may be added in the delivery phase; no revert.

## Denied or attempted commands

None.
