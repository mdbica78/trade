import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { loadLatestReportDates } from "./latest-report-dates";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 30_000);

afterEach(async () => {
  await db.close();
});

async function etf(symbol: string, active = true): Promise<number> {
  const r = await db.pg.query<{ id: number }>(
    'insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1,$2,$3,$4,$5) returning "id"',
    [symbol, `${symbol} fund`, `https://bvb.ro/${symbol}`, null, active],
  );
  return r.rows[0]!.id;
}

async function report(etfId: number, date: string, status: string) {
  await db.pg.query('insert into "reports" ("etf_id", "report_date", "status") values ($1,$2,$3)', [etfId, date, status]);
}

const deps = () => ({ db: db.mockDb, run: db.runner });

describe("loadLatestReportDates (LR, US-059)", () => {
  it("LR-1: the newest status=ok report date per ETF, mapped to the right symbol, inactive ETFs included", async () => {
    const a = await etf("AAAETF");
    const b = await etf("BBBETF", false);
    await report(a, "2026-10-01", "ok");
    await report(a, "2026-10-07", "ok");
    await report(a, "2026-10-05", "ok");
    await report(b, "2026-09-30", "ok");
    expect(await loadLatestReportDates(deps())).toEqual(
      new Map([
        ["AAAETF", "2026-10-07"],
        ["BBBETF", "2026-09-30"],
      ]),
    );
  });

  it("LR-2: non-ok reports (missing, parse_error, no_adapter) never count, even when newer", async () => {
    const a = await etf("AAAETF");
    await report(a, "2026-10-01", "ok");
    await report(a, "2026-10-08", "missing");
    await report(a, "2026-10-09", "parse_error");
    await report(a, "2026-10-10", "no_adapter");
    expect((await loadLatestReportDates(deps())).get("AAAETF")).toBe("2026-10-01");
  });

  it("LR-3: an ETF with no ok report is absent (not null, not a made-up date); no reports at all gives an empty map", async () => {
    expect((await loadLatestReportDates(deps())).size).toBe(0);
    const a = await etf("AAAETF");
    await etf("NOREPORT");
    await report(a, "2026-10-08", "parse_error");
    expect((await loadLatestReportDates(deps())).size).toBe(0);
  });

  it("LR-4: dates are plain YYYY-MM-DD text whatever the session time zone, and the read writes nothing", async () => {
    const a = await etf("AAAETF");
    await report(a, "2026-01-01", "ok");
    const before = await db.pg.query('select * from "reports" order by "id"');
    const dates = await loadLatestReportDates(deps());
    expect(dates.get("AAAETF")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dates.get("AAAETF")).toBe("2026-01-01");
    expect((await db.pg.query('select * from "reports" order by "id"')).rows).toEqual(before.rows);
  });

  it("LR-5: one runner call holding exactly one statement", async () => {
    let calls = 0;
    let statements = 0;
    const run: typeof db.runner = async (s) => {
      calls += 1;
      statements = s.length;
      return db.runner(s);
    };
    await loadLatestReportDates({ db: db.mockDb, run });
    expect([calls, statements]).toEqual([1, 1]);
  });
});
