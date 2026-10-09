import type { Locale } from "@/i18n/locale";

/**
 * `isoDate` is a plain `YYYY-MM-DD` string (`reports.report_date`, stored as `date` mode
 * "string" — data model: "the date the report is FOR"). Pure string slicing, never a `Date`
 * object: decision 5 requires the same calendar day regardless of the process time zone, and
 * `new Date("YYYY-MM-DD")` parses as UTC midnight, which can shift the displayed day depending
 * on the reader's offset.
 */
export function formatReportDate(isoDate: string, locale: Locale): string {
  if (locale === "en") {
    return isoDate;
  }
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}
