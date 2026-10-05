# Code review — simplification (Technical Lead, 2026-10-04)

Asked by the user: "check that the code is well written, no extra code, no duplication, no contradictions, simple and efficient; clean it without affecting functionality — simplify, simplify, simplify."
Scope: every non-test source file under `lib/`, `app/`, `components/`, `scripts/` (about 11,700 lines), read in four areas. Test files were not read; anything a test may pin is marked *check*.
Result: no defect that breaks the app. About **800-900 lines** can go, plus fewer database requests. The work becomes **Sprint 12 (US-049..US-052)**, built by the dev loop; the Technical Lead does not edit application code.

## Rules for every Sprint 12 story (binding)
1. **No behaviour change.** Same pages, same text, same rendered HTML (byte-identical where an exact-markup test exists), same stored data, same outcome codes, same RO/EN keys. Exceptions are listed by name in the story ("allowed change").
2. **Tests.** Every existing test of behaviour that stays must pass unchanged. A test may be deleted or edited only when the code it exercises is deleted as unreachable or test-only; each such change is listed in HANDOVER as `deliberate test change: file, test, reason`. Never loosen an assertion to make a refactor pass (AGENTS.md).
3. **Decisions stay binding:** DEC-010 (one batch, `ok` last, never downgraded), DEC-016 (config writes in `lib/config`, thin actions), DEC-017/021 (key boundary), DEC-018 (bounded requests, deadline guard), DEC-019 (`logLoadError` only, 42P01 fallbacks), DEC-020 (tokens, no positional selectors), DEC-022 (closed widget set, validate all actions first), DEC-023, exact bigint decimals, DEC-007 number format.
4. Gates as usual: typecheck, lint, build, full test suite, predeploy script. Each story reports lines removed (`wc -l` before/after of the files it touched).

## Findings by area (→ story)

### A. Ingestion, extraction, cron, db, deploy — US-049 (about 220 lines, −1 DB request per report, −2 per health check)
1. `ingest-etf.ts:60-64` reads the report before saving, but `saveReport` already guards with `status <> 'ok'` and returns `already_ok`. Drop the pre-read; delete `findReport`, `buildFindReportStatement`, `ReportRow` (store.ts).
2. `ingestEtf` and `ingestNoAdapter` each run discovery with their own try/catch and branches — discover once.
3. The three `persist(...)` calls repeat `reportDate/sourceUrl/fetchedAt`; `PersistWriteStatus` duplicates `SaveReportInput["status"]`.
4. Adapters duplicate the report-date search and the values/missingFields assembly (`brd-depositary.ts:57-90,162-171`, `intercapital-nav.ts:39-65,135-144`); BRD re-implements `parseDottedDate`. Move to `text.ts` helpers; **keep each adapter's exact error strings** (pass them in).
5. `validate.ts:66-118` runs the unknown/duplicate checks twice (values, missingFields) — one pass over the combined keys, same violation order.
6. `report-links.ts` `isStorableReportUrl` repeats discovery's rule and can never reject; the `rejected_url` result/outcome is unreachable. Delete.
7. Discovery parses the HTML twice (`discovery.ts:198` + `findLatestFilingLinks`); `found` spreads `links[0]` and has an optional `links`, causing an unreachable fallback in `ingest-etf.ts:163` and an unreachable empty case in `filing-outcome.ts`. Parse once; `links` required and non-empty.
8. Inactive ETFs are filtered in SQL (`load-etfs.ts`) and again in `run-daily.ts`. Drop the second filter and `isActive` from `DailyEtf`.
9. Dead in production: `createDefaultIngestDeps`, `findLatestReportLink`, the non-drizzle branch of `spawnDrizzleMigrate`, `PageOutcome.headers`, the `SMOKE_LOCALES` alias, the redundant runner argument in `scripts/db-seed.ts`; `ingestReport` need not be exported.
10. `daily-handler.ts` `redact` re-implements `redactSecrets` (job-run-summary.ts) — reuse it.
11. `runDailyJob` carries `finished/abortLog!/finishInput` — one `input` variable plus a `threw` flag.
12. `/health` makes three requests and wraps the probe twice (`db.execute(buildSchemaProbeStatement(...))`). Await the builder; run the counts and probe in one batch.
13. **Contradiction (allowed change):** fetch error messages carry the URL (`http.ts`) and flow into `outcome.detail` → `job_runs.log` and the cron response, against the "never the URL or an error message" rule (`outcome.ts:78`, DEC-019 spirit). Detail becomes kind + HTTP status only; drop the message plumbing. Also drop the symbol repeated in discovery messages (the log line already prints it).

