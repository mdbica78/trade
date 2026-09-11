import { SchedulerService } from '@/lib/scheduler';
import { NextResponse } from 'next/server';

export async function GET() {
  const schedulerService = new SchedulerService();
  const jobs = await schedulerService.listJobs();

  return NextResponse.json(jobs, { status: 200 });
}
