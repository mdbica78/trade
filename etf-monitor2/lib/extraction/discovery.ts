import { collapseWhitespace, decodeEntities, foldForMatch, stripTags } from "./html";
import { fetchOnce } from "./http";

export const BVB_REQUEST_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5",
  "User-Agent": "etf-monitor2/0.1 (daily ETF report monitor)",
};

export const DEFAULT_DISCOVERY_TIMEOUT_MS = 15_000;

export type ReportLink = {
  pdfUrl: string;
  title: string;
  publishedAt?: string;
};

export type DiscoveryResult =
  | ({ status: "found" } & ReportLink)
  | { status: "not_found"; reason: "no_report_entries" | "list_not_found" }
  | { status: "error"; kind: "http_error" | "network" | "timeout"; message: string; httpStatus?: number };

type ParsedEntry = {
  href: string;
  pdfUrl: string | null;
  title: string;
  publishedAt?: string;
  isDepositaryReport: boolean;
  index: number;
  rowIndex: number;
  linkIndexInRow: number;
};

export type ParseResult = {
  listFound: boolean;
  entries: ParsedEntry[];
};

const LIST_CONTAINER_RE = /<table[^>]*\bid=(["'])gv5News\1[^>]*>([\s\S]*?)<\/table>/i;
const ROW_RE = /<tr>([\s\S]*?)<\/tr>/gi;
const TITLE_RE = /<input[^>]*\bvalue=(["'])([\s\S]*?)\1[^>]*>/i;
const DATE_RE = /<p[^>]*\bclass=(["'])[^"']*\bdate\b[^"']*\1[^>]*>([\s\S]*?)<\/p>/i;
const HREF_RE = /<a[^>]*\bhref=(["'])([\s\S]*?)\1[^>]*>/gi;

/** Isolates the "Stiri" news table before parsing anything, so no link elsewhere on the page is a candidate. */
export function parseReportList(html: string, pageUrl: string): ParseResult {
  const containerMatch = LIST_CONTAINER_RE.exec(html);
  if (!containerMatch) {
    return { listFound: false, entries: [] };
  }

  const tableInner = containerMatch[2];
  const entries: ParsedEntry[] = [];
  let index = 0;
  let rowIndex = 0;
  let rowMatch: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;

  while ((rowMatch = ROW_RE.exec(tableInner)) !== null) {
    const row = rowMatch[1];
    const titleMatch = TITLE_RE.exec(row);
    if (!titleMatch) {
      continue;
    }
    const title = collapseWhitespace(decodeEntities(stripTags(titleMatch[2])));
    const dateMatch = DATE_RE.exec(row);
    const publishedAt = dateMatch
      ? parseBvbTimestamp(collapseWhitespace(decodeEntities(stripTags(dateMatch[2]))))
      : undefined;
    const isDepositaryReport = isDepositaryReportEntry({ title });

    let linkIndexInRow = 0;
    let hrefMatch: RegExpExecArray | null;
    HREF_RE.lastIndex = 0;
    let sawAnyHref = false;
    while ((hrefMatch = HREF_RE.exec(row)) !== null) {
      const rawHref = decodeEntities(hrefMatch[2]);
      const pdfUrl = resolvePdfHref(rawHref, pageUrl);
      if (pdfUrl === null) {
        continue;
      }
      sawAnyHref = true;
      entries.push({
        href: rawHref,
        pdfUrl,
        title,
        publishedAt,
        isDepositaryReport,
        index,
        rowIndex,
        linkIndexInRow,
      });
      linkIndexInRow += 1;
      index += 1;
    }
    if (!sawAnyHref) {
      entries.push({
        href: "",
        pdfUrl: null,
        title,
        publishedAt,
        isDepositaryReport,
        index,
        rowIndex,
        linkIndexInRow: 0,
      });
      index += 1;
    }
    rowIndex += 1;
  }

  return { listFound: true, entries };
}

/** The single place the identifying rule for a depositary-report entry lives (test/fixtures/bvb/README.md §3). */
export function isDepositaryReportEntry(entry: { title: string }): boolean {
  return foldForMatch(entry.title).startsWith("van la data");
}

export function findLatestReportLink(html: string, pageUrl: string): ReportLink | null {
  const { entries } = parseReportList(html, pageUrl);
  const candidates = entries.filter((e) => e.isDepositaryReport && e.pdfUrl !== null);
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) {
      if (a.publishedAt === undefined) return 1;
      if (b.publishedAt === undefined) return -1;
      return a.publishedAt < b.publishedAt ? 1 : -1;
    }
    // Same publishedAt: same row → later link in that row wins (README §2 catch-up-filing rule).
    // Different rows tied on the same timestamp → first in document order wins (US-007-plan.md R4).
    if (a.rowIndex === b.rowIndex) {
      return b.linkIndexInRow - a.linkIndexInRow;
    }
    return a.index - b.index;
  });

  const best = sorted[0];
  return { pdfUrl: best.pdfUrl as string, title: best.title, publishedAt: best.publishedAt };
}

export async function discoverLatestReport(
  etf: { symbol: string; bvbUrl: string },
  deps?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<DiscoveryResult> {
  const result = await fetchOnce(
    etf.bvbUrl,
    (res) => res.text(),
    {
      fetchImpl: deps?.fetchImpl,
      timeoutMs: deps?.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS,
      headers: BVB_REQUEST_HEADERS,
    },
  );

  if (!result.ok) {
    if (result.kind === "http_error") {
      return {
        status: "error",
        kind: "http_error",
        message: `${etf.symbol}: ${result.message}`,
        httpStatus: result.httpStatus,
      };
    }
    return { status: "error", kind: result.kind, message: `${etf.symbol}: ${result.message}` };
  }

  const { listFound } = parseReportList(result.value, result.finalUrl);
  if (!listFound) {
    return { status: "not_found", reason: "list_not_found" };
  }

  const link = findLatestReportLink(result.value, result.finalUrl);
  if (!link) {
    return { status: "not_found", reason: "no_report_entries" };
  }

  return { status: "found", ...link };
}

/** Resolves an entry href to an absolute https/http PDF URL, or null if it isn't one (e.g. javascript:, #). */
function resolvePdfHref(href: string, pageUrl: string): string | null {
  const trimmed = href.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(trimmed, pageUrl);
  } catch {
    return null;
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return null;
  }
  if (!resolved.pathname.toLowerCase().endsWith(".pdf")) {
    return null;
  }
  return resolved.toString();
}

/** "D.MM.YYYY H:mm:ss" (BVB filing timestamp, Bucharest local, no offset) -> naive "YYYY-MM-DDTHH:mm", or undefined if out of range. */
function parseBvbTimestamp(raw: string): string | undefined {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) {
    return undefined;
  }
  const [, dStr, moStr, yStr, hStr, miStr] = match;
  const day = Number(dStr);
  const month = Number(moStr);
  const year = Number(yStr);
  const hour = Number(hStr);
  const minute = Number(miStr);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return undefined;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
