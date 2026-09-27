import { getDb } from "../db/index";
import { createEtfConfigDeps } from "../config/default-deps";
import type { EtfConfigDeps } from "../config/etfs";
import { createProviderDeps, getAiAvailability, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import type { ActiveProviderFailureReason } from "./providers/resolve";
import { getCapability } from "./capabilities/registry";
import { bindGenerate } from "./capabilities/generate";
import { loadConfigurationContext } from "./capabilities/configuration/context";
import type { ContextField } from "./capabilities/configuration/context";
import type { ConfigurationOutcome } from "./capabilities/configuration/intent";
import { executeConfigurationIntent, type ExecutionOutcome } from "./capabilities/configuration/execute";

export const CHAT_MESSAGE_MAX_LENGTH = 500;

export const CHAT_INVALID_REASONS = ["empty", "too_long"] as const;
export type ChatInvalidReason = (typeof CHAT_INVALID_REASONS)[number];

export const CHAT_UNAVAILABLE_REASONS = [
  "not_configured",
  "unknown_provider",
  "not_implemented",
  "no_api_key",
  "no_model",
] as const satisfies readonly ActiveProviderFailureReason[];
export type ChatUnavailableReason = (typeof CHAT_UNAVAILABLE_REASONS)[number];

export type InterpretedOutcome = Exclude<ConfigurationOutcome, { kind: "intent" }>;

export type ChatOutcome =
  | { kind: "invalid_message"; reason: ChatInvalidReason }
  | { kind: "unavailable"; reason: ChatUnavailableReason }
  | { kind: "interpreted"; outcome: InterpretedOutcome; field: ContextField | null }
  | { kind: "executed"; result: ExecutionOutcome }
  | { kind: "error" };

export type ChatAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: ChatUnavailableReason }
  | { status: "error" };

export type ChatDeps = { provider: ProviderDeps; config: EtfConfigDeps };

export function createChatDeps(): ChatDeps {
  return { provider: createProviderDeps(), config: createEtfConfigDeps(getDb()) };
}

function unclearField(outcome: ConfigurationOutcome, context: Awaited<ReturnType<typeof loadConfigurationContext>>): ContextField | null {
  if (outcome.kind !== "unclear" || outcome.symbol === undefined || outcome.field === undefined) return null;
  const etf = context.etfs.find((e) => e.symbol === outcome.symbol);
  const found =
    etf?.available.find((f) => f.fieldKey === outcome.field) ?? etf?.tracked.find((f) => f.fieldKey === outcome.field);
  return found ?? { fieldKey: outcome.field, labelRo: outcome.field, labelEn: outcome.field };
}

/**
 * One message, in order: validate, resolve the provider, load context, interpret, execute.
 * Never throws; a caught value is never read, stored or returned (no exception text leaks).
 */
export async function handleChatMessage(
  raw: unknown,
  depsFactory: () => ChatDeps = createChatDeps,
): Promise<ChatOutcome> {
  const message = typeof raw === "string" ? raw.trim() : "";
  if (message === "") {
    return { kind: "invalid_message", reason: "empty" };
  }
  if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { kind: "invalid_message", reason: "too_long" };
  }

  let deps: ChatDeps;
  try {
    deps = depsFactory();
  } catch {
    return { kind: "error" };
  }

  let active: Awaited<ReturnType<typeof loadActiveProvider>>;
  try {
    active = await loadActiveProvider(deps.provider);
  } catch {
    return { kind: "error" };
  }
  if (!active.ok) {
    return { kind: "unavailable", reason: active.reason };
  }

  let context: Awaited<ReturnType<typeof loadConfigurationContext>>;
  try {
    context = await loadConfigurationContext(deps.config);
  } catch {
    return { kind: "error" };
  }

  let outcome: ConfigurationOutcome;
  try {
    outcome = await getCapability("configuration").run(
      { message, context },
      bindGenerate(active.provider, active.input),
    );
  } catch {
    return { kind: "error" };
  }

  if (outcome.kind !== "intent") {
    return { kind: "interpreted", outcome, field: unclearField(outcome, context) };
  }

  try {
    const result = await executeConfigurationIntent(outcome.intent, context, deps.config);
    return { kind: "executed", result };
  } catch {
    return { kind: "error" };
  }
}

/** Key-free by construction: the provider id and model are never passed on. */
export async function getChatAvailability(providerDepsFactory: () => ProviderDeps = createProviderDeps): Promise<ChatAvailability> {
  try {
    const availability = await getAiAvailability(providerDepsFactory());
    if (availability.available) return { status: "available" };
    return { status: "unavailable", reason: availability.reason };
  } catch {
    return { status: "error" };
  }
}
