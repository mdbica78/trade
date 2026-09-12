import { BVBService } from '@/lib/bvb';
import { ConfigService } from '@/lib/config/service';
import { DatabaseService, type EtfHistorySnapshotRow } from '@/lib/db/service';
import { NextResponse } from 'next/server';

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9]{2,20}$/.test(value);
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

function toMetricCards(
  history: EtfHistorySnapshotRow[],
  fields: Awaited<ReturnType<ConfigService['getEnabledMonitoredFields']>>,
): Array<{
  fieldName: string;
  displayName: string;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
}> {
  const latest = history[0];
  const previous = history[1];

  return fields.map((field) => {
    const currentValue = latest?.metrics[field.fieldName] ?? null;
    const previousValue = previous?.metrics[field.fieldName] ?? null;
    return {
      fieldName: field.fieldName,
      displayName: field.displayName,
      currentValue,
      previousValue,
      delta: calculateDelta(currentValue, previousValue),
      deltaPercent: calculateDeltaPercent(currentValue, previousValue),
    };
  });
}

function toChartSeries(
  history: EtfHistorySnapshotRow[],
  fields: Awaited<ReturnType<ConfigService['getEnabledMonitoredFields']>>,
): Array<{
  fieldName: string;
  displayName: string;
  points: Array<{ reportDate: string; value: number | null }>;
}> {
  const chronologicalHistory = [...history].reverse();
  return fields.map((field) => ({
    fieldName: field.fieldName,
    displayName: field.displayName,
    points: chronologicalHistory.map((row) => ({
      reportDate: row.report_date,
      value: row.metrics[field.fieldName] ?? null,
    })),
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!isValidSymbol(normalizedSymbol)) {
    return NextResponse.json({ success: false, error: 'Invalid ETF symbol' }, { status: 400 });
  }

  try {
    const configService = new ConfigService();
    const databaseService = new DatabaseService();
    const bvbService = new BVBService();

    const [monitoredEtf, history, enabledFields] = await Promise.all([
      configService.getMonitoredEtf(normalizedSymbol),
      databaseService.getHistoryBySymbol(normalizedSymbol, 180),
      configService.getEnabledMonitoredFields(),
    ]);

    if (!monitoredEtf && history.length === 0) {
      return NextResponse.json({ success: false, error: 'ETF not found' }, { status: 404 });
    }

    let identityName = monitoredEtf?.name ?? null;
    let identityIsin = monitoredEtf?.isin ?? null;
    if (!identityName || !identityIsin) {
      const etfs = await bvbService.getEtfs();
      const matched = etfs.find((etf) => etf.symbol === normalizedSymbol);
      if (matched) {
        identityName = matched.name;
        identityIsin = matched.isin;
      }
    }

    const latestReport = history[0]
      ? {
          reportDate: history[0].report_date,
          reportUrl: history[0].report_url,
        }
      : null;
    const previousReport = history[1]
      ? {
          reportDate: history[1].report_date,
          reportUrl: history[1].report_url,
        }
      : null;

    const metrics = toMetricCards(history, enabledFields);
    const charts = toChartSeries(history, enabledFields);

    return NextResponse.json(
      {
        symbol: normalizedSymbol,
        name: identityName,
        isin: identityIsin,
        latestReport,
        previousReport,
        metrics,
        charts,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load ETF details' }, { status: 500 });
  }
}
