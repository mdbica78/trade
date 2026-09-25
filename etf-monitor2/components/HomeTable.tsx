import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format/number";
import { formatReportDate } from "@/lib/format/date";
import { formatDeltaAbsolute, formatDeltaPercent } from "@/lib/format/delta";
import type { Locale } from "@/i18n/locale";
import type { HomeTableViewModel } from "@/lib/monitoring/home";

export type HomeTableProps =
  | { status: "ok"; viewModel: HomeTableViewModel }
  | { status: "error" };

/**
 * Presentational only — receives the view model as props (US-016 Task 3), so it renders
 * without a database in tests. `status: "error"` never shows the underlying exception
 * (AGENTS.md secrets rule / AC9): the caller (`app/page.tsx`) is responsible for catching it.
 */
export function HomeTable(props: HomeTableProps) {
  const t = useTranslations("Home");
  const locale = useLocale() as Locale;

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { columns, rows } = props.viewModel;

  if (rows.length === 0) {
    return <p>{t("empty")}</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t("symbolColumn")}</th>
          <th>{t("dateColumn")}</th>
          {columns.map((column) => (
            <th key={column.fieldKey}>{locale === "ro" ? column.labelRo : column.labelEn}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.symbol}>
            <td>
              {row.latestPdfUrl ? (
                <a href={row.latestPdfUrl} target="_blank" rel="noopener noreferrer">
                  {row.symbol}
                </a>
              ) : (
                row.symbol
              )}
              {!row.adapterAvailable && <span>{` (${t("extractionUnavailable")})`}</span>}
              {" "}
              <Link href={`/etf/${encodeURIComponent(row.symbol)}`}>{t("historyLink")}</Link>
            </td>
            <td>{row.valueDate ? formatReportDate(row.valueDate, locale) : ""}</td>
            {columns.map((column) => {
              const cell = row.cells[column.fieldKey];
              if (!cell?.tracked || cell.value === null) {
                return <td key={column.fieldKey}></td>;
              }
              return (
                <td key={column.fieldKey}>
                  {formatNumber(cell.value, locale)}
                  {cell.delta && (
                    <>
                      {" "}
                      <span title={t("deltaAbsolute")}>{formatDeltaAbsolute(cell.delta.absolute, locale)}</span>
                      {cell.delta.percent !== null && (
                        <>
                          {" "}
                          <span title={t("deltaPercent")}>
                            {formatDeltaPercent(cell.delta.percent, locale)}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
