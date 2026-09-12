import { SchedulerService } from '@/lib/scheduler';
import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasValidSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${cronSecret}`;
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) {
    return false;
  }

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

function isAuthorizedCronRequest(request: Request): boolean {
  return hasValidSecret(request);
}

function isAuthorizedManualRunRequest(request: Request): boolean {
  if (hasValidSecret(request)) {
    return true;
  }

  return (
    request.headers.get('x-etf-monitor-action') === 'run-sync' && isSameOriginRequest(request)
  );
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
  if (!isAuthorizedManualRunRequest(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.jobId !== 'string' || body.jobId.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Invalid job id' }, { status: 400 });
  }

  try {
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
