import { resolveModelProvider } from '@/lib/ai';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const provider = resolveModelProvider();
    const status = await provider.getStatus();

    return NextResponse.json(
      {
        provider: status.provider,
        model: status.model,
        configured: status.configured,
        status: status.status,
        message: status.message,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        provider: 'mock',
        model: 'mock',
        configured: false,
        status: 'connection_error',
        message: 'Failed to resolve AI provider settings.',
      },
      { status: 200 },
    );
  }
}
