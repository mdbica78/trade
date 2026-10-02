"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisTick, formatTooltip } from "@/lib/format/chart";
import { formatReportDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import type { Locale } from "@/i18n/locale";
import type { ChartPoint } from "@/lib/monitoring/chart-series";
import {
  CHART_TYPES, DEFAULT_CHART_TYPE, chartStorageKey, isIsolatedValue, isSingleValue,
  readChartType, writeChartType, type ChartType,
} from "./chart-type";

export type FieldChartLabels = {
  series: string;
  date: string;
  typeSelector: string;
  types: Record<ChartType, string>;
};

export type FieldChartProps = {
  points: readonly ChartPoint[];
  locale: Locale;
  labels: FieldChartLabels;
  symbol: string;
  fieldKey: string;
};

type TooltipContentProps = {
  active?: boolean;
  payload?: readonly { payload: ChartPoint }[];
  locale: Locale;
  labels: Pick<FieldChartLabels, "series" | "date">;
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

type DotPosition = { cx?: number; cy?: number; index?: number };
type BarLabelPosition = { x?: string | number; y?: string | number; width?: string | number; index?: number };

function subscribeStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

function serverChartType(): ChartType {
  return DEFAULT_CHART_TYPE;
}

export function ChartSeries({ points, locale, series, type }: {
  points: readonly ChartPoint[];
  locale: Locale;
  series: string;
  type: ChartType;
}) {
  const single = isSingleValue(points);

  function dot({ cx, cy, index }: DotPosition) {
    if (cx === undefined || cy === undefined || index === undefined) return null;
    const point = points[index];
    if (!point || point.value === null || (type === "line" && !isIsolatedValue(points, index) && !single)) return null;
    return (
      <g key={point.date}>
        <circle cx={cx} cy={cy} r={single ? 6 : 3} fill="var(--chart-1)" />
        {single && point.display !== null && (
          <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--chart-1)" fontSize={12}>
            {formatNumber(point.display, locale)}
          </text>
        )}
      </g>
    );
  }

  function columnLabel({ x, y, width, index }: BarLabelPosition) {
    if (!single || typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || index === undefined) return <g />;
    const point = points[index];
    if (!point || point.value === null || point.display === null) return <g />;
    const cx = x + width / 2;
    return (
      <g key={point.date}>
        <circle cx={cx} cy={y} r={6} fill="var(--chart-1)" />
        <text x={cx} y={y - 12} textAnchor="middle" fill="var(--chart-1)" fontSize={12}>
          {formatNumber(point.display, locale)}
        </text>
      </g>
    );
  }

  if (type === "columns") {
    return (
      <Bar dataKey="value" name={series} fill="var(--chart-1)" isAnimationActive={false}>
        {single && <LabelList dataKey="value" content={columnLabel} />}
      </Bar>
    );
  }
  if (type === "area") {
    return (
      <Area
        type="linear"
        dataKey="value"
        name={series}
        connectNulls={false}
        dot={single ? dot : false}
        stroke="var(--chart-1)"
        fill="var(--chart-1)"
        fillOpacity={0.18}
        isAnimationActive={false}
      />
    );
  }
  return (
    <Line
      type="linear"
      dataKey="value"
      name={series}
      connectNulls={false}
      dot={dot}
      activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--panel)", strokeWidth: 2 }}
      isAnimationActive={false}
      stroke="var(--chart-1)"
      strokeWidth={1.75}
    />
  );
}

export function FieldChart({ points, locale, labels, symbol, fieldKey }: FieldChartProps) {
  const identity = chartStorageKey(symbol, fieldKey);
  const savedType = useSyncExternalStore(
    subscribeStorage,
    useCallback(() => readChartType(() => window.localStorage, symbol, fieldKey), [symbol, fieldKey]),
    serverChartType,
  );
  const [selected, setSelected] = useState<{ identity: string; type: ChartType } | null>(null);
  const type = selected?.identity === identity ? selected.type : savedType;

  function selectType(next: ChartType) {
    setSelected({ identity, type: next });
    writeChartType(() => window.localStorage, symbol, fieldKey, next);
  }

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <label className="self-end text-xs text-[var(--muted)]">
        {labels.typeSelector}{" "}
        <select
          data-chart-type="selector"
          className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[var(--text)]"
          value={type}
          onChange={(event) => selectType(event.target.value as ChartType)}
        >
          {CHART_TYPES.map((chartType) => <option key={chartType} value={chartType}>{labels.types[chartType]}</option>)}
        </select>
      </label>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points as ChartPoint[]} accessibilityLayer margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
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
            {ChartSeries({ points, locale, series: labels.series, type })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
