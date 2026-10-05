import { normaliseResult } from "../../providers/run-generation";
import { parseActionListOutput, type ActionListOutcome } from "../action-list";
import type { CapabilityGenerate } from "../types";
import type { ConfigurationContext } from "./context";
import { buildConfigurationRequest } from "./prompt";

/** Exactly one `generate` call, never throws; the model text never appears in the outcome. */
export async function interpretConfigurationRequest(
  message: string,
  context: ConfigurationContext,
  generate: CapabilityGenerate,
): Promise<ActionListOutcome> {
  const request = buildConfigurationRequest(message, context);

  let result;
  try {
    result = normaliseResult(await generate(request));
  } catch {
    return { kind: "provider_error", error: "provider_error" };
  }
  if (!result.ok) {
    return { kind: "provider_error", error: result.error };
  }
  return parseActionListOutput(result.text);
}
