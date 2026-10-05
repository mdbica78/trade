import { formatAbortedRunLog, formatRunLog, summarizeRun } from "../ingestion/job-run-summary";
import type { FinalJobRunStatus, FinishRunInput, JobRunStore } from "../ingestion/job-runs";
import type { DailyRunSummary } from "../ingestion/run-daily";

/** Longer than the route's maxDuration (60s, US-013), so a real timeout is always swept, never a live run. */
export const STALE_RUN_THRESHOLD_MS = 15 * 60_000;

export type DailyJobResult =
  | { kind: "finished"; jobRunId: number; status: FinalJobRunStatus; etfs: DailyRunSummary["etfs"] }
  | { kind: "aborted"; jobRunId: number; status: "failed"; reason: "run_threw" | "finish_failed" };

export type DailyJobDeps = {
  now: () => Date;
  jobRuns: JobRunStore;
  runIngestion: (ctx: { startedAt: Date }) => Promise<DailyRunSummary>;
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

  let etfs: DailyRunSummary["etfs"] = [];
  let threw = false;
  let fields: Omit<FinishRunInput, "finishedAt">;

  try {
    const summary = await deps.runIngestion({ startedAt });
    etfs = summary.etfs;
    const result = summarizeRun(summary.etfs);
    fields = { ...result, log: formatRunLog(summary.etfs, result, deps.secrets) };
  } catch (error) {
    threw = true;
    fields = { status: "failed", etfsProcessed: 0, errorsCount: 0, log: formatAbortedRunLog(error, deps.secrets) };
  }

  const input: FinishRunInput = { finishedAt: deps.now(), ...fields };

  try {
    await deps.jobRuns.finishRun(jobRunId, input);
  } catch {
    return { kind: "aborted", jobRunId, status: "failed", reason: "finish_failed" };
  }

  if (threw) {
    return { kind: "aborted", jobRunId, status: "failed", reason: "run_threw" };
  }
  return { kind: "finished", jobRunId, status: fields.status, etfs };
}
