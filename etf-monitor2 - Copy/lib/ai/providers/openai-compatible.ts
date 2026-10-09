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

function buildRequestBody(model: string, request: GenerateRequest) {
  return {
    model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ],
    max_tokens: request.maxOutputTokens,
    ...(request.json ? { response_format: { type: "json_object" } } : {}),
  };
}

/** A provider-neutral adapter for any OpenAI-compatible chat-completions API (Task 2's "one more small entry"). */
export function createOpenAiCompatibleProvider(options: {
  id: string;
  chatCompletionsUrl: string;
  errorBodyRule?: ErrorBodyRule;
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
          body: buildRequestBody(ctx.model, request),
          errorBodyRule: options.errorBodyRule ?? null,
          extractText: extractChatCompletionsText,
        },
        ctx,
      );
    },
  };
}
