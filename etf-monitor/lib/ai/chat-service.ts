import { ConfigService } from '../config/service';
import {
  AIProvider,
  type AIChatMessage,
  type AIRequest,
  type AIResponse,
} from '../types';
import { ConfigurationAssistantService } from './configuration-assistant';
import { resolveModelProvider } from './model-provider';

function normalizeMessages(messages: AIChatMessage[]): AIChatMessage[] {
  return messages.filter((message) => message.content.trim().length > 0);
}

function extractLatestUserPrompt(messages: AIChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user' && message.content.trim().length > 0) {
      return message.content.trim();
    }
  }

  return '';
}

function shouldUseConfigurationAssistant(response: AIResponse, request: AIRequest): boolean {
  if (request.confirm || request.confirmationToken) {
    return true;
  }

  if (response.intent && response.intent !== 'UNKNOWN') {
    return true;
  }

  return response.requiresConfirmation === true;
}

function buildSystemMessage(configurationSummary: string): AIChatMessage {
  return {
    role: 'system',
    content:
      'You are an ETF Monitor assistant. Use only factual application context provided below. ' +
      'Do not invent ETF configuration state or BVB validation outcomes. ' +
      'If the user requests persistent configuration changes, instruct them to use the confirmation-enabled workflow.\n\n' +
      `Current configuration snapshot:\n${configurationSummary}`,
  };
}

export class AIChatService {
  private readonly configAssistant = new ConfigurationAssistantService();
  private readonly configService = new ConfigService();

  async process(request: AIRequest): Promise<AIResponse> {
    const incomingMessages = normalizeMessages(request.messages ?? []);
    const latestPrompt = request.prompt.trim() || extractLatestUserPrompt(incomingMessages);
    if (!latestPrompt) {
      return {
        provider: AIProvider.MOCK,
        success: false,
        message: 'A user prompt is required.',
      };
    }

    const configAssistantResponse = await this.configAssistant.chat({
      prompt: latestPrompt,
      confirm: request.confirm,
      confirmationToken: request.confirmationToken,
      provider: request.provider,
      messages: incomingMessages,
    });
    if (shouldUseConfigurationAssistant(configAssistantResponse, request)) {
      const provider = resolveModelProvider();
      return {
        ...configAssistantResponse,
        model: provider.model,
      };
    }

    const provider = resolveModelProvider();
    const providerStatus = await provider.getStatus();
    if (providerStatus.status !== 'configured') {
      return {
        provider: providerStatus.provider,
        success: false,
        model: providerStatus.model,
        message: `AI provider unavailable: ${providerStatus.message}`,
      };
    }

    try {
      const configuration = await this.configService.getConfiguration();
      const configurationSummary = JSON.stringify(
        {
          monitoredEtfs: configuration.etfs.filter((etf) => etf.enabled).map((etf) => etf.symbol),
          enabledMetrics: configuration.fields.filter((field) => field.enabled).map((field) => field.fieldName),
          dashboardMetric: configuration.dashboardMetric,
          scheduler: configuration.scheduler,
        },
        null,
        2,
      );
      const modelMessages: AIChatMessage[] = [
        buildSystemMessage(configurationSummary),
        ...incomingMessages,
      ];
      if (modelMessages.every((message) => message.role !== 'user')) {
        modelMessages.push({ role: 'user', content: latestPrompt });
      }

      const message = await provider.generate(modelMessages);
      return {
        provider: provider.provider,
        model: provider.model,
        success: true,
        message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown model error';
      return {
        provider: provider.provider,
        model: provider.model,
        success: false,
        message: `AI generation failed: ${message}`,
      };
    }
  }
}
