import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdapterRegistry } from "../extraction/adapters/registry";
import type { ExtractionAdapter } from "../extraction/adapters/types";
import { createDrizzleReportStore } from "../ingestion/store";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { buildEtfStatusStatement, buildParseErrorReportsStatement, buildRunsStatement, createOperationsLoader } from "./operations";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

const fakeAdapter: ExtractionAdapter = {
  key: "brd-depositary",
  fieldKeys: ["net_asset", "units_in_circulation"],
  canHandle: () => true,
  extract: () => {
    throw new Error("not used");
  },
};
const registry = createAdapterRegistry([fakeAdapter]);

function loader() {
  return createOperationsLoader(db.mockDb, registry, db.runner);
}

async function insertEtf(symbol: string, adapterKey: string | null, isActive = true) {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1, $2, $3, $4, $5) returning "id"`,
    [symbol, `${symbol} name`, `https://bvb.ro/${symbol}`, adapterKey, isActive],
  );
  return result.rows[0].id;
}

async function insertCatalog(adapterKey: string, fieldKey: string, labelRo: string, labelEn: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    [adapterKey, fieldKey, labelRo, labelEn],
  );
}

async function insertJobRun(input: {
  startedAt: string;
  finishedAt: string | null;
  status: string;
  etfsProcessed?: number;
  errorsCount?: number;
  log?: string | null;
}) {
  const result = await db.pg.query<{ id: number }>(
    `insert into "job_runs" ("started_at", "finished_at", "status", "etfs_processed", "errors_count", "log")
     values ($1, $2, $3, $4, $5, $6) returning "id"`,
    [input.startedAt, input.finishedAt, input.status, input.etfsProcessed ?? 0, input.errorsCount ?? 0, input.log ?? null],
  );
  return result.rows[0].id;
}

async function okReport(etfId: number, reportDate: string, fetchedAt: string | null, values: { fieldKey: string; numericValue: string }[] = []) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId,
    reportDate,
    sourceUrl: `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: fetchedAt ? new Date(fetchedAt) : new Date(`${reportDate}T09:00:00Z`),
    status: "ok",
    errorMessage: null,
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
  if (fetchedAt === null) {
    await db.pg.query(`update "reports" set "fetched_at" = null where "etf_id" = $1 and "report_date" = $2`, [etfId, reportDate]);
  }
}

async function parseErrorReport(
  etfId: number,
  reportDate: string,
  sourceUrl: string | null,
  errorMessage: string,
  values: { fieldKey: string; numericValue: string }[],
) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId,
    reportDate,
    sourceUrl: sourceUrl ?? `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: new Date(`${reportDate}T09:00:00Z`),
    status: "parse_error",
    errorMessage,
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
  if (sourceUrl === null) {
    await db.pg.query(`update "reports" set "source_url" = null where "etf_id" = $1 and "report_date" = $2`, [etfId, reportDate]);
  }
}

async function noAdapterReport(etfId: number, reportDate: string) {
  await db.pg.query(`insert into "reports" ("etf_id", "report_date", "status") values ($1, $2, 'no_adapter')`, [etfId, reportDate]);
}

