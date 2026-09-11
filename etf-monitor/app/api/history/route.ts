import { ConfigService } from '@/lib/config/service';
import { DatabaseService } from '@/lib/db';
import { NextResponse } from 'next/server';

export function GET() {
  try {
    const databaseService = new DatabaseService();
    const configService = new ConfigService();
    const history = databaseService.getLatestHistoryWithPrevious();
    const syncOverview = databaseService.getSyncOverview();
    const schedulerSettings = configService.getSchedulerSettings();
    const enabledFieldNames = configService.getEnabledFieldNames();
    const dashboardMetric = configService.getDashboardMetric();
    const monitoredEtfs = configService.getEnabledMonitoredEtfCount();

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
