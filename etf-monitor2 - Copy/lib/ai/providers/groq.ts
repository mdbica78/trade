import { createOpenAiCompatibleProvider } from "./openai-compatible";
import type { ErrorBodyRule } from "./http";
import type { AiProvider } from "./types";

export const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

type GroqErrorBody = { error?: { code?: unknown } };

const groqErrorBodyRule: ErrorBodyRule = (status, errorBody) => {
  if (status !== 400) return null;
  const body = errorBody as GroqErrorBody | null;
  return body?.error?.code === "json_validate_failed" ? "bad_response" : null;
};

export const groqProvider: AiProvider = createOpenAiCompatibleProvider({
  id: "groq",
  chatCompletionsUrl: GROQ_CHAT_COMPLETIONS_URL,
  errorBodyRule: groqErrorBodyRule,
});
