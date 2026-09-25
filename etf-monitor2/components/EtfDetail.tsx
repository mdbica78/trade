import { useLocale, useTranslations } from "next-intl";
import { HistoryTable } from "./HistoryTable";
import { FieldChart } from "./FieldChart";
import { buildChartSeries, hasAnyValue } from "@/lib/monitoring/chart-series";
import type { Locale } from "@/i18n/locale";
import type { EtfHistory } from "@/lib/monitoring/history";

export type EtfDetailProps = { status: "error" } | { status: "ok"; history: EtfHistory };

/**
 * Presentational only — receives the loaded history as props (US-018 AC6/AC7), so it renders
 * without a database in tests, the same pattern as `HomeTable` (Sprint 1 audit W3: hooks cannot
 * be used in an async Server Component). `status: "error"` never shows the underlying exception
 * (AGENTS.md secrets rule / AC6): the caller (`app/etf/[symbol]/page.tsx`) is responsible for
 * catching it.
 */
export function EtfDetail(props: EtfDetailProps) {
  const t = useTranslations("EtfDetail");
  const locale = useLocale() as Locale;

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { etf, fields, rows } = props.history;

  return (
    <>
      <h1>
        {etf.symbol} <span>{etf.name}</span>
      </h1>
      {fields.length === 0 ? (
        <p>{t("noTrackedFields")}</p>
      ) : rows.length === 0 ? (
        <p>{t("noHistory")}</p>
      ) : (
        <>
          <HistoryTable fields={fields} rows={rows} />
          <section aria-labelledby="etf-charts-heading">
            <h2 id="etf-charts-heading">{t("chartsHeading")}</h2>
            {fields.map((field) => {
              const label = locale === "ro" ? field.labelRo : field.labelEn;
              const points = buildChartSeries(rows, field.fieldKey);
              return (
                <section key={field.fieldKey} data-chart-field={field.fieldKey}>
                  <h3>{label}</h3>
                  {hasAnyValue(points) ? (
                    <div data-chart-container className="h-64 w-full">
                      <FieldChart points={points} locale={locale} labels={{ series: label, date: t("dateColumn") }} />
                    </div>
                  ) : (
                    <p>{t("noFieldData")}</p>
                  )}
                </section>
              );
            })}
          </section>
        </>
      )}
    </>
  );
}
