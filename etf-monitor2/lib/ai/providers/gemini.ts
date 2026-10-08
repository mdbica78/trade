import { sendProviderRequest, type ErrorBodyRule } from "./http";
import type { AiProvider, GenerateRequest, GenerateResult, JsonSchema, ProviderCallContext } from "./types";

export const GEMINI_UNSUPPORTED_FORMAT_STATUSES = [400, 422] as const;

/**
 * Converts a neutral JSON-Schema object (as used by `ANSWER_JSON_SCHEMA`) into Gemini's OpenAPI
 * subset: uppercase type names, `nullable` instead of a `["T","null"]` union, no
 * `additionalProperties` (Gemini rejects the keyword), and every OBJECT keeps non-empty
 * `properties` (Gemini rejects an OBJECT with none). A `["integer","string"]` union (the `slot`
 * field) becomes a plain `STRING` — the existing normaliser turns a numeric string back into an
 * integer (T-3). Pure, never mutates its input.
 */
export function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const rawType = (schema as Record<string, unknown>).type;
  let nullable = false;
  let type: string | undefined;
  if (Array.isArray(rawType)) {
    const types = rawType.filter((t): t is string => typeof t === "string");
    nullable = types.includes("null");
    const real = types.find((t) => t !== "null");
    type = real ?? types[0];
  } else if (typeof rawType === "string") {
    type = rawType;
  }
  if (type) out.type = type.toUpperCase();
  if (nullable) out.nullable = true;

  if (typeof schema.description === "string") out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;

  if (type === "object") {
    const properties = schema.properties as Record<string, JsonSchema> | undefined;
    if (properties) {
      out.properties = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [key, toGeminiSchema(value)]),
      );
    }
    if (Array.isArray(schema.required)) out.required = schema.required;
  } else if (type === "array") {
    if (schema.items) out.items = toGeminiSchema(schema.items as JsonSchema);
    if (typeof schema.maxItems === "number") out.maxItems = schema.maxItems;
  }

  return out;
}

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

type GeminiContent = { role: "user" | "model"; parts: [{ text: string }] };

function buildContents(messages: GenerateRequest["messages"]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text = `${last.parts[0].text}\n\n${message.content}`;
    } else {
      contents.push({ role, parts: [{ text: message.content }] });
    }
  }
  if (contents.length > 0 && contents[0].role === "model") {
    contents.unshift({ role: "user", parts: [{ text: "(earlier conversation)" }] });
  }
  return contents;
}

function buildRequestBody(request: GenerateRequest) {
  const structuredOutput =
    request.format === "json_schema" && request.schema
      ? { responseMimeType: "application/json", responseSchema: toGeminiSchema(request.schema) }
      : request.format === "json_object"
        ? { responseMimeType: "application/json" }
        : {};
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: buildContents(request.messages),
    generationConfig: {
      maxOutputTokens: request.maxOutputTokens,
      ...structuredOutput,
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
        unsupportedFormatStatuses: request.format === "json_schema" ? GEMINI_UNSUPPORTED_FORMAT_STATUSES : undefined,
      },
      ctx,
    );
  },
};
