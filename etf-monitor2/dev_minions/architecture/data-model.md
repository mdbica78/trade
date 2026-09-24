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

> FR4.1 (missing report → blank in history) is satisfied by simply having no `ok` row for that date. A `missing` row is optional bookkeeping, never a retry trigger.

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

### `settings` — single-row app configuration (FR11, FR12)
| column | type | notes |
|---|---|---|
| id | int PK CHECK (id = 1) | enforces a single row |
| ai_provider | text NULL | selected free LLM provider |
| ai_model | text NULL | |
| cron_hour_utc | int NULL | hour of day the daily job should run |
| default_locale | text NOT NULL default `'ro'` | |

## Notes

- `field_key` is a plain string, deliberately not a foreign key to `field_catalog`, so historical values survive a catalogue change.
- `raw_value` is kept alongside `numeric_value` so parsing bugs stay diagnosable after the fact. Source format, as measured on the BRD depositary reports (US-001 spike, `spikes/pdf-extraction/FINDINGS.md`): `,` thousands separator, `.` decimal mark, variable decimal places (e.g. `415,591,664.27`, `37,470,000`, `8,640,000.00`, VUAN `11.091`). Display format is separate: no thousands separator, decimal mark per locale (DEC-007). (Corrected 2026-09-24; the earlier note said `.` thousands, which the spike disproved.)
- Storage is trivial (one row per ETF per field per day), far inside the Neon free tier.
