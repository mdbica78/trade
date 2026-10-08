# Data model

Derived from the functional requirements. Referenced by US-003 and by every story that reads or writes data.

## Tables

### `etfs` — the monitored ETF registry (FR1, FR9)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| symbol | text UNIQUE NOT NULL | e.g. `BTBETRETF` |
| name | text NOT NULL | full fund name |
| bvb_url | text NOT NULL | instrument page on bvb.ro |
| adapter_key | text NULL | which extraction adapter handles it; NULL = no adapter matched (FR13) |
| is_active | boolean NOT NULL default true | soft removal from monitoring |
| created_at | timestamptz NOT NULL default now() | |

### `field_catalog` — what each adapter can extract (FR10)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| adapter_key | text NOT NULL | |
| field_key | text NOT NULL | e.g. `units_in_circulation` |
| label_ro | text NOT NULL | UI label, Romanian |
| label_en | text NOT NULL | UI label, English |
| unit | text NULL | `RON`, `count`, … |
| UNIQUE (adapter_key, field_key) | | |

### `tracked_fields` — what the user chose to track, per ETF (FR2, FR10)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| etf_id | int NOT NULL FK → etfs.id ON DELETE CASCADE | NOT NULL per DEC-010 |
| field_key | text NOT NULL | |
| display_order | int NOT NULL default 0 | column order on the home table |
| UNIQUE (etf_id, field_key) | | |

### `reports` — one row per ETF per report date (FR3, FR4.1, FR13)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| etf_id | int NOT NULL FK → etfs.id ON DELETE CASCADE | NOT NULL per DEC-010 |
| report_date | date NOT NULL | the date the report is **for**, not when it was published |
| source_url | text NULL | direct PDF link, shown in the UI (FR7) |
| fetched_at | timestamptz NULL | |
| status | text NOT NULL | `ok` \| `missing` \| `parse_error` \| `no_adapter` |
| error_message | text NULL | |
| UNIQUE (etf_id, report_date) | | |

> FR4.1 (missing report → blank in history) is satisfied by simply having no `ok` row for that date.
> As built (Sprint 3 decision 4): a failure with no report date from the PDF (fetch error, no report found,
> unreadable PDF, no adapter) writes **no** `reports` row and is recorded only in `job_runs.log`; `missing` and
> `no_adapter` are allowed by the schema but unused today. A `parse_error` row can carry the values that were
> found (Sprint 3 decision 5); the UI shows values from `ok` rows only (product decision P4).

### `report_values` — the extracted numbers (FR4)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| report_id | int NOT NULL FK → reports.id ON DELETE CASCADE | NOT NULL per DEC-010 |
| field_key | text NOT NULL | |
| numeric_value | numeric NULL | parsed value |
| raw_value | text NULL | as it appeared in the PDF, for auditing |
| UNIQUE (report_id, field_key) | | |

### `job_runs` — cron execution log (FR13)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| started_at | timestamptz NOT NULL | |
| finished_at | timestamptz NULL | |
| status | text NOT NULL | `running` \| `success` \| `partial` \| `failed` |
| etfs_processed | int NOT NULL default 0 | |
| errors_count | int NOT NULL default 0 | |
| log | text NULL | human-readable summary |

### `etf_report_links` — newest known report link for a no-adapter ETF (Section 3, US-030)
| column | type | notes |
|---|---|---|
| etf_id | int PK FK → etfs.id ON DELETE CASCADE | one row per ETF |
| source_url | text NOT NULL | newest depositary-report PDF link discovery found, whatever the adapter outcome |
| discovered_at | timestamptz NOT NULL | clock time of the write, from the caller's injected `now` |

### `settings` — single-row app configuration (FR11, FR12)
| column | type | notes |
|---|---|---|
| id | int PK CHECK (id = 1) | enforces a single row |
| ai_provider | text NULL | selected free LLM provider |
| ai_model | text NULL | |
| cron_hour_utc | int NULL | the admin's desired hour; the effective schedule stays in `vercel.json` and changes when the user commits the line `/admin/cron` shows and redeploys (US-023, sprint-05 decision 11) |
| default_locale | text NOT NULL default `'ro'` | |

