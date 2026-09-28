import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

const BASE = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx";
const PDF_BASE = "https://bvb.ro/infocont/infocont26";

export const FIXTURE_URLS = {
  page: {
    BTBETRETF: `${BASE}?s=BTBETRETF`,
    TVBETETF: `${BASE}?s=TVBETETF`,
    PTENGETF: `${BASE}?s=PTENGETF`,
    ICBETNETF: `${BASE}?s=ICBETNETF`,
    NOADAPTER: `${BASE}?s=NOADAPTER`,
  },
  pdf: {
    BTBETRETF: `${PDF_BASE}/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf`,
    TVBETETF: `${PDF_BASE}/TVBETETF_20260923090730_VUAN-ETF-BET-Patria---Tradeville-22-09-2026.pdf`,
    PTENGETF: `${PDF_BASE}/PTENGETF_20260923090816_VUAN-ETF-Energie-Patria-Tradeville-22-09-2026.pdf`,
    ICBETNETF: `${PDF_BASE}/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf`,
    NOADAPTER: `${PDF_BASE}/NOADAPTER_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf`,
  },
} as const;

function readText(...segments: string[]): string {
  return readFileSync(path.join(FIXTURES_DIR, ...segments), "utf8");
}

function readBytes(name: string): Uint8Array<ArrayBuffer> {
  const buf = readFileSync(path.join(FIXTURES_DIR, name));
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

/** Replaces every occurrence of `from` with `to`, including inside every PDF href (which embeds the symbol). */
export function deriveSymbolPage(html: string, from: string, to: string): string {
  return html.split(from).join(to);
}

/** Empties the `gv5News` table's rows while keeping the table and its `id`, so discovery still finds the container but no report entries. */
export function withoutReportRows(html: string): string {
  return html.replace(
    /(<table[^>]*\bid=(["'])gv5News\2[^>]*>)([\s\S]*?)(<\/table>)/i,
    (_match, open: string, _q: string, inner: string, close: string) => `${open}${inner.replace(/<tr>[\s\S]*?<\/tr>/gi, "")}${close}`,
  );
}

export type FetchMap = ReadonlyMap<string, () => Response>;

function htmlResponse(html: string): Response {
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function pdfResponse(bytes: Uint8Array<ArrayBuffer>): Response {
  return new Response(bytes, { status: 200, headers: { "content-type": "application/pdf" } });
}

/** Day A: BRD pages list the 22 Sept filing (filing stamp 23 Sept); the served PDF content is the 21 Sept report — proves `report_date` comes from the PDF's own footer, never the URL or the filing stamp. */
export function dayAMap(): FetchMap {
  const btbetretfPage = readText("bvb", "BTBETRETF-instrument-2026-09-23.html");
  const map = new Map<string, () => Response>();
  map.set(FIXTURE_URLS.page.BTBETRETF, () => htmlResponse(btbetretfPage));
  map.set(FIXTURE_URLS.page.TVBETETF, () => htmlResponse(readText("bvb", "TVBETETF-instrument-2026-09-23.html")));
  map.set(FIXTURE_URLS.page.PTENGETF, () => htmlResponse(readText("bvb", "PTENGETF-instrument-2026-09-23.html")));
  map.set(FIXTURE_URLS.page.ICBETNETF, () => htmlResponse(readText("bvb", "ICBETNETF-instrument-2026-09-27.html")));
  map.set(FIXTURE_URLS.page.NOADAPTER, () => htmlResponse(deriveSymbolPage(btbetretfPage, "BTBETRETF", "NOADAPTER")));

  map.set(FIXTURE_URLS.pdf.BTBETRETF, () => pdfResponse(readBytes("BTBETRETF-2026-09-21.pdf")));
  map.set(FIXTURE_URLS.pdf.TVBETETF, () => pdfResponse(readBytes("TVBETETF-2026-09-21.pdf")));
  map.set(FIXTURE_URLS.pdf.PTENGETF, () => pdfResponse(readBytes("PTENGETF-2026-09-21.pdf")));
  map.set(FIXTURE_URLS.pdf.ICBETNETF, () => pdfResponse(readBytes("ICBETNETF-2026-09-24.pdf")));

  return map;
}

/** Day B: the BRD PDF hrefs now serve the 22 Sept report; PTENGETF's page has no report rows left (a missing day). ICBETNETF is unchanged. */
export function dayBMap(): FetchMap {
  const map = new Map(dayAMap());
  map.set(FIXTURE_URLS.pdf.BTBETRETF, () => pdfResponse(readBytes("BTBETRETF-2026-09-22.pdf")));
  map.set(FIXTURE_URLS.pdf.TVBETETF, () => pdfResponse(readBytes("TVBETETF-2026-09-22.pdf")));
  map.set(FIXTURE_URLS.page.PTENGETF, () => htmlResponse(withoutReportRows(readText("bvb", "PTENGETF-instrument-2026-09-23.html"))));
  return map;
}

export type FetchGuard = {
  fetch: typeof fetch;
  calls: { method: string; url: string }[];
  rejected: string[];
  setMap(map: FetchMap): void;
};

/** Records every call; an unknown URL is rejected with a `TypeError`, the shape of a real network failure. */
export function createFetchGuard(initialMap: FetchMap): FetchGuard {
  let map = initialMap;
  const calls: { method: string; url: string }[] = [];
  const rejected: string[] = [];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    calls.push({ method, url });
    const build = map.get(url);
    if (!build) {
      rejected.push(url);
      throw new TypeError(`fetch guard: unmapped URL ${url}`);
    }
    return build();
  }) as typeof fetch;

  return {
    fetch: fetchImpl,
    calls,
    rejected,
    setMap(next: FetchMap) {
      map = next;
    },
  };
}

export type ExpectedValue = { rawValue: string; numericValue: string };

/** The `expected.json` values for one fixture file, read independently of any adapter output. */
export function expectedValues(file: string): Record<string, ExpectedValue> {
  const data = JSON.parse(readText("expected.json")) as {
    fixtures: { file: string; values: Record<string, ExpectedValue> }[];
  };
  const entry = data.fixtures.find((f) => f.file === file);
  if (!entry) {
    throw new Error(`no expected.json entry for ${file}`);
  }
  return entry.values;
}
