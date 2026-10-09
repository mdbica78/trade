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

export type ConnectionTestTarget = { provider: string; model: string };

/** `target` is what the admin form currently shows (US-056/DEC-029); without a provider the stored settings are tested. */
export async function testProviderConnection(
  deps: ProviderDeps = createProviderDeps(),
  options: { timeoutMs?: number; target?: ConnectionTestTarget | null } = {},
): Promise<ConnectionTestResult> {
  const target = options.target;
  const effective: ProviderDeps =
    target && target.provider.trim() !== ""
      ? {
          ...deps,
          loadSettings: async () => ({
            provider: target.provider.trim(),
            model: target.model.trim() === "" ? null : target.model.trim(),
          }),
        }
      : deps;
  const call = await loadActiveProvider(effective);
  if (!call.ok) {
    return { ok: false, code: call.reason };
  }
  const result = await runGeneration(call.provider, PING_REQUEST, call.input, { timeoutMs: options.timeoutMs });
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, code: result.error };
}