### `ai_provider_keys` — encrypted provider credentials (FR16, DEC-021)
| column | type | notes |
|---|---|---|
| provider_id | text PK | closed provider-catalogue id |
| ciphertext | text NOT NULL | base64 of `iv ‖ authentication tag ‖ ciphertext`; never plaintext |
| key_source | text NOT NULL | `master` or `cron_derived`; determines the only permitted decryption source |
| updated_at | timestamptz NOT NULL | |

The application stores keys submitted at `/admin/ai` in this table in encrypted form. The table has
no plaintext, prefix, suffix, key-length, or endpoint column. Its migration is applied by the
production build (DEC-023).

### `ai_custom_providers` — up to 5 user-defined OpenAI-compatible providers (DEC-026 §2)
| column | type | notes |
|---|---|---|
| id | serial PK | the provider id shown elsewhere is `custom-<id>` |
| name | text NOT NULL, CHECK 1-40 chars | |
| base_url | text NOT NULL, CHECK starts `https://` and ≤ 200 chars | no `/chat/completions` suffix stored |
| created_at | timestamptz NOT NULL default now() | |

`lib/config/custom-providers.ts` alone reads and writes this table (no FK to `ai_provider_keys`,
whose `provider_id` stays free text). Changing or deleting a provider's address deletes that
provider's stored key in the same atomic batch — the delete statement is built by
`lib/ai/key-store.ts` (`buildClearStoredProviderKeyStatement`) and wired in from
`lib/config/ai-keys.ts`, the only approved importer of both modules. A custom provider's key AAD
binds the provider id *and* the base URL (`providerKeyAad`), so a key saved for one address can
never decrypt under another. A missing table (`42P01`) reads as no custom providers.

### `home_display_settings`, `home_display_columns`, `home_display_etfs` — shared home view (FR7.3)

`home_display_settings` is a single row (`id = 1`) holding the global absolute, percent and arrow
switches. No row means the default home view. `home_display_columns` holds the selected catalogue
`field_key`s and their unique display positions, with nullable per-column change overrides
(`NULL` follows the global switch). `home_display_etfs` holds an explicit visibility choice for an
ETF; an active ETF with no row is visible by default. Its `etf_id` references `etfs.id` with
`ON DELETE CASCADE`.

### `etf_widgets` — per-ETF derived-value definitions (FR18, DEC-022)

Each row has a serial `id`, cascading `etf_id`, unique `(etf_id, slot)` with
slot 1–6, a closed `operation` (`change`, `percent_change`, `average`, `min`,
`max`), existing numeric-catalogue `field_key`, closed `period_unit`
(`days` or `reports`), integer `period_amount` 1–365, optional plain-text
`title`, and timezone-aware `updated_at`. Definitions live in columns rather
than JSON; no raw-field or extraction definition is added.

## Write rules (binding)

- A report and its values are written atomically in one Neon HTTP batch; `report_id` is resolved by
  subquery and `status = 'ok'` is set last (DEC-010, `lib/ingestion/store.ts`).
- An `ok` row is never downgraded or overwritten: every write statement is guarded `status <> 'ok'`.
- `report_date` comes only from the PDF's own report-date text (BRD: the footer; InterCapital: the `Data:` line), never from the filing stamp or the clock
  (US-001 findings, trap 2).
- The daily run stores every report of the newest filing row (up to `MAX_REPORTS_PER_FILING`, newest first,
  US-037 AC1). Each report is its own DEC-010 batch above; no batch mixes two reports.
- A link whose `source_url` already has an `ok` report for that ETF is skipped with no request
  (`ReportStore.findStoredReportUrls`, one read per ETF, outside any write batch, US-037 AC3). A link that
  resolves to an already-`ok` report date (a different URL, same date) is a no-op there too.
- Every field the adapter extracts is stored, whatever the ETF tracks (FR3.1, P1). Tracked fields decide only
  `ok` vs `parse_error` and select what the home table/detail page display, not what is stored. Reports stored
  before US-037 keep only the fields that were tracked when they were written (no backfill).
