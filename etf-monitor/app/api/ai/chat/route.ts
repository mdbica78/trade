import { AIService, MockAIProvider } from '@/lib/ai';
import type { AIRequest } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const provider = new MockAIProvider();
  const service = new AIService(provider);
  const aiRequest = (await request.json()) as AIRequest;
  const aiResponse = await service.chat(aiRequest);

  return NextResponse.json(aiResponse, { status: 200 });
}
