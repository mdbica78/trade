import type { AdapterRegistry, ExtractionAdapter, ExtractionResult } from "../extraction/adapters/types";
import { validateExtractionResult } from "../extraction/adapters/validate";
import type { DiscoveryResult, ReportLink } from "../extraction/discovery";
import type { PdfDownloadResult, PdfTextResult } from "../extraction/pdf";
import { errorText, formatFetchError, formatMissingFields, formatViolations, oneLine, type IngestOutcome } from "./outcome";
import { selectValuesToPersist } from "./select-values";
import type { ReportStore, SaveReportInput } from "./store";

export type { IngestOutcome, IngestOutcomeCode } from "./outcome";

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

type PersistWriteStatus = "ok" | "parse_error";

/**
 * Applies US-012's precedence once for every write path: an existing `ok` row is never
 * downgraded (checked here, and again in SQL by `store.ts`'s `status <> 'ok'` guards).
 */
async function persist(
  etf: IngestEtfInput,
  store: ReportStore,
  write: {
    status: PersistWriteStatus;
    reportDate: string;
    sourceUrl: string;
    fetchedAt: Date;
    errorMessage: string | null;
    values: SaveReportInput["values"];
  },
  onWritten: (reportDate: string) => IngestOutcome,
): Promise<IngestOutcome> {
  try {
    const existing = await store.findReport(etf.id, write.reportDate);
    if (existing?.status === "ok") {
      return { code: "already_ingested", symbol: etf.symbol, reportDate: write.reportDate, detail: oneLine("report already stored") };
    }

    const saved = await store.saveReport({
      etfId: etf.id,
      reportDate: write.reportDate,
      sourceUrl: write.sourceUrl,
      fetchedAt: write.fetchedAt,
      status: write.status,
      errorMessage: write.errorMessage,
      values: write.values,
    });
    if (saved.status === "already_ok") {
      return { code: "already_ingested", symbol: etf.symbol, reportDate: write.reportDate, detail: oneLine("report already stored") };
    }

    return onWritten(write.reportDate);
  } catch (error) {
    return {
      code: "persist_error",
      symbol: etf.symbol,
      reportDate: write.reportDate,
      detail: oneLine(`database write failed: ${errorText(error)}`),
    };
  }
}

/**
 * Discovers the newest report link and ingests it for one ETF (FR3, FR4). Exactly one
 * discovery request and, when an adapter resolves, at most one PDF download. Never throws:
 * every failure becomes an outcome from the closed `IngestOutcomeCode` vocabulary (FR13).
 */
export async function ingestEtf(etf: IngestEtfInput, deps: IngestDeps): Promise<IngestOutcome> {
  let adapter: ExtractionAdapter | undefined;
  try {
    adapter = deps.registry.get(etf.adapterKey);
  } catch (error) {
    return {
      code: "no_adapter",
      symbol: etf.symbol,
      detail: oneLine(`no adapter: lookup failed: ${errorText(error)}`),
    };
  }
  if (!adapter) {
    const detail =
      etf.adapterKey === null
        ? "no adapter: adapter_key not set"
        : `no adapter: adapter_key "${etf.adapterKey}" is not registered`;
    return { code: "no_adapter", symbol: etf.symbol, detail: oneLine(detail) };
  }

  let discovery: DiscoveryResult;
  try {
    discovery = await deps.discover({ symbol: etf.symbol, bvbUrl: etf.bvbUrl });
  } catch (error) {
    return {
      code: "fetch_error",
      symbol: etf.symbol,
      stage: "discovery",
      kind: "unexpected",
      detail: oneLine(formatFetchError("discovery", "unexpected", undefined, errorText(error))),
    };
  }

  if (discovery.status === "error") {
    return {
      code: "fetch_error",
      symbol: etf.symbol,
      stage: "discovery",
      kind: discovery.kind,
      httpStatus: discovery.httpStatus,
      detail: oneLine(formatFetchError("discovery", discovery.kind, discovery.httpStatus, discovery.message)),
    };
  }
  if (discovery.status === "not_found") {
    return {
      code: "missing",
      symbol: etf.symbol,
      reason: discovery.reason,
      detail: oneLine(`no report found: ${discovery.reason}`),
    };
  }

  try {
    return await ingestReport(etf, adapter, discovery, deps);
  } catch (error) {
    return {
      code: "persist_error",
      symbol: etf.symbol,
      detail: oneLine(`database write failed: ${errorText(error)}`),
    };
  }
}

