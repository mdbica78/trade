import { normaliseResult } from "../../providers/run-generation";
import type { GenerateMessage, GenerateRequest } from "../../providers/types";
import { parseActionListOutput, type ActionListOutcome } from "../action-list";
import type { CapabilityGenerate } from "../types";
import type { ConfigurationContext } from "./context";
import { buildConfigurationRequest } from "./prompt";

/**
 * Runs exactly one model call for an already-built request. `text` is the raw model text when the
 * call succeeded (needed by the correction round, US-058), `null` otherwise. Never throws.
 */
export async function runConfigurationTurn(
  request: GenerateRequest,
  generate: CapabilityGenerate,
): Promise<{ outcome: ActionListOutcome; text: string | null }> {
  let result;
  try {
    result = normaliseResult(await generate(request));
  } catch {
    return { outcome: { kind: "provider_error", error: "provider_error" }, text: null };
  }
  if (!result.ok) {
    return { outcome: { kind: "provider_error", error: result.error }, text: null };
  }
  return { outcome: parseActionListOutput(result.text), text: result.text };
}

/** Exactly one `generate` call, never throws; the model text never appears in the outcome. */
export async function interpretConfigurationRequest(
  message: string,
  context: ConfigurationContext,
  generate: CapabilityGenerate,
  history: readonly GenerateMessage[] = [],
): Promise<ActionListOutcome> {
  const request = buildConfigurationRequest(message, context, history);
  const { outcome } = await runConfigurationTurn(request, generate);
  return outcome;
}
