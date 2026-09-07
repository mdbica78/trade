import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: '0.1.0',
      service: 'etf-monitor',
    },
    { status: 200 },
  );
}
