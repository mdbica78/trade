import { sendProviderRequest, type ErrorBodyRule } from "./http";
import type { AiProvider, GenerateRequest, GenerateResult, ProviderCallContext } from "./types";

export const GEMINI_MODELS_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

type GeminiErrorDetail = { reason?: unknown };
type GeminiErrorBody = { error?: { details?: unknown } };

const geminiErrorBodyRule: ErrorBodyRule = (status, errorBody) => {
  if (status !== 400) return null;
  const body = errorBody as GeminiErrorBody | null;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return null;
  const hasInvalidKey = details.some((d) => (d as GeminiErrorDetail)?.reason === "API_KEY_INVALID");
  return hasInvalidKey ? "auth_failed" : null;
};

type GeminiPart = { text?: unknown; thought?: unknown };
type GeminiCandidate = { content?: { parts?: unknown } };
type GeminiResponseBody = { candidates?: unknown };

function extractGeminiText(json: unknown): string | null {
  const body = json as GeminiResponseBody | null;
  const candidates = body?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as GeminiCandidate;
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return null;

  const texts: string[] = [];
  for (const part of parts as GeminiPart[]) {
    if (typeof part?.text === "string" && part.thought !== true) {
      texts.push(part.text);
    }
  }
  if (texts.length === 0) return null;
  return texts.join("");
}

function buildRequestBody(request: GenerateRequest) {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: "user", parts: [{ text: request.user }] }],
    generationConfig: {
      maxOutputTokens: request.maxOutputTokens,
      ...(request.json ? { responseMimeType: "application/json" } : {}),
    },
  };
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  async generate(request: GenerateRequest, ctx: ProviderCallContext): Promise<GenerateResult> {
    if (ctx.apiKey === null) {
      return { ok: false, error: "auth_failed" };
    }
    const url = `${GEMINI_MODELS_BASE_URL}${encodeURIComponent(ctx.model)}:generateContent`;
    return sendProviderRequest(
      {
        url,
        headers: { "content-type": "application/json", "x-goog-api-key": ctx.apiKey },
        body: buildRequestBody(request),
        errorBodyRule: geminiErrorBodyRule,
        extractText: extractGeminiText,
      },
      ctx,
    );
  },
};