- `job_runs.log` holds per-ETF outcome codes (`lib/ingestion/outcome.ts`, including `not_attempted` when the
  run deadline guard skips an ETF, US-030 AC7, and the four filing counts — stored/already stored/failed/not
  attempted, US-037 AC1/AC5) and never secrets; a run killed by
  the platform is swept to `failed` on the next run, with `finished_at` left NULL (US-015).
- `etf_report_links` holds exactly one row per ETF, written by a single `on conflict ("etf_id") do update`
  upsert statement (`lib/ingestion/report-links.ts`), never batched with a `reports` write. It is written only
  by adapter detection (`addEtf`/`detectEtfAdapter`, whatever the detection reason) and the daily run's
  no-adapter branch (only on a `found` discovery), and is never read as a report. A failed write never fails
  the ETF insert/detection result or the ingest outcome (US-030 AC8). A run that finds nothing keeps the
  existing row unchanged.
- Read side: `etf_report_links` is an optional enrichment for the home table only; if the table itself is
  missing (Postgres `42P01`, e.g. its migration was never applied), `lib/monitoring/home.ts` falls back to
  report-derived links only and logs one safe diagnostic line, rather than failing the whole page (US-033, DEC-019 §3).
- `lib/config/home-display.ts` is the only writer of the three home-display tables. A save validates the
  complete submitted state and replaces the rows of all three tables in one atomic batch; partial settings
  are never exposed (US-047, DEC-016).
- `lib/config/widgets.ts` alone validates and writes widget definitions. A
  replacement validates every definition against that ETF's numeric adapter
  catalogue and replaces only its rows in one atomic batch. At most six slots
  belong to each ETF; deleting the ETF cascades its definitions (US-043,
  DEC-022).
- Read side: `lib/monitoring/home.ts` alone reads the home-display tables to construct the shared home view.
  If any one is missing (`42P01`), it logs one sanitised diagnostic and falls back to the unsaved view;
  other database errors still fail the read (US-047, DEC-019 §3).
- `lib/ai/key-store.ts` alone encrypts/decrypts and reads/writes `ai_provider_keys`. The recorded
  `key_source` is authoritative; a missing or rotated source makes only that stored key unavailable.
  Provider resolution prefers a successfully decrypted stored key, then its environment key. Plaintext
  is never persisted, returned to `/app`, rendered, or logged (US-040, DEC-021).
- A home-table cell's change is computed **per field**, not per ETF-per-calendar-day: the previous value used
  for a delta is that field's own most recent earlier stored value, whatever `ok` report it came from, even
  if a different field on the same row compares against a different earlier date. A field with no earlier
  stored value has `delta: null` (US-036 AC4, review §3 T-2).
- Migrations are generated locally (`pnpm db:generate`); the production build applies them during deploy
  (DEC-023). Agents generate expand-only migrations and never apply them to a live database.
- `lib/config/custom-providers.ts` alone reads and writes `ai_custom_providers`; changing or deleting a
  provider's address deletes that provider's stored key in the same atomic batch (the statement is built
  by `lib/ai/key-store.ts`). A custom provider's key AAD binds the provider id and the base URL. A missing
  table (`42P01`) reads as no custom providers (US-057, DEC-026 §2).

## Notes

- `field_key` is a plain string, deliberately not a foreign key to `field_catalog`, so historical values survive a catalogue change.
- `raw_value` is kept alongside `numeric_value` so parsing bugs stay diagnosable after the fact. Source format, as measured on the BRD depositary reports (US-001 spike, `spikes/pdf-extraction/FINDINGS.md`): `,` thousands separator, `.` decimal mark, variable decimal places (e.g. `415,591,664.27`, `37,470,000`, `8,640,000.00`, VUAN `11.091`). Display format is separate: no thousands separator, decimal mark per locale (DEC-007). (Corrected 2026-09-24; the earlier note said `.` thousands, which the spike disproved.)
- Storage is trivial (one row per ETF per field per day), far inside the Neon free tier.
