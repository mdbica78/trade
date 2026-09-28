import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchRunner } from "../ingestion/store";
import { createDrizzleReportStore } from "../ingestion/store";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { buildLatestReportLinksStatement, buildReportOnlyLinksStatement, createHomeTableLoader } from "./home";

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

async function catalogueRow(fieldKey: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    ["brd-depositary", fieldKey, fieldKey, fieldKey],
  );
}

async function ok(reportDate: string, values: { fieldKey: string; numericValue: string }[]) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId: db.etfId,
    reportDate,
    sourceUrl: `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: new Date(`${reportDate}T09:00:00Z`),
    status: "ok",
    errorMessage: null,
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
}

function loader(run: BatchRunner) {
  return createHomeTableLoader(db.mockDb, undefined, run);
}

function countingRunner(inner: BatchRunner): { run: BatchRunner; calls: { count: number } } {
  const calls = { count: 0 };
  const run: BatchRunner = async (statements) => {
    calls.count++;
    return inner(statements);
  };
  return { run, calls };
}

function scriptedRunner(errors: readonly (unknown | null)[]): { run: BatchRunner; calls: { count: number } } {
  const calls = { count: 0 };
  const run: BatchRunner = async () => {
    const error = errors[calls.count];
    calls.count++;
    if (error !== null && error !== undefined) throw error;
    return [];
  };
  return { run, calls };
}

describe("createHomeTableLoader falls back only for the missing etf_report_links table (DEC-019 §3, AC4)", () => {
  it("HF-1: dropping etf_report_links keeps the loader's result identical and logs one safe line", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await catalogueRow("nav_per_unit");
    await ok("2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "10.000" }]);
    await ok("2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "10.500" }]);

    const before = await loader(db.runner)();

    await db.pg.exec(`drop table "etf_report_links"`);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, calls } = countingRunner(db.runner);
    const after = await loader(run)();
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    spy.mockRestore();

    expect(after).toEqual(before);
    expect(calls.count).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] home\/report-links name=[A-Za-z_$][\w$]* code=42P01 relation=etf_report_links$/);
  }, 60_000);

  it("HF-2: dropping reports (etf_report_links present) rejects without retry and logs nothing from the loader", async () => {
    await db.pg.exec(`drop table "reports" cascade`);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, calls } = countingRunner(db.runner);
    await expect(loader(run)()).rejects.toBeTruthy();
    spy.mockRestore();

    expect(calls.count).toBe(1);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    expect(lines).toHaveLength(0);
  }, 60_000);

  it("HF-3: a wrong code (42703) is not treated as the missing-table case", async () => {
    const wrapper = new Error("outer", {
      cause: { code: "42703", message: 'column "x" of relation "etf_report_links" does not exist' },
    });
    const { run, calls } = scriptedRunner([wrapper]);

    await expect(loader(run)()).rejects.toBe(wrapper);
    expect(calls.count).toBe(1);
  });

  it("HF-4: 42P01 on a different relation (reports) is not treated as the missing-table case", async () => {
    const err = Object.assign(new Error('relation "reports" does not exist'), { code: "42P01" });
    const { run, calls } = scriptedRunner([err]);

    await expect(loader(run)()).rejects.toBe(err);
    expect(calls.count).toBe(1);
  });

  it("HF-5: the retry itself failing propagates the second error, one home/report-links line total", async () => {
    const first = Object.assign(new Error('relation "etf_report_links" does not exist'), { code: "42P01" });
    const second = new Error("boom");
    const { run, calls } = scriptedRunner([first, second]);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(loader(run)()).rejects.toBe(second);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    spy.mockRestore();

    expect(calls.count).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] home\/report-links /);
  });

  it("HF-6: the normal path (table present) makes exactly one call and logs nothing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, calls } = countingRunner(db.runner);
    await loader(run)();
    spy.mockRestore();

    expect(calls.count).toBe(1);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    expect(lines).toHaveLength(0);
  });

  it("HF-7: buildReportOnlyLinksStatement equals buildLatestReportLinksStatement when no link rows exist", async () => {
    await db.pg.query(
      `insert into "etfs" ("symbol", "name", "bvb_url", "is_active") values ($1, $2, $3, $4)`,
      ["INACTIVE1", "Inactive ETF", "https://bvb.ro/inactive", false],
    );
    const nullUrlEtf = await db.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url") values ($1, $2, $3) returning "id"`,
      ["NULLURL", "No URL ETF", "https://bvb.ro/nullurl"],
    );
    await db.pg.query(
      `insert into "reports" ("etf_id", "report_date", "source_url", "fetched_at", "status") values ($1, $2, $3, $4, 'ok')`,
      [nullUrlEtf.rows[0].id, "2026-09-22", null, new Date("2026-09-22T09:00:00Z")],
    );
    await db.pg.query(
      `insert into "reports" ("etf_id", "report_date", "source_url", "fetched_at", "status") values ($1, $2, $3, $4, 'ok')`,
      [db.etfId, "2026-09-22", "https://bvb.ro/report.pdf", new Date("2026-09-22T09:00:00Z")],
    );

    const [reportOnly] = await db.runner([buildReportOnlyLinksStatement(db.mockDb)]);
    const [full] = await db.runner([buildLatestReportLinksStatement(db.mockDb)]);

    const sortByEtfId = (rows: readonly unknown[]) =>
      [...(rows as { etf_id: number }[])].sort((a, b) => a.etf_id - b.etf_id);

    expect(sortByEtfId(reportOnly as unknown[])).toEqual(sortByEtfId(full as unknown[]));
  });
});
