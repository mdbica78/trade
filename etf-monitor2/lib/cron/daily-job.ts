import { formatAbortedRunLog, formatRunLog, summarizeRun } from "../ingestion/job-run-summary";
import type { FinalJobRunStatus, JobRunStore } from "../ingestion/job-runs";
import type { DailyRunSummary } from "../ingestion/run-daily";

/** Longer than the route's maxDuration (60s, US-013), so a real timeout is always swept, never a live run. */
export const STALE_RUN_THRESHOLD_MS = 15 * 60_000;

export type DailyJobResult =
  | { kind: "finished"; jobRunId: number; status: FinalJobRunStatus; etfs: DailyRunSummary["etfs"] }
  | { kind: "aborted"; jobRunId: number; status: "failed"; reason: "run_threw" | "finish_failed" };

export type DailyJobDeps = {
  now: () => Date;
  jobRuns: JobRunStore;
  runIngestion: () => Promise<DailyRunSummary>;
  secrets: readonly string[];
};

/**
 * `failStaleRuns` and `startRun` are not wrapped in a try: if either fails (e.g. the database is
 * unreachable), no row exists yet, nothing can be recorded, and the caller (the handler) reports
 * `500 run could not start`. Once a row exists, every path finishes it: ingestion failures are
 * caught and logged as an abort, and `finishRun` is attempted exactly once (US-015 plan R2 — no
 * retry; a still-running row is picked up by the next run's stale-run sweep).
 */
export async function runDailyJob(deps: DailyJobDeps): Promise<DailyJobResult> {
  const startedAt = deps.now();
  await deps.jobRuns.failStaleRuns(new Date(startedAt.getTime() - STALE_RUN_THRESHOLD_MS));
  const jobRunId = await deps.jobRuns.startRun(startedAt);

  let finished:
    | { etfs: DailyRunSummary["etfs"]; status: FinalJobRunStatus; etfsProcessed: number; errorsCount: number; log: string }
    | undefined;
  let abortLog: string | undefined;

  try {
    const summary = await deps.runIngestion();
    const result = summarizeRun(summary.etfs);
    finished = {
      etfs: summary.etfs,
      status: result.status,
      etfsProcessed: result.etfsProcessed,
      errorsCount: result.errorsCount,
      log: formatRunLog(summary.etfs, result, deps.secrets),
    };
  } catch (error) {
    abortLog = formatAbortedRunLog(error, deps.secrets);
  }

  const finishInput = finished
    ? {
        finishedAt: deps.now(),
        status: finished.status,
        etfsProcessed: finished.etfsProcessed,
        errorsCount: finished.errorsCount,
        log: finished.log,
      }
    : { finishedAt: deps.now(), status: "failed" as const, etfsProcessed: 0, errorsCount: 0, log: abortLog! };

  try {
    await deps.jobRuns.finishRun(jobRunId, finishInput);
  } catch {
    return { kind: "aborted", jobRunId, status: "failed", reason: "finish_failed" };
  }

  if (!finished) {
    return { kind: "aborted", jobRunId, status: "failed", reason: "run_threw" };
  }
  return { kind: "finished", jobRunId, status: finished.status, etfs: finished.etfs };
}
