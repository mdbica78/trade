# US-063 plan — Job runs table scrolls

Date: 2026-10-09. The PO has already implemented the proposed change; retain it and review/gate it rather than reverting it.

## Data / schema impact
No schema change, migration, database read/write change or data-model documentation change.

## Existing implementation retained
- `components/admin/OperationsDashboard.tsx`: run-history table uses a `max-h-96 overflow-auto` scroll region, sticky table-header cells, `role="region"`, `tabIndex={0}`, a localized `aria-label`, and `data-runs-scroll`.
- `messages/en.json`, `messages/ro.json`: `Admin.operations.runsScrollLabel`.
- `components/admin/OperationsDashboard.test.tsx`: OD-SC1 currently proves labelled/focusable/bounded markup in both locales.

## Files and verification
- Review the above implementation and extend OD-SC1 in `components/admin/OperationsDashboard.test.tsx` to pin vertical and horizontal overflow, sticky header and visible keyboard-focus behavior without coupling to generated utility ordering. Keep both RO/EN label assertions.
- `components/admin/OperationsDashboard.tsx`, both message catalogues: source unchanged unless the independent review finds a concrete AC gap; any fix must remain token-based and bilingual.
- `components/admin/admin-markup.golden.test.tsx` and its snapshot: determine whether this component is included. If so, update only its intentional scroll-region markup; otherwise do not add a broad snapshot unrelated to the focused component behavior.
- Theme/contrast checks: use existing `app/globals.contrast.test.ts` and component assertions to check the scroll region against existing tokens; no new raw color literals.
- Verify focused operations component suite, then typecheck, lint, full suite and offline build. Handover records 12 focused tests plus a 59-test admin run and typecheck green; full suite/build and independent review remain unverified and must be run now.

## Deliberate test / snapshot changes
The wrapper, keyboard-focus hook, accessible region label and sticky header are intended markup changes. Record them in the QA checklist. Do not regenerate snapshots using update mode; run the test normally and inspect the expected markup.

## Risks and proof
`overflow-auto` should contain both axes; test the table's wide log column at narrow width to prove horizontal scrolling does not enlarge the document. Verify sticky header contrast in both themes and keyboard scrolling/focus in a browser (MANUAL-QA). No query pagination is added; this is a bounded viewport around the existing run list.

## Order
1. Review the pre-implemented source and OD-SC1.
2. Add any missing assertions surgically; retain PO markup.
3. Run focused operations tests, full local gates and independent review/test; write QA checklist including narrow-screen keyboard/scroll check.
