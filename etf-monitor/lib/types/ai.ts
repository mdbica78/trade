export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  MOCK = 'mock',
}

export interface AIRequest {
  provider: AIProvider;
  prompt: string;
}

export interface AIResponse {
  provider: AIProvider;
  success: boolean;
  message: string;
}
