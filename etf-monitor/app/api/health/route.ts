import { ConfigService } from '@/lib/config/service';
import { DatabaseService } from '@/lib/db';
import { NextResponse } from 'next/server';

export function GET() {
  const databaseService = new DatabaseService();
  const configService = new ConfigService();
  const syncOverview = databaseService.getSyncOverview();
  const schedulerSettings = configService.getSchedulerSettings();

  let database = 'ok';
  try {
    databaseService.getDatabase().prepare('SELECT 1').get();
  } catch {
    database = 'error';
  }

  const scheduler = schedulerSettings.enabled
    ? `enabled (${schedulerSettings.time})`
    : `disabled (${schedulerSettings.time})`;

  return NextResponse.json(
    {
      database,
      scheduler,
      openai: 'mock',
      lastSync: syncOverview.completedAt,
      monitoredEtfs: configService.getEnabledMonitoredEtfCount(),
    },
    { status: 200 },
  );
}
