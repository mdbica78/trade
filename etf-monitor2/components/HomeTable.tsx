import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format/number";
import { formatReportDate } from "@/lib/format/date";
import { formatDeltaAbsolute, formatDeltaPercent } from "@/lib/format/delta";
import { deltaArrow, deltaTone } from "@/lib/format/delta-direction";
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
          <tr key={row.symbol} data-home-row>
            <td>
              <Link href={`/etf/${encodeURIComponent(row.symbol)}`} data-home-row-link>
                {row.symbol}
              </Link>
              {row.latestPdfUrl && (
                <a
                  href={row.latestPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-home-pdf-link
                  aria-label={t("pdfLinkLabel", { symbol: row.symbol })}
                >
                  {"PDF"}
                </a>
              )}
              {!row.adapterAvailable && <span data-extraction-unavailable="true">{` (${t("extractionUnavailable")})`}</span>}
              <div data-home-name>{row.name}</div>
            </td>
            <td data-home-numeric>{row.valueDate ? formatReportDate(row.valueDate, locale) : ""}</td>
            {columns.map((column) => {
              const cell = row.cells[column.fieldKey];
              if (!cell?.tracked || cell.value === null) {
                return <td key={column.fieldKey} data-home-numeric></td>;
              }
              const delta = cell.delta;
              const showArrow = column.showArrow !== false;
              const showAbsolute = column.showAbsolute !== false;
              const showPercent = column.showPercent !== false && delta?.percent !== null;
              const hasChangeLine = delta !== null && (showArrow || showAbsolute || showPercent);
              const arrow = delta ? deltaArrow(delta.absolute) : null;
              return (
                <td key={column.fieldKey} data-home-numeric>
                  {formatNumber(cell.value, locale)}
                  {hasChangeLine && delta && arrow && (
                    <div
                      className={deltaTone(delta.absolute)}
                      data-home-change
                      title={t("previousDateTitle", { date: formatReportDate(delta.previousDate, locale) })}
                    >
                      {showArrow && (
                        <>
                          <span aria-hidden="true">{arrow.glyph}</span>
                          <span className="sr-only">{t(arrow.textKey)}</span>
                          {" "}
                        </>
                      )}
                      {showAbsolute && formatDeltaAbsolute(delta.absolute, locale)}
                      {showPercent && <> {formatDeltaPercent(delta.percent as string, locale)}</>}
                    </div>
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
