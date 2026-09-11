import { ConfigService } from '@/lib/config/service';
import { DatabaseService } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const databaseService = new DatabaseService();
    const configService = new ConfigService();
    const history = await databaseService.getLatestHistoryWithPrevious();
    const syncOverview = await databaseService.getSyncOverview();
    const schedulerSettings = await configService.getSchedulerSettings();
    const enabledFieldNames = await configService.getEnabledFieldNames();
    const dashboardMetric = await configService.getDashboardMetric();
    const monitoredEtfs = await configService.getEnabledMonitoredEtfCount();

    return NextResponse.json(
      {
        rows: history,
        scheduler: schedulerSettings,
        sync: {
          status: syncOverview.status,
          completedAt: syncOverview.completedAt,
          durationSeconds: syncOverview.durationSeconds,
        },
        enabledFields: enabledFieldNames,
        dashboardMetric,
        monitoredEtfs,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to load history: ${message}`,
      },
      { status: 500 },
    );
  }
}
