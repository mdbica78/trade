import { ConfigService, type DashboardMetric } from '@/lib/config/service';
import { SUPPORTED_METRIC_KEYS } from '@/lib/types';
import { NextResponse } from 'next/server';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDashboardMetric(value: unknown): value is DashboardMetric {
  return typeof value === 'string' && SUPPORTED_METRIC_KEYS.includes(value as DashboardMetric);
}

export function GET() {
  try {
    const configService = new ConfigService();
    const monitoredFields = configService.getAllMonitoredFields();
    const dashboardMetric = configService.getDashboardMetric();

    return NextResponse.json(
      {
        fields: monitoredFields,
        dashboardMetric,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to load field settings: ${message}`,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const configService = new ConfigService();
    let hasUpdate = false;

    if (body.fieldName !== undefined || body.enabled !== undefined) {
      if (typeof body.fieldName !== 'string' || typeof body.enabled !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Invalid field update' }, { status: 400 });
      }

      if (body.enabled) {
        configService.enableField(body.fieldName);
      } else {
        configService.disableField(body.fieldName);
      }
      hasUpdate = true;
    }

    if (body.dashboardMetric !== undefined) {
      if (!isDashboardMetric(body.dashboardMetric)) {
        return NextResponse.json(
          { success: false, error: 'Invalid dashboard metric' },
          { status: 400 },
        );
      }

      configService.saveDashboardMetric(body.dashboardMetric);
      hasUpdate = true;
    }

    if (!hasUpdate) {
      return NextResponse.json(
        { success: false, error: 'No valid update provided' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to save field settings: ${message}`,
      },
      { status: 500 },
    );
  }
}
