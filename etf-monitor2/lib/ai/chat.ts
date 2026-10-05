import { getDb } from "../db/index";
import { createEtfConfigDeps, createWidgetsConfigDeps } from "../config/default-deps";
import { isRecord } from "../config/widgets";
import type { EtfConfigDeps } from "../config/etfs";
import type { WidgetConfigDeps } from "../config/widgets";
import { createProviderDeps, getAiAvailability, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import { ACTIVE_PROVIDER_FAILURE_REASONS } from "./providers/resolve";
import { getCapability, isCapabilityId } from "./capabilities/registry";
import { bindGenerate } from "./capabilities/generate";
import { loadConfigurationContext } from "./capabilities/configuration/context";
import { interpretConfigurationRequest } from "./capabilities/configuration/interpret";
import type { ContextField, ConfigurationContext } from "./capabilities/configuration/context";
import { parseConfigurationAction } from "./capabilities/configuration/intent";
import type { ConfigurationIntent } from "./capabilities/configuration/intent";
import { groundAction } from "./capabilities/configuration/grounding";
import { configurationOutcomeFailed, executeConfigurationIntent, type ExecutionOutcome } from "./capabilities/configuration/execute";
import { loadWidgetContext, type WidgetContext } from "./capabilities/widgets/context";
import { validateWidgetAction, type WidgetIntent } from "./capabilities/widgets/intent";
import { executeWidgetIntent, type WidgetExecutionOutcome } from "./capabilities/widgets/execute";
import type { ActionListOutcome } from "./capabilities/action-list";
import { logLoadError } from "../log/load-error";

export const CHAT_MESSAGE_MAX_LENGTH = 500;

export const CHAT_INVALID_REASONS = ["empty", "too_long"] as const;
export type ChatInvalidReason = (typeof CHAT_INVALID_REASONS)[number];

export const CHAT_UNAVAILABLE_REASONS = ACTIVE_PROVIDER_FAILURE_REASONS;
export type ChatUnavailableReason = (typeof CHAT_UNAVAILABLE_REASONS)[number];

export type InterpretedOutcome = Exclude<ActionListOutcome, { kind: "actions" }>;

export type ChatActionResult = {
  index: number;
  status: "done" | "failed" | "not_run";
  capability: "configuration" | "widgets";
  action: string;
  symbol: string;
  changed: boolean;
  field?: ContextField;
  configuration?: ExecutionOutcome;
  widget?: WidgetExecutionOutcome;
};
export type ChatOutcome =
  | { kind: "invalid_message"; reason: ChatInvalidReason }
  | { kind: "key_request" }
  | { kind: "unavailable"; reason: ChatUnavailableReason }
  | { kind: "interpreted"; outcome: InterpretedOutcome }
  | { kind: "invalid_action"; index: number; reason: string }
  | { kind: "executed_actions"; results: readonly ChatActionResult[] }
  | { kind: "error" };

export type ChatAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: ChatUnavailableReason }
  | { status: "error" };

export type ChatDeps = { provider: ProviderDeps; config: EtfConfigDeps; widgets: WidgetConfigDeps };

function isProviderKeyRequest(message: string): boolean {
  const namedKey = /\b(?:api[\s_-]*key|provider[\s_-]*key|(?:gemini|groq)[\s_-]*key)\b|\bchei[ae]\s*(?:api|(?:de\s+(?:la\s+)?)?(?:furnizor|gemini|groq))\b/iu;
  const englishKeyAction = /\b(?:set|save|update|replace|configure|enter|change|store)\b[^\n.!?]{0,40}\b(?:my\s+|the\s+)?key\b/iu;
  const romanianKeyAction = /(?:^|[^\p{L}])(?:seteaz[aă]|schimb[aă]|configureaz[aă]|introdu|adaug[aă]|actualizeaz[aă])(?=\s)[^\n.!?]{0,40}\bchei[ae]\b/iu;
  return namedKey.test(message) || englishKeyAction.test(message) || romanianKeyAction.test(message);
}

