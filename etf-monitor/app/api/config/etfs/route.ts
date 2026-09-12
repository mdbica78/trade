import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9]{2,20}$/.test(value);
}

export async function GET() {
  const configService = new ConfigService();
  const monitoredEtfs = await configService.getAllMonitoredEtfs();

  return NextResponse.json(monitoredEtfs, { status: 200 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.symbol !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Invalid ETF update' }, { status: 400 });
  }

  const symbol = normalizeSymbol(body.symbol);
  if (!isValidSymbol(symbol)) {
    return NextResponse.json({ success: false, error: 'Invalid ETF symbol' }, { status: 400 });
  }

  try {
    const configService = new ConfigService();
    const monitoredEtf = await configService.getMonitoredEtf(symbol);
    if (!monitoredEtf) {
      return NextResponse.json({ success: false, error: 'Unknown ETF symbol' }, { status: 400 });
    }

    if (body.enabled) {
      await configService.enableEtf(symbol);
    } else {
      await configService.disableEtf(symbol);
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update ETF settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
