import { DatabaseService } from '@/lib/db';
import { NextResponse } from 'next/server';

export function GET() {
  const databaseService = new DatabaseService();
  const history = databaseService.getLatestHistoryWithPrevious();

  return NextResponse.json(history, { status: 200 });
}
