import { SchedulerService } from '@/lib/scheduler';
import { NextResponse } from 'next/server';

export function GET() {
  const schedulerService = new SchedulerService();
  const jobs = schedulerService.listJobs();

  return NextResponse.json(jobs, { status: 200 });
}
