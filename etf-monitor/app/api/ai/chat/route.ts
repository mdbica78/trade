import { AIChatService } from '@/lib/ai';
import { AIProvider, type AIChatMessage, type AIRequest, type AIResponse } from '@/lib/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMessages(value: unknown): AIChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const role = item.role;
      const content = item.content;
      if (
        (role !== 'user' && role !== 'assistant' && role !== 'system') ||
        typeof content !== 'string'
      ) {
        return null;
      }

      return { role, content };
    })
    .filter((item): item is AIChatMessage => item !== null);
}

function extractPrompt(messages: AIChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user' && message.content.trim().length > 0) {
      return message.content.trim();
    }
  }

  return '';
}

function toProvider(value: unknown): AIProvider | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === AIProvider.OLLAMA) {
    return AIProvider.OLLAMA;
  }
  if (normalized === AIProvider.GATEWAY) {
    return AIProvider.GATEWAY;
  }
  if (normalized === AIProvider.OPENAI_COMPATIBLE || normalized === AIProvider.OPENAI) {
    return AIProvider.OPENAI_COMPATIBLE;
  }
  if (normalized === AIProvider.MOCK) {
    return AIProvider.MOCK;
  }

  return undefined;
}

function createStreamingResponse(aiResponse: AIResponse): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const text = aiResponse.message;
      const chunkSize = 48;

      for (let offset = 0; offset < text.length; offset += chunkSize) {
        const token = text.slice(offset, offset + chunkSize);
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'token', text: token })}\n`));
      }

      controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'final', response: aiResponse })}\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createStreamingResponse({
      provider: AIProvider.MOCK,
      success: false,
      message: 'Invalid request body.',
    });
  }

  if (!isRecord(body)) {
    return createStreamingResponse({
      provider: AIProvider.MOCK,
      success: false,
      message: 'Invalid request body.',
    });
  }

  const messages = toMessages(body.messages);
  const promptFromMessages = extractPrompt(messages);
  const prompt = typeof body.prompt === 'string' && body.prompt.trim().length > 0
    ? body.prompt.trim()
    : promptFromMessages;

  const aiRequest: AIRequest = {
    provider: toProvider(body.provider),
    prompt,
    messages,
    confirm: body.confirm === true,
    confirmationToken: typeof body.confirmationToken === 'string' ? body.confirmationToken : undefined,
  };

  try {
    const service = new AIChatService();
    const aiResponse = await service.process(aiRequest);
    return createStreamingResponse(aiResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createStreamingResponse({
      provider: AIProvider.MOCK,
      success: false,
      message: `Configuration request failed: ${message}`,
    });
  }
}
