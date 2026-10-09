# US-016 — Home table with configurable columns and PDF links — Independent Review

## Round 1 — 2026-09-25

Reviewer: GitHub Copilot, fresh chat (`/review-story`), independent from the implementing
context (Copilot fallback — no `story-reviewer` subagent available, per `process.md` "Fallback
(Copilot)").

Sources read: `dev_minions/backlog/stories/US-016.md`, `dev_minions/verification/US-016-plan.md`,
`AGENTS.md`, `dev_minions/status.md`'s Story board row for US-016. Every file the plan's "Files
to touch" section lists was read in full: `lib/format/number.ts` (+ test), `lib/format/date.ts`
(+ test), `lib/monitoring/home.ts` (+ `home.pglite.test.ts`), `components/HomeTable.tsx` (+
test), `app/page.tsx` (+ test), `i18n/request.ts`, `messages/ro.json`, `messages/en.json`.
Grepped the repo for `Home.intro` and for any remaining import of `lib/format.ts` — none found
outside `dev_minions/` documentation and unrelated fixture text (`spikes`/HTML fixtures contain
the substring "introduc..." from Romanian prose, not the key). `lib/format.ts` and
`lib/format.test.ts` are deleted as the plan specified.

Gates run directly in WSL (not trusted from HANDOVER/status.md), `NODE_EXTRA_CA_CERTS` exported
per AGENTS.md:
- `pnpm typecheck` — 0 errors.
- `pnpm lint` — 0 errors, exit 0; 3 pre-existing warnings, all unrelated to this story
  (`lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`,
  `lib/ingestion/load-etfs.test.ts` — unused test parameters, a known non-blocking pattern
  already logged in prior HANDOVER entries).
- `pnpm test` — 649/650 passed, 48/49 files, on the first aggregate run. The one failure
  (`app/api/cron/daily/route.test.ts` "RT-6", a US-015 file this story never touches) was a
  `Test timed out in 5000ms` on a WSL aggregate run — the same class of transient timeout
  already documented for US-013's QA run. Re-ran that file alone: 7/7 passed in 1.24s,
  confirming it is environmental, not a regression caused by US-016. No other file in the
  aggregate run failed.
- `pnpm build` with `DATABASE_URL` explicitly unset (`unset DATABASE_URL`) — succeeded.
  `Route (app)` output shows `ƒ /` ("Dynamic — server-rendered on demand"), i.e. the home page
  is not prerendered with a database connection at build time (AC10).

VERDICT: PASS

### Acceptance criteria

- **AC1** — MET. `lib/monitoring/home.ts`'s `buildActiveEtfsStatement` filters `is_active = true`
  and orders by `symbol`; `parseEtfs`/`buildViewModel` emit exactly one row per distinct ETF id
  regardless of whether it has any tracked field or report row. `home.pglite.test.ts` "AC1"
  proves: an inactive ETF (`AAAETF`, alphabetically first) is excluded; a null-adapter ETF
  (`ZZZETF`) with no reports still gets a row with `valueDate: null`, `latestPdfUrl: null`,
  `adapterAvailable: false`; row order is `["BTBETRETF", "ZZZETF"]`.
- **AC2** — MET. Columns are the union of every active ETF's tracked `field_key`s
  (`buildActiveEtfsStatement` only reads active ETFs' `tracked_fields`), ordered by the lowest
  `display_order` any ETF gives the field then `field_key` (`parseColumns`'s
  `minDisplayOrder`/sort), matching decision 3 exactly. Cells are `{tracked:false}` vs.
  `{tracked:true,value}` per `buildViewModel`'s per-column loop. Header labels come from
  `field_catalog`, first row per `field_key` after ordering by `(field_key, adapter_key)`
  (alphabetical tie-break), falling back to the field key when no catalogue entry exists.
  `home.pglite.test.ts` covers: add/delete a `tracked_fields` row toggles the column with no code
  change; the display-order tie-break across two ETFs; the tracked/untracked distinction; the
  field-key fallback label; the alphabetical-adapter label tie-break. Header locale selection is
  additionally proven in `HomeTable.test.tsx` (ro shows `VUAN`, en shows `NAV per unit`).
- **AC3** — MET. `buildLatestOkValuesStatement` selects `status = 'ok'` only,
  `distinct on (etf_id)` ordered by `report_date desc, id desc`, left-joined to
  `report_values` so a report with zero stored values still carries its date. `valueDate` and
  cell values are read only from this result (`buildViewModel`). `home.pglite.test.ts` "AC3"
  proves: the newest `ok` report's date and values win over an older `ok` report; a field
  missing from the newest `ok` report is `{tracked:true, value:null}`, never backfilled from the
  older report; an ETF with no `ok` report at all has `valueDate:null` and every tracked cell
  `value:null`; a newer `parse_error` row — even one carrying stored values — changes neither
  the date nor the value (decision 2, `store.saveReport` used to insert a real `parse_error` row
  through the same code path Sprint 3 ships).
- **AC4** — MET. `buildLatestReportLinksStatement` selects the newest report row with a
  non-null `source_url`, `distinct on (etf_id)`, **no** `status` filter — deliberately separate
  from the values query, exactly per the story's Notes ("the link rule (any status) and the
  value rule (ok only) deliberately differ"). `home.pglite.test.ts` "AC4" proves a newer
  `parse_error` row's link wins over an older `ok` row's link, and that an ETF with no report at
  all has `latestPdfUrl:null`. `HomeTable.tsx` renders the symbol as
  `<a href={latestPdfUrl} target="_blank" rel="noopener noreferrer">` only when a link exists,
  plain text otherwise (`HomeTable.test.tsx` "the symbol is a link... plain text otherwise",
  asserting exactly one `<a>` in a two-row fixture). No URL is built from the symbol, `bvb_url`,
  or a date anywhere in `home.ts` or `HomeTable.tsx`.
- **AC5** — MET. `adapterAvailable = etf.adapterKey !== null && registry.get(etf.adapterKey) !== undefined`
  in `buildViewModel`, using the real `defaultAdapterRegistry` by default (only overridden in
  tests). `home.pglite.test.ts` "AC5" covers a `NULL` `adapter_key`, an unregistered string key,
  and the seeded `brd-depositary` key (registered) in the same assertion block.
  `HomeTable.test.tsx` renders the translated marker next to the symbol for the non-adapter row
  and confirms the marker is absent for the adapter-available row; AC3's values behave
  identically for both rows (same `cells` mechanism, no special-casing).
- **AC6** — MET. `formatNumber` (`lib/format/number.ts`) is a plain string replace — `ro`
  replaces `.` with `,`, `en` returns the canonical string unchanged — never parses to a
  `number`, so it cannot hit the `Intl.NumberFormat` rounding/grouping trap the story's Notes
  warn about. `number.test.ts` reproduces every AC6 example verbatim
  (`415591664.27`, `37470000`, `54.1373`, `8640000.00`, `-0.006`) plus a parametrised
  "never contains a grouping character" test on a value long enough to trigger `Intl` grouping,
  checking for space, NBSP and apostrophe and the *other* locale's decimal mark.
- **AC7** — MET. `formatReportDate` (`lib/format/date.ts`) does pure substring slicing of the
  `YYYY-MM-DD` string, never constructs a `Date`, so it cannot be affected by the process time
  zone — proven directly by `date.test.ts`'s test that flips `process.env.TZ` to
  `Pacific/Kiritimati` (UTC+14) and `Etc/GMT+12` and asserts the same output both times, plus the
  three boundary dates from the story (`2026-01-01`, `2026-12-31`, `2028-02-29`). `en` returns
  the ISO string as-is; `ro` gives `dd.MM.yyyy`. `i18n/request.ts` sets
  `timeZone: "Europe/Bucharest"` as decision 4 requires (confirmed the tests that read a real
  Postgres `date` column back through `home.pglite.test.ts` still resolve to the correct
  calendar day, via `toIsoDateString`'s UTC-getter approach in `home.ts`, which the story's Notes
  flagged as a related trap one layer earlier).
- **AC8** — MET. `Home.*` keys exist with identical shape in both `messages/ro.json` and
  `messages/en.json` (`symbolColumn`, `dateColumn`, `extractionUnavailable`, `empty`,
  `loadError`); the placeholder `Home.intro` is removed from both, and no code references it
  (verified by grep). `i18n/messages.test.ts` (key-parity test) passed in the full suite run.
  `HomeTable.test.tsx` renders both locales and asserts each does not contain the other locale's
  differing text (`extractionUnavailable`); `app/page.test.tsx` does the same for the
  empty-state text.
- **AC9** — MET. `HomeTable`'s `status: "error"` branch renders only the translated
  `Home.loadError` string; `app/page.tsx`'s `loadHomeTableProps` catches any thrown error from
  the loader and discards it entirely (bare `catch { return { status: "error" } }` — the
  exception object is never read, so it cannot leak into the response even by accident).
  `app/page.test.tsx` proves this with a rejected loader whose message contains a fake
  connection string and the literal word "secret", asserting none of that text, nor `postgres://`,
  appears in the rendered HTML. The no-active-ETF empty state is proven in both locales in the
  same file.
- **AC10** — MET. `home.pglite.test.ts` runs every read through PGlite with
  `drizzle/0000_init.sql` applied, via the same `db.execute(sql\`...\`)` + `BatchRunner`
  statements the page uses in production (`createHomeTableLoader`'s injected `run` defaults to
  `neonBatchRunner(db)`, overridden only in tests) — no test connects to Neon. `getDb()`
  (`lib/db/index.ts`) is lazy and is only invoked inside the async Server Component at request
  time, never at module load; the direct `pnpm build` run with `DATABASE_URL` unset (above)
  confirms this end-to-end, and the build's route table shows `/` as dynamic, not statically
  prerendered.
- **AC11** — MET. All four gates verified directly above; the one test failure was proven
  transient/unrelated by an isolated rerun, not a defect in this story's files.

### Findings (ordered by severity)

No Critical or Warning findings.

1. **Note** — `HomeTable.test.tsx` and `app/page.test.tsx` wrap the component directly in
   `NextIntlClientProvider` without a `timeZone` prop, which prints an
   `IntlError: ENVIRONMENT_FALLBACK` warning to stderr during the test run (same pattern already
   present in the pre-existing `components/LanguageSwitcher.test.tsx`, not introduced by this
   story). It does not affect correctness here: `formatReportDate`/`formatNumber` are pure
   string functions that never call `Intl`, so the warning is cosmetic. Not blocking.
2. **Note** — `dev_minions/architecture/data-model.md` was not touched by this story (not in
   the plan's file list either) and still documents `.` as the numeric thousands separator per
   Sprint 2 audit's earlier N5 finding — a pre-existing doc gap unrelated to this story's code,
   already flagged for a PO/Technical-Lead doc fix in a prior audit.

### Scope deviations

None. Every file touched matches the plan's "Files to touch" list exactly (verified by grep for
usages of the deleted `lib/format.ts` and by reading each new/edited file above); no
unrequested refactor, dependency, or abstraction found.
