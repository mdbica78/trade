import type { AIRequest, AIResponse } from '../types';
import type { AIProvider } from './provider';

export class AIService {
  constructor(private readonly provider: AIProvider) {}

  chat(request: AIRequest): Promise<AIResponse> {
    return this.provider.chat(request);
  }
}
