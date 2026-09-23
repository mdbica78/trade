import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  etfs,
  fieldCatalog,
  jobRuns,
  reportValues,
  reports,
  settings,
  trackedFields,
} from "./schema";

type ColumnExpectation = {
  name: string;
  sqlType: string;
  notNull: boolean;
  hasDefault: boolean;
  primary?: boolean;
};

function columnMap(table: unknown) {
  const { columns } = getTableConfig(table as never);
  return new Map(columns.map((c) => [c.name, c]));
}

function expectColumns(table: unknown, expected: ColumnExpectation[]) {
  const cols = columnMap(table);
  expect(new Set(cols.keys())).toEqual(new Set(expected.map((e) => e.name)));
  for (const e of expected) {
    const c = cols.get(e.name)!;
    expect(c.getSQLType(), `${e.name} type`).toBe(e.sqlType);
    expect(c.notNull, `${e.name} notNull`).toBe(e.notNull);
    expect(c.hasDefault, `${e.name} hasDefault`).toBe(e.hasDefault);
    if (e.primary) {
      expect(c.primary, `${e.name} primary`).toBe(true);
    }
  }
}

describe("schema — tables and columns", () => {
  it("exports exactly the seven documented tables", () => {
    const names = [
      etfs,
      fieldCatalog,
      trackedFields,
      reports,
      reportValues,
      jobRuns,
      settings,
    ].map((t) => getTableConfig(t as never).name);
    expect(new Set(names)).toEqual(
      new Set([
        "etfs",
        "field_catalog",
        "tracked_fields",
        "reports",
        "report_values",
        "job_runs",
        "settings",
      ]),
    );
  });

  it("etfs", () => {
    expectColumns(etfs, [
      { name: "id", sqlType: "serial", notNull: true, hasDefault: true, primary: true },
      { name: "symbol", sqlType: "text", notNull: true, hasDefault: false },
      { name: "name", sqlType: "text", notNull: true, hasDefault: false },
      { name: "bvb_url", sqlType: "text", notNull: true, hasDefault: false },
      { name: "adapter_key", sqlType: "text", notNull: false, hasDefault: false },
      { name: "is_active", sqlType: "boolean", notNull: true, hasDefault: true },
      {
        name: "created_at",
        sqlType: "timestamp with time zone",
        notNull: true,
        hasDefault: true,
      },
    ]);
    const symbol = columnMap(etfs).get("symbol")!;
    expect(symbol.isUnique).toBe(true);
  });

  it("field_catalog", () => {
    expectColumns(fieldCatalog, [
      { name: "id", sqlType: "serial", notNull: true, hasDefault: true, primary: true },
      { name: "adapter_key", sqlType: "text", notNull: true, hasDefault: false },
      { name: "field_key", sqlType: "text", notNull: true, hasDefault: false },
      { name: "label_ro", sqlType: "text", notNull: true, hasDefault: false },
      { name: "label_en", sqlType: "text", notNull: true, hasDefault: false },
      { name: "unit", sqlType: "text", notNull: false, hasDefault: false },
    ]);
  });

  it("tracked_fields", () => {
    expectColumns(trackedFields, [
      { name: "id", sqlType: "serial", notNull: true, hasDefault: true, primary: true },
      { name: "etf_id", sqlType: "integer", notNull: true, hasDefault: false },
      { name: "field_key", sqlType: "text", notNull: true, hasDefault: false },
      { name: "display_order", sqlType: "integer", notNull: true, hasDefault: true },
    ]);
  });

  it("reports", () => {
    expectColumns(reports, [
      { name: "id", sqlType: "serial", notNull: true, hasDefault: true, primary: true },
      { name: "etf_id", sqlType: "integer", notNull: true, hasDefault: false },
      { name: "report_date", sqlType: "date", notNull: true, hasDefault: false },
      { name: "source_url", sqlType: "text", notNull: false, hasDefault: false },
      {
        name: "fetched_at",
        sqlType: "timestamp with time zone",
        notNull: false,
        hasDefault: false,
      },
      { name: "status", sqlType: "text", notNull: true, hasDefault: false },
      { name: "error_message", sqlType: "text", notNull: false, hasDefault: false },
    ]);
  });

  it("report_values", () => {
    expectColumns(reportValues, [
      { name: "id", sqlType: "serial", notNull: true, hasDefault: true, primary: true },
      { name: "report_id", sqlType: "integer", notNull: true, hasDefault: false },
      { name: "field_key", sqlType: "text", notNull: true, hasDefault: false },
      { name: "numeric_value", sqlType: "numeric", notNull: false, hasDefault: false },
      { name: "raw_value", sqlType: "text", notNull: false, hasDefault: false },
    ]);
  });

  it("job_runs", () => {
    expectColumns(jobRuns, [
      { name: "id", sqlType: "serial", notNull: true, hasDefault: true, primary: true },
      {
        name: "started_at",
        sqlType: "timestamp with time zone",
        notNull: true,
        hasDefault: false,
      },
      {
        name: "finished_at",
        sqlType: "timestamp with time zone",
        notNull: false,
        hasDefault: false,
      },
      { name: "status", sqlType: "text", notNull: true, hasDefault: false },
      { name: "etfs_processed", sqlType: "integer", notNull: true, hasDefault: true },
      { name: "errors_count", sqlType: "integer", notNull: true, hasDefault: true },
      { name: "log", sqlType: "text", notNull: false, hasDefault: false },
    ]);
  });

  it("settings", () => {
    expectColumns(settings, [
      { name: "id", sqlType: "integer", notNull: true, hasDefault: false, primary: true },
      { name: "ai_provider", sqlType: "text", notNull: false, hasDefault: false },
      { name: "ai_model", sqlType: "text", notNull: false, hasDefault: false },
      { name: "cron_hour_utc", sqlType: "integer", notNull: false, hasDefault: false },
      { name: "default_locale", sqlType: "text", notNull: true, hasDefault: true },
    ]);
    const { checks } = getTableConfig(settings);
    expect(checks.map((c) => c.name)).toContain("settings_single_row");
  });
});

