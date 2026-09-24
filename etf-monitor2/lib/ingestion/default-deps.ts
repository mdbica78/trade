import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { getDb } from "../db/index";
import type { IngestDeps } from "./ingest-etf";
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
