'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SUPPORTED_METRIC_KEYS, type MetricKey } from '@/lib/types';

type EtfRow = {
  id: number;
  symbol: string;
  report_date: string;
  units_in_circulation: number | null;
  previous_units_in_circulation: number | null;
  vuan: number | null;
  previous_vuan: number | null;
  net_assets: number | null;
  previous_net_assets: number | null;
  report_url: string | null;
};

type SchedulerSettings = {
  enabled: boolean;
  time: string;
};

type SyncStatus = 'Completed' | 'Running' | 'Failed';

type SyncInfo = {
  status: SyncStatus;
  completedAt: string | null;
  durationSeconds: number | null;
};

type DashboardMetric = MetricKey;

type MonitoredField = {
  fieldName: DashboardMetric;
  displayName: string;
};

type HistoryPayload = {
  rows: EtfRow[];
  scheduler: SchedulerSettings;
  sync: SyncInfo;
  enabledFields: string[];
  dashboardMetric: DashboardMetric;
  monitoredEtfs: number;
};

type FieldsPayload = {
  fields: MonitoredField[];
};

const DASHBOARD_METRIC_SET = new Set<string>(SUPPORTED_METRIC_KEYS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDashboardMetric(value: unknown): value is DashboardMetric {
  return typeof value === 'string' && DASHBOARD_METRIC_SET.has(value);
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

function toEtfRows(value: unknown): EtfRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const symbol = item.symbol;
      const reportDate = item.report_date;
      const unitsInCirculation = toNullableNumber(item.units_in_circulation);
      const previousUnitsInCirculation = toNullableNumber(item.previous_units_in_circulation);
      const vuan = toNullableNumber(item.vuan);
      const previousVuan = toNullableNumber(item.previous_vuan);
      const netAssets = toNullableNumber(item.net_assets);
      const previousNetAssets = toNullableNumber(item.previous_net_assets);
      const reportUrl = item.report_url;
      const id = item.id;

      if (
        typeof id !== 'number' ||
        typeof symbol !== 'string' ||
        typeof reportDate !== 'string' ||
        unitsInCirculation === undefined ||
        previousUnitsInCirculation === undefined ||
        vuan === undefined ||
        previousVuan === undefined ||
        netAssets === undefined ||
        previousNetAssets === undefined ||
        !(reportUrl === null || typeof reportUrl === 'string')
      ) {
        return null;
      }

      return {
        id,
        symbol,
        report_date: reportDate,
        units_in_circulation: unitsInCirculation,
        previous_units_in_circulation: previousUnitsInCirculation,
        vuan,
        previous_vuan: previousVuan,
        net_assets: netAssets,
        previous_net_assets: previousNetAssets,
        report_url: reportUrl,
      };
    })
    .filter((row): row is EtfRow => row !== null);
}

function toHistoryPayload(value: unknown): HistoryPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const rows = toEtfRows(value.rows);
  const scheduler = value.scheduler;
  const sync = value.sync;
  const enabledFields = value.enabledFields;
  const dashboardMetric = value.dashboardMetric;
  const monitoredEtfs = value.monitoredEtfs;

  if (
    !isRecord(scheduler) ||
    typeof scheduler.enabled !== 'boolean' ||
    typeof scheduler.time !== 'string' ||
    !isRecord(sync) ||
    (sync.status !== 'Completed' && sync.status !== 'Running' && sync.status !== 'Failed') ||
    !(sync.completedAt === null || typeof sync.completedAt === 'string') ||
    !(sync.durationSeconds === null || typeof sync.durationSeconds === 'number') ||
    !Array.isArray(enabledFields) ||
    !enabledFields.every((field) => typeof field === 'string') ||
    !isDashboardMetric(dashboardMetric) ||
    typeof monitoredEtfs !== 'number'
  ) {
    return null;
  }

  return {
    rows,
    scheduler: {
      enabled: scheduler.enabled,
      time: scheduler.time,
    },
    sync: {
      status: sync.status,
      completedAt: sync.completedAt,
      durationSeconds: sync.durationSeconds,
    },
    enabledFields,
    dashboardMetric,
    monitoredEtfs,
  };
}

function toFieldsPayload(value: unknown): FieldsPayload | null {
  if (!isRecord(value) || !Array.isArray(value.fields)) {
    return null;
  }

  const fields = value.fields
    .map((item) => {
      if (!isRecord(item) || !isDashboardMetric(item.fieldName) || typeof item.displayName !== 'string') {
        return null;
      }

      return {
        fieldName: item.fieldName,
        displayName: item.displayName,
      };
    })
    .filter((item): item is MonitoredField => item !== null);

  return { fields };
}

function parseJsonPayload(text: string): unknown {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return parseJsonPayload(text);
  } catch {
    return null;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return '-';
  }

  return `${value.toFixed(1)} s`;
}

