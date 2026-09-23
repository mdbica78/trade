import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
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

export const jobRuns = pgTable("job_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status", {
    enum: ["running", "success", "partial", "failed"],
  }).notNull(),
  etfsProcessed: integer("etfs_processed").notNull().default(0),
  errorsCount: integer("errors_count").notNull().default(0),
  log: text("log"),
});

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    aiProvider: text("ai_provider"),
    aiModel: text("ai_model"),
    cronHourUtc: integer("cron_hour_utc"),
    defaultLocale: text("default_locale").notNull().default("ro"),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
);
