'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type MetricRow = {
  fieldName: string;
  displayName: string;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
};

type ChartSeries = {
  fieldName: string;
  displayName: string;
  points: Array<{ reportDate: string; value: number | null }>;
};

type DetailPayload = {
  symbol: string;
  name: string | null;
  isin: string | null;
  latestReport: { reportDate: string; reportUrl: string | null } | null;
  previousReport: { reportDate: string; reportUrl: string | null } | null;
  metrics: MetricRow[];
  charts: ChartSeries[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  return undefined;
}

function toNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function parsePayload(value: unknown): DetailPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const symbol = value.symbol;
  const name = toNullableString(value.name);
  const isin = toNullableString(value.isin);
  const latestReport = value.latestReport;
  const previousReport = value.previousReport;
  const metrics = value.metrics;
  const charts = value.charts;

  if (
    typeof symbol !== 'string' ||
    name === undefined ||
    isin === undefined ||
    !Array.isArray(metrics) ||
    !Array.isArray(charts)
  ) {
    return null;
  }

  const parsedMetrics = metrics
    .map((metric) => {
      if (!isRecord(metric)) {
        return null;
      }

      const fieldName = metric.fieldName;
      const displayName = metric.displayName;
      const currentValue = toNullableNumber(metric.currentValue);
      const previousValue = toNullableNumber(metric.previousValue);
      const delta = toNullableNumber(metric.delta);
      const deltaPercent = toNullableNumber(metric.deltaPercent);

      if (
        typeof fieldName !== 'string' ||
        typeof displayName !== 'string' ||
        currentValue === undefined ||
        previousValue === undefined ||
        delta === undefined ||
        deltaPercent === undefined
      ) {
        return null;
      }

      return {
        fieldName,
        displayName,
        currentValue,
        previousValue,
        delta,
        deltaPercent,
      };
    })
    .filter((metric): metric is MetricRow => metric !== null);

  const parsedCharts = charts
    .map((chart) => {
      if (!isRecord(chart) || !Array.isArray(chart.points)) {
        return null;
      }

      const fieldName = chart.fieldName;
      const displayName = chart.displayName;
      if (typeof fieldName !== 'string' || typeof displayName !== 'string') {
        return null;
      }

      const points = chart.points
        .map((point) => {
          if (!isRecord(point)) {
            return null;
          }

          const reportDate = point.reportDate;
          const value = toNullableNumber(point.value);
          if (typeof reportDate !== 'string' || value === undefined) {
            return null;
          }

          return { reportDate, value };
        })
        .filter((point): point is { reportDate: string; value: number | null } => point !== null);

      return {
        fieldName,
        displayName,
        points,
      };
    })
    .filter((chart): chart is ChartSeries => chart !== null);

  const parseReport = (
    input: unknown,
  ): { reportDate: string; reportUrl: string | null } | null | undefined => {
    if (input === null) {
      return null;
    }
    if (!isRecord(input)) {
      return undefined;
    }

    const reportDate = input.reportDate;
    const reportUrl = toNullableString(input.reportUrl);
    if (typeof reportDate !== 'string' || reportUrl === undefined) {
      return undefined;
    }

    return { reportDate, reportUrl };
  };

  const parsedLatestReport = parseReport(latestReport);
  const parsedPreviousReport = parseReport(previousReport);
  if (parsedLatestReport === undefined || parsedPreviousReport === undefined) {
    return null;
  }

  return {
    symbol,
    name,
    isin,
    latestReport: parsedLatestReport,
    previousReport: parsedPreviousReport,
    metrics: parsedMetrics,
    charts: parsedCharts,
  };
}

function formatMetricValue(value: number | null, metricKey: string): string {
  if (value === null) {
    return '-';
  }

  if (metricKey.includes('vuan')) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }
  if (metricKey.includes('asset') || metricKey.includes('fund')) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString();
}

function getDeltaColor(value: number | null): string {
  if (value === null || value === 0) {
    return 'text-slate-700';
  }

  return value > 0 ? 'text-green-700' : 'text-red-700';
}

