import { vi } from "vitest";
import type { ExtractionAdapter } from "../../lib/extraction/adapters/types";
import type { PdfDownloadResult, PdfTextResult } from "../../lib/extraction/pdf";
import type { IngestDeps } from "../../lib/ingestion/ingest-etf";
import type { ReportStore, SaveReportInput, SaveReportResult } from "../../lib/ingestion/store";

export const INSTRUMENT_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
export const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";

/** Every `saveReport` call this session has ever seen, across every IF test (IF-8c anti-vacuity). */
export const allSaveReportInputs: SaveReportInput[] = [];

export class FakeStore implements ReportStore {
  rows = new Map<string, { id: number; status: string; errorMessage: string | null; values: Map<string, { numericValue: string; rawValue: string }> }>();
  nextId = 1;
  findReportCalls: { etfId: number; reportDate: string }[] = [];
  saveReportCalls: SaveReportInput[] = [];
  findReportImpl?: (etfId: number, reportDate: string) => Promise<{ id: number; status: string } | undefined>;
  saveReportImpl?: (input: SaveReportInput) => Promise<SaveReportResult>;

  key(etfId: number, reportDate: string) {
    return `${etfId}:${reportDate}`;
  }

  seed(etfId: number, reportDate: string, status: string, values: readonly { fieldKey: string; numericValue: string; rawValue: string }[] = [], errorMessage: string | null = null) {
    this.rows.set(this.key(etfId, reportDate), {
      id: this.nextId++,
      status,
      errorMessage,
      values: new Map(values.map((v) => [v.fieldKey, { numericValue: v.numericValue, rawValue: v.rawValue }])),
    });
  }

  async findReport(etfId: number, reportDate: string) {
    this.findReportCalls.push({ etfId, reportDate });
    if (this.findReportImpl) return this.findReportImpl(etfId, reportDate);
    const row = this.rows.get(this.key(etfId, reportDate));
    return row ? { id: row.id, status: row.status } : undefined;
  }

  async saveReport(input: SaveReportInput): Promise<SaveReportResult> {
    this.saveReportCalls.push(input);
    allSaveReportInputs.push(input);
    if (this.saveReportImpl) return this.saveReportImpl(input);
    const key = this.key(input.etfId, input.reportDate);
    const existing = this.rows.get(key);
    if (existing?.status === "ok") {
      return { status: "already_ok" };
    }
    const id = existing?.id ?? this.nextId++;
    const values = new Map(input.values.map((v) => [v.fieldKey, { numericValue: v.numericValue, rawValue: v.rawValue }]));
    this.rows.set(key, { id, status: input.status, errorMessage: input.errorMessage, values });
    return { status: "written", reportId: id };
  }
}

export function makeFetchImpl(routes: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) {
      return new Response("not found", { status: 404 });
    }
    return route();
  }) as unknown as typeof fetch;
}

/**
 * Fully stubbed `IngestDeps`: discovery/download/text are canned, so a test can focus on the
 * adapter/store interaction without real HTTP or PDF parsing.
 */
export function stubPipelineDeps(
  adapter: ExtractionAdapter,
  text: string,
  store: ReportStore,
  overrides: { download?: Partial<Extract<PdfDownloadResult, { ok: true }>>; extractText?: () => Promise<PdfTextResult> } = {},
): IngestDeps {
  const fetchedAt = overrides.download?.fetchedAt ?? new Date("2026-09-22T09:00:00Z");
  const bytes = overrides.download?.bytes ?? new Uint8Array();
  return {
    discover: async () => ({ status: "found", pdfUrl: NEWEST_PDF_URL, title: "VAN la data 22.09.2026" }),
    download: async () => ({ ok: true, bytes, fetchedAt }),
    extractText: overrides.extractText ?? (async () => ({ ok: true, text })),
    registry: { get: () => adapter },
    store,
  };
}
