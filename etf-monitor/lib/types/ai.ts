export enum AIProvider {
  OLLAMA = 'ollama',
  GATEWAY = 'gateway',
  OPENAI_COMPATIBLE = 'openai-compatible',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  MOCK = 'mock',
}

export type AIIntentCategory =
  | 'ADD_ETF'
  | 'REMOVE_ETF'
  | 'ADD_METRIC'
  | 'REMOVE_METRIC'
  | 'SET_DASHBOARD_METRIC'
  | 'SHOW_CONFIGURATION'
  | 'EXPLAIN_CONFIGURATION'
  | 'UNKNOWN';

export interface AIRequest {
  messages?: AIChatMessage[];
  provider?: AIProvider;
  prompt: string;
  confirm?: boolean;
  confirmationToken?: string;
}

export interface AIResponse {
  provider: AIProvider;
  success: boolean;
  message: string;
  model?: string;
  intent?: AIIntentCategory;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  data?: Record<string, unknown>;
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProviderStatus {
  provider: AIProvider;
  model: string;
  configured: boolean;
  status: 'configured' | 'unavailable' | 'connection_error';
  message: string;
}