export function createChatDeps(): ChatDeps {
  const db = getDb();
  return {
    provider: createProviderDeps(),
    config: createEtfConfigDeps(db),
    widgets: createWidgetsConfigDeps(db),
  };
}

type ValidatedAction =
  | { capability: "configuration"; intent: ConfigurationIntent }
  | { capability: "widgets"; intent: WidgetIntent };

function validateAction(
  raw: unknown,
  message: string,
  configuration: ConfigurationContext,
  widgets: WidgetContext,
): { ok: true; action: ValidatedAction } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: "malformed" };
  const { capability, action } = raw;
  if (!isCapabilityId(capability) || typeof action !== "string" || !getCapability(capability).actions.includes(action)) {
    return { ok: false, reason: capability === "widgets" ? "unknown_operation" : "unsupported" };
  }
  if (capability === "configuration") {
    const parsed = parseConfigurationAction(raw);
    const grounded = groundAction(parsed, message, configuration);
    return grounded.kind === "intent"
      ? { ok: true, action: { capability, intent: grounded.intent } }
      : { ok: false, reason: grounded.reason };
  }
  const validated = validateWidgetAction(raw, widgets);
  return validated.ok
    ? { ok: true, action: { capability, intent: validated.intent } }
    : { ok: false, reason: validated.reason };
}

function actionDescriptor(action: ValidatedAction): { capability: "configuration" | "widgets"; action: string; symbol: string } {
  return { capability: action.capability, action: action.intent.action, symbol: action.intent.symbol };
}

const FAILED = { status: "failed" as const, changed: false };

async function runAction(
  action: ValidatedAction,
  deps: ChatDeps,
  configuration: ConfigurationContext,
): Promise<{ status: "done" | "failed"; changed: boolean; field?: ContextField; configuration?: ExecutionOutcome; widget?: WidgetExecutionOutcome }> {
  if (action.capability === "configuration") {
    const c = await executeConfigurationIntent(action.intent, configuration, deps.config);
    return {
      status: configurationOutcomeFailed(c.code) ? "failed" : "done",
      changed: c.changed,
      ...(c.field === null ? {} : { field: c.field }),
      configuration: c,
    };
  }
  const w = await executeWidgetIntent(action.intent, deps.widgets);
  return w.ok ? { status: "done", changed: w.outcome.changed, widget: w.outcome } : FAILED;
}

async function executeActions(
  actions: readonly ValidatedAction[],
  deps: ChatDeps,
  configuration: ConfigurationContext,
): Promise<ChatActionResult[]> {
  const results: ChatActionResult[] = [];
  let failed = false;
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!;
    const descriptor = actionDescriptor(action);
    if (failed) {
      results.push({ index: index + 1, status: "not_run", ...descriptor, changed: false });
      continue;
    }
    const step = await runAction(action, deps, configuration).catch(() => FAILED);
    results.push({ index: index + 1, ...descriptor, ...step });
    if (step.status === "failed") failed = true;
  }
  return results;
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
  if (isProviderKeyRequest(message)) {
    return { kind: "key_request" };
  }

  try {
    const deps = depsFactory();
    const active = await loadActiveProvider(deps.provider);
    if (!active.ok) return { kind: "unavailable", reason: active.reason };

    const context = await loadConfigurationContext(deps.config);
    const outcome: ActionListOutcome = await interpretConfigurationRequest(
      message,
      context,
      bindGenerate(active.provider, active.input),
    );
    if (outcome.kind !== "actions") return { kind: "interpreted", outcome };

    const widgets: WidgetContext = outcome.actions.some((a) => isRecord(a) && a.capability === "widgets")
      ? await loadWidgetContext(context, deps.widgets)
      : { etfs: [] };

    const validated: ValidatedAction[] = [];
    for (let index = 0; index < outcome.actions.length; index += 1) {
      const result = validateAction(outcome.actions[index], message, context, widgets);
      if (!result.ok) return { kind: "invalid_action", index: index + 1, reason: result.reason };
      validated.push(result.action);
    }
    return { kind: "executed_actions", results: await executeActions(validated, deps, context) };
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
  } catch (error) {
    logLoadError("chat", error);
    return { status: "error" };
  }
}
