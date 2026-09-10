import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

export function GET() {
  const configService = new ConfigService();
  const monitoredEtfs = configService.getAllMonitoredEtfs();

  return NextResponse.json(monitoredEtfs, { status: 200 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { symbol: string; enabled: boolean };
  const configService = new ConfigService();

  if (body.enabled) {
    configService.enableEtf(body.symbol);
  } else {
    configService.disableEtf(body.symbol);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
