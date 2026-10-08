import { createProviderDeps, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import { runGeneration } from "./providers/run-generation";
import { ACTIVE_PROVIDER_FAILURE_REASONS } from "./providers/resolve";
import { PROVIDER_ERROR_CODES } from "./providers/types";
import type { GenerateRequest } from "./providers/types";

/** US-056 AC3: one tiny request with the active provider/model, closed result only — never the
 * raw provider text, never a key. */
export const CONNECTION_TEST_CODES = [...ACTIVE_PROVIDER_FAILURE_REASONS, ...PROVIDER_ERROR_CODES] as const;
export type ConnectionTestCode = (typeof CONNECTION_TEST_CODES)[number];
export type ConnectionTestResult = { ok: true } | { ok: false; code: ConnectionTestCode };

export const CONNECTION_TEST_MAX_OUTPUT_TOKENS = 512;

const PING_REQUEST: GenerateRequest = {
  system: 'Connection check. Reply with exactly this JSON object: {"ok":true}',
  messages: [{ role: "user", content: "ping" }],
  format: "json_object",
  maxOutputTokens: CONNECTION_TEST_MAX_OUTPUT_TOKENS,
};

export async function testProviderConnection(
  deps: ProviderDeps = createProviderDeps(),
  options: { timeoutMs?: number } = {},
): Promise<ConnectionTestResult> {
  const call = await loadActiveProvider(deps);
  if (!call.ok) {
    return { ok: false, code: call.reason };
  }
  const result = await runGeneration(call.provider, PING_REQUEST, call.input, options);
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, code: result.error };
}
