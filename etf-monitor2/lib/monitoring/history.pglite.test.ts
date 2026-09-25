import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDrizzleReportStore } from "../ingestion/store";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { createEtfHistoryLoader, buildHistoryEtfStatement } from "./history";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function insertEtf(symbol: string, adapterKey: string | null, name = `${symbol} name`, isActive = true) {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1, $2, $3, $4, $5) returning "id"`,
    [symbol, name, `https://bvb.ro/${symbol}`, adapterKey, isActive],
  );
  return result.rows[0].id;
}

async function trackField(etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
    [etfId, fieldKey, displayOrder],
  );
}

async function insertCatalog(adapterKey: string, fieldKey: string, labelRo: string, labelEn: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    [adapterKey, fieldKey, labelRo, labelEn],
  );
}

function loader() {
  return createEtfHistoryLoader(db.mockDb, db.runner);
}

async function ok(etfId: number, reportDate: string, values: { fieldKey: string; numericValue: string }[]) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId,
    reportDate,
    sourceUrl: `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: new Date(`${reportDate}T09:00:00Z`),
    status: "ok",
    errorMessage: null,
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
}

async function parseError(etfId: number, reportDate: string, values: { fieldKey: string; numericValue: string }[]) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId,
    reportDate,
    sourceUrl: `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: new Date(`${reportDate}T09:00:00Z`),
    status: "parse_error",
    errorMessage: "boom",
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
}

/**
 * `missing`/`no_adapter` reports are never written through `store.saveReport` (its `status`
 * type is `"ok" | "parse_error"` only — a missing/no-adapter day is documented to get no
 * `reports` row at all, Sprint 3 decision). Inserted directly here only to prove the read
 * model's `"ok"` SQL filter excludes every non-`ok` status, not just `parse_error`.
 */
async function insertRawStatusReport(etfId: number, reportDate: string, status: "missing" | "no_adapter") {
  await db.pg.query(
    `insert into "reports" ("etf_id", "report_date", "status") values ($1, $2, $3)`,
    [etfId, reportDate, status],
  );
}

