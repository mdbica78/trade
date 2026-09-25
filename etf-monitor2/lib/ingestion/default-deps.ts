import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { getDb } from "../db/index";
import { ingestEtf, type IngestDeps } from "./ingest-etf";
import { createDrizzleJobRunStore, type JobRunStore } from "./job-runs";
import { createDrizzleEtfLoader } from "./load-etfs";
import { CRON_FETCH_TIMEOUT_MS, type DailyRunDeps } from "./run-daily";
import { createDrizzleReportStore } from "./store";

/**
 * Wires the Sprint 2 extraction functions and the Drizzle store into `IngestDeps`. The only
 * file in `lib/ingestion` that imports concrete I/O. `getDb()` is only called when this
 * function runs, not at module load, so a missing `DATABASE_URL` surfaces at call time.
 */
export function createDefaultIngestDeps(): IngestDeps {
  return {
    discover: discoverLatestReport,
    download: downloadReportPdf,
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store: createDrizzleReportStore(getDb()),
  };
}

/**
 * The cron route's dependencies: a shorter per-request `fetchTimeoutMs` than the default
 * (Vercel's `maxDuration` budget, US-013 plan R1), so the worst case for every active ETF
 * still fits inside the function's time limit.
 */
export function createDailyRunDeps(options: { fetchTimeoutMs?: number } = {}): DailyRunDeps {
  const timeoutMs = options.fetchTimeoutMs ?? CRON_FETCH_TIMEOUT_MS;
  const db = getDb();
  const ingestDeps: IngestDeps = {
    discover: (etf) => discoverLatestReport(etf, { timeoutMs }),
    download: (url) => downloadReportPdf(url, { timeoutMs }),
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store: createDrizzleReportStore(db),
  };
  return {
    loadEtfs: createDrizzleEtfLoader(db),
    ingest: (etf) => ingestEtf(etf, ingestDeps),
  };
}

/** `getDb()` is only called when this function runs, so a missing `DATABASE_URL` surfaces at call time. */
export function createDefaultJobRunStore(): JobRunStore {
  return createDrizzleJobRunStore(getDb());
}
