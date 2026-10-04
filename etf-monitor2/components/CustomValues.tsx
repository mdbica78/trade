import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";
import { formatDeltaAbsolute, formatDeltaPercent } from "@/lib/format/delta";
import { deltaArrow, deltaTone } from "@/lib/format/delta-direction";
import { formatReportDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import type { WidgetView } from "@/lib/monitoring/history";

export function CustomValues({ widgets }: { widgets: readonly WidgetView[] }) {
  const t = useTranslations("EtfDetail.widgets");
  const locale = useLocale() as Locale;
  if (widgets.length === 0) return null;

  return (
    <section aria-labelledby="etf-custom-values-heading" className="mt-4">
      <h2 id="etf-custom-values-heading">{t("heading")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {widgets.map((widget) => {
          const { definition, evaluation } = widget;
          const title = definition.title ?? t("title", {
            operation: t(`operation.${definition.operation}`),
            field: locale === "ro" ? widget.labelRo : widget.labelEn,
            amount: definition.periodAmount,
            unit: t(definition.periodUnit, { amount: definition.periodAmount }),
          });
          const change = definition.operation === "change" || definition.operation === "percent_change";
          const value = evaluation.status === "ok" ? evaluation.value : null;
          const arrow = change && value !== null ? deltaArrow(value) : null;
          const tone = arrow && value !== null ? deltaTone(value) : undefined;
          const displayed = evaluation.status === "insufficient_history"
            ? t("insufficient")
            : value === null
              ? t("noPercent")
              : definition.operation === "percent_change"
                ? formatDeltaPercent(value, locale)
                : change
                  ? formatDeltaAbsolute(value, locale)
                  : formatNumber(value, locale);
          return (
            <article key={widget.slot} data-widget-slot={widget.slot}
              className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
              <h3>{title}</h3>
              <p className={tone}>
                {arrow && <><span aria-hidden="true">{arrow.glyph}</span>
                  <span className="sr-only">{t(arrow.textKey)}</span>{" "}</>}
                {displayed}
              </p>
              {evaluation.basisDates.length > 0 &&
                <p className="text-[var(--muted)]">{t("basis", {
                  dates: evaluation.basisDates.map((date) => formatReportDate(date, locale)).join(", "),
                })}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
