import { SchedulerService } from '@/lib/scheduler';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobId: string };
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
