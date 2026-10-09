import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { runDailyJob } from "../cron/daily-job";
import { createDrizzleJobRunStore, STALE_RUN_LOG_LINE } from "./job-runs";
import type { DailyRunSummary } from "./run-daily";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

const T0 = new Date("2026-09-25T10:00:05.000Z");

describe(
  "JP-1: real SQL for startRun/finishRun",
  () => {
    it(
      "startRun inserts a running row, finishRun sets the exact given values",
      async () => {
        const store = createDrizzleJobRunStore(db.mockDb, db.runner);
        const id = await store.startRun(T0);
        expect(typeof id).toBe("number");

        const rows = await db.pg.query<{
          status: string;
          started_at: Date;
          finished_at: Date | null;
          etfs_processed: number;
          errors_count: number;
          log: string | null;
        }>('select "status", "started_at", "finished_at", "etfs_processed", "errors_count", "log" from "job_runs"');
        expect(rows.rows).toHaveLength(1);
        expect(rows.rows[0].status).toBe("running");
        expect(rows.rows[0].finished_at).toBeNull();
        expect(rows.rows[0].etfs_processed).toBe(0);
        expect(rows.rows[0].errors_count).toBe(0);
        expect(rows.rows[0].log).toBeNull();

        await store.finishRun(id, {
          finishedAt: new Date("2026-09-25T10:00:41.000Z"),
          status: "success",
          etfsProcessed: 3,
          errorsCount: 0,
          log: "success: 3 processed, 0 errors",
        });

        const finished = await db.pg.query<{
          status: string;
          finished_at: Date | null;
          etfs_processed: number;
          errors_count: number;
          log: string | null;
        }>('select "status", "finished_at", "etfs_processed", "errors_count", "log" from "job_runs"');
        expect(finished.rows).toHaveLength(1);
        expect(finished.rows[0].status).toBe("success");
        expect(finished.rows[0].finished_at).not.toBeNull();
        expect(finished.rows[0].etfs_processed).toBe(3);
        expect(finished.rows[0].errors_count).toBe(0);
        expect(finished.rows[0].log).toBe("success: 3 processed, 0 errors");

        const count = await db.pg.query('select count(*) as n from "job_runs"');
        expect(Number((count.rows[0] as { n: string | number }).n)).toBe(1);
      },
      30_000,
    );
  },
  30_000,
);

