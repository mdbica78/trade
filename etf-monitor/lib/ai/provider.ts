import type { AIRequest, AIResponse } from '../types';

export interface AIProvider {
  chat(request: AIRequest): Promise<AIResponse>;
}
