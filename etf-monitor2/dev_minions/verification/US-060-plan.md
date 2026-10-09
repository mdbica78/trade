# US-060 plan — Professional /admin/etfs, add by symbol only

Date: 2026-10-09. Scope follows the PO's tech-lead brief and BR2.

## Data / schema impact
No schema change or migration. Keep `etfs.name NOT NULL`; fallback to normalized symbol in code. Parse the fund name deterministically from the fetched instrument page title/header, propagate it as optional data through discovery and adapter detection, and insert the detected name or symbol fallback. Existing ETF names change only on explicit re-detection and only when a valid name was extracted.

## Files and implementation
- `lib/extraction/discovery.ts`: add an optional `instrumentName` to all discovery outcomes after a page fetch, parsed from a narrowly matched BVB instrument-page title/header using existing entity/tag/whitespace helpers. Return no name for a missing symbol match, empty title or failed fetch. Do not parse depositary report titles as the ETF name.
- `lib/extraction/discovery.test.ts`: fixture-driven name parser cases for the committed BTBETRETF, TVBETETF, PTENGETF and ICBETNETF pages plus malformed/missing title and entity decoding; no network.
- `lib/config/detect-adapter.ts`, `lib/config/detect-adapter.test.ts`: propagate optional discovered name in detected, no-match, unreadable and later-stage failure outcomes when page metadata was available. Preserve name on discovery error.
- `lib/config/etfs.ts`: make `addEtf` take `{symbol}` only; use detection's non-empty normalized instrument name or normalized symbol. On re-detect, conditionally update name only when a fresh valid BVB name exists; otherwise update the adapter result while preserving the prior name. Keep existing inactive reactivation behavior (does not redetect).
- `lib/config/etfs.test.ts`, `lib/config/etfs.pglite.test.ts`: prove detected-name insertion, symbol fallback, blank/malformed name fallback, existing-active rejection, reactivation, name refresh on successful re-detection, preservation on failed/nameless detection, and one-row persistence.
- `app/admin/etfs/actions.ts` and `actions.test.ts`: accept only the symbol form field and call `addEtf({symbol})`; reject missing symbol, never read/forward a name.
- `components/admin/EtfAdmin.tsx` (rewrite), new `components/admin/EtfAdmin.test.tsx`, `app/admin/etfs/page.tsx` and `page.test.tsx`: replace the table with a compact native GET selector using a validated `?symbol=` query parameter and a panel for only the selected ETF; default to first symbol when absent/invalid. Keep all actions/fields link in the panel; add form contains only the symbol input. Ensure server-rendered fallback works without JavaScript.
- `app/admin/etfs/result-messages.ts` and tests: remove `invalid_name` result/message if no other caller remains; preserve safe detection/add errors.
- `lib/ai/capabilities/configuration/execute.ts` and `execute.test.ts` / `execute.pglite.test.ts`: call the same symbol-only `addEtf`; ignore model-provided `name`; retain add_etf response semantics. Update prompt example/intent expectations only where the name field is no longer accepted or needed.
- `messages/en.json`, `messages/ro.json`: selector/panel/add-by-symbol/fallback and errors.
- `components/admin/admin-markup.golden.test.tsx` and snapshot: add page/component markup coverage or update only affected admin markup. List the intentional redesign in the story QA checklist and HANDOVER.
- Update `lib/config/boundaries.test.ts` only if a new module requires a boundary assertion/allowlist.

## Deliberate test / snapshot changes
Remove the add-form name expectation and add a negative assertion that no name input is rendered/read. Update chat's `name`-required parser expectation only as needed to allow omitted/null model field while ignoring any supplied value. The ETF admin table-to-selector markup and name form removal are intentional snapshot changes; record them explicitly and refresh snapshots only with a normal reviewed test run.

## Risks and proof
BVB page title shape may vary. The parser must be conservative, return `undefined` on ambiguity and fall back to symbol; no report text or AI inference. Re-detection should not erase a known name after a transient failure. Keep adapter matching/fetch counts unchanged except existing detection flow. Manual checks: add a fixture-backed symbol for an unknown adapter and verify safe unavailable state; browser check selector without JS, form, keyboard, RO/EN and both themes. Full gates: focused discovery/config/chat/admin tests, typecheck, lint, full suite and offline build.

## Order
1. Parse/propagate the optional instrument name and test against committed pages.
2. Change the shared add/re-detect config API and PGlite tests.
3. Wire the admin form and chat path to symbol-only semantics.
4. Build selector/detail server fallback, bilingual UI, snapshots and page/action tests.
5. Run focused and full gates; prepare QA checklist with live BVB add/re-detect checks.
