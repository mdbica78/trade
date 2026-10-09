/**
 * One extraction adapter per report format (issuer/depositary), AGENTS.md.
 *
 * `key` equals `etfs.adapter_key` and `field_catalog.adapter_key` (data model). `fieldKeys`
 * are plain strings, not a foreign key to `field_catalog` (data model notes).
 *
 * `canHandle` and `extract` are pure, synchronous functions of the given text: same input,
 * same output, no I/O, no throwing. They **return** a result — a throw is an adapter bug.
 */
export interface ExtractionAdapter {
  key: string;
  fieldKeys: readonly string[];
  canHandle(text: string): boolean;
  extract(text: string): ExtractionResult;
}

/**
 * `numericValue` is the canonical decimal form: optional leading `-`, digits, optionally `.`
 * plus digits, no thousands separator, decimals kept exactly as written. It maps losslessly
 * onto `report_values.numeric_value numeric`, which Drizzle reads/writes as a string.
 *
 * `rawValue` is the token exactly as it appeared in the source text, kept for auditing
 * (`report_values.raw_value`, data model).
 */
export type ExtractedValue = {
  fieldKey: string;
  numericValue: string;
  rawValue: string;
};

/**
 * An adapter returns every field it can extract from the text; `values` plus `missingFields`
 * together cover `fieldKeys`. Choosing which fields to persist is the caller's job (Sprint 3).
 * A field the adapter could not find goes in `missingFields` — never guessed (AGENTS.md).
 *
 * `ok: false` means the text is unusable by this adapter at all, **including when no report
 * date can be found** (`reports.report_date` is NOT NULL). `ok: true` with every field in
 * `missingFields` is still contract-valid — the date was found, nothing else was; how that
 * maps onto `reports.status` is a later story's call (Sprint 3, US-014).
 */
export type ExtractionResult =
  | {
      ok: true;
      /** YYYY-MM-DD, a real calendar date. */
      reportDate: string;
      values: readonly ExtractedValue[];
      missingFields: readonly string[];
    }
  | { ok: false; error: string };

/**
 * `get` is an exact-key lookup (no fallback, no fuzzy match — a wrong guess is worse than a
 * clear "unavailable", section 3 / AGENTS.md). `detect` is structure-based matching, used when
 * an ETF has no assigned `adapter_key` yet.
 */
export interface AdapterRegistry {
  get(key: string | null | undefined): ExtractionAdapter | undefined;
  list(): readonly ExtractionAdapter[];
  detect(text: string): ExtractionAdapter | undefined;
}
