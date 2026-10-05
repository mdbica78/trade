import { vi } from "vitest";
import type { ExtractionAdapter } from "../../lib/extraction/adapters/types";
import type { DiscoveryResult, ReportLink } from "../../lib/extraction/discovery";
import type { PdfDownloadResult, PdfTextResult } from "../../lib/extraction/pdf";
import type { IngestDeps } from "../../lib/ingestion/ingest-etf";
import type { ReportLinkStore, UpsertReportLinkInput } from "../../lib/ingestion/report-links";
import type { RunBudget } from "../../lib/ingestion/run-daily";
import type { ReportStore, SaveReportInput, SaveReportResult } from "../../lib/ingestion/store";

export const FIXED_NOW = new Date("2026-09-27T08:00:00Z");

export class FakeLinkStore implements ReportLinkStore {
  calls: UpsertReportLinkInput[] = [];
  impl?: (input: UpsertReportLinkInput) => Promise<void>;

  async upsertReportLink(input: UpsertReportLinkInput): Promise<void> {
    this.calls.push(input);
    if (this.impl) return this.impl(input);
  }
}

/** A `{ status: "found", ... }` discovery result for one link (US-049 A7: `links`/`truncated` are now required). */
export function foundDiscovery(link: ReportLink): Extract<DiscoveryResult, { status: "found" }> {
  return { status: "found", ...link, links: [link], truncated: false };
}

/** `{ links, now }`, spread into any `IngestDeps` literal that does not care about the link write (type-only churn from US-030). */
export function linkDeps(): { links: ReportLinkStore; now: () => Date } {
  return { links: new FakeLinkStore(), now: () => FIXED_NOW };
}

/** A `RunBudget` whose deadline is far in the future, for tests that don't exercise the guard (US-030 AC7). */
export function roomyBudget(startedAt: Date = FIXED_NOW): RunBudget {
  return { startedAt, now: () => startedAt };
}

export const INSTRUMENT_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
export const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";

/** Every `saveReport` call this session has ever seen, across every IF test (IF-8c anti-vacuity). */
export const allSaveReportInputs: SaveReportInput[] = [];

export class FakeStore implements ReportStore {
  rows = new Map<string, { id: number; reportDate: string; status: string; sourceUrl: string; errorMessage: string | null; values: Map<string, { numericValue: string; rawValue: string }> }>();
  nextId = 1;
  saveReportCalls: SaveReportInput[] = [];
  findStoredReportUrlsCalls: { etfId: number; sourceUrls: readonly string[] }[] = [];
  saveReportImpl?: (input: SaveReportInput) => Promise<SaveReportResult>;
  findStoredReportUrlsImpl?: (etfId: number, sourceUrls: readonly string[]) => Promise<ReadonlyMap<string, string>>;

  key(etfId: number, reportDate: string) {
    return `${etfId}:${reportDate}`;
  }

  seed(
    etfId: number,
    reportDate: string,
    status: string,
    values: readonly { fieldKey: string; numericValue: string; rawValue: string }[] = [],
    errorMessage: string | null = null,
    sourceUrl: string = NEWEST_PDF_URL,
  ) {
    this.rows.set(this.key(etfId, reportDate), {
      id: this.nextId++,
      reportDate,
      status,
      sourceUrl,
      errorMessage,
      values: new Map(values.map((v) => [v.fieldKey, { numericValue: v.numericValue, rawValue: v.rawValue }])),
    });
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
    this.rows.set(key, { id, reportDate: input.reportDate, status: input.status, sourceUrl: input.sourceUrl, errorMessage: input.errorMessage, values });
    return { status: "written", reportId: id };
  }

  async findStoredReportUrls(etfId: number, sourceUrls: readonly string[]): Promise<ReadonlyMap<string, string>> {
    this.findStoredReportUrlsCalls.push({ etfId, sourceUrls });
    if (this.findStoredReportUrlsImpl) return this.findStoredReportUrlsImpl(etfId, sourceUrls);
    const map = new Map<string, string>();
    for (const [key, row] of this.rows) {
      if (!key.startsWith(`${etfId}:`)) continue;
      if (row.status === "ok" && sourceUrls.includes(row.sourceUrl)) {
        map.set(row.sourceUrl, row.reportDate);
      }
    }
    return map;
  }
}

export const FAKE_FILING_FIELD_KEY = "nav_per_unit";

/** A minimal adapter for `filingDeps`: reads the report date out of the stubbed text (`REPORT_DATE:YYYY-MM-DD`). */
function fakeFilingAdapter(): ExtractionAdapter {
  return {
    key: "fake-filing",
    fieldKeys: [FAKE_FILING_FIELD_KEY],
    canHandle: () => true,
    extract(text: string) {
      const match = /REPORT_DATE:(\d{4}-\d{2}-\d{2})/.exec(text);
      if (!match) {
        return { ok: false, error: "fake-filing: no REPORT_DATE in text" };
      }
      return {
        ok: true,
        reportDate: match[1],
        values: [{ fieldKey: FAKE_FILING_FIELD_KEY, numericValue: "1", rawValue: "1" }],
        missingFields: [],
      };
    },
  };
}

/**
 * A stubbed multi-link `IngestDeps` (US-037): `discover` returns every one of `links` as the
 * newest filing, `download` tags its bytes with the URL, and `extractText` looks the matching
 * stubbed text back up by URL so each link's report date/values come from its own text.
 */
export function filingDeps(options: {
  links: readonly ReportLink[];
  store: ReportStore;
  textFor: (link: ReportLink) => string;
  canStartDownload?: () => boolean;
}): IngestDeps {
  const textByUrl = new Map(options.links.map((link) => [link.pdfUrl, options.textFor(link)] as const));
  const [first, ...rest] = options.links;
  return {
    discover: async () => ({ status: "found", ...first, links: [first, ...rest], truncated: false }),
    download: async (url: string) => ({ ok: true, bytes: new TextEncoder().encode(url), fetchedAt: FIXED_NOW }),
    extractText: async (bytes: Uint8Array) => {
      const url = new TextDecoder().decode(bytes);
      const text = textByUrl.get(url);
      return text !== undefined
        ? { ok: true, text }
        : { ok: false, kind: "unreadable", message: `filingDeps: unknown url ${url}` };
    },
    registry: { get: () => fakeFilingAdapter() },
    store: options.store,
    canStartDownload: options.canStartDownload,
    ...linkDeps(),
  };
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
    discover: async () => foundDiscovery({ pdfUrl: NEWEST_PDF_URL, title: "VAN la data 22.09.2026" }),
    download: async () => ({ ok: true, bytes, fetchedAt }),
    extractText: overrides.extractText ?? (async () => ({ ok: true, text })),
    registry: { get: () => adapter },
    store,
    ...linkDeps(),
  };
}
