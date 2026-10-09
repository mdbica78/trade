import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { neonBatchRunner, rowsOf, type BatchRunner } from "./store";

export type JobRunStatus = "running" | "success" | "partial" | "failed";
export type FinalJobRunStatus = Exclude<JobRunStatus, "running">;

export const STALE_RUN_LOG_LINE = "did not finish (timed out or crashed)";

export type FinishRunInput = {
  finishedAt: Date;
  status: FinalJobRunStatus;
  etfsProcessed: number;
  errorsCount: number;
  log: string;
};

export interface JobRunStore {
  failStaleRuns(startedBefore: Date): Promise<number>;
  startRun(startedAt: Date): Promise<number>;
  finishRun(id: number, input: FinishRunInput): Promise<void>;
}

/**
 * A run killed by the platform's duration limit never reaches `finishRun` and would stay
 * `running` forever. Sweeps every such row to `failed`, appending the stale-run line to its
 * existing log (or setting it, if there is none). `finished_at` is deliberately left null:
 * nobody knows when the run actually ended.
 */
export function buildFailStaleRunsStatement(db: Db, startedBefore: Date) {
  return db.execute(
    sql`update "job_runs"
        set "status" = 'failed',
            "log" = case when "log" is null or "log" = '' then ${STALE_RUN_LOG_LINE}::text
                     else "log" || E'\n' || ${STALE_RUN_LOG_LINE}::text end
        where "status" = 'running' and "started_at" < ${startedBefore}
        returning "id"`,
  );
}

export function buildStartRunStatement(db: Db, startedAt: Date) {
  return db.execute(
    sql`insert into "job_runs" ("started_at", "status") values (${startedAt}, 'running') returning "id"`,
  );
}

/** No `status = 'running'` guard: whichever caller finishes a row last writes the true result (US-015 plan R2). */
export function buildFinishRunStatement(db: Db, id: number, input: FinishRunInput) {
  const { finishedAt, status, etfsProcessed, errorsCount, log } = input;
  return db.execute(
    sql`update "job_runs"
        set "finished_at" = ${finishedAt}, "status" = ${status}, "etfs_processed" = ${etfsProcessed},
            "errors_count" = ${errorsCount}, "log" = ${log}
        where "id" = ${id}
        returning "id"`,
  );
}

export function createDrizzleJobRunStore(db: Db, run: BatchRunner = neonBatchRunner(db)): JobRunStore {
  return {
    async failStaleRuns(startedBefore) {
      const [result] = await run([buildFailStaleRunsStatement(db, startedBefore)]);
      return rowsOf(result).length;
    },
    async startRun(startedAt) {
      const [result] = await run([buildStartRunStatement(db, startedAt)]);
      const rows = rowsOf(result);
      return Number(rows[0].id);
    },
    async finishRun(id, input) {
      const [result] = await run([buildFinishRunStatement(db, id, input)]);
      const rows = rowsOf(result);
      if (rows.length === 0) {
        throw new Error(`job run ${id} not found`);
      }
    },
  };
}
