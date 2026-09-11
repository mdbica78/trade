import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function GET() {
  const configService = new ConfigService();
  return NextResponse.json(await configService.getSchedulerSettings(), { status: 200 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.enabled !== 'boolean' ||
    typeof body.time !== 'string' ||
    !isValidTime(body.time)
  ) {
    return NextResponse.json({ success: false, error: 'Invalid scheduler settings' }, { status: 400 });
  }

  const configService = new ConfigService();
  const settings = { enabled: body.enabled, time: body.time };
  await configService.saveSchedulerSettings(settings);

  return NextResponse.json(settings, { status: 200 });
}
