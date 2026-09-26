import type { DiscoveryResult } from "../extraction/discovery";
import type { PdfDownloadResult, PdfTextResult } from "../extraction/pdf";
import type { AdapterRegistry } from "../extraction/adapters/types";

/**
 * Never throws, never retries (FR4.1), writes nothing (FR4.2, no `reports`/`report_values`
 * row): this module takes no store. `'ambiguous'`/`'no_match'` come from `registry.list()`,
 * only used to explain a `undefined` `registry.detect(text)` result — the adapter key itself
 * always comes from `detect()`'s single "exactly one match" rule (section 3).
 */
export type DetectionReason =
  | "detected"
  | "not_found"
  | "fetch_error"
  | "unreadable"
  | "no_match"
  | "ambiguous"
  | "internal_error";

export type DetectionResult = { adapterKey: string | null; reason: DetectionReason };

export type DetectAdapterDeps = {
  discover(etf: { symbol: string; bvbUrl: string }): Promise<DiscoveryResult>;
  download(url: string): Promise<PdfDownloadResult>;
  extractText(bytes: Uint8Array): Promise<PdfTextResult>;
  registry: Pick<AdapterRegistry, "list" | "detect">;
};

export async function detectAdapter(
  etf: { symbol: string; bvbUrl: string },
  deps: DetectAdapterDeps,
): Promise<DetectionResult> {
  try {
    const discovery = await deps.discover(etf);
    if (discovery.status === "not_found") {
      return { adapterKey: null, reason: "not_found" };
    }
    if (discovery.status === "error") {
      return { adapterKey: null, reason: "fetch_error" };
    }

    const download = await deps.download(discovery.pdfUrl);
    if (!download.ok) {
      return { adapterKey: null, reason: download.kind === "not_pdf" ? "unreadable" : "fetch_error" };
    }

    const extracted = await deps.extractText(download.bytes);
    if (!extracted.ok) {
      return { adapterKey: null, reason: "unreadable" };
    }

    const adapter = deps.registry.detect(extracted.text);
    if (adapter) {
      return { adapterKey: adapter.key, reason: "detected" };
    }

    const matches = deps.registry.list().filter((candidate) => candidate.canHandle(extracted.text));
    return { adapterKey: null, reason: matches.length === 0 ? "no_match" : "ambiguous" };
  } catch {
    return { adapterKey: null, reason: "internal_error" };
  }
}
