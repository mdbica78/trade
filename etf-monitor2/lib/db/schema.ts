import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const etfs = pgTable("etfs", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique("etfs_symbol_unique"),
  name: text("name").notNull(),
  bvbUrl: text("bvb_url").notNull(),
  adapterKey: text("adapter_key"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fieldCatalog = pgTable(
  "field_catalog",
  {
    id: serial("id").primaryKey(),
    adapterKey: text("adapter_key").notNull(),
    fieldKey: text("field_key").notNull(),
    labelRo: text("label_ro").notNull(),
    labelEn: text("label_en").notNull(),
    unit: text("unit"),
  },
  (t) => [
    unique("field_catalog_adapter_key_field_key_unique").on(t.adapterKey, t.fieldKey),
  ],
);

export const trackedFields = pgTable(
  "tracked_fields",
  {
    id: serial("id").primaryKey(),
    etfId: integer("etf_id")
      .notNull()
      .references(() => etfs.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    unique("tracked_fields_etf_id_field_key_unique").on(t.etfId, t.fieldKey),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    etfId: integer("etf_id")
      .notNull()
      .references(() => etfs.id, { onDelete: "cascade" }),
    /** Date the report is FOR, not published/fetched — see US-001 FINDINGS (footer date vs filing stamp). */
    reportDate: date("report_date", { mode: "string" }).notNull(),
    sourceUrl: text("source_url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    status: text("status", {
      enum: ["ok", "missing", "parse_error", "no_adapter"],
    }).notNull(),
    errorMessage: text("error_message"),
  },
  (t) => [
    unique("reports_etf_id_report_date_unique").on(t.etfId, t.reportDate),
  ],
);

export const reportValues = pgTable(
  "report_values",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    numericValue: numeric("numeric_value"),
    rawValue: text("raw_value"),
  },
  (t) => [
    unique("report_values_report_id_field_key_unique").on(t.reportId, t.fieldKey),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: serial("id").primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status", {
      enum: ["running", "success", "partial", "failed"],
    }).notNull(),
    etfsProcessed: integer("etfs_processed").notNull().default(0),
    errorsCount: integer("errors_count").notNull().default(0),
    log: text("log"),
    /** UTC day a scheduled run claimed (DEC-030); NULL on rows that predate the claim or were started otherwise. */
    scheduledDateUtc: date("scheduled_date_utc", { mode: "string" }),
  },
  (table) => [
    uniqueIndex("job_runs_scheduled_date_utc_unique").on(table.scheduledDateUtc),
    index("job_runs_started_at_idx").on(table.startedAt),
  ],
);

export const etfReportLinks = pgTable("etf_report_links", {
  etfId: integer("etf_id")
    .primaryKey()
    .references(() => etfs.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull(),
});

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    aiProvider: text("ai_provider"),
    aiModel: text("ai_model"),
    aiModels: jsonb("ai_models").$type<Record<string, string>>(),
    cronHourUtc: integer("cron_hour_utc"),
    defaultLocale: text("default_locale").notNull().default("ro"),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
);

export const homeDisplaySettings = pgTable(
  "home_display_settings",
  {
    id: integer("id").primaryKey(),
    showAbsolute: boolean("show_absolute").notNull().default(true),
    showPercent: boolean("show_percent").notNull().default(true),
    showArrow: boolean("show_arrow").notNull().default(true),
  },
  (t) => [check("home_display_settings_single_row", sql`${t.id} = 1`)],
);

export const homeDisplayColumns = pgTable(
  "home_display_columns",
  {
    fieldKey: text("field_key").primaryKey(),
    position: integer("position").notNull(),
    showAbsolute: boolean("show_absolute"),
    showPercent: boolean("show_percent"),
    showArrow: boolean("show_arrow"),
  },
  (t) => [unique("home_display_columns_position_unique").on(t.position)],
);

export const homeDisplayEtfs = pgTable("home_display_etfs", {
  etfId: integer("etf_id")
    .primaryKey()
    .references(() => etfs.id, { onDelete: "cascade" }),
  visible: boolean("visible").notNull(),
});

export const etfWidgets = pgTable(
  "etf_widgets",
  {
    id: serial("id").primaryKey(),
    etfId: integer("etf_id")
      .notNull()
      .references(() => etfs.id, { onDelete: "cascade" }),
    slot: smallint("slot").notNull(),
    operation: text("operation").notNull(),
    fieldKey: text("field_key").notNull(),
    periodUnit: text("period_unit").notNull(),
    periodAmount: integer("period_amount").notNull(),
    title: text("title"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("etf_widgets_etf_id_slot_unique").on(t.etfId, t.slot),
    check("etf_widgets_slot_range", sql`${t.slot} between 1 and 6`),
    check("etf_widgets_operation_closed", sql`${t.operation} in ('change', 'percent_change', 'average', 'min', 'max')`),
    check("etf_widgets_period_unit_closed", sql`${t.periodUnit} in ('days', 'reports')`),
    check("etf_widgets_period_amount_range", sql`${t.periodAmount} between 1 and 365`),
  ],
);

export const aiProviderKeys = pgTable("ai_provider_keys", {
  providerId: text("provider_id").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  keySource: text("key_source").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const aiCustomProviders = pgTable(
  "ai_custom_providers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ai_custom_providers_name_length", sql`char_length(${t.name}) between 1 and 40`),
    check(
      "ai_custom_providers_base_url_https",
      sql`${t.baseUrl} like 'https://%' and char_length(${t.baseUrl}) <= 200`,
    ),
  ],
);
