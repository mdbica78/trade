import type { ExtractedValue, ExtractionResult } from "../extraction/adapters/types";

export type ValueSelection =
  | { complete: true; values: readonly ExtractedValue[] }
  | { complete: false; values: readonly ExtractedValue[]; missingFieldKeys: readonly string[] };

/**
 * Every value the adapter extracted is stored (FR3.1, P1: "every field"), whatever the ETF
 * tracks. Tracked fields decide only `ok` vs `parse_error`: a tracked key the adapter did not
 * return at all — whether reported in `missingFields` or unknown to the adapter — makes the
 * selection incomplete, and is what `ingest-etf.ts` persists as a `parse_error` row (US-014
 * AC5). Tracked fields also decide what the home table/detail page display, not what is stored.
 */
export function selectValuesToPersist(
  result: Extract<ExtractionResult, { ok: true }>,
  trackedFieldKeys: readonly string[],
): ValueSelection {
  const values: ExtractedValue[] = [...result.values];
  const foundKeys = new Set(values.map((v) => v.fieldKey));
  const dedupedKeys = [...new Set(trackedFieldKeys)];
  const missingFieldKeys = dedupedKeys.filter((key) => !foundKeys.has(key));

  if (missingFieldKeys.length > 0) {
    return { complete: false, values, missingFieldKeys };
  }
  return { complete: true, values };
}
