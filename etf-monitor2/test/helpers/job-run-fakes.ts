import type { FinishRunInput, JobRunStore } from "../../lib/ingestion/job-runs";

export type FakeJobRunRow = {
  id: number;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  etfsProcessed: number;
  errorsCount: number;
  log: string | null;
};

export type JobRunStoreCall =
  | { method: "failStaleRuns"; args: [Date] }
  | { method: "startRun"; args: [Date] }
  | { method: "finishRun"; args: [number, FinishRunInput] };

export type FakeJobRunStore = JobRunStore & {
  calls: JobRunStoreCall[];
  rows: Map<number, FakeJobRunRow>;
};

/**
 * `events`, when given, is a shared recorder so a test can assert ordering across the store, the
 * ETF loader and the ingest calls in one list (DJ-1a).
 */
export function createFakeJobRunStore(
  options: {
    failOn?: "failStaleRuns" | "startRun" | "finishRun";
    staleSweepCount?: number;
    events?: string[];
  } = {},
): FakeJobRunStore {
  const rows = new Map<number, FakeJobRunRow>();
  const calls: JobRunStoreCall[] = [];
  let nextId = 1;

  return {
    calls,
    rows,
    async failStaleRuns(startedBefore) {
      calls.push({ method: "failStaleRuns", args: [startedBefore] });
      options.events?.push("failStaleRuns");
      if (options.failOn === "failStaleRuns") {
        throw new Error("failStaleRuns failed");
      }
      return options.staleSweepCount ?? 0;
    },
    async startRun(startedAt) {
      calls.push({ method: "startRun", args: [startedAt] });
      options.events?.push("startRun");
      if (options.failOn === "startRun") {
        throw new Error("startRun failed");
      }
      const id = nextId++;
      rows.set(id, {
        id,
        startedAt,
        finishedAt: null,
        status: "running",
        etfsProcessed: 0,
        errorsCount: 0,
        log: null,
      });
      return id;
    },
    async finishRun(id, input) {
      calls.push({ method: "finishRun", args: [id, input] });
      options.events?.push("finishRun");
      if (options.failOn === "finishRun") {
        throw new Error("finishRun failed");
      }
      const row = rows.get(id);
      if (!row) {
        throw new Error(`job run ${id} not found`);
      }
      row.finishedAt = input.finishedAt;
      row.status = input.status;
      row.etfsProcessed = input.etfsProcessed;
      row.errorsCount = input.errorsCount;
      row.log = input.log;
    },
  };
}

/** A fixed sequence of clock reads, one per call; throws if called more times than provided (a bug, not a fallback). */
export function fixedClock(...reads: readonly Date[]): () => Date {
  let i = 0;
  return () => {
    if (i >= reads.length) {
      throw new Error("fixedClock: no more scheduled reads");
    }
    return reads[i++];
  };
}
