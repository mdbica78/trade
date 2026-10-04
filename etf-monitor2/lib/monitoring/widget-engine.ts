import type { WidgetDefinition } from "../config/widgets";
import { computeDelta, previousCalendarDay } from "./delta";
import { averageCanonical, compareCanonical, isCanonicalDecimal } from "./exact-decimal";

export type WidgetReport = {
  reportDate: string;
  status: string;
  values: Readonly<Record<string, string | null>>;
};
export type WidgetEvaluation =
  | { status: "ok"; value: string | null; basisDates: string[] }
  | { status: "insufficient_history"; basisDates: [] };

const insufficient: WidgetEvaluation = { status: "insufficient_history", basisDates: [] };

function valueOf(report: WidgetReport, fieldKey: string): string | null {
  const value = report.values[fieldKey];
  return value !== undefined && value !== null && isCanonicalDecimal(value) ? value : null;
}

export function evaluateWidget(
  definition: WidgetDefinition,
  reports: readonly WidgetReport[],
): WidgetEvaluation {
  const ordered = reports.filter((report) => report.status === "ok")
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  if (ordered.length === 0) return insufficient;

  let boundary = ordered[0].reportDate;
  if (definition.periodUnit === "days") {
    for (let index = 0; index < definition.periodAmount; index++) {
      boundary = previousCalendarDay(boundary);
    }
  }

  if (definition.operation === "change" || definition.operation === "percent_change") {
    const latestIndex = ordered.findIndex((report) => valueOf(report, definition.fieldKey) !== null);
    if (latestIndex < 0) return insufficient;
    const latest = ordered[latestIndex];
    const earlier = definition.periodUnit === "days"
      ? ordered.find((report) => report.reportDate <= boundary && valueOf(report, definition.fieldKey) !== null)
      : ordered.slice(latestIndex + definition.periodAmount).find((report) => valueOf(report, definition.fieldKey) !== null);
    if (!earlier || earlier === latest) return insufficient;
    const delta = computeDelta(valueOf(latest, definition.fieldKey)!, valueOf(earlier, definition.fieldKey)!);
    return {
      status: "ok",
      value: definition.operation === "change" ? delta.absolute : delta.percent,
      basisDates: [latest.reportDate, earlier.reportDate],
    };
  }

  const window = definition.periodUnit === "days"
    ? ordered.filter((report) => report.reportDate >= boundary)
    : ordered.slice(0, definition.periodAmount);
  const present = window.flatMap((report) => {
    const value = valueOf(report, definition.fieldKey);
    return value === null ? [] : [{ reportDate: report.reportDate, value }];
  });
  if (present.length === 0) return insufficient;
  const values = present.map((item) => item.value);
  const selected = definition.operation === "average"
    ? averageCanonical(values)
    : values.reduce((best, value) =>
      (definition.operation === "min" ? compareCanonical(value, best) < 0 : compareCanonical(value, best) > 0)
        ? value : best);
  return { status: "ok", value: selected, basisDates: present.map((item) => item.reportDate) };
}
