import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDrizzleReportStore } from "../ingestion/store";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { createEtfHistoryLoader } from "./history";
import { buildChartSeries } from "./chart-series";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function trackField(etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
    [etfId, fieldKey, displayOrder],
  );
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

describe("buildChartSeries through the real read model, on PGlite (AC2/AC1)", () => {
  it("a parse_error report contributes no value, and the series stops at the newest ok report", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok(db.etfId, "2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "11.1" }]);
    await parseError(db.etfId, "2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);
    await ok(db.etfId, "2026-09-23", [{ fieldKey: "nav_per_unit", numericValue: "11.3" }]);

    const history = await createEtfHistoryLoader(db.mockDb, db.runner)("BTBETRETF");
    const points = buildChartSeries(history!.rows, "nav_per_unit");
    expect(points.map((p) => p.date)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(points.find((p) => p.date === "2026-09-22")).toEqual({ date: "2026-09-22", value: null, display: null });
    expect(JSON.stringify(points)).not.toContain("999");
  });

  it("a parse_error report after the newest ok report does not extend the series", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok(db.etfId, "2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "11.1" }]);
    await ok(db.etfId, "2026-09-23", [{ fieldKey: "nav_per_unit", numericValue: "11.3" }]);
    await parseError(db.etfId, "2026-09-24", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);

    const history = await createEtfHistoryLoader(db.mockDb, db.runner)("BTBETRETF");
    const points = buildChartSeries(history!.rows, "nav_per_unit");
    expect(points[points.length - 1].date).toBe("2026-09-23");
  });

  it("AC1 end-to-end: an untracked stored field never becomes a series, since it never appears in the history model's fields", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok(db.etfId, "2026-09-22", [
      { fieldKey: "nav_per_unit", numericValue: "11" },
      { fieldKey: "net_asset", numericValue: "999999" },
    ]);

    const history = await createEtfHistoryLoader(db.mockDb, db.runner)("BTBETRETF");
    expect(history!.fields.map((f) => f.fieldKey)).toEqual(["nav_per_unit"]);
    const series = history!.fields.map((f) => buildChartSeries(history!.rows, f.fieldKey));
    expect(series).toHaveLength(1);
    expect(JSON.stringify(series)).not.toContain("999999");
  });
});