describe("JP-6: stale-run sweep, real SQL", () => {
  async function seed(status: string, startedAt: Date, log: string | null, extra: Partial<{ finishedAt: Date }> = {}) {
    const result = await db.pg.query<{ id: number }>(
      `insert into "job_runs" ("started_at", "finished_at", "status", "log") values ($1, $2, $3, $4) returning "id"`,
      [startedAt.toISOString(), extra.finishedAt ? extra.finishedAt.toISOString() : null, status, log],
    );
    return result.rows[0].id;
  }

  it(
    "JP-6a: sweeps only running rows older than the cutoff, leaves others byte-for-byte unchanged",
    async () => {
      const rowNoLog = await seed("running", new Date(T0.getTime() - 20 * 60_000), null);
      const rowWithLog = await seed("running", new Date(T0.getTime() - 16 * 60_000), "partial text");
      const rowFresh = await seed("running", new Date(T0.getTime() - 5 * 60_000), null);
      const rowDone = await seed(
        "success",
        new Date(T0.getTime() - 2 * 24 * 60 * 60_000),
        "success: 3 processed, 0 errors",
        { finishedAt: new Date(T0.getTime() - 2 * 24 * 60 * 60_000 + 60_000) },
      );

      const before = await db.pg.query('select * from "job_runs" where "id" in ($1, $2)', [rowFresh, rowDone]);

      const store = createDrizzleJobRunStore(db.mockDb, db.runner);
      const swept = await store.failStaleRuns(new Date(T0.getTime() - 15 * 60_000));
      expect(swept).toBe(2);

      const after1 = await db.pg.query<{ status: string; log: string | null; finished_at: Date | null }>(
        'select "status", "log", "finished_at" from "job_runs" where "id" = $1',
        [rowNoLog],
      );
      expect(after1.rows[0].status).toBe("failed");
      expect(after1.rows[0].log).toBe(STALE_RUN_LOG_LINE);
      expect(after1.rows[0].finished_at).toBeNull();

      const after2 = await db.pg.query<{ status: string; log: string | null; finished_at: Date | null }>(
        'select "status", "log", "finished_at" from "job_runs" where "id" = $1',
        [rowWithLog],
      );
      expect(after2.rows[0].status).toBe("failed");
      expect(after2.rows[0].log).toBe(`partial text\n${STALE_RUN_LOG_LINE}`);
      expect(after2.rows[0].finished_at).toBeNull();

      const after = await db.pg.query('select * from "job_runs" where "id" in ($1, $2)', [rowFresh, rowDone]);
      expect(after.rows).toEqual(before.rows);
    },
    30_000,
  );

  it(
    "JP-6b: a running row with started_at exactly at the cutoff is not swept",
    async () => {
      const cutoff = new Date(T0.getTime() - 15 * 60_000);
      const rowAtCutoff = await seed("running", cutoff, null);

      const store = createDrizzleJobRunStore(db.mockDb, db.runner);
      const swept = await store.failStaleRuns(cutoff);
      expect(swept).toBe(0);

      const row = await db.pg.query<{ status: string }>('select "status" from "job_runs" where "id" = $1', [rowAtCutoff]);
      expect(row.rows[0].status).toBe("running");
    },
    30_000,
  );

  it(
    "JP-6c: a second sweep with the same cutoff is idempotent, no double-appended log line",
    async () => {
      await seed("running", new Date(T0.getTime() - 20 * 60_000), null);
      const store = createDrizzleJobRunStore(db.mockDb, db.runner);
      const cutoff = new Date(T0.getTime() - 15 * 60_000);

      const first = await store.failStaleRuns(cutoff);
      expect(first).toBe(1);
      const second = await store.failStaleRuns(cutoff);
      expect(second).toBe(0);

      const rows = await db.pg.query<{ log: string | null }>('select "log" from "job_runs"');
      expect(rows.rows[0].log).toBe(STALE_RUN_LOG_LINE);
    },
    30_000,
  );
});

describe("JP-15: a composed run through the real store on PGlite", () => {
  it(
    "sweeps a pre-seeded stale row and writes exactly one new finished row",
    async () => {
      const staleStartedAt = new Date(T0.getTime() - 20 * 60_000);
      await db.pg.query(`insert into "job_runs" ("started_at", "status") values ($1, 'running')`, [
        staleStartedAt.toISOString(),
      ]);

      const jobRuns = createDrizzleJobRunStore(db.mockDb, db.runner);
      const runIngestion = async (): Promise<DailyRunSummary> => ({
        etfs: [
          { symbol: "A", outcome: { code: "ok", symbol: "A", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "x", detail: "stored 1 values" } },
          { symbol: "B", outcome: { code: "ok", symbol: "B", reportDate: "2026-09-22", valuesWritten: 1, sourceUrl: "y", detail: "stored 1 values" } },
        ],
      });

      let calls = 0;
      const now = () => {
        calls += 1;
        return calls === 1 ? T0 : new Date(T0.getTime() + 36_000);
      };

      const result = await runDailyJob({ now, jobRuns, runIngestion, secrets: [] });
      expect(result).toMatchObject({ kind: "finished", status: "success" });

      const rows = await db.pg.query<{ status: string; etfs_processed: number; errors_count: number; log: string | null; finished_at: Date | null }>(
        'select "status", "etfs_processed", "errors_count", "log", "finished_at" from "job_runs" order by "id"',
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0].status).toBe("failed");
      expect(rows.rows[0].log).toBe(STALE_RUN_LOG_LINE);
      expect(rows.rows[1].status).toBe("success");
      expect(rows.rows[1].etfs_processed).toBe(2);
      expect(rows.rows[1].errors_count).toBe(0);
      expect(rows.rows[1].finished_at).not.toBeNull();
      expect(rows.rows[1].log).toContain("success: 2 processed, 0 errors");
    },
    30_000,
  );
});
