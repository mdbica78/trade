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
    <div>
      <p>
        {labels.date}: {formatted.date}
      </p>
      <p>
        {labels.series}: {formatted.value}
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
      <LineChart data={points as ChartPoint[]} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(d: string) => formatReportDate(d, locale)} minTickGap={16} />
        <YAxis domain={["auto", "auto"]} tickFormatter={(n: number) => formatAxisTick(n, locale)} width={88} />
        <Tooltip content={(p) => <ChartTooltipContent active={p.active} payload={p.payload as unknown as { payload: ChartPoint }[]} locale={locale} labels={labels} />} />
        <Line
          type="linear"
          dataKey="value"
          name={labels.series}
          connectNulls={false}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
          stroke="#1d4ed8"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
