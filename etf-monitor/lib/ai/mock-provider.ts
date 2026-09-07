import type { AIProvider as AIProviderInterface } from './provider';
import { AIProvider, type AIRequest, type AIResponse } from '../types';

export class MockAIProvider implements AIProviderInterface {
  async chat(_request: AIRequest): Promise<AIResponse> {
    return {
      provider: AIProvider.MOCK,
      success: true,
      message: 'Mock response',
    };
  }
}
