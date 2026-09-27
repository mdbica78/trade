import type { IngestEtfInput, IngestOutcome } from "./ingest-etf";

export const CRON_FETCH_TIMEOUT_MS = 7_000;

/**
 * The most requests any access path makes for one ETF in the daily run: today's discovery GET
 * plus one PDF GET. Both the BRD `<a href>` path and the ICBETNETF `intercapital-nav` path stay
 * at 2 (US-029 FINDINGS §4, DEC-018 §5); it never needed to grow for either adapter.
 */
export const MAX_REQUESTS_PER_ETF = 2;

export type DailyEtf = IngestEtfInput & { isActive: boolean };

export type DailyEtfOutcome = IngestOutcome;

export type DailyRunSummary = { etfs: { symbol: string; outcome: DailyEtfOutcome }[] };

export type DailyRunDeps = {
  loadEtfs: () => Promise<readonly DailyEtf[]>;
  ingest: (etf: IngestEtfInput) => Promise<IngestOutcome>;
};

/**
 * Loads every ETF, skips inactive ones, and ingests the rest one at a time (FR4.1 "no
 * retries" — no `Promise.all`, so the bvb.ro load stays bounded and the logs stay
 * deterministic). One ETF's failure, thrown or returned, never stops the others.
 */
export async function runDailyIngestion(deps: DailyRunDeps): Promise<DailyRunSummary> {
  const etfs = await deps.loadEtfs();
  const results: { symbol: string; outcome: DailyEtfOutcome }[] = [];

  for (const etf of etfs) {
    if (etf.isActive !== true) {
      continue;
    }
    let outcome: DailyEtfOutcome;
    try {
      outcome = await deps.ingest({
        id: etf.id,
        symbol: etf.symbol,
        bvbUrl: etf.bvbUrl,
        adapterKey: etf.adapterKey,
        trackedFieldKeys: etf.trackedFieldKeys,
      });
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
