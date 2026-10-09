import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as schema from "../db/schema";
import { jobRuns } from "../db/schema";
import type { Db } from "../db/index";
import {
  buildFailStaleRunsStatement,
  buildFinishRunStatement,
  buildStartRunStatement,
  createDrizzleJobRunStore,
  STALE_RUN_LOG_LINE,
  type JobRunStatus,
} from "./job-runs";
import type { BatchRunner } from "./store";

const mockDb = drizzle.mock({ schema }) as unknown as Db;

describe("JR: statement builders", () => {
  it("buildFailStaleRunsStatement targets running rows older than the cutoff, never touches finished_at", () => {
    const { sql, params } = buildFailStaleRunsStatement(mockDb, new Date("2026-09-25T09:45:00Z")).getQuery();
    expect(sql).toContain(`"status" = 'running'`);
    expect(sql).toContain(`"started_at" <`);
    expect(sql).not.toContain("finished_at");
    expect(sql).toContain("'failed'");
    expect(params).toContain(STALE_RUN_LOG_LINE);
  });

  it("buildStartRunStatement inserts a running row with the given started_at", () => {
    const startedAt = new Date("2026-09-25T10:00:00Z");
    const { sql, params } = buildStartRunStatement(mockDb, startedAt).getQuery();
    expect(sql).toContain('insert into "job_runs"');
    expect(sql).toContain("'running'");
    expect(params).toContain(startedAt);
  });

  it("buildFinishRunStatement is keyed on id and has no status = 'running' guard", () => {
    const input = {
      finishedAt: new Date("2026-09-25T10:05:00Z"),
      status: "success" as const,
      etfsProcessed: 3,
      errorsCount: 0,
      log: "success: 3 processed, 0 errors",
    };
    const { sql, params } = buildFinishRunStatement(mockDb, 42, input).getQuery();
    expect(sql).toContain('update "job_runs"');
    expect(sql).toContain('where "id" =');
    expect(sql).not.toContain(`"status" = 'running'`);
    expect(params).toContain(42);
    expect(params).toContain("success");
  });
});

describe("JR: createDrizzleJobRunStore", () => {
  function fakeRunner(rows: readonly Record<string, unknown>[]) {
    const calls: { statementCount: number }[] = [];
    const run: BatchRunner = async (statements) => {
      calls.push({ statementCount: statements.length });
      return [rows];
    };
    return { run, calls };
  }

  it("failStaleRuns calls the runner once with one statement and returns the swept row count", async () => {
    const { run, calls } = fakeRunner([{ id: 1 }, { id: 2 }]);
    const store = createDrizzleJobRunStore(mockDb, run);
    const count = await store.failStaleRuns(new Date("2026-09-25T09:45:00Z"));
    expect(count).toBe(2);
    expect(calls).toEqual([{ statementCount: 1 }]);
  });

  it("startRun calls the runner once and returns the new numeric id", async () => {
    const { run, calls } = fakeRunner([{ id: "42" }]);
    const store = createDrizzleJobRunStore(mockDb, run);
    const id = await store.startRun(new Date("2026-09-25T10:00:00Z"));
    expect(id).toBe(42);
    expect(calls).toEqual([{ statementCount: 1 }]);
  });

  it("finishRun resolves when a row was updated", async () => {
    const { run } = fakeRunner([{ id: 42 }]);
    const store = createDrizzleJobRunStore(mockDb, run);
    await expect(
      store.finishRun(42, { finishedAt: new Date(), status: "success", etfsProcessed: 1, errorsCount: 0, log: "x" }),
    ).resolves.toBeUndefined();
  });

  it("finishRun rejects when no row matched the id", async () => {
    const { run } = fakeRunner([]);
    const store = createDrizzleJobRunStore(mockDb, run);
    await expect(
      store.finishRun(999, { finishedAt: new Date(), status: "success", etfsProcessed: 0, errorsCount: 0, log: "x" }),
    ).rejects.toThrow("job run 999 not found");
  });
});

describe("JobRunStatus stays tied to the schema", () => {
  it("equals the schema's inferred status column type", () => {
    expectTypeOf<JobRunStatus>().toEqualTypeOf<(typeof jobRuns.$inferSelect)["status"]>();
  });
});
