import { AIProvider, type AIChatMessage, type AIProviderStatus } from '../types';

interface ProviderConfig {
  provider: AIProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
}

function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeout);
  });
  return controller;
}

function normalizeMessages(messages: AIChatMessage[]): Array<{ role: string; content: string }> {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function readErrorMessage(status: number, bodyText: string): string {
  if (!bodyText.trim()) {
    return `Provider request failed with status ${status}`;
  }

  return `Provider request failed with status ${status}: ${bodyText.substring(0, 200)}`;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export interface AIModelProvider {
  readonly provider: AIProvider;
  readonly model: string;
  generate(messages: AIChatMessage[]): Promise<string>;
  getStatus(): Promise<AIProviderStatus>;
}

class OllamaModelProvider implements AIModelProvider {
  readonly provider = AIProvider.OLLAMA;

  constructor(
    private readonly config: ProviderConfig,
    private readonly timeoutMs = 15000,
  ) {}

  get model(): string {
    return this.config.model;
  }

  async generate(messages: AIChatMessage[]): Promise<string> {
    const controller = createTimeoutController(this.timeoutMs);
    const response = await fetch(`${sanitizeBaseUrl(this.config.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: normalizeMessages(messages),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(readErrorMessage(response.status, await safeReadText(response)));
    }

    const payload = (await response.json()) as unknown;
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('message' in payload) ||
      typeof payload.message !== 'object' ||
      payload.message === null ||
      !('content' in payload.message) ||
      typeof payload.message.content !== 'string'
    ) {
      throw new Error('Unexpected Ollama response shape');
    }

    return payload.message.content;
  }

  async getStatus(): Promise<AIProviderStatus> {
    const baseUrl = sanitizeBaseUrl(this.config.baseUrl);
    const controller = createTimeoutController(this.timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          provider: this.provider,
          model: this.model,
          configured: true,
          status: 'connection_error',
          message: `Ollama responded with status ${response.status}.`,
        };
      }

      return {
        provider: this.provider,
        model: this.model,
        configured: true,
        status: 'configured',
        message: 'Configured and reachable.',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown connection error';
      return {
        provider: this.provider,
        model: this.model,
        configured: true,
        status: 'connection_error',
        message: `Ollama is unavailable: ${message}`,
      };
    }
  }
}

class OpenAiCompatibleProvider implements AIModelProvider {
  constructor(
    private readonly config: ProviderConfig,
    private readonly timeoutMs = 20000,
  ) {}

  get provider(): AIProvider {
    return this.config.provider;
  }

  get model(): string {
    return this.config.model;
  }

  private createHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  async generate(messages: AIChatMessage[]): Promise<string> {
    const controller = createTimeoutController(this.timeoutMs);
    const response = await fetch(`${sanitizeBaseUrl(this.config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: this.createHeaders(),
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.1,
        messages: normalizeMessages(messages),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(readErrorMessage(response.status, await safeReadText(response)));
    }

    const payload = (await response.json()) as unknown;
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('choices' in payload) ||
      !Array.isArray(payload.choices)
    ) {
      throw new Error('Unexpected model response shape');
    }

    const firstChoice = payload.choices[0] as unknown;
    if (
      typeof firstChoice !== 'object' ||
      firstChoice === null ||
      !('message' in firstChoice) ||
      typeof firstChoice.message !== 'object' ||
      firstChoice.message === null ||
      !('content' in firstChoice.message) ||
      typeof firstChoice.message.content !== 'string'
    ) {
      throw new Error('Model response did not include text content');
    }

    return firstChoice.message.content;
  }

  async getStatus(): Promise<AIProviderStatus> {
    if (!this.config.apiKey) {
      return {
        provider: this.provider,
        model: this.model,
        configured: false,
        status: 'unavailable',
        message: 'Missing provider API key configuration.',
      };
    }

    const controller = createTimeoutController(this.timeoutMs);
    try {
      const response = await fetch(`${sanitizeBaseUrl(this.config.baseUrl)}/models`, {
        method: 'GET',
        headers: this.createHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          provider: this.provider,
          model: this.model,
          configured: true,
          status: 'connection_error',
          message: `Provider responded with status ${response.status}.`,
        };
      }

      return {
        provider: this.provider,
        model: this.model,
        configured: true,
        status: 'configured',
        message: 'Configured and reachable.',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown connection error';
      return {
        provider: this.provider,
        model: this.model,
        configured: true,
        status: 'connection_error',
        message: `Provider is unavailable: ${message}`,
      };
    }
  }
}

class MockModelProvider implements AIModelProvider {
  readonly provider = AIProvider.MOCK;
  readonly model = 'mock';

  async generate(_messages: AIChatMessage[]): Promise<string> {
    return 'Mock provider active. Configure AI_PROVIDER and AI_MODEL for live model responses.';
  }

  async getStatus(): Promise<AIProviderStatus> {
    return {
      provider: this.provider,
      model: this.model,
      configured: true,
      status: 'configured',
      message: 'Mock provider active.',
    };
  }
}

function readProviderFromEnv(): AIProvider {
  const configuredProvider = (process.env.AI_PROVIDER ?? 'mock').trim().toLowerCase();
  if (configuredProvider === AIProvider.OLLAMA) {
    return AIProvider.OLLAMA;
  }
  if (configuredProvider === AIProvider.GATEWAY) {
    return AIProvider.GATEWAY;
  }
  if (
    configuredProvider === AIProvider.OPENAI_COMPATIBLE ||
    configuredProvider === AIProvider.OPENAI
  ) {
    return AIProvider.OPENAI_COMPATIBLE;
  }
  return AIProvider.MOCK;
}

function defaultModelForProvider(provider: AIProvider): string {
  if (provider === AIProvider.OLLAMA) {
    return 'llama3.2';
  }
  if (provider === AIProvider.GATEWAY) {
    return 'openai/gpt-4o-mini';
  }
  if (provider === AIProvider.OPENAI_COMPATIBLE) {
    return 'gpt-4o-mini';
  }
  return 'mock';
}

export function resolveModelProvider(): AIModelProvider {
  const provider = readProviderFromEnv();
  const configuredModel = (process.env.AI_MODEL ?? '').trim();
  const model = configuredModel || defaultModelForProvider(provider);

  if (provider === AIProvider.OLLAMA) {
    return new OllamaModelProvider({
      provider,
      model,
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    });
  }

  if (provider === AIProvider.GATEWAY) {
    return new OpenAiCompatibleProvider({
      provider,
      model,
      baseUrl: process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1',
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });
  }

  if (provider === AIProvider.OPENAI_COMPATIBLE) {
    return new OpenAiCompatibleProvider({
      provider,
      model,
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return new MockModelProvider();
}
