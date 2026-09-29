import { MAX_REPORTS_PER_FILING } from "../extraction/discovery";
import type { IngestEtfInput, IngestOutcome } from "./ingest-etf";

export { MAX_REPORTS_PER_FILING };

export const CRON_FETCH_TIMEOUT_MS = 7_000;

/** The most requests add-time detection (US-020/US-029) makes for one ETF: discovery + one PDF. */
export const MIN_REQUESTS_PER_ETF = 2;

/**
 * The most requests the daily run makes for one ETF: today's discovery GET plus at most
 * MAX_REPORTS_PER_FILING PDF GETs (US-037, DEC-018 §5 amended). Every PDF after the first is
 * additionally guarded per-download by `canStartDownload`, so this is a ceiling, not a promise.
 */
export const MAX_REQUESTS_PER_ETF = 1 + MAX_REPORTS_PER_FILING;

/** The Vercel Hobby cron function's `maxDuration` (`app/api/cron/daily/route.ts`). Kept as a named constant so the budget check below can prove it fits (story US-030 AC7). */
export const CRON_MAX_DURATION_S = 60;

/** Covers `unpdf` text extraction plus the Neon report batch for one ETF, on top of its network requests. */
export const PARSE_ALLOWANCE_MS = 5_000;

/** Covers `summarizeRun` + `finishRun` + the response, plus boot time before `startedAt`. */
export const FINISH_RESERVE_MS = 5_000;

/** Worst case for one ETF: every request timing out, plus the parse allowance. */
export function etfWorstCaseMs(requests: number = MAX_REQUESTS_PER_ETF): number {
  return requests * CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS;
}

/** The instant by which every ETF must have started, so the run still finishes inside `maxDuration`. */
export function runDeadlineMs(startedAt: Date): number {
  return startedAt.getTime() + CRON_MAX_DURATION_S * 1_000 - FINISH_RESERVE_MS;
}

/** Whether one more ETF can still start and fit its worst (minimum, discovery + one PDF) case before the deadline. */
export function canStartEtf(now: Date, startedAt: Date): boolean {
  return now.getTime() + etfWorstCaseMs(MIN_REQUESTS_PER_ETF) <= runDeadlineMs(startedAt);
}

/** Whether one more PDF download (after the first) can still fit before the deadline (US-037 AC5). */
export function canStartDownload(now: Date, startedAt: Date): boolean {
  return now.getTime() + CRON_FETCH_TIMEOUT_MS + PARSE_ALLOWANCE_MS <= runDeadlineMs(startedAt);
}

export type DailyEtf = IngestEtfInput & { isActive: boolean };

export type DailyEtfOutcome = IngestOutcome;

export type DailyRunSummary = { etfs: { symbol: string; outcome: DailyEtfOutcome }[] };

export type DailyRunDeps = {
  loadEtfs: () => Promise<readonly DailyEtf[]>;
  ingest: (etf: IngestEtfInput, run: { canStartDownload: () => boolean }) => Promise<IngestOutcome>;
};

export type RunBudget = { startedAt: Date; now: () => Date };

/**
 * Loads every ETF, skips inactive ones, and ingests the rest one at a time (FR4.1 "no
 * retries" — no `Promise.all`, so the bvb.ro load stays bounded and the logs stay
 * deterministic). One ETF's failure, thrown or returned, never stops the others. Before
 * starting each ETF, checks the run deadline (US-030 AC7): one whose worst case no longer fits
 * is skipped with `not_attempted`, and every ETF already started keeps its real outcome.
 */
export async function runDailyIngestion(deps: DailyRunDeps, budget: RunBudget): Promise<DailyRunSummary> {
  const etfs = await deps.loadEtfs();
  const results: { symbol: string; outcome: DailyEtfOutcome }[] = [];

  for (const etf of etfs) {
    if (etf.isActive !== true) {
      continue;
    }
    if (!canStartEtf(budget.now(), budget.startedAt)) {
      results.push({
        symbol: etf.symbol,
        outcome: { code: "not_attempted", symbol: etf.symbol, detail: "run time limit: not started before the deadline" },
      });
      continue;
    }
    let outcome: DailyEtfOutcome;
    try {
      outcome = await deps.ingest(
        {
          id: etf.id,
          symbol: etf.symbol,
          bvbUrl: etf.bvbUrl,
          adapterKey: etf.adapterKey,
          trackedFieldKeys: etf.trackedFieldKeys,
        },
        { canStartDownload: () => canStartDownload(budget.now(), budget.startedAt) },
      );
    } catch (error) {
      outcome = {
        code: "internal_error",
        symbol: etf.symbol,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
    results.push({ symbol: etf.symbol, outcome });
  }

  return { etfs: results };
}