### B. Home page and monitoring — US-050 (about 170 lines)
1. `home.ts` `buildViewModel` (416-533): columns chosen twice, the catalogue Map built twice, saved column flags parsed twice, panel sort comparator duplicated in `components/home-display-state.ts:97-104` — one of each.
2. `createHomeTableLoader` (540-609): offset slicing and two copies of the fallback. Put display statements after the five home statements; one loader that retries once per missing optional table; same `logLoadError` scopes, both 42P01 fallbacks kept.
3. **Contradiction:** two label rules for a field key shared by two adapters (`parseColumns` = first by adapter_key; `parseCatalogueFields` = lowest id). One dedupe helper with one SQL `order by` (lowest id). The `Number.isFinite(id)` guards are dead. Allowed change: only the label of a key shared by two adapters, if any.
4. Postgres `date` handled three ways — use `"report_date"::text` in the home statements and delete `toIsoDateString`.
5. Tracked fields without a catalogue row are added to the unsaved panel as visible, but saving rejects them (`unknown_field`). Drop that loop.
6. `delta.ts` recomputes scale/rescale/diff in two functions and `exact-decimal.ts` once more; `ZERO`/`TWO` declared twice — one exported `subtract` in `exact-decimal.ts`, exact maths unchanged. Import `isCanonicalDecimal` from `exact-decimal` directly.
7. Two zero detectors that disagree (`format/delta.ts:5`, `delta-direction.ts:2`) — keep one; fold `formatDeltaAbsolute` into `withExplicitSign`'s caller. Arrow markup duplicated in `HomeTable.tsx:86-92` and `CustomValues.tsx:44-45` → one `<DeltaArrow>` with **byte-identical** output.
8. `locale === "ro" ? labelRo : labelEn` appears 7 times → `localizedLabel(item, locale)` in `lib/format`.
9. Dead branches: `row.name ?? row.symbol` (`name` is not null), null checks after inner joins (`home.ts:341,374`), two missing-table predicates → one `isMissingTable(error, names)`; `customization` always set (make it required, drop `?? EMPTY_CUSTOMIZATION`, *check* fixtures); `hasChangeLine && delta && arrow` and the `as string` cast; the unused type re-export in `home-display-state.ts`; `ReturnType<typeof toHomeDisplaySaveInput>` → `HomeDisplaySaveInput`; inline `toggleSwitch`.

### C. AI chat, capabilities, keys, widgets — US-051 (about 230 lines)
1. `chat.ts:126-195`: the "mark the rest not_run and stop" loop is written three times; `configurationOutcomeFailed` called twice; identical ternary branches in `actionDescriptor`. One loop body.
2. `chat.ts:216-264`: five identical `try { } catch { return {kind:"error"} }` blocks → one.
3. Dead because `validateAction` admits only exact known actions: the trim/lowercase and unsupported/unclear paths in `configuration/intent.ts:50-54`, grounding's `unsupported` branch, `ConfigurationOutcome` `provider_error/too_many`, the fall-through in `widgets/intent.ts:133-137`, plus `parseConfigurationOutput`, `ConfigurationActionListOutcome`, `widgetForSlot`, the identity `widgetError`. Merge the two checks in `validateAction` into one registry lookup.
4. `fieldForConfigurationIntent` repeats `execute.ts` `fieldFromContext`; the executed outcome already carries `field` — read it from there.
5. `widgets/execute.ts`: four branches build the same result — one builder.
6. `interpret.ts`: `isGenerateResult` re-implements `normaliseResult`; the try/catch around `parseActionListOutput` is dead; the message is trimmed three times (once is enough, at the entry).
7. `provider-deps.ts`: `loadActiveProvider` and `getAiAvailability` repeat the load→resolve sequence; `AiAvailability.providerId/model` never read; `ProviderKeyStatusView` and `AiSettingsAdmin` `KeyRow` copy `ProviderKeyStatus`; `getKeyStatuses(env)` needs no ternary; drop the `ProviderOption` alias. Key boundary unchanged.
8. `key-status.ts`: `getEncryptionKeyMaterial` = master ?? cron_derived via the per-source function; `isSet` = `readApiKey(...) !== null`. `encryptProviderKey` has no production caller; `storingEnabled` and `getProviderKeyStorageEnabled` wrap each other — keep one (respecting the boundary test).
9. Slot range check written three times, the widget "changes" merge twice, `isRecord` five times, `hasOnlyKeys` twice → export `validSlot`, `mergeWidgetChanges`, `isRecord`, `hasOnlyKeys` from `lib/config` (capabilities may depend on lib/config, DEC-017 §5).
10. `chat.ts:254` loads the widget context even for configuration-only messages; `loadWidgetContext` awaits ETFs one by one; `listWidgetsForEtf` runs an unused catalogue join. Load only when a widget action exists, in parallel, without the join. Allowed change: a configuration-only message no longer fails when the widget read fails.
11. Capability registry: two 7-9-line `capability.ts` files and unused `Capability.id`/`CAPABILITY_IDS`; `WIDGET_ACTIONS` and `CONFIGURATION_ACTIONS` live in different kinds of files. Inline both entries in `registry.ts` (still one registry).
12. `ai-settings.ts`: `normaliseProvider`/`normaliseModel` share logic → one helper. `ai-keys.ts` `operations?` is a test-only seam (*check*).
13. `reply-messages.ts:120-121`: the success-code list equals `result.changed`; unreachable `?? "actionFailed"`; `ChatReply.tsx` renders field/reason twice; shared base type for reply states.
14. `CHAT_UNAVAILABLE_REASONS` repeats `ActiveProviderFailureReason` — define the array once in `resolve.ts`, keep the exported name.

