import type { Db } from "../db/index";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { CRON_FETCH_TIMEOUT_MS } from "../ingestion/run-daily";
import { neonBatchRunner } from "../ingestion/store";
import { detectAdapter } from "./detect-adapter";
import type { EtfConfigDeps } from "./etfs";

/**
 * The only file in `lib/config` that wires concrete I/O. Reuses the cron's fetch timeout
 * (US-020 plan R2): worst case discovery + download + text extraction stays well inside the
 * admin ETF route's `maxDuration = 60`.
 */
export function createEtfConfigDeps(db: Db): EtfConfigDeps {
  return {
    db,
    run: neonBatchRunner(db),
    registry: defaultAdapterRegistry,
    detect: (etf) =>
      detectAdapter(etf, {
        discover: (e) => discoverLatestReport(e, { timeoutMs: CRON_FETCH_TIMEOUT_MS }),
        download: (url) => downloadReportPdf(url, { timeoutMs: CRON_FETCH_TIMEOUT_MS }),
        extractText: extractPdfText,
        registry: defaultAdapterRegistry,
      }),
  };
}
