import { SchedulerService } from '@/lib/scheduler';
import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const configService = new ConfigService();
  const schedulerSettings = await configService.getSchedulerSettings();
  if (!schedulerSettings.enabled) {
    return NextResponse.json({ success: true, skipped: true }, { status: 200 });
  }

  const scheduler = new SchedulerService();
  await scheduler.runJob('daily-etf-monitor');
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobId: string };
    const scheduler = new SchedulerService();
    await scheduler.runJob(body.jobId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unknown job') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unknown job',
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