describe("createEtfHistoryLoader executed on PGlite", () => {
  it("AC1: unknown symbol gives null, no ETF row is created or altered", async () => {
    const before = await db.pg.query('select count(*) as "count" from "etfs"');
    const result = await loader()("NOPE");
    const after = await db.pg.query('select count(*) as "count" from "etfs"');
    expect(result).toBeNull();
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("AC1: exact match only, case-sensitive, no trimming", async () => {
    expect(await loader()("btbetretf")).toBeNull();
    expect(await loader()("BTBETRETF ")).toBeNull();
    const found = await loader()("BTBETRETF");
    expect(found).not.toBeNull();
  });

  it("AC1: a SQL-injection-shaped symbol is just a literal string, no row matches, table untouched", async () => {
    const before = await db.pg.query('select count(*) as "count" from "etfs"');
    const result = await loader()("x' or '1'='1");
    const after = await db.pg.query('select count(*) as "count" from "etfs"');
    expect(result).toBeNull();
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("AC1: symbol is a bound parameter, never interpolated into the SQL text", () => {
    const { sql: sqlText, params } = buildHistoryEtfStatement(db.mockDb, "SYM").getQuery();
    expect(params).toContain("SYM");
    expect(sqlText).not.toContain("SYM");
  });

  it("AC1: returns the ETF's symbol, stored name and is_active", async () => {
    const result = await loader()("BTBETRETF");
    expect(result?.etf).toEqual({ symbol: "BTBETRETF", name: "BT Index Romania ETF BET-TR", isActive: true });
  });

  it("AC3(a): rows are ordered newest report_date first, regardless of insertion order", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok(db.etfId, "2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "10" }]);
    await ok(db.etfId, "2026-09-23", [{ fieldKey: "nav_per_unit", numericValue: "12" }]);
    await ok(db.etfId, "2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "11" }]);

    const result = await loader()("BTBETRETF");
    expect(result?.rows.map((r) => r.reportDate)).toEqual(["2026-09-23", "2026-09-22", "2026-09-21"]);
  });

  it("AC3(b): field order is display_order then field_key", async () => {
    await trackField(db.etfId, "b_field", 0);
    await trackField(db.etfId, "a_field", 1);
    await trackField(db.etfId, "c_field", 1);

    const result = await loader()("BTBETRETF");
    expect(result?.fields.map((f) => f.fieldKey)).toEqual(["b_field", "a_field", "c_field"]);
  });

  it("AC3(c): labels come from the ETF's own adapter, not the alphabetically first one", async () => {
    await insertCatalog("a-adapter", "shared_field", "A label ro", "A label en");
    await insertCatalog("brd-depositary", "shared_field", "Own label ro", "Own label en");
    await trackField(db.etfId, "shared_field", 0);

    const result = await loader()("BTBETRETF");
    expect(result?.fields[0]).toEqual({ fieldKey: "shared_field", labelRo: "Own label ro", labelEn: "Own label en" });
  });

  it("AC3(c): no catalogue row, or a NULL adapter_key, falls back to field_key", async () => {
    await trackField(db.etfId, "no_catalog_entry", 0);
    const withCatalog = await loader()("BTBETRETF");
    expect(withCatalog?.fields[0]).toEqual({ fieldKey: "no_catalog_entry", labelRo: "no_catalog_entry", labelEn: "no_catalog_entry" });

    await insertEtf("NULLADAPTER", null);
    await trackField((await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', ["NULLADAPTER"])).rows[0].id, "some_field", 0);
    const nullAdapter = await loader()("NULLADAPTER");
    expect(nullAdapter?.fields[0]).toEqual({ fieldKey: "some_field", labelRo: "some_field", labelEn: "some_field" });
  });

  it("AC3(d): only tracked fields appear, an untracked stored field never appears anywhere in the result", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await trackField(db.etfId, "units_in_circulation", 1);
    await ok(db.etfId, "2026-09-22", [
      { fieldKey: "nav_per_unit", numericValue: "11" },
      { fieldKey: "units_in_circulation", numericValue: "5000000" },
      { fieldKey: "net_asset", numericValue: "999999" },
    ]);

    const result = await loader()("BTBETRETF");
    expect(result?.fields.map((f) => f.fieldKey)).toEqual(["nav_per_unit", "units_in_circulation"]);
    expect(Object.keys(result!.rows[0].values).sort()).toEqual(["nav_per_unit", "units_in_circulation"]);
    expect(JSON.stringify(result)).not.toContain("999999");
    expect(JSON.stringify(result)).not.toContain("net_asset");
  });

  it("AC3(e): a missing value for a tracked field is null; a report with no values still yields a row with every value null", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await trackField(db.etfId, "units_in_circulation", 1);
    await ok(db.etfId, "2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "10" }]);
    await ok(db.etfId, "2026-09-22", []);

    const result = await loader()("BTBETRETF");
    const row21 = result?.rows.find((r) => r.reportDate === "2026-09-21");
    const row22 = result?.rows.find((r) => r.reportDate === "2026-09-22");
    expect(row21?.values).toEqual({ nav_per_unit: "10", units_in_circulation: null });
    expect(row22?.values).toEqual({ nav_per_unit: null, units_in_circulation: null });
  });

  it("AC3(f): another ETF's reports never appear", async () => {
    const other = await insertEtf("OTHERETF", "brd-depositary");
    await trackField(db.etfId, "nav_per_unit", 0);
    await trackField(other, "nav_per_unit", 0);
    await ok(other, "2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);

    const result = await loader()("BTBETRETF");
    expect(result?.rows).toEqual([]);
  });

  it("AC4: missing calendar days are never filled, no carried-forward value", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await trackField(db.etfId, "units_in_circulation", 1);
    await ok(db.etfId, "2026-09-21", [
      { fieldKey: "nav_per_unit", numericValue: "10" },
      { fieldKey: "units_in_circulation", numericValue: "5000000" },
    ]);
    await ok(db.etfId, "2026-09-23", [{ fieldKey: "nav_per_unit", numericValue: "12" }]);

    const result = await loader()("BTBETRETF");
    expect(result?.rows.map((r) => r.reportDate)).toEqual(["2026-09-23", "2026-09-21"]);
    const row23 = result?.rows.find((r) => r.reportDate === "2026-09-23");
    expect(row23?.values.units_in_circulation).toBeNull();
  });

  it("AC5: only ok reports appear; parse_error, missing and no_adapter rows are all excluded", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok(db.etfId, "2026-09-19", [{ fieldKey: "nav_per_unit", numericValue: "10" }]);
    await parseError(db.etfId, "2026-09-20", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);
    await insertRawStatusReport(db.etfId, "2026-09-21", "missing");
    await insertRawStatusReport(db.etfId, "2026-09-22", "no_adapter");
    await ok(db.etfId, "2026-09-23", [{ fieldKey: "nav_per_unit", numericValue: "12" }]);

    const result = await loader()("BTBETRETF");
    expect(result?.rows.map((r) => r.reportDate)).toEqual(["2026-09-23", "2026-09-19"]);
    expect(JSON.stringify(result)).not.toContain("999");
  });

  it("AC5: an ETF whose only report is parse_error has an empty history", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await parseError(db.etfId, "2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);

    const result = await loader()("BTBETRETF");
    expect(result?.rows).toEqual([]);
  });

  it("AC7: an inactive ETF's history still loads in full", async () => {
    const inactiveId = await insertEtf("OLDETF", "brd-depositary", "Old ETF name", false);
    await trackField(inactiveId, "nav_per_unit", 0);
    await ok(inactiveId, "2026-09-20", [{ fieldKey: "nav_per_unit", numericValue: "9" }]);

    const result = await loader()("OLDETF");
    expect(result?.etf.isActive).toBe(false);
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0]).toEqual({ reportDate: "2026-09-20", values: { nav_per_unit: "9" } });
  });

  it("AC6 (read-model shapes): no tracked fields -> fields: []; no ok report -> rows: []", async () => {
    const noFields = await loader()("BTBETRETF");
    expect(noFields?.fields).toEqual([]);
    expect(noFields?.rows).toEqual([]);

    await trackField(db.etfId, "nav_per_unit", 0);
    const noReports = await loader()("BTBETRETF");
    expect(noReports?.fields).toEqual([{ fieldKey: "nav_per_unit", labelRo: "nav_per_unit", labelEn: "nav_per_unit" }]);
    expect(noReports?.rows).toEqual([]);
  });
});