/** The "ingest one report link" half, kept separate so a future change to discovery (e.g. every link in a filing row) only changes `ingestEtf`. */
export async function ingestReport(
  etf: IngestEtfInput,
  adapter: ExtractionAdapter,
  link: ReportLink,
  deps: IngestDeps,
): Promise<IngestOutcome> {
  let download: PdfDownloadResult;
  try {
    download = await deps.download(link.pdfUrl);
  } catch (error) {
    return {
      code: "fetch_error",
      symbol: etf.symbol,
      stage: "download",
      kind: "unexpected",
      detail: oneLine(formatFetchError("download", "unexpected", undefined, errorText(error))),
    };
  }
  if (!download.ok) {
    return {
      code: "fetch_error",
      symbol: etf.symbol,
      stage: "download",
      kind: download.kind,
      httpStatus: download.httpStatus,
      detail: oneLine(formatFetchError("download", download.kind, download.httpStatus, download.message)),
    };
  }

  try {
    const textResult = await deps.extractText(download.bytes);
    if (!textResult.ok) {
      return {
        code: "parse_error",
        symbol: etf.symbol,
        reason: "unreadable_text",
        detail: oneLine(`unreadable text: ${textResult.message}`),
      };
    }

    if (!adapter.canHandle(textResult.text)) {
      return {
        code: "parse_error",
        symbol: etf.symbol,
        reason: "format_not_recognised",
        detail: oneLine(`report format not recognised by adapter ${adapter.key}`),
      };
    }

    const result: ExtractionResult = adapter.extract(textResult.text);
    if (!result.ok) {
      return {
        code: "parse_error",
        symbol: etf.symbol,
        reason: "extraction_failed",
        detail: oneLine(`extraction failed: ${result.error}`),
      };
    }

    const violations = validateExtractionResult(adapter, result);
    if (violations.length > 0) {
      if (violations.some((v) => v.rule === "invalid_report_date")) {
        return {
          code: "parse_error",
          symbol: etf.symbol,
          reason: "contract_violation",
          detail: oneLine(formatViolations(violations)),
        };
      }
      return persist(
        etf,
        deps.store,
        {
          status: "parse_error",
          reportDate: result.reportDate,
          sourceUrl: link.pdfUrl,
          fetchedAt: download.fetchedAt,
          errorMessage: oneLine(formatViolations(violations)),
          values: [],
        },
        (reportDate) => ({
          code: "parse_error",
          symbol: etf.symbol,
          reason: "contract_violation",
          reportDate,
          detail: oneLine(formatViolations(violations)),
        }),
      );
    }

    const selection = selectValuesToPersist(result, etf.trackedFieldKeys);
    if (!selection.complete) {
      const errorMessage = oneLine(formatMissingFields(selection.missingFieldKeys));
      return persist(
        etf,
        deps.store,
        {
          status: "parse_error",
          reportDate: result.reportDate,
          sourceUrl: link.pdfUrl,
          fetchedAt: download.fetchedAt,
          errorMessage,
          values: selection.values,
        },
        (reportDate) => ({ code: "parse_error", symbol: etf.symbol, reason: "incomplete", reportDate, detail: errorMessage }),
      );
    }

    return persist(
      etf,
      deps.store,
      {
        status: "ok",
        reportDate: result.reportDate,
        sourceUrl: link.pdfUrl,
        fetchedAt: download.fetchedAt,
        errorMessage: null,
        values: selection.values,
      },
      (reportDate) => ({
        code: "ok",
        symbol: etf.symbol,
        reportDate,
        valuesWritten: selection.values.length,
        sourceUrl: link.pdfUrl,
        detail: oneLine(`stored ${selection.values.length} values`),
      }),
    );
  } catch (error) {
    return {
      code: "parse_error",
      symbol: etf.symbol,
      reason: "unexpected",
      detail: oneLine(`unexpected error during extraction: ${errorText(error)}`),
    };
  }
}
