# US-060 review

## Round 1

Reviewer: independent (not the implementer). Evidence below was produced by this review unless marked "not re-run".

### Commands run by this review (DB/cron/key variables unset)
- `vitest run` on 27 files (discovery*, config/etfs*, detect-adapter, etfs.report-link, EtfAdmin, app/admin/etfs, configuration capability tests, chat.pglite/test/regression, request-bound, data-model): **27 files / 400 tests PASS**.
- `tsc --noEmit -p .`: exit 0.
- `eslint` on the changed source files: 0 errors, 1 warning (see W1).
- Full suite, lint over the whole repo and offline build: **not re-run** (tester gate).

### Acceptance criteria
- **AC1 MET** — `components/admin/EtfAdmin.tsx:42-130`: native `<form method="get">` with `<select name="symbol">` plus submit button (works without JS); detail panel `data-etf-details` shows status, active toggle/remove (ActionForm setActive), adapter select, re-detect and fields link. Page reads `?symbol=` (string or array) in `app/admin/etfs/page.tsx`; unknown/blank falls back to first ETF (`EtfAdmin.tsx:36-37`). Tests EA-S1..S3, PG-SEL pass.
- **AC2 MET** — add card `EtfAdmin.tsx:132-142` has only `name="symbol"`; `app/admin/etfs/actions.ts:15-25` reads only `symbol` and calls `addEtf({symbol})`, the same `lib/config/etfs.ts` `addEtf` the chat executor uses (`configuration/execute.ts:71`). EA-A1, PG-ADD assert no `name="name"`.
- **AC3 MET** — `lib/extraction/discovery.ts:183-203` `parseInstrumentName` is a conservative `<title>` parser ("BVB - <≤5 words> SYMBOL NAME"): requires the exact symbol, non-empty name ≤200 chars, no control chars/`<>`; returns undefined otherwise. Propagated on found/not_found (`discovery.ts:223-239`), not on fetch error. `lib/config/detect-adapter.ts` forwards it; `etfs.ts:121-122` `normaliseName(detection.instrumentName) ?? symbol`. `name NOT NULL` unchanged, no schema/migration. Verified against the four committed fixtures' `<title>` lines (e.g. `BVB - Unitati de fond ICBETNETF INTERCAPITAL BET-TRN UCITS ETF`) and tests (discovery.test.ts:83-133, CE-N1/N2, CEP-5/5b) pass.
- **AC4 MET** — `intent.ts:43-49` tolerates but never reads a model `name` (string/null/absent only); `grounding.ts:18-22` builds `{action:"add_etf", symbol}`; `execute.ts:71` passes symbol only; prompt (`prompt.ts:190`) no longer offers `name`. CEP-5 proves a supplied name is ignored.
- **AC5 MET** — `etfs.ts:171-178`: `set "adapter_key" = …, "name" = coalesce(${freshName}::text, "name")`. A null `freshName` (undefined/""/blank → null via `normaliseName`) preserves the name; the explicit `::text` cast gives the null parameter a type, which is correct for PGlite and for the Neon HTTP driver (parameters are sent positionally, null is a valid typed text parameter). Proven on real PGlite by CE-M9 (undefined, "", "   " keep the name; " Fresh BVB Name " is stored trimmed). Not run against live Neon (MANUAL-QA, see below). `invalid_name` was removed from the ETF admin action/messages only because the name input no longer exists (`result-messages.ts`, no references left in `app/admin/etfs`, `components/admin`, `messages/*`; remaining `invalid_name` hits are the unrelated custom-provider feature).
- **AC6 PARTIALLY MET / MANUAL-QA** — i18n: every `t("…")` key used in `EtfAdmin.tsx` exists in both `messages/en.json` and `messages/ro.json` (checked by script); no key leftover (`nameLabel`, `Admin.messages.invalidName` gone). Styling uses only CSS tokens (`var(--line)`, `--panel`, `--muted`, `--gain`, `--radius`), no hard-coded colours. Accessibility: select is wrapped in a `<label>`, native buttons, `role="alert"` on error. Focused tests/typecheck pass. No golden snapshot covers EtfAdmin (`admin-markup.golden.test.tsx` imports only TrackedFieldsAdmin), so no snapshot changed; the handover states this and it matches. Theme/keyboard/responsive visual check, full suite and offline build: MANUAL-QA / tester gate, not re-run.

### Tests weakened or deleted?
No evidence of weakening. Removed expectations (add-name, `invalid_name` action/message case, `nameLabel`) belong to the deleted name input/result code; they are replaced by negative assertions (no `name="name"`, model name ignored) and new tests (CE-N1/N2/M9, CEP-5/5b, PG-SEL/PG-ADD, EA-*, name-parser cases). I did not diff the test files (git is off-limits); assessment is from reading the current tests.

### Findings
- **Critical:** none.
- **Warning:** none.
- **Note N1:** `discovery.ts:195` `// eslint-disable-next-line no-control-regex` is reported as an unused directive (lint warning only; the rule does not fire on the `\u0000-\u001f` class here). Cosmetic.
- **Note N2:** `detectEtfAdapter` still clears `adapter_key` to NULL on a failed re-detect (pre-existing US-020 AC7 behaviour, already a recorded user question); name is preserved as AC5 requires.
- **Note N3:** after a successful add, the page stays on the previously selected ETF (selection is by `?symbol=`; no redirect to the new symbol). Usability nicety, not an AC.
- **Note N4:** `action-list.ts:141-150` still carries a `name` exemption for `dropNulls`/schema (`name: ["string","null"]`), consistent with the tolerated-but-ignored model field; harmless.
- **Note N5:** live BVB add/re-detect (real title parsing on the current site, Neon HTTP coalesce) is MANUAL-QA for the QA checklist.

Denied or attempted commands: none.

Verdict: PASS
