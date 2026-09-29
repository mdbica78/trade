"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisTick, formatTooltip } from "@/lib/format/chart";
import { formatReportDate } from "@/lib/format/date";
import type { Locale } from "@/i18n/locale";
import type { ChartPoint } from "@/lib/monitoring/chart-series";

export type FieldChartLabels = { series: string; date: string };

export type FieldChartProps = {
  points: readonly ChartPoint[];
  locale: Locale;
  labels: FieldChartLabels;
};

type TooltipContentProps = {
  active?: boolean;
  payload?: readonly { payload: ChartPoint }[];
  locale: Locale;
  labels: FieldChartLabels;
};

/**
 * Renders the tooltip body for one chart point (US-019 AC3/§4.3). `null` when the tooltip is not
 * active, or on a gap day (no value to show, FR4.1 "blank") — never a guessed reading. Exported
 * with its own prop type, not Recharts' generic `TooltipProps`, so tests can call it directly.
 */
export function ChartTooltipContent({ active, payload, locale, labels }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const formatted = formatTooltip(payload[0].payload, locale);
  if (formatted === null) {
    return null;
  }
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs shadow-lg">
      <p className="m-0 text-[var(--muted)]">
        {labels.date}
        {": "}
        {formatted.date}
      </p>
      <p className="m-0 mt-0.5 text-[var(--text)]">
        {labels.series}
        {": "}
        {formatted.value}
      </p>
    </div>
  );
}

/**
 * One line chart for one tracked field (US-019). Receives only plain, already-translated,
 * serialisable props — no database access, no next-intl (labels arrive pre-translated). The line
 * breaks at every missing calendar day (`connectNulls={false}`) and draws a dot on every stored
 * day, so a single point or an isolated day between two gaps is still visible.
 */
export function FieldChart({ points, locale, labels }: FieldChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points as ChartPoint[]} accessibilityLayer margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatReportDate(d, locale)}
          minTickGap={16}
          stroke="var(--line)"
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(n: number) => formatAxisTick(n, locale)}
          width={88}
          stroke="var(--line)"
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          tickLine={false}
        />
        <Tooltip content={(p) => <ChartTooltipContent active={p.active} payload={p.payload as unknown as { payload: ChartPoint }[]} locale={locale} labels={labels} />} />
        <Line
          type="linear"
          dataKey="value"
          name={labels.series}
          connectNulls={false}
          dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--panel)", strokeWidth: 2 }}
          isAnimationActive={false}
          stroke="var(--chart-1)"
          strokeWidth={1.75}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
