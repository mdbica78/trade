import { ConfigService } from '@/lib/config/service';
import { DatabaseService } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const databaseService = new DatabaseService();
  const configService = new ConfigService();
  let database = 'ok';
  let syncOverview: Awaited<ReturnType<DatabaseService['getSyncOverview']>> = {
    status: 'Failed',
    completedAt: null,
    durationSeconds: null,
  };
  let schedulerSettings = { enabled: true, time: '09:00' };
  let monitoredEtfs = 0;

  try {
    [syncOverview, schedulerSettings, monitoredEtfs] = await Promise.all([
      databaseService.getSyncOverview(),
      configService.getSchedulerSettings(),
      configService.getEnabledMonitoredEtfCount(),
    ]);
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
      monitoredEtfs,
    },
    { status: 200 },
  );
}