### D. Admin, configuration, layout, CSS — US-052 (about 230 lines)
1. Admin server actions repeat one skeleton (constants `GENERIC_ERROR`/`INVALID_REQUEST` four times; try → call lib → revalidate → map → catch) → `app/admin/run-action.ts` (`runAdminAction`), each action about 4 lines.
2. The admin action function type is written 13 times → `AdminAction` in `components/admin/action-state.ts`.
3. Every admin page repeats load → try → `logLoadError` → `{status:"error"}` → `loadOrError(scope, fn)` in `lib/log/load-error.ts`.
4. **Contradiction (allowed HTML change):** `/admin` renders `AdminNav` twice (layout and page). Remove it from `app/admin/page.tsx`.
5. `tracked-fields.ts`: field-key normalising copied three times; "adapter registered" check repeated here and in `etfs.ts`, `operations.ts`, `history.ts`, `home.ts` → `isAdapterRegistered(registry, key)`; `listFieldsForEtf` builds the same data twice.
6. `untrackField` makes two round trips → one batch (like `moveField`).
7. Field-move direction validated in the action and again in `moveField` → validate once in `lib/config` (DEC-016). Allowed change: a malformed direction shows "Invalid direction." instead of "Invalid request." (*check* the action test).
8. `createCronConfigDeps` and `createHomeDisplayConfigDeps` are identical → one `createDbDeps`.
9. Hour range check written four times in `cron.ts` → `isHour`; keep the RangeError texts.
10. `TrackedFieldsAdmin.tsx`: hidden inputs repeated four times and identical up/down forms → local `FieldActionForm` (same HTML); unused `symbol` prop and the extra `Loaded` mapping in `fields/page.tsx`.
11. Five SVG icons repeat eight attributes (`HeaderNav.tsx`, `ThemeToggle.tsx`) → one `Icon` wrapper, same attribute order.
12. `globals.css`: dead rules (`input[type="number"]`, `input[type="hidden"]`, `[data-theme-toggle]{font:inherit}`), declarations already inherited (`[data-home-numeric]` font-variant, `[data-home-row-link]` link styles, `[data-app-nav] a` text-decoration, `dl dt`), `--radius` repeated in the dark block. Keep `--flat`/`--focus` (theme tests compare token sets; *check*).
13. Small: `/admin` revalidation of ETF data the index page does not show; `symbol.trim().toUpperCase()` re-implementing `normaliseSymbol`; discriminate `DetectEtfAdapterResult` instead of `reason: undefined` + cast; `cron/page.tsx` array destructuring of two values.

## Not in Sprint 12 (would change behaviour; owner's call, no question raised now)
Panel save returning only `{ok}`; one-batch ETF detail page (narrows the widget-error catch); removing `lib/theme.ts` reference functions (they back a test of the inline theme script); `report-latest` CLI not calling `canHandle`; unwritten `reports.status` values `missing/no_adapter` (still used for display text); `/health` showing raw error text (P15, accepted). Test-only exports (statement builders, constants used by tests) stay.
