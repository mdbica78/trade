import type { AdapterRegistry, ExtractionAdapter, ExtractionResult } from "../extraction/adapters/types";
import { validateExtractionResult } from "../extraction/adapters/validate";
import type { DiscoveryResult, ReportLink } from "../extraction/discovery";
import type { PdfDownloadResult, PdfTextResult } from "../extraction/pdf";
import { selectValuesToPersist } from "./select-values";
import type { ReportStore } from "./store";

export type IngestEtfInput = {
  id: number;
  symbol: string;
  bvbUrl: string;
  adapterKey: string | null;
  trackedFieldKeys: readonly string[];
};

export type IngestDeps = {
  discover: (etf: { symbol: string; bvbUrl: string }) => Promise<DiscoveryResult>;
  download: (url: string) => Promise<PdfDownloadResult>;
  extractText: (bytes: Uint8Array) => Promise<PdfTextResult>;
  registry: Pick<AdapterRegistry, "get">;
  store: ReportStore;
};

export type IngestStage =
  | "adapter"
  | "discovery"
  | "download"
  | "text"
  | "extract"
  | "validate"
  | "select"
  | "persist"
  | "internal";

export type IngestOutcome =
  | { code: "ok"; symbol: string; reportDate: string; valuesWritten: number; sourceUrl: string }
  | { code: "already_ingested"; symbol: string; reportDate: string }
  | { code: "failed"; symbol: string; stage: IngestStage; kind?: string; message: string; reportDate?: string };

/**
 * Discovers the newest report link and ingests it for one ETF (FR3, FR4). Exactly one
 * discovery request and, when an adapter resolves, at most one PDF download. Never throws:
 * every failure, including a store error, becomes a `failed` outcome (FR13).
 */
export async function ingestEtf(etf: IngestEtfInput, deps: IngestDeps): Promise<IngestOutcome> {
  let stage: IngestStage = "adapter";
  try {
    const adapter = deps.registry.get(etf.adapterKey);
    if (!adapter) {
      return {
        code: "failed",
        symbol: etf.symbol,
        stage: "adapter",
        message: `no adapter registered for key "${etf.adapterKey ?? ""}"`,
      };
    }

    stage = "discovery";
    const discovery = await deps.discover({ symbol: etf.symbol, bvbUrl: etf.bvbUrl });
    if (discovery.status === "error") {
      return { code: "failed", symbol: etf.symbol, stage: "discovery", kind: discovery.kind, message: discovery.message };
    }
    if (discovery.status === "not_found") {
      return {
        code: "failed",
        symbol: etf.symbol,
        stage: "discovery",
        kind: discovery.reason,
        message: `no depositary report found for ${etf.symbol} (${discovery.reason})`,
      };
    }

    return await ingestReport(etf, adapter, discovery, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { code: "failed", symbol: etf.symbol, stage, message };
  }
}

/** The "ingest one report link" half, kept separate so a future change to discovery (e.g. every link in a filing row) only changes `ingestEtf`. */
export async function ingestReport(
  etf: IngestEtfInput,
  adapter: ExtractionAdapter,
  link: ReportLink,
  deps: IngestDeps,
): Promise<IngestOutcome> {
  let stage: IngestStage = "download";
  try {
    const download = await deps.download(link.pdfUrl);
    if (!download.ok) {
      return { code: "failed", symbol: etf.symbol, stage: "download", kind: download.kind, message: download.message };
    }

    stage = "text";
    const textResult = await deps.extractText(download.bytes);
    if (!textResult.ok) {
      return { code: "failed", symbol: etf.symbol, stage: "text", kind: textResult.kind, message: textResult.message };
    }

    stage = "extract";
    const result: ExtractionResult = adapter.extract(textResult.text);
    if (!result.ok) {
      return { code: "failed", symbol: etf.symbol, stage: "extract", message: result.error };
    }

    stage = "validate";
    const violations = validateExtractionResult(adapter, result);
    if (violations.length > 0) {
      return {
        code: "failed",
        symbol: etf.symbol,
        stage: "validate",
        message: violations.map((v) => v.message).join("; "),
        reportDate: result.reportDate,
      };
    }

    stage = "select";
    const selection = selectValuesToPersist(result, etf.trackedFieldKeys);
    if (!selection.complete) {
      return {
        code: "failed",
        symbol: etf.symbol,
        stage: "select",
        message: `tracked field(s) not found: ${selection.missingFieldKeys.join(", ")}`,
        reportDate: result.reportDate,
      };
    }

    stage = "persist";
    const existing = await deps.store.findReport(etf.id, result.reportDate);
    if (existing?.status === "ok") {
      return { code: "already_ingested", symbol: etf.symbol, reportDate: result.reportDate };
    }

    const saved = await deps.store.saveReport({
      etfId: etf.id,
      reportDate: result.reportDate,
      sourceUrl: link.pdfUrl,
      fetchedAt: download.fetchedAt,
      status: "ok",
      errorMessage: null,
      values: selection.values,
    });
    if (saved.status === "already_ok") {
      return { code: "already_ingested", symbol: etf.symbol, reportDate: result.reportDate };
    }

    return {
      code: "ok",
      symbol: etf.symbol,
      reportDate: result.reportDate,
      valuesWritten: selection.values.length,
      sourceUrl: link.pdfUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { code: "failed", symbol: etf.symbol, stage, message };
  }
}
