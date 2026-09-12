import { ConfigService, type DashboardMetric } from '@/lib/config/service';
import { NextResponse } from 'next/server';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function GET() {
  try {
    const configService = new ConfigService();
    const monitoredFields = await configService.getAllMonitoredFields();
    const dashboardMetric = await configService.getDashboardMetric();

    return NextResponse.json(
      {
        fields: monitoredFields,
        dashboardMetric,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to load field settings: ${message}`);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load field settings',
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
      const monitoredField = await configService.getMonitoredField(body.fieldName);
      if (!monitoredField) {
        return NextResponse.json({ success: false, error: 'Unknown field' }, { status: 400 });
      }

      if (body.enabled) {
        await configService.enableField(body.fieldName);
      } else {
        await configService.disableField(body.fieldName);
      }
      hasUpdate = true;
    }

    if (body.dashboardMetric !== undefined) {
      if (typeof body.dashboardMetric !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Invalid dashboard metric' },
          { status: 400 },
        );
      }

      const monitoredField = await configService.getMonitoredField(body.dashboardMetric);
      if (!monitoredField || !monitoredField.enabled) {
        return NextResponse.json(
          { success: false, error: 'Invalid dashboard metric' },
          { status: 400 },
        );
      }

      await configService.saveDashboardMetric(body.dashboardMetric as DashboardMetric);
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
    console.error(`Failed to save field settings: ${message}`);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save field settings',
      },
      { status: 500 },
    );
  }
}
