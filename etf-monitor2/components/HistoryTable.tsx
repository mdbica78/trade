import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format/number";
import { formatReportDate } from "@/lib/format/date";
import type { Locale } from "@/i18n/locale";
import type { HistoryField, HistoryRow } from "@/lib/monitoring/history";

export type HistoryTableProps = {
  fields: readonly HistoryField[];
  rows: readonly HistoryRow[];
};

/**
 * Presentational only — props, no I/O (US-018 AC3/AC8). The caller (`EtfDetail`) decides whether
 * to render a table at all; this component never shows a "no history" message itself.
 */
export function HistoryTable({ fields, rows }: HistoryTableProps) {
  const t = useTranslations("EtfDetail");
  const locale = useLocale() as Locale;

  return (
    <table>
      <thead>
        <tr>
          <th>{t("dateColumn")}</th>
          {fields.map((field) => (
            <th key={field.fieldKey}>{locale === "ro" ? field.labelRo : field.labelEn}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.reportDate}>
            <td>{formatReportDate(row.reportDate, locale)}</td>
            {fields.map((field) => {
              const value = row.values[field.fieldKey] ?? null;
              return <td key={field.fieldKey}>{value === null ? "" : formatNumber(value, locale)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