function buildPolylinePoints(
  points: Array<{ reportDate: string; value: number | null }>,
  width: number,
  height: number,
): string | null {
  const validPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter((point): point is { reportDate: string; value: number; index: number } => point.value !== null);

  if (validPoints.length < 2) {
    return null;
  }

  const minValue = Math.min(...validPoints.map((point) => point.value));
  const maxValue = Math.max(...validPoints.map((point) => point.value));
  const valueRange = maxValue - minValue || 1;
  const xStep = points.length > 1 ? width / (points.length - 1) : width;

  return validPoints
    .map((point) => {
      const x = point.index * xStep;
      const normalized = (point.value - minValue) / valueRange;
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function EtfDetailPage() {
  const params = useParams<{ symbol: string }>();
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const symbol = useMemo(() => {
    const raw = typeof params.symbol === 'string' ? params.symbol : '';
    return decodeURIComponent(raw).toUpperCase();
  }, [params.symbol]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      let response: Response;
      try {
        response = await fetch(`/api/etf/${encodeURIComponent(symbol)}`, {
          method: 'GET',
          cache: 'no-store',
        });
      } catch {
        setError('Failed to load ETF details.');
        setLoading(false);
        return;
      }

      let rawPayload: unknown = null;
      try {
        rawPayload = JSON.parse(await response.text()) as unknown;
      } catch {
        rawPayload = null;
      }

      if (!response.ok) {
        setError('Failed to load ETF details.');
        setLoading(false);
        return;
      }

      const parsed = parsePayload(rawPayload);
      if (!parsed) {
        setError('Failed to load ETF details.');
        setLoading(false);
        return;
      }

      setPayload(parsed);
      setLoading(false);
    };

    if (symbol) {
      void load();
    }
  }, [symbol]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-slate-700">Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-red-700">{error ?? 'Failed to load ETF details.'}</p>
          <Link href="/" className="mt-4 inline-flex rounded bg-[#0b3a6e] px-5 py-2 text-sm text-white">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">{payload.symbol}</h1>
          <p className="mt-1 text-sm text-blue-100">{payload.name ?? 'Name unavailable'}</p>
          <p className="mt-1 text-sm text-blue-100">ISIN: {payload.isin ?? '-'}</p>
          <Link href="/" className="mt-4 inline-flex text-sm text-blue-100 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest Report</p>
              <p className="mt-1 text-sm text-slate-800">
                {payload.latestReport ? new Date(payload.latestReport.reportDate).toLocaleDateString() : '-'}
              </p>
              {payload.latestReport?.reportUrl ? (
                <a
                  href={payload.latestReport.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm text-[#0b3a6e] hover:underline"
                >
                  View PDF
                </a>
              ) : null}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Previous Report</p>
              <p className="mt-1 text-sm text-slate-800">
                {payload.previousReport
                  ? new Date(payload.previousReport.reportDate).toLocaleDateString()
                  : '-'}
              </p>
              {payload.previousReport?.reportUrl ? (
                <a
                  href={payload.previousReport.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm text-[#0b3a6e] hover:underline"
                >
                  View PDF
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Monitored Metrics</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border border-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Metric</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Current</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Previous</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Δ</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {payload.metrics.map((metric, index) => (
                  <tr key={metric.fieldName} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-900">{metric.displayName}</td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {formatMetricValue(metric.currentValue, metric.fieldName)}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                      {formatMetricValue(metric.previousValue, metric.fieldName)}
                    </td>
                    <td className={`border-b border-slate-200 px-4 py-3 ${getDeltaColor(metric.delta)}`}>
                      {metric.delta === null ? '-' : formatMetricValue(metric.delta, metric.fieldName)}
                    </td>
                    <td className={`border-b border-slate-200 px-4 py-3 ${getDeltaColor(metric.deltaPercent)}`}>
                      {metric.deltaPercent === null
                        ? '-'
                        : `${metric.deltaPercent.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">History Charts</h2>
          {payload.charts.map((chart) => {
            const polyline = buildPolylinePoints(chart.points, 640, 180);
            return (
              <article key={chart.fieldName} className="rounded border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{chart.displayName}</h3>
                {polyline ? (
                  <svg viewBox="0 0 640 180" className="mt-4 h-44 w-full rounded bg-slate-50">
                    <polyline fill="none" stroke="#0b3a6e" strokeWidth="2" points={polyline} />
                  </svg>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">Not enough historical values for chart rendering.</p>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
