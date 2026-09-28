import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { getDb, type Db } from "../db/index";
import { ingestEtf, type IngestDeps } from "./ingest-etf";
import { createDrizzleJobRunStore, type JobRunStore } from "./job-runs";
import { createDrizzleEtfLoader } from "./load-etfs";
import { createDrizzleReportLinkStore } from "./report-links";
import { CRON_FETCH_TIMEOUT_MS, type DailyRunDeps } from "./run-daily";
import type { BatchRunner } from "./store";
import { createDrizzleReportStore } from "./store";

/**
 * A database and the batch runner to use with it. Only tests inject this (US-031 plan section
 * 2.1) — the no-argument production path still calls `getDb()` and passes no runner, which hits
 * `neonBatchRunner(db)`'s default parameter, exactly as before this type existed.
 */
export type DatabaseAccess = { db: Db; run: BatchRunner };

/**
 * Wires the Sprint 2 extraction functions and the Drizzle store into `IngestDeps`. The only
 * file in `lib/ingestion` that imports concrete I/O. `getDb()` is only called when this
 * function runs, not at module load, so a missing `DATABASE_URL` surfaces at call time.
 * `now` is required (never read from the system clock inside `lib/ingestion`, BD-3).
 */
export function createDefaultIngestDeps(now: () => Date): IngestDeps {
  const db = getDb();
  return {
    discover: discoverLatestReport,
    download: downloadReportPdf,
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store: createDrizzleReportStore(db),
    links: createDrizzleReportLinkStore(db),
    now,
  };
}

/**
 * The cron route's dependencies: a shorter per-request `fetchTimeoutMs` than the default
 * (Vercel's `maxDuration` budget, US-013 plan R1), so the worst case for every active ETF
 * still fits inside the function's time limit.
 */
export function createDailyRunDeps(options: {
  now: () => Date;
  fetchTimeoutMs?: number;
  database?: DatabaseAccess;
}): DailyRunDeps {
  const timeoutMs = options.fetchTimeoutMs ?? CRON_FETCH_TIMEOUT_MS;
  const db = options.database?.db ?? getDb();
  const run = options.database?.run;
  const ingestDeps: IngestDeps = {
    discover: (etf) => discoverLatestReport(etf, { timeoutMs }),
    download: (url) => downloadReportPdf(url, { timeoutMs }),
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store: createDrizzleReportStore(db, run),
    links: createDrizzleReportLinkStore(db, run),
    now: options.now,
  };
  return {
    loadEtfs: createDrizzleEtfLoader(db, run),
    ingest: (etf) => ingestEtf(etf, ingestDeps),
  };
}

/** `getDb()` is only called when this function runs, so a missing `DATABASE_URL` surfaces at call time. */
export function createDefaultJobRunStore(database?: DatabaseAccess): JobRunStore {
  const db = database?.db ?? getDb();
  return createDrizzleJobRunStore(db, database?.run);
}
