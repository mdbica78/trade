import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

export async function GET() {
  const configService = new ConfigService();
  const monitoredEtfs = await configService.getAllMonitoredEtfs();

  return NextResponse.json(monitoredEtfs, { status: 200 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { symbol: string; enabled: boolean };
  const configService = new ConfigService();

  if (body.enabled) {
    await configService.enableEtf(body.symbol);
  } else {
    await configService.disableEtf(body.symbol);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