function getDeltaIndicator(value: number | null): string {
  if (value === null) {
    return '';
  }
  if (value > 0) {
    return '▲';
  }
  if (value < 0) {
    return '▼';
  }
  return '•';
}

function getDeltaColorClass(value: number | null): string {
  if (value === null || value === 0) {
    return 'text-slate-700';
  }
  return value > 0 ? 'text-green-700' : 'text-red-700';
}

function getSyncStatusStyle(status: SyncStatus): { textClass: string; dotClass: string } {
  if (status === 'Completed') {
    return {
      textClass: 'text-green-700',
      dotClass: 'bg-green-600',
    };
  }

  if (status === 'Failed') {
    return {
      textClass: 'text-red-700',
      dotClass: 'bg-red-600',
    };
  }

  return {
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
  };
}

function getMetricLabel(
  metric: DashboardMetric,
  metricDisplayNames: Partial<Record<DashboardMetric, string>>,
): string {
  return metricDisplayNames[metric] ?? metric.replace(/_/g, ' ');
}

function getMetricDeltaLabel(
  metric: DashboardMetric,
  metricDisplayNames: Partial<Record<DashboardMetric, string>>,
): string {
  return `Δ ${getMetricLabel(metric, metricDisplayNames)}`;
}

function getCurrentMetricValue(row: EtfRow, metric: DashboardMetric): number | null {
  if (metric === 'vuan') {
    return row.vuan;
  }
  if (metric === 'net_assets') {
    return row.net_assets;
  }
  return row.units_in_circulation;
}

function getPreviousMetricValue(row: EtfRow, metric: DashboardMetric): number | null {
  if (metric === 'vuan') {
    return row.previous_vuan;
  }
  if (metric === 'net_assets') {
    return row.previous_net_assets;
  }
  return row.previous_units_in_circulation;
}

function formatMetricValue(value: number | null, metric: DashboardMetric): string {
  if (value === null) {
    return '-';
  }

  if (metric === 'vuan') {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }
  if (metric === 'net_assets') {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString();
}

function calculateDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) {
    return null;
  }

  return current - previous;
}

function calculateDeltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

