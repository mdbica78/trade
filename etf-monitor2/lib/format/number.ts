import type { Locale } from "@/i18n/locale";

/**
 * DEC-007: no thousands separator, decimal mark only (comma `ro`, dot `en`). Works on the
 * canonical string as stored (`report_values.numeric_value`), never on a parsed float — see
 * US-016's Notes on the `Intl.NumberFormat` trap (default `maximumFractionDigits: 3` rounds
 * VUAN-style values and drops trailing zeros). A plain string replace keeps every digit
 * exactly as stored and never introduces a grouping character.
 */
export function formatNumber(canonical: string, locale: Locale): string {
  if (locale === "ro") {
    return canonical.replace(".", ",");
  }
  return canonical;
}
