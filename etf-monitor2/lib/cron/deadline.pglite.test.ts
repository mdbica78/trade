import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { createDrizzleJobRunStore } from "../ingestion/job-runs";
import type { IngestOutcome } from "../ingestion/ingest-etf";
import { runDailyIngestion, type DailyEtf } from "../ingestion/run-daily";
import { runDailyJob } from "./daily-job";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
});

afterEach(async () => {
  await db.close();
});

function etf(overrides: Partial<DailyEtf> = {}): DailyEtf {
  return {
    id: 1,
    symbol: "A",
    bvbUrl: "https://bvb.ro/A",
    adapterKey: "brd-depositary",
    trackedFieldKeys: [],
    isActive: true,
    ...overrides,
  };
}

describe("DJP-1: runDailyJob + a real Drizzle job-run store + the fake-clock deadline guard, on PGlite", () => {
  it("gives a partial run with one job_runs row, correct counts and one log line per ETF including not_attempted", async () => {
    const jobRuns = createDrizzleJobRunStore(db.mockDb, db.runner);
    const startedAt = new Date("2026-09-27T08:00:00Z");
    let t = startedAt.getTime();
    const now = () => new Date(t);

    const A = etf({ id: 1, symbol: "A" });
    const B = etf({ id: 2, symbol: "B" });

    const ingest = async (input: { symbol: string }): Promise<IngestOutcome> => {
      t += 60_000;
      return {
        code: "ok",
        symbol: input.symbol,
        reportDate: "2026-09-22",
        valuesWritten: 1,
        sourceUrl: "https://bvb.ro/x.pdf",
        detail: "stored 1 values",
      };
    };

    const result = await runDailyJob({
      now: () => new Date(startedAt),
      jobRuns,
      runIngestion: (ctx) => runDailyIngestion({ loadEtfs: async () => [A, B], ingest }, { startedAt: ctx.startedAt, now }),
      secrets: [],
    });

    expect(result.kind).toBe("finished");
    if (result.kind !== "finished") throw new Error("expected finished");
    expect(result.status).toBe("partial");

    const row = (await db.pg.query('select * from "job_runs" where "id" = $1', [result.jobRunId])).rows[0] as {
      status: string;
      finished_at: string | null;
      errors_count: number;
      etfs_processed: number;
      log: string;
    };
    expect(row.status).toBe("partial");
    expect(row.finished_at).not.toBeNull();
    expect(row.etfs_processed).toBe(2);
    expect(row.errors_count).toBe(1);
    expect(row.log).toContain("A ok");
    expect(row.log).toContain("B not_attempted");
  });
});