describe("schema — foreign keys", () => {
  it("declares exactly the three documented FKs, all ON DELETE CASCADE, all NOT NULL", () => {
    const all = [
      { table: trackedFields, tableName: "tracked_fields" },
      { table: reports, tableName: "reports" },
      { table: reportValues, tableName: "report_values" },
    ];
    const found: { table: string; column: string; foreignTable: string; foreignColumn: string; onDelete: string | undefined }[] = [];
    for (const { table, tableName } of all) {
      const { foreignKeys } = getTableConfig(table as never);
      for (const fk of foreignKeys) {
        const ref = fk.reference();
        found.push({
          table: tableName,
          column: ref.columns[0]!.name,
          foreignTable: getTableConfig(ref.foreignTable as never).name,
          foreignColumn: ref.foreignColumns[0]!.name,
          onDelete: fk.onDelete,
        });
      }
    }
    expect(found).toHaveLength(3);
    expect(found).toContainEqual({
      table: "tracked_fields",
      column: "etf_id",
      foreignTable: "etfs",
      foreignColumn: "id",
      onDelete: "cascade",
    });
    expect(found).toContainEqual({
      table: "reports",
      column: "etf_id",
      foreignTable: "etfs",
      foreignColumn: "id",
      onDelete: "cascade",
    });
    expect(found).toContainEqual({
      table: "report_values",
      column: "report_id",
      foreignTable: "reports",
      foreignColumn: "id",
      onDelete: "cascade",
    });

    // field_key is deliberately not an FK (data-model.md "Notes").
    expect(getTableConfig(fieldCatalog as never).foreignKeys).toHaveLength(0);

    // NOT NULL on the three FK columns (DEC-010, D1).
    expect(columnMap(trackedFields).get("etf_id")!.notNull).toBe(true);
    expect(columnMap(reports).get("etf_id")!.notNull).toBe(true);
    expect(columnMap(reportValues).get("report_id")!.notNull).toBe(true);
  });
});

describe("schema — duplicate-ingestion guards", () => {
  it("reports has UNIQUE (etf_id, report_date)", () => {
    const { uniqueConstraints } = getTableConfig(reports as never);
    const names = uniqueConstraints.map((u) => u.columns.map((c) => c.name).sort());
    expect(names).toContainEqual(["etf_id", "report_date"].sort());
  });

  it("report_values has UNIQUE (report_id, field_key)", () => {
    const { uniqueConstraints } = getTableConfig(reportValues as never);
    const names = uniqueConstraints.map((u) => u.columns.map((c) => c.name).sort());
    expect(names).toContainEqual(["report_id", "field_key"].sort());
  });
});

describe("schema — committed migration", () => {
  const drizzleDir = path.resolve(__dirname, "../../drizzle");
  const journalPath = path.join(drizzleDir, "meta", "_journal.json");

  it("has a journal with at least one migration entry, and the SQL file exists", () => {
    expect(existsSync(journalPath)).toBe(true);
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    expect(journal.entries.length).toBeGreaterThanOrEqual(1);
    const entry = journal.entries[0];
    const sqlPath = path.join(drizzleDir, `${entry.tag}.sql`);
    expect(existsSync(sqlPath)).toBe(true);
  });

  it("the generated SQL contains all seven CREATE TABLE statements, both unique guards, three cascades and the settings check", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const entry = journal.entries[0];
    const sql = readFileSync(path.join(drizzleDir, `${entry.tag}.sql`), "utf8");
    const normalized = sql.toLowerCase();

    for (const table of [
      "etfs",
      "field_catalog",
      "tracked_fields",
      "reports",
      "report_values",
      "job_runs",
      "settings",
    ]) {
      expect(normalized).toMatch(new RegExp(`create table\\s+"${table}"`));
    }

    expect(normalized).toMatch(/unique\("etf_id","report_date"\)/);
    expect(normalized).toMatch(/unique\("report_id","field_key"\)/);
    expect((normalized.match(/on delete cascade/g) ?? []).length).toBe(3);
    expect(normalized).toMatch(/check\s*\("settings"\."id"\s*=\s*1\)/);
  });
});

describe("schema module exports", () => {
  it("exposes exactly the seven table exports used elsewhere in the app", () => {
    const keys = Object.keys(schema).sort();
    expect(keys).toEqual(
      [
        "etfs",
        "fieldCatalog",
        "trackedFields",
        "reports",
        "reportValues",
        "jobRuns",
        "settings",
      ].sort(),
    );
  });
});
