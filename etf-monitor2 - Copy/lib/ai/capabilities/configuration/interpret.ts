import { PROVIDER_ERROR_CODES, type GenerateResult } from "../../providers/types";
import type { CapabilityGenerate } from "../types";
import type { ConfigurationContext } from "./context";
import { groundAction } from "./grounding";
import type { ConfigurationOutcome } from "./intent";
import { parseConfigurationOutput } from "./intent";
import { buildConfigurationRequest } from "./prompt";

/** Defensive: `runGeneration` always returns a well-formed `GenerateResult`, but a test double may not. */
function isGenerateResult(value: unknown): value is GenerateResult {
  const candidate = value as { ok?: unknown; text?: unknown; error?: unknown } | null | undefined;
  if (typeof candidate !== "object" || candidate === null) return false;
  if (candidate.ok === true) return typeof candidate.text === "string";
  if (candidate.ok === false) {
    return typeof candidate.error === "string" && (PROVIDER_ERROR_CODES as readonly string[]).includes(candidate.error);
  }
  return false;
}

/** Exactly one `generate` call, never throws; the model text never appears in the outcome. */
export async function interpretConfigurationRequest(
  message: string,
  context: ConfigurationContext,
  generate: CapabilityGenerate,
): Promise<ConfigurationOutcome> {
  const trimmed = message.trim();
  const request = buildConfigurationRequest(trimmed, context);

  let result: unknown;
  try {
    result = await generate(request);
  } catch {
    return { kind: "provider_error", error: "provider_error" };
  }
  if (!isGenerateResult(result)) {
    return { kind: "provider_error", error: "provider_error" };
  }
  if (!result.ok) {
    return { kind: "provider_error", error: result.error };
  }

  try {
    return groundAction(parseConfigurationOutput(result.text), trimmed, context);
  } catch {
    return { kind: "unclear", reason: "malformed" };
  }
}