export default function Home() {
  const pathname = usePathname();
  const [rows, setRows] = useState<EtfRow[]>([]);
  const [dashboardMetric, setDashboardMetric] = useState<DashboardMetric>('units_in_circulation');
  const [metricDisplayNames, setMetricDisplayNames] = useState<
    Partial<Record<DashboardMetric, string>>
  >({});
  const [scheduler, setScheduler] = useState<SchedulerSettings>({ enabled: true, time: '09:00' });
  const [sync, setSync] = useState<SyncInfo>({
    status: 'Failed',
    completedAt: null,
    durationSeconds: null,
  });
  const [monitoredEtfs, setMonitoredEtfs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(false);

    let response: Response;
    try {
      response = await fetch('/api/history', { method: 'GET', cache: 'no-store' });
    } catch {
      setError(true);
      setLoading(false);
      return;
    }

    if (!response.ok) {
      setError(true);
      setLoading(false);
      return;
    }

    const payload = toHistoryPayload(await readJsonPayload(response));
    if (!payload) {
      setError(true);
      setLoading(false);
      return;
    }

    setRows(payload.rows);
    setScheduler(payload.scheduler);
    setSync(payload.sync);
    setDashboardMetric(payload.dashboardMetric);
    setMonitoredEtfs(payload.monitoredEtfs);

    const fieldsResponse = await fetch('/api/config/fields', { method: 'GET', cache: 'no-store' });
    if (fieldsResponse.ok) {
      const fieldsPayload = toFieldsPayload(await readJsonPayload(fieldsResponse));
      if (fieldsPayload) {
        const nextMetricDisplayNames: Partial<Record<DashboardMetric, string>> = {};
        for (const field of fieldsPayload.fields) {
          nextMetricDisplayNames[field.fieldName] = field.displayName;
        }
        setMetricDisplayNames(nextMetricDisplayNames);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const runNow = async () => {
    if (runningNow) {
      return;
    }

    setRunError(null);
    setRunningNow(true);

    try {
      const response = await fetch('/api/jobs/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 'daily-etf-monitor' }),
      });
      if (!response.ok) {
        throw new Error('Failed to run sync');
      }

      await loadDashboard();
    } catch {
      setRunError('Failed to run synchronization.');
    } finally {
      setRunningNow(false);
    }
  };

  const syncStatusStyle = getSyncStatusStyle(sync.status);

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ETF Monitor
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/"
                className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className={pathname === '/settings' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
              >
                Settings
              </Link>
            </div>
          </div>
        </nav>
        <header className="bg-[#0b3a6e] px-6 py-5 text-white">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-3xl font-semibold tracking-tight">ETF Monitor</h1>
            <p className="mt-1 text-sm text-blue-100">
              Live data extracted automatically from BVB reports
            </p>
          </div>
        </header>
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
          <div className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-700">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white">
        <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ETF Monitor
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/"
                className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className={pathname === '/settings' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
              >
                Settings
              </Link>
            </div>
          </div>
        </nav>
        <header className="bg-[#0b3a6e] px-6 py-5 text-white">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-3xl font-semibold tracking-tight">ETF Monitor</h1>
            <p className="mt-1 text-sm text-blue-100">
              Live data extracted automatically from BVB reports
            </p>
          </div>
        </header>
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
          <div className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-red-700">
              Failed to load data. Please refresh the page and try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="bg-[#0b3a6e] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            ETF Monitor
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className={pathname === '/' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={pathname === '/settings' ? 'font-semibold underline' : 'text-blue-100 hover:text-white'}
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>
      <header className="bg-[#0b3a6e] px-6 py-5 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight">ETF Monitor</h1>
          <p className="mt-1 text-sm text-blue-100">Live data extracted automatically from BVB reports</p>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
        <section className="w-full max-w-5xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last Sync</p>
              <p className="mt-1 text-sm text-slate-800">Completed</p>
              <p className="text-sm text-slate-800">{formatDateTime(sync.completedAt)}</p>
              <p className="mt-1 text-xs text-slate-600">Duration {formatDuration(sync.durationSeconds)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scheduler</p>
              <p className="mt-1 text-sm text-slate-800">
                {scheduler.enabled ? `Daily ${scheduler.time}` : `Disabled (${scheduler.time})`}
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
              <p className={`mt-1 inline-flex items-center gap-2 text-sm font-medium ${syncStatusStyle.textClass}`}>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${syncStatusStyle.dotClass}${sync.status === 'Running' ? ' animate-pulse' : ''}`}
                />
                {sync.status}
              </p>
              <button
                type="button"
                onClick={runNow}
                disabled={runningNow}
                className="mt-2 rounded bg-[#0b3a6e] px-3 py-1 text-xs font-medium text-white hover:bg-[#0a335f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningNow ? 'Running...' : 'Run now'}
              </button>
            </div>
          </div>

          {runError ? <p className="mb-4 text-sm text-red-700">{runError}</p> : null}

          {monitoredEtfs === 0 ? (
            <p className="text-sm text-slate-700">No ETFs are currently monitored.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">ETF</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                      Report Date
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                      {getMetricLabel(dashboardMetric, metricDisplayNames)}
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                      {getMetricDeltaLabel(dashboardMetric, metricDisplayNames)}
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Δ %</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.symbol}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}
                    >
                      <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                        {row.symbol}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                        {new Date(row.report_date).toLocaleDateString()}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                        {formatMetricValue(getCurrentMetricValue(row, dashboardMetric), dashboardMetric)}
                      </td>
                      <td
                        className={`border-b border-slate-200 px-4 py-3 ${getDeltaColorClass(calculateDelta(getCurrentMetricValue(row, dashboardMetric), getPreviousMetricValue(row, dashboardMetric)))}`}
                      >
                        {(() => {
                          const delta = calculateDelta(
                            getCurrentMetricValue(row, dashboardMetric),
                            getPreviousMetricValue(row, dashboardMetric),
                          );

                          if (delta === null) {
                            return '-';
                          }

                          return (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-[10px]" aria-hidden="true">
                                {getDeltaIndicator(delta)}
                              </span>
                              <span>
                                {delta > 0
                                  ? `+${formatMetricValue(delta, dashboardMetric)}`
                                  : delta < 0
                                    ? formatMetricValue(delta, dashboardMetric)
                                    : '0'}
                              </span>
                            </span>
                          );
                        })()}
                      </td>
                      <td
                        className={`border-b border-slate-200 px-4 py-3 ${getDeltaColorClass(calculateDeltaPercent(getCurrentMetricValue(row, dashboardMetric), getPreviousMetricValue(row, dashboardMetric)))}`}
                      >
                        {(() => {
                          const deltaPercent = calculateDeltaPercent(
                            getCurrentMetricValue(row, dashboardMetric),
                            getPreviousMetricValue(row, dashboardMetric),
                          );
                          if (deltaPercent === null) {
                            return '-';
                          }

                          return (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-[10px]" aria-hidden="true">
                                {getDeltaIndicator(deltaPercent)}
                              </span>
                              <span>
                                {`${deltaPercent > 0 ? '+' : ''}${deltaPercent.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}%`}
                              </span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3">
                        {row.report_url ? (
                          <a
                            href={row.report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                          >
                            <span aria-hidden="true">↗</span>
                            <span>View</span>
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
