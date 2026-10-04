import { getDb } from "../db/index";
import { createEtfConfigDeps, createWidgetsConfigDeps } from "../config/default-deps";
import type { EtfConfigDeps } from "../config/etfs";
import type { WidgetConfigDeps } from "../config/widgets";
import { createProviderDeps, getAiAvailability, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import type { ActiveProviderFailureReason } from "./providers/resolve";
import { getCapability } from "./capabilities/registry";
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

export const CHAT_UNAVAILABLE_REASONS = [
  "not_configured",
  "unknown_provider",
  "not_implemented",
  "no_api_key",
  "no_model",
] as const satisfies readonly ActiveProviderFailureReason[];
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

function fieldForConfigurationIntent(intent: ConfigurationIntent, context: ConfigurationContext): ContextField | undefined {
  if (intent.action !== "track_field" && intent.action !== "untrack_field") return undefined;
  const etf = context.etfs.find((item) => item.symbol === intent.symbol);
  return etf?.available.find((field) => field.fieldKey === intent.field) ??
    etf?.tracked.find((field) => field.fieldKey === intent.field) ??
    { fieldKey: intent.field, labelRo: intent.field, labelEn: intent.field };
}

function validateAction(
  raw: unknown,
  message: string,
  configuration: ConfigurationContext,
  widgets: WidgetContext,
): { ok: true; action: ValidatedAction } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "malformed" };
  const capability = (raw as { capability?: unknown }).capability;
  if (capability === "configuration") {
    if (typeof (raw as { action?: unknown }).action !== "string" ||
        !getCapability("configuration").actions.includes((raw as { action: string }).action)) {
      return { ok: false, reason: "unsupported" };
    }
    const parsed = parseConfigurationAction(raw);
    const grounded = groundAction(parsed, message, configuration);
    if (grounded.kind !== "intent") {
      return { ok: false, reason: grounded.kind === "unclear" ? grounded.reason : grounded.kind };
    }
    return { ok: true, action: { capability, intent: grounded.intent } };
  }
  if (capability === "widgets") {
    if (typeof (raw as { action?: unknown }).action !== "string" ||
        !getCapability("widgets").actions.includes((raw as { action: string }).action)) {
      return { ok: false, reason: "unknown_operation" };
    }
    const validated = validateWidgetAction(raw, widgets);
    return validated.ok
      ? { ok: true, action: { capability, intent: validated.intent } }
      : { ok: false, reason: validated.reason };
  }
  return { ok: false, reason: "unsupported" };
}

function actionDescriptor(action: ValidatedAction): { capability: "configuration" | "widgets"; action: string; symbol: string } {
  return action.capability === "configuration"
    ? { capability: action.capability, action: action.intent.action, symbol: action.intent.symbol }
    : { capability: action.capability, action: action.intent.action, symbol: action.intent.symbol };
}

async function executeActions(
  actions: readonly ValidatedAction[],
  deps: ChatDeps,
  configuration: ConfigurationContext,
): Promise<ChatActionResult[]> {
  const results: ChatActionResult[] = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!;
    const descriptor = actionDescriptor(action);
    try {
      if (action.capability === "configuration") {
        const configurationResult = await executeConfigurationIntent(action.intent, configuration, deps.config);
        const field = fieldForConfigurationIntent(action.intent, configuration);
        results.push({
          index: index + 1,
          status: configurationOutcomeFailed(configurationResult.code) ? "failed" : "done",
          ...descriptor,
          changed: configurationResult.changed,
          ...(field === undefined ? {} : { field }),
          configuration: configurationResult,
        });
        if (configurationOutcomeFailed(configurationResult.code)) {
          for (let later = index + 1; later < actions.length; later += 1) {
            results.push({ index: later + 1, status: "not_run", ...actionDescriptor(actions[later]!), changed: false });
          }
          break;
        }
      } else {
        const widgetResult = await executeWidgetIntent(action.intent, deps.widgets);
        if (!widgetResult.ok) {
          results.push({ index: index + 1, status: "failed", ...descriptor, changed: false });
          for (let later = index + 1; later < actions.length; later += 1) {
            results.push({
              index: later + 1,
              status: "not_run",
              ...actionDescriptor(actions[later]!),
              changed: false,
            });
          }
          break;
        }
        results.push({
          index: index + 1,
          status: "done",
          ...descriptor,
          changed: widgetResult.outcome.changed,
          widget: widgetResult.outcome,
        });
      }
    } catch {
      results.push({ index: index + 1, status: "failed", ...descriptor, changed: false });
      for (let later = index + 1; later < actions.length; later += 1) {
        results.push({
          index: later + 1,
          status: "not_run",
          ...actionDescriptor(actions[later]!),
          changed: false,
        });
      }
      break;
    }
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

  let outcome: ActionListOutcome;
  try {
    outcome = await interpretConfigurationRequest(
      message,
      context,
      bindGenerate(active.provider, active.input),
    );
  } catch {
    return { kind: "error" };
  }

  if (outcome.kind !== "actions") return { kind: "interpreted", outcome };

  try {
    const widgets = await loadWidgetContext(context, deps.widgets);
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
