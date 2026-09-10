import { ConfigService } from '@/lib/config/service';
import { NextResponse } from 'next/server';

export function GET() {
  const configService = new ConfigService();
  const monitoredFields = configService.getAllMonitoredFields();

  return NextResponse.json(monitoredFields, { status: 200 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { fieldName: string; enabled: boolean };
  const configService = new ConfigService();

  if (body.enabled) {
    configService.enableField(body.fieldName);
  } else {
    configService.disableField(body.fieldName);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
