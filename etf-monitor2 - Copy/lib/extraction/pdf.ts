import { extractText, getDocumentProxy } from "unpdf";
import { fetchOnce } from "./http";

export const DEFAULT_PDF_TIMEOUT_MS = 15_000;

// Same request identity as lib/extraction/discovery.ts's BVB_REQUEST_HEADERS, which bvb.ro
// accepted (test/fixtures/bvb/README.md §1). Kept as a separate literal so pdf.ts never imports
// discovery.ts; lib/extraction/pdf.test.ts asserts the two User-Agent strings stay equal.
export const PDF_REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/pdf",
  "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5",
  "User-Agent": "etf-monitor2/0.1 (daily ETF report monitor)",
};

export type PdfDownloadResult =
  | { ok: true; bytes: Uint8Array; fetchedAt: Date }
  | {
      ok: false;
      kind: "http_error" | "network" | "timeout" | "not_pdf";
      message: string;
      httpStatus?: number;
    };

export type PdfTextResult = { ok: true; text: string } | { ok: false; kind: "unreadable"; message: string };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const SIGNATURE_SEARCH_WINDOW = 1024;

/** True when "%PDF-" starts anywhere within the first 1024 bytes (the same leeway pdf.js allows). */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, SIGNATURE_SEARCH_WINDOW) - PDF_SIGNATURE.length;
  for (let offset = 0; offset <= limit; offset += 1) {
    let matches = true;
    for (let i = 0; i < PDF_SIGNATURE.length; i += 1) {
      if (bytes[offset + i] !== PDF_SIGNATURE[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }
  return false;
}

export async function downloadReportPdf(
  url: string,
  deps?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PdfDownloadResult> {
  const result = await fetchOnce(url, (res) => res.arrayBuffer(), {
    fetchImpl: deps?.fetchImpl,
    timeoutMs: deps?.timeoutMs ?? DEFAULT_PDF_TIMEOUT_MS,
    headers: PDF_REQUEST_HEADERS,
  });

  if (!result.ok) {
    if (result.kind === "http_error") {
      return { ok: false, kind: "http_error", message: result.message, httpStatus: result.httpStatus };
    }
    return { ok: false, kind: result.kind, message: result.message };
  }

  const bytes = new Uint8Array(result.value);
  if (!hasPdfSignature(bytes)) {
    return { ok: false, kind: "not_pdf", message: `response for ${url} is not a PDF (${bytes.length} bytes)` };
  }

  return { ok: true, bytes, fetchedAt: new Date() };
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    try {
      const { text } = await extractText(doc, { mergePages: true });
      if (text.trim() === "") {
        return { ok: false, kind: "unreadable", message: "PDF has no extractable text" };
      }
      return { ok: true, text };
    } finally {
      await doc.destroy().catch(() => {});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: "unreadable", message };
  }
}