describe("createOperationsLoader executed on PGlite", () => {
  it("OP-R1/OP-R2: runs are newest started_at first, then higher id first; timestamps are UTC ISO strings", async () => {
    const successId = await insertJobRun({ startedAt: "2026-09-20 10:00:00+00", finishedAt: "2026-09-20 10:05:00+00", status: "success", etfsProcessed: 3, errorsCount: 0 });
    const partialId = await insertJobRun({ startedAt: "2026-09-21 10:00:00+00", finishedAt: "2026-09-21 10:05:00+00", status: "partial", etfsProcessed: 3, errorsCount: 1 });
    const failedSweptId = await insertJobRun({ startedAt: "2026-09-22 10:03:00+03", finishedAt: null, status: "failed", etfsProcessed: 0, errorsCount: 0, log: "did not finish (timed out or crashed)" });
    const runningId = await insertJobRun({ startedAt: "2026-09-22 10:03:00+03", finishedAt: null, status: "running" });

    const view = await loader()();
    expect(view.runs.map((r) => r.id)).toEqual([runningId, failedSweptId, partialId, successId]);

    const failedRun = view.runs.find((r) => r.id === failedSweptId)!;
    expect(failedRun.startedAt).toBe("2026-09-22T07:03:00Z");
    expect(failedRun.finishedAt).toBeNull();

    const successRun = view.runs.find((r) => r.id === successId)!;
    expect(successRun.startedAt).toBe("2026-09-20T10:00:00Z");
    expect(successRun.finishedAt).toBe("2026-09-20T10:05:00Z");
    expect(typeof successRun.etfsProcessed).toBe("number");
    expect(typeof successRun.errorsCount).toBe("number");
  });

  it("OD-R2: an aborted run (failed with finished_at) keeps its end time", async () => {
    const abortedId = await insertJobRun({ startedAt: "2026-09-22 10:00:00+00", finishedAt: "2026-09-22 10:01:00+00", status: "failed", log: "failed: 0 processed, 0 errors\nrun aborted: boom" });
    const view = await loader()();
    const run = view.runs.find((r) => r.id === abortedId)!;
    expect(run.finishedAt).toBe("2026-09-22T10:01:00Z");
  });

  it("OP-E1/OP-E2: last successful extraction per ETF, a newer parse_error does not count, inactive ETFs are listed", async () => {
    const aaa = await insertEtf("AAA", "brd-depositary");
    const bbb = await insertEtf("BBB", "brd-depositary");
    const ccc = await insertEtf("CCC", "brd-depositary", false);

    await okReport(aaa, "2026-09-19", "2026-09-19T09:00:00Z");
    await okReport(aaa, "2026-09-20", "2026-09-20T09:15:00Z");
    await parseErrorReport(aaa, "2026-09-22", "https://bvb.ro/x.pdf", "boom", []);
    await parseErrorReport(bbb, "2026-09-21", "https://bvb.ro/y.pdf", "boom", []);
    await okReport(ccc, "2026-09-18", null);

    const view = await loader()();
    expect(view.etfs.map((e) => e.symbol)).toEqual(["AAA", "BBB", "CCC"]);

    const aaaStatus = view.etfs.find((e) => e.symbol === "AAA")!;
    expect(aaaStatus.lastOk).toEqual({ reportDate: "2026-09-20", fetchedAt: "2026-09-20T09:15:00Z" });

    const bbbStatus = view.etfs.find((e) => e.symbol === "BBB")!;
    expect(bbbStatus.lastOk).toBeNull();

    const cccStatus = view.etfs.find((e) => e.symbol === "CCC")!;
    expect(cccStatus.isActive).toBe(false);
    expect(cccStatus.lastOk).toEqual({ reportDate: "2026-09-18", fetchedAt: null });
  });

  it("OP-E3: adapter-missing flag against the injected registry", async () => {
    await insertEtf("AAA", "brd-depositary");
    await insertEtf("BBB", null);
    await insertEtf("CCC", "unknown-adapter");

    const view = await loader()();
    const byy = new Map(view.etfs.map((e) => [e.symbol, e.adapterAvailable]));
    expect(byy.get("AAA")).toBe(true);
    expect(byy.get("BBB")).toBe(false);
    expect(byy.get("CCC")).toBe(false);
  });

  it("OP-P1/OP-P2: parse errors are listed newest report_date first, ok rows are absent, values grouped and labelled", async () => {
    await insertCatalog("brd-depositary", "net_asset", "Activ net", "Net assets");
    const aaa = await insertEtf("AAA", "brd-depositary");
    const bbb = await insertEtf("BBB", null);

    await okReport(aaa, "2026-09-20", "2026-09-20T09:00:00Z");
    await parseErrorReport(aaa, "2026-09-22", "https://bvb.ro/x.pdf", "missing fields: nav_per_unit", [
      { fieldKey: "net_asset", numericValue: "415591664.27" },
      { fieldKey: "units_in_circulation", numericValue: "37470000" },
    ]);
    await noAdapterReport(bbb, "2026-09-21");

    const view = await loader()();
    expect(view.parseErrors).toHaveLength(2);
    expect(view.parseErrors.map((r) => r.reportDate)).toEqual(["2026-09-22", "2026-09-21"]);
    expect(view.parseErrors.some((r) => r.status === "ok")).toBe(false);

    const aaaReport = view.parseErrors.find((r) => r.symbol === "AAA")!;
    expect(aaaReport.errorMessage).toBe("missing fields: nav_per_unit");
    expect(aaaReport.sourceUrl).toBe("https://bvb.ro/x.pdf");
    const byFieldKey = new Map(aaaReport.values.map((v) => [v.fieldKey, v]));
    expect(byFieldKey.get("net_asset")).toEqual({ fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net assets", numericValue: "415591664.27" });
    expect(byFieldKey.get("units_in_circulation")).toEqual({ fieldKey: "units_in_circulation", labelRo: "units_in_circulation", labelEn: "units_in_circulation", numericValue: "37470000" });

    const bbbReport = view.parseErrors.find((r) => r.symbol === "BBB")!;
    expect(bbbReport.status).toBe("no_adapter");
    expect(bbbReport.sourceUrl).toBeNull();
    expect(bbbReport.values).toEqual([]);
  });

  it("OP-W1/OP-W2: the loader writes nothing, and each statement is a single select", async () => {
    await insertEtf("AAA", "brd-depositary");
    const before = await Promise.all(
      ["etfs", "reports", "report_values", "job_runs", "tracked_fields", "field_catalog"].map((t) => db.pg.query(`select * from "${t}" order by "id"`)),
    );
    await loader()();
    const after = await Promise.all(
      ["etfs", "reports", "report_values", "job_runs", "tracked_fields", "field_catalog"].map((t) => db.pg.query(`select * from "${t}" order by "id"`)),
    );
    expect(after.map((r) => r.rows)).toEqual(before.map((r) => r.rows));

    for (const statement of [buildRunsStatement(db.mockDb), buildEtfStatusStatement(db.mockDb), buildParseErrorReportsStatement(db.mockDb)]) {
      const { sql: sqlText } = statement.getQuery();
      expect(sqlText.trim().toLowerCase().startsWith("select")).toBe(true);
    }

    let calls = 0;
    const spyRunner: typeof db.runner = (statements) => {
      calls += 1;
      return db.runner(statements);
    };
    await createOperationsLoader(db.mockDb, registry, spyRunner)();
    expect(calls).toBe(1);
  });
});
