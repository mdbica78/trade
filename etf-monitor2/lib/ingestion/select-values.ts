import type { ExtractedValue, ExtractionResult } from "../extraction/adapters/types";

export type ValueSelection =
  | { complete: true; values: readonly ExtractedValue[] }
  | { complete: false; values: readonly ExtractedValue[]; missingFieldKeys: readonly string[] };

/**
 * Picks the ETF's tracked fields out of an adapter's full result (FR3 "the selected
 * parameters"). A tracked key the adapter did not return at all — whether reported in
 * `missingFields` or unknown to the adapter — makes the selection incomplete; nothing should
 * be persisted for an incomplete selection (US-012 AC3). PRODUCT decision 1 changes only this
 * function if the PO later chooses "every extracted field" instead.
 */
export function selectValuesToPersist(
  result: Extract<ExtractionResult, { ok: true }>,
  trackedFieldKeys: readonly string[],
): ValueSelection {
  const valuesByKey = new Map(result.values.map((v) => [v.fieldKey, v] as const));
  const dedupedKeys = [...new Set(trackedFieldKeys)];

  const values: ExtractedValue[] = [];
  const missingFieldKeys: string[] = [];

  for (const key of dedupedKeys) {
    const value = valuesByKey.get(key);
    if (value) {
      values.push(value);
    } else {
      missingFieldKeys.push(key);
    }
  }

  if (missingFieldKeys.length > 0) {
    return { complete: false, values, missingFieldKeys };
  }
  return { complete: true, values };
}
