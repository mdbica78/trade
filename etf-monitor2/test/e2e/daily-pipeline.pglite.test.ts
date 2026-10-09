import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../helpers/pglite";
import { seed } from "../../lib/db/seed";
import { defaultAdapterRegistry } from "../../lib/extraction/adapters/default-registry";
import { createHomeTableLoader } from "../../lib/monitoring/home";
import { createEtfHistoryLoader } from "../../lib/monitoring/history";
import { createOperationsLoader } from "../../lib/admin/operations";
import {
  createFetchGuard,
  dayAMap,
  dayBMap,
  expectedValues,
  FIXTURE_URLS,
  type FetchGuard,
} from "./fixture-web";

vi.mock("../../lib/db/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/index")>();
  return { ...actual, getDb: vi.fn(actual.getDb) };
});

const CRON_SECRET = "e2e-sentinel-cron-secret";
const DATABASE_URL_SENTINEL = "postgresql://sentinel-user:sentinel-pass@sentinel-host/sentinel-db";

const PAGE_BY_SYMBOL = FIXTURE_URLS.page;
const PDF_BY_SYMBOL = FIXTURE_URLS.pdf;

async function insertEtf(db: EmptyTestDatabase, symbol: string, adapterKey: string | null): Promise<number> {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4) returning "id"`,
    [symbol, `${symbol} name`, PAGE_BY_SYMBOL[symbol as keyof typeof PAGE_BY_SYMBOL], adapterKey],
  );
  return result.rows[0].id;
}

async function trackField(db: EmptyTestDatabase, etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(`insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`, [
    etfId,
    fieldKey,
    displayOrder,
  ]);
}

async function setupSeededDatabase(): Promise<EmptyTestDatabase> {
  const db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);

  const icbetnetfId = await insertEtf(db, "ICBETNETF", "intercapital-nav");
  await trackField(db, icbetnetfId, "nav_per_unit", 0);
  await trackField(db, icbetnetfId, "units_in_circulation", 1);

  await insertEtf(db, "NOADAPTER", null);

  return db;
}

function buildRequest(): Request {
  return new Request("http://localhost/api/cron/daily", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

async function callCron(db: EmptyTestDatabase, guard: FetchGuard): Promise<Response> {
  vi.stubGlobal("fetch", guard.fetch);
  const { createDailyCronDeps } = await import("../../lib/cron/default-deps");
  const { handleDailyCron } = await import("../../lib/cron/daily-handler");
  const deps = createDailyCronDeps({ database: { db: db.mockDb, run: db.runner } });
  return handleDailyCron(buildRequest(), deps);
}

function scanForSecret(value: unknown, secret: string): boolean {
  return JSON.stringify(value).includes(secret);
}

describe("US-031 AC1/AC2/AC7: the whole daily pipeline, offline", () => {
  let db: EmptyTestDatabase;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_SENTINEL);
    db = await setupSeededDatabase();
  }, 60_000);

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await db.close();
  });

  it("DP-0: fixture self-checks (no production parser used)", async () => {
    const map = dayAMap();
    for (const url of [
      ...Object.values(PAGE_BY_SYMBOL),
      PDF_BY_SYMBOL.BTBETRETF,
      PDF_BY_SYMBOL.TVBETETF,
      PDF_BY_SYMBOL.PTENGETF,
      PDF_BY_SYMBOL.ICBETNETF,
    ]) {
      expect(map.has(url), `expected a fixture mapped for ${url}`).toBe(true);
    }

    const noAdapterResponse = map.get(PAGE_BY_SYMBOL.NOADAPTER)!();
    const noAdapterHtml = await noAdapterResponse.text();
    expect(noAdapterHtml).not.toContain("BTBETRETF");
    expect(noAdapterHtml).toContain(
      "https://bvb.ro/infocont/infocont26/NOADAPTER_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf",
    );

    const dayB = dayBMap();
    const noRowsHtml = await dayB.get(PAGE_BY_SYMBOL.PTENGETF)!().text();
    expect(noRowsHtml).toContain('id="gv5News"');
    const tableMatch = /<table[^>]*\bid=(["'])gv5News\1[^>]*>([\s\S]*?)<\/table>/i.exec(noRowsHtml);
    expect(tableMatch).not.toBeNull();
    expect(tableMatch![2]).not.toContain("<tr>");

    // US-037 §0.2: day B must serve its report under a new URL, never day A's already-`ok` URL.
    expect(dayB.has(FIXTURE_URLS.pdfDayB.BTBETRETF)).toBe(true);
    expect(dayB.has(FIXTURE_URLS.pdfDayB.TVBETETF)).toBe(true);
    const btbetretfPageB = await dayB.get(PAGE_BY_SYMBOL.BTBETRETF)!().text();
    expect(btbetretfPageB).toContain(FIXTURE_URLS.pdfDayB.BTBETRETF);
    expect(btbetretfPageB).not.toContain(FIXTURE_URLS.pdf.BTBETRETF);
    const tvbetetfPageB = await dayB.get(PAGE_BY_SYMBOL.TVBETETF)!().text();
    expect(tvbetetfPageB).toContain(FIXTURE_URLS.pdfDayB.TVBETETF);
    expect(tvbetetfPageB).not.toContain(FIXTURE_URLS.pdf.TVBETETF);
  });

  it("DP-1: one run over day A — response, job_runs, reports, report_values, links, fetch guard, loaders, secrets", async () => {
    vi.setSystemTime(new Date("2026-09-23T10:05:00Z"));
    const guard = createFetchGuard(dayAMap());

    const response = await callCron(db, guard);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; etfs: { symbol: string; outcome: { code: string; reportDate?: string } }[] };
    expect(body.status).toBe("partial");
    expect(body.etfs.map((e) => e.symbol)).toEqual(["BTBETRETF", "ICBETNETF", "NOADAPTER", "PTENGETF", "TVBETETF"]);
    expect(body.etfs.map((e) => e.outcome.code)).toEqual(["ok", "ok", "no_adapter", "ok", "ok"]);
    expect(body.etfs.find((e) => e.symbol === "BTBETRETF")!.outcome.reportDate).toBe("2026-09-21");
    expect(body.etfs.find((e) => e.symbol === "ICBETNETF")!.outcome.reportDate).toBe("2026-09-24");

    const runs = await db.pg.query<{
      status: string;
      etfs_processed: number;
      errors_count: number;
      finished_at: string | null;
      log: string;
    }>('select "status", "etfs_processed", "errors_count", "finished_at", "log" from "job_runs"');
    expect(runs.rows).toHaveLength(1);
    const run = runs.rows[0];
    expect(run.status).toBe("partial");
    expect(run.etfs_processed).toBe(5);
    expect(run.errors_count).toBe(1);
    expect(run.finished_at).not.toBeNull();
    expect(run.log).toBe(
      [
        "partial: 5 processed, 1 errors",
        "BTBETRETF ok 2026-09-21 stored 1, already stored 0, failed 0, not attempted 0; 8 values written",
        "ICBETNETF ok 2026-09-24 stored 1, already stored 0, failed 0, not attempted 0; 8 values written",
        "NOADAPTER no_adapter no adapter: adapter_key not set; report link stored",
        "PTENGETF ok 2026-09-21 stored 1, already stored 0, failed 0, not attempted 0; 8 values written",
        "TVBETETF ok 2026-09-21 stored 1, already stored 0, failed 0, not attempted 0; 8 values written",
      ].join("\n"),
    );

    const reports = await db.pg.query<{
      symbol: string;
      report_date: string;
      status: string;
      source_url: string;
      error_message: string | null;
    }>(
      `select "e"."symbol", "r"."report_date"::text, "r"."status", "r"."source_url", "r"."error_message"
       from "reports" "r" join "etfs" "e" on "e"."id" = "r"."etf_id" order by "e"."symbol"`,
    );
    expect(reports.rows).toEqual([
      { symbol: "BTBETRETF", report_date: "2026-09-21", status: "ok", source_url: PDF_BY_SYMBOL.BTBETRETF, error_message: null },
      { symbol: "ICBETNETF", report_date: "2026-09-24", status: "ok", source_url: PDF_BY_SYMBOL.ICBETNETF, error_message: null },
      { symbol: "PTENGETF", report_date: "2026-09-21", status: "ok", source_url: PDF_BY_SYMBOL.PTENGETF, error_message: null },
      { symbol: "TVBETETF", report_date: "2026-09-21", status: "ok", source_url: PDF_BY_SYMBOL.TVBETETF, error_message: null },
    ]);

    for (const [symbol, file] of [
      ["BTBETRETF", "BTBETRETF-2026-09-21.pdf"],
      ["PTENGETF", "PTENGETF-2026-09-21.pdf"],
      ["TVBETETF", "TVBETETF-2026-09-21.pdf"],
    ] as const) {
      const expected = expectedValues(file);
      const values = await db.pg.query<{ field_key: string; numeric_value: string; raw_value: string }>(
        `select "rv"."field_key", "rv"."numeric_value"::text, "rv"."raw_value"
         from "report_values" "rv"
         join "reports" "r" on "r"."id" = "rv"."report_id"
         join "etfs" "e" on "e"."id" = "r"."etf_id"
         where "e"."symbol" = $1 order by "rv"."field_key"`,
        [symbol],
      );
      expect(values.rows).toEqual(
        Object.keys(expected)
          .map((fieldKey) => ({
            field_key: fieldKey,
            numeric_value: expected[fieldKey].numericValue,
            raw_value: expected[fieldKey].rawValue,
          }))
          .sort((a, b) => a.field_key.localeCompare(b.field_key)),
      );
    }

    const icbetnetfExpected = expectedValues("ICBETNETF-2026-09-24.pdf");
    const icbetnetfValues = await db.pg.query<{ field_key: string; numeric_value: string; raw_value: string }>(
      `select "rv"."field_key", "rv"."numeric_value"::text, "rv"."raw_value"
       from "report_values" "rv"
       join "reports" "r" on "r"."id" = "rv"."report_id"
       join "etfs" "e" on "e"."id" = "r"."etf_id"
       where "e"."symbol" = 'ICBETNETF' order by "rv"."field_key"`,
    );
    expect(icbetnetfValues.rows).toEqual(
      Object.keys(icbetnetfExpected)
        .map((fieldKey) => ({
          field_key: fieldKey,
          numeric_value: icbetnetfExpected[fieldKey].numericValue,
          raw_value: icbetnetfExpected[fieldKey].rawValue,
        }))
        .sort((a, b) => a.field_key.localeCompare(b.field_key)),
    );

    const noAdapterReports = await db.pg.query(
      `select "r"."id" from "reports" "r" join "etfs" "e" on "e"."id" = "r"."etf_id" where "e"."symbol" = 'NOADAPTER'`,
    );
    expect(noAdapterReports.rows).toHaveLength(0);

    const links = await db.pg.query<{ symbol: string; source_url: string; discovered_at: string }>(
      `select "e"."symbol", "l"."source_url", "l"."discovered_at"::text
       from "etf_report_links" "l" join "etfs" "e" on "e"."id" = "l"."etf_id"`,
    );
    expect(links.rows).toHaveLength(1);
    expect(links.rows[0].symbol).toBe("NOADAPTER");
    expect(links.rows[0].source_url).toBe(PDF_BY_SYMBOL.NOADAPTER);

    expect(guard.rejected).toEqual([]);
    expect(guard.calls).toEqual([
      { method: "GET", url: PAGE_BY_SYMBOL.BTBETRETF },
      { method: "GET", url: PDF_BY_SYMBOL.BTBETRETF },
      { method: "GET", url: PAGE_BY_SYMBOL.ICBETNETF },
      { method: "GET", url: PDF_BY_SYMBOL.ICBETNETF },
      { method: "GET", url: PAGE_BY_SYMBOL.NOADAPTER },
      { method: "GET", url: PAGE_BY_SYMBOL.PTENGETF },
      { method: "GET", url: PDF_BY_SYMBOL.PTENGETF },
      { method: "GET", url: PAGE_BY_SYMBOL.TVBETETF },
      { method: "GET", url: PDF_BY_SYMBOL.TVBETETF },
    ]);
    const callsPerSymbol = new Map<string, number>();
    for (const call of guard.calls) {
      for (const [symbol, url] of Object.entries(PAGE_BY_SYMBOL)) {
        if (call.url === url || call.url === PDF_BY_SYMBOL[symbol as keyof typeof PDF_BY_SYMBOL]) {
          callsPerSymbol.set(symbol, (callsPerSymbol.get(symbol) ?? 0) + 1);
        }
      }
    }
    expect(callsPerSymbol.get("NOADAPTER")).toBe(1);
    for (const count of callsPerSymbol.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }

    const { getDb } = await import("../../lib/db/index");
    expect(vi.mocked(getDb)).not.toHaveBeenCalled();

    const homeLoader = createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner);
    const home = await homeLoader();
    expect(home.columns.map((c) => c.fieldKey).sort()).toEqual(["nav_per_unit", "units_in_circulation"]);

    const btbetretfRow = home.rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(btbetretfRow.adapterAvailable).toBe(true);
    expect(btbetretfRow.valueDate).toBe("2026-09-21");
    expect(btbetretfRow.latestPdfUrl).toBe(PDF_BY_SYMBOL.BTBETRETF);
    expect(btbetretfRow.cells.nav_per_unit).toMatchObject({ tracked: true, delta: null });

    const icbetnetfRow = home.rows.find((r) => r.symbol === "ICBETNETF")!;
    expect(icbetnetfRow.valueDate).toBe("2026-09-24");
    expect(icbetnetfRow.latestPdfUrl).toBe(PDF_BY_SYMBOL.ICBETNETF);

    const noAdapterRow = home.rows.find((r) => r.symbol === "NOADAPTER")!;
    expect(noAdapterRow.adapterAvailable).toBe(false);
    expect(noAdapterRow.valueDate).toBeNull();
    expect(Object.values(noAdapterRow.cells).every((c) => c.tracked === false)).toBe(true);
    expect(noAdapterRow.latestPdfUrl).toBe(PDF_BY_SYMBOL.NOADAPTER);

    const historyLoader = createEtfHistoryLoader(db.mockDb, db.runner, defaultAdapterRegistry);
    for (const symbol of ["BTBETRETF", "ICBETNETF", "PTENGETF", "TVBETETF"]) {
      const history = await historyLoader(symbol);
      expect(history!.rows).toHaveLength(1);
    }
    const noAdapterHistory = await historyLoader("NOADAPTER");
    expect(noAdapterHistory!.rows).toEqual([]);
    expect(noAdapterHistory!.etf.adapterAvailable).toBe(false);

    const operationsLoader = createOperationsLoader(db.mockDb, defaultAdapterRegistry, db.runner);
    const operations = await operationsLoader();
    expect(operations.runs).toHaveLength(1);
    expect(operations.runs[0]).toMatchObject({ status: "partial", etfsProcessed: 5, errorsCount: 1 });
    expect(operations.runs[0].log.entries.filter((e) => e.kind === "etf")).toHaveLength(5);
    expect(operations.parseErrors).toEqual([]);
    const noAdapterOpStatus = operations.etfs.find((e) => e.symbol === "NOADAPTER")!;
    expect(noAdapterOpStatus.adapterAvailable).toBe(false);
    expect(noAdapterOpStatus.lastOk).toBeNull();

    expect(scanForSecret(body, CRON_SECRET)).toBe(false);
    expect(scanForSecret(body, DATABASE_URL_SENTINEL)).toBe(false);
    expect(scanForSecret(run.log, CRON_SECRET)).toBe(false);
    expect(scanForSecret(run.log, DATABASE_URL_SENTINEL)).toBe(false);
    expect(scanForSecret(home, CRON_SECRET)).toBe(false);
    expect(scanForSecret(operations, CRON_SECRET)).toBe(false);
  }, 120_000);

  it("DP-2: a rerun (already_ingested) and a missing day do not disturb existing ok rows", async () => {
    vi.setSystemTime(new Date("2026-09-23T10:05:00Z"));
    const guard1 = createFetchGuard(dayAMap());
    await callCron(db, guard1);

    const snapshotBefore = await db.pg.query<{ id: number }>('select * from "reports" order by "id"');
    const valuesBefore = await db.pg.query('select * from "report_values" order by "id"');

    // A later UTC day: the same UTC day would be skipped (DEC-030), so the rerun happens the next day.
    vi.setSystemTime(new Date("2026-09-24T10:05:00Z"));
    const guard2 = createFetchGuard(dayAMap());
    const response2 = await callCron(db, guard2);
    const body2 = (await response2.json()) as { status: string; etfs: { symbol: string; outcome: { code: string } }[] };
    expect(body2.status).toBe("partial");
    expect(body2.etfs.map((e) => e.outcome.code)).toEqual(["already_ingested", "already_ingested", "no_adapter", "already_ingested", "already_ingested"]);

    const snapshotAfterRun2 = await db.pg.query('select * from "reports" order by "id"');
    const valuesAfterRun2 = await db.pg.query('select * from "report_values" order by "id"');
    expect(snapshotAfterRun2.rows).toEqual(snapshotBefore.rows);
    expect(valuesAfterRun2.rows).toEqual(valuesBefore.rows);
    // Every adapter ETF's URL is already stored `ok` (US-037 AC3): discovery only, no PDF re-download.
    expect(guard2.calls).toHaveLength(5);

    vi.setSystemTime(new Date("2026-09-25T10:05:00Z"));
    const guard3 = createFetchGuard(dayBMap());
    const response3 = await callCron(db, guard3);
    const body3 = (await response3.json()) as {
      status: string;
      etfs: { symbol: string; outcome: { code: string; reason?: string } }[];
    };
    expect(body3.status).toBe("partial");
    const codesBySymbol = Object.fromEntries(body3.etfs.map((e) => [e.symbol, e.outcome.code]));
    expect(codesBySymbol).toEqual({
      BTBETRETF: "ok",
      ICBETNETF: "already_ingested",
      NOADAPTER: "no_adapter",
      PTENGETF: "missing",
      TVBETETF: "ok",
    });
    expect(body3.etfs.find((e) => e.symbol === "PTENGETF")!.outcome.reason).toBe("no_report_entries");

    const runs = await db.pg.query('select "id" from "job_runs"');
    expect(runs.rows).toHaveLength(3);
    const ptengetfReports = await db.pg.query(
      `select "r"."report_date"::text from "reports" "r" join "etfs" "e" on "e"."id" = "r"."etf_id" where "e"."symbol" = 'PTENGETF'`,
    );
    expect(ptengetfReports.rows).toEqual([{ report_date: "2026-09-21" }]);

    const snapshotAfterRun3 = await db.pg.query('select * from "reports" where "id" = ANY($1) order by "id"', [
      snapshotBefore.rows.map((r: { id: number }) => r.id),
    ]);
    expect(snapshotAfterRun3.rows).toEqual(snapshotBefore.rows);
    expect(guard3.rejected).toEqual([]);
    // ICBETNETF's URL is unchanged from day A (already stored `ok`): discovery only, 1 call.
    expect(guard3.calls).toHaveLength(7);

    const homeLoader = createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner);
    const home = await homeLoader();
    const ptengetfRow = home.rows.find((r) => r.symbol === "PTENGETF")!;
    expect(ptengetfRow.valueDate).toBe("2026-09-21");
    const ptengetfCell = ptengetfRow.cells.nav_per_unit;
    expect(ptengetfCell?.tracked && ptengetfCell.delta).toBeNull();

    const btbetretfRow = home.rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(btbetretfRow.valueDate).toBe("2026-09-22");
    expect(btbetretfRow.cells.nav_per_unit).toMatchObject({ tracked: true });
    const btbetretfCell = btbetretfRow.cells.nav_per_unit;
    expect(btbetretfCell?.tracked && btbetretfCell.delta).not.toBeNull();

    const tvbetetfRow = home.rows.find((r) => r.symbol === "TVBETETF")!;
    expect(tvbetetfRow.valueDate).toBe("2026-09-22");
    const tvbetetfCell = tvbetetfRow.cells.nav_per_unit;
    expect(tvbetetfCell?.tracked && tvbetetfCell.delta).not.toBeNull();
  }, 120_000);

  it("DP-4 (US-062): before the configured hour nothing runs and nothing is written; at the hour one run; a same-day repeat is skipped with no fetch and no new row; the next UTC day runs again", async () => {
    const body = async (response: Response) => (await response.json()) as Record<string, unknown>;

    vi.setSystemTime(new Date("2026-09-23T09:59:59Z"));
    const early = createFetchGuard(dayAMap());
    const earlyResponse = await callCron(db, early);
    expect(earlyResponse.status).toBe(200);
    expect(earlyResponse.headers.get("cache-control")).toBe("no-store");
    expect(await body(earlyResponse)).toEqual({ skipped: "not_scheduled_hour" });
    expect(early.calls).toEqual([]);
    expect((await db.pg.query('select "id" from "job_runs"')).rows).toHaveLength(0);

    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    const first = createFetchGuard(dayAMap());
    const firstResponse = await callCron(db, first);
    expect(firstResponse.status).toBe(200);
    expect((await body(firstResponse)).jobRunId).toBeTypeOf("number");
    expect(first.calls.length).toBeGreaterThan(0);

    vi.setSystemTime(new Date("2026-09-23T15:30:00Z"));
    const repeat = createFetchGuard(dayAMap());
    const repeatResponse = await callCron(db, repeat);
    expect(repeatResponse.status).toBe(200);
    expect(await body(repeatResponse)).toEqual({ skipped: "already_ran" });
    expect(repeat.calls).toEqual([]);
    const afterRepeat = await db.pg.query<{ scheduled_date_utc: string | null }>(
      'select "scheduled_date_utc"::text from "job_runs" order by "id"',
    );
    expect(afterRepeat.rows).toEqual([{ scheduled_date_utc: "2026-09-23" }]);

    vi.setSystemTime(new Date("2026-09-24T10:00:00Z"));
    const nextDay = createFetchGuard(dayAMap());
    expect((await body(await callCron(db, nextDay))).jobRunId).toBeTypeOf("number");
    expect((await db.pg.query('select "id" from "job_runs"')).rows).toHaveLength(2);
  }, 120_000);

  it("DP-3: a wrong bearer never reaches the pipeline", async () => {
    vi.setSystemTime(new Date("2026-09-23T10:05:00Z"));
    const guard = createFetchGuard(dayAMap());
    vi.stubGlobal("fetch", guard.fetch);
    const { createDailyCronDeps } = await import("../../lib/cron/default-deps");
    const { handleDailyCron } = await import("../../lib/cron/daily-handler");
    const deps = createDailyCronDeps({ database: { db: db.mockDb, run: db.runner } });

    const request = new Request("http://localhost/api/cron/daily", { headers: { authorization: "Bearer wrong" } });
    const response = await handleDailyCron(request, deps);
    expect(response.status).toBe(401);

    const bodyText = await response.text();
    expect(bodyText).not.toContain(CRON_SECRET);
    expect(bodyText).not.toContain(DATABASE_URL_SENTINEL);

    const runs = await db.pg.query('select "id" from "job_runs"');
    expect(runs.rows).toHaveLength(0);
    expect(guard.calls).toEqual([]);
    expect(guard.rejected).toEqual([]);
  });
});
