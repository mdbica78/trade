import { sendProviderRequest, type ErrorBodyRule } from "./http";
import type { AiProvider, GenerateRequest, GenerateResult, ProviderCallContext } from "./types";

type ChoiceMessage = { message?: { content?: unknown } };
type ChatCompletionsBody = { choices?: unknown };

function extractChatCompletionsText(json: unknown): string | null {
  const body = json as ChatCompletionsBody | null;
  const choices = body?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const content = (choices[0] as ChoiceMessage)?.message?.content;
  return typeof content === "string" ? content : null;
}

type TokenLimitField = "max_tokens" | "max_completion_tokens";

function responseFormatFor(request: GenerateRequest): Record<string, unknown> {
  if (request.format === "json_schema" && request.schema) {
    return {
      response_format: {
        type: "json_schema",
        json_schema: { name: "chat_answer", strict: false, schema: request.schema },
      },
    };
  }
  if (request.format === "json_object") {
    return { response_format: { type: "json_object" } };
  }
  return {};
}

function buildRequestBody(model: string, request: GenerateRequest, tokenLimitField: TokenLimitField) {
  return {
    model,
    messages: [{ role: "system", content: request.system }, ...request.messages],
    [tokenLimitField]: request.maxOutputTokens,
    ...responseFormatFor(request),
  };
}

export const OPENAI_COMPATIBLE_UNSUPPORTED_FORMAT_STATUSES = [400, 422] as const;

/** A provider-neutral adapter for any OpenAI-compatible chat-completions API (Task 2's "one more small entry"). */
export function createOpenAiCompatibleProvider(options: {
  id: string;
  chatCompletionsUrl: string;
  errorBodyRule?: ErrorBodyRule;
  tokenLimitField?: TokenLimitField;
}): AiProvider {
  return {
    id: options.id,
    async generate(request: GenerateRequest, ctx: ProviderCallContext): Promise<GenerateResult> {
      if (ctx.apiKey === null) {
        return { ok: false, error: "auth_failed" };
      }
      return sendProviderRequest(
        {
          url: options.chatCompletionsUrl,
          headers: { "content-type": "application/json", authorization: `Bearer ${ctx.apiKey}` },
          body: buildRequestBody(ctx.model, request, options.tokenLimitField ?? "max_tokens"),
          errorBodyRule: options.errorBodyRule ?? null,
          extractText: extractChatCompletionsText,
          unsupportedFormatStatuses:
            request.format === "json_schema" ? OPENAI_COMPATIBLE_UNSUPPORTED_FORMAT_STATUSES : undefined,
        },
        ctx,
      );
    },
  };
}

/** US-056: fixed chat-completions endpoints for the six OpenAI-compatible presets (DEC-026 §1). */
export const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
export const MISTRAL_CHAT_COMPLETIONS_URL = "https://api.mistral.ai/v1/chat/completions";
export const DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions";
export const CEREBRAS_CHAT_COMPLETIONS_URL = "https://api.cerebras.ai/v1/chat/completions";
export const TOGETHER_CHAT_COMPLETIONS_URL = "https://api.together.xyz/v1/chat/completions";

export const OPENAI_COMPATIBLE_PRESETS: readonly {
  readonly id: string;
  readonly chatCompletionsUrl: string;
  readonly tokenLimitField?: TokenLimitField;
}[] = [
  { id: "openai", chatCompletionsUrl: OPENAI_CHAT_COMPLETIONS_URL, tokenLimitField: "max_completion_tokens" },
  { id: "openrouter", chatCompletionsUrl: OPENROUTER_CHAT_COMPLETIONS_URL },
  { id: "mistral", chatCompletionsUrl: MISTRAL_CHAT_COMPLETIONS_URL },
  { id: "deepseek", chatCompletionsUrl: DEEPSEEK_CHAT_COMPLETIONS_URL },
  { id: "cerebras", chatCompletionsUrl: CEREBRAS_CHAT_COMPLETIONS_URL },
  { id: "together", chatCompletionsUrl: TOGETHER_CHAT_COMPLETIONS_URL },
];

export const OPENAI_COMPATIBLE_PRESET_ADAPTERS: readonly AiProvider[] = OPENAI_COMPATIBLE_PRESETS.map((preset) =>
  createOpenAiCompatibleProvider(preset),
);

/** US-057: a custom provider's base URL plus the OpenAI-compatible chat-completions path. */
export function customChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}
