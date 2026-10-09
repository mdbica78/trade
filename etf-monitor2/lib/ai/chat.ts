import { getDb } from "../db/index";
import { createEtfConfigDeps, createWidgetsConfigDeps } from "../config/default-deps";
import { isRecord } from "../config/widgets";
import type { EtfConfigDeps } from "../config/etfs";
import type { WidgetConfigDeps } from "../config/widgets";
import { createProviderDeps, getAiAvailability, getChatPlanSigningKey, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import { ACTIVE_PROVIDER_FAILURE_REASONS } from "./providers/resolve";
import type { GenerateRequest } from "./providers/types";
import { getCapability, isCapabilityId } from "./capabilities/registry";
import { loadConfigurationContext } from "./capabilities/configuration/context";
import { buildConfigurationRequest } from "./capabilities/configuration/prompt";
import { runConfigurationTurn } from "./capabilities/configuration/interpret";
import type { ContextField, ConfigurationContext } from "./capabilities/configuration/context";
import { parseConfigurationAction } from "./capabilities/configuration/intent";
import type { ConfigurationIntent } from "./capabilities/configuration/intent";
import { groundAction } from "./capabilities/configuration/grounding";
import { configurationOutcomeFailed, executeConfigurationIntent, type ExecutionOutcome } from "./capabilities/configuration/execute";
import { loadWidgetContext, withWidgets, type WidgetContext } from "./capabilities/widgets/context";
import { validateWidgetAction, type WidgetIntent } from "./capabilities/widgets/intent";
import { executeWidgetIntent, type WidgetExecutionOutcome } from "./capabilities/widgets/execute";
import { resolveActionTargets, stripSchemaNulls, type ActionListOutcome } from "./capabilities/action-list";
import { normaliseModelAction } from "./capabilities/normalise";
import { prepareHistory, historyGroundingText } from "./chat-history";
import { describeWidgetAction, type ActionDetail } from "./chat-results";
import { containsKeyMaterial } from "./reply-guard";
import { logLoadError } from "../log/load-error";
import { structuredOutputFor, type StructuredOutputMode } from "./provider-catalog";
import { createModelCaller, type FormatCache } from "./model-call";
import { buildCorrectionMessages, describeFailure } from "./correction";
import {
  needsConfirmation,
  planFingerprint,
  signPlanToken,
  verifyPlanToken,
  PLAN_TOKEN_MAX_CHARS,
  PLAN_TOKEN_TTL_MS,
  type PlannedAction,
} from "./chat-plan";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export const CHAT_INVALID_REASONS = ["empty", "too_long"] as const;
export type ChatInvalidReason = (typeof CHAT_INVALID_REASONS)[number];

export const CHAT_UNAVAILABLE_REASONS = ACTIVE_PROVIDER_FAILURE_REASONS;
export type ChatUnavailableReason = (typeof CHAT_UNAVAILABLE_REASONS)[number];

export const PLAN_REFUSED_REASONS = ["tampered", "expired", "state_changed", "unavailable"] as const;
export type PlanRefusedReason = (typeof PLAN_REFUSED_REASONS)[number];

export type InterpretedOutcome = Exclude<ActionListOutcome, { kind: "actions" | "answer" }>;

export type ChatActionResult = {
  index: number;
  status: "done" | "failed" | "not_run" | "proposed";
  capability: "configuration" | "widgets";
  action: string;
  symbol: string;
  changed: boolean;
  field?: ContextField;
  configuration?: ExecutionOutcome;
  widget?: WidgetExecutionOutcome;
  detail?: ActionDetail;
};
export type ChatOutcome =
  | { kind: "invalid_message"; reason: ChatInvalidReason }
  | { kind: "key_request" }
  | { kind: "unavailable"; reason: ChatUnavailableReason }
  | { kind: "answered"; reply: string | null; question: string | null }
  | { kind: "interpreted"; outcome: InterpretedOutcome }
  | { kind: "invalid_action"; index: number; reason: string; symbol?: string; field?: ContextField }
  | { kind: "executed_actions"; results: readonly ChatActionResult[]; reply?: string }
  | { kind: "proposed"; results: readonly ChatActionResult[]; token: string; reply?: string }
  | { kind: "plan_refused"; reason: PlanRefusedReason }
  | { kind: "error" };

export type ChatAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: ChatUnavailableReason }
  | { status: "error" };

export type ChatDeps = {
  provider: ProviderDeps;
  config: EtfConfigDeps;
  widgets: WidgetConfigDeps;
  planKey?: () => Uint8Array | null;
  formatCache?: FormatCache;
};

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
    planKey: () => getChatPlanSigningKey(),
  };
}

type UnindexedAction =
  | { capability: "configuration"; intent: ConfigurationIntent }
  | { capability: "widgets"; intent: WidgetIntent };

type ValidatedAction = PlannedAction;

function validateAction(
  raw: unknown,
  groundingText: string,
  configuration: ConfigurationContext,
  widgets: WidgetContext,
): { ok: true; action: UnindexedAction } | { ok: false; reason: string; field?: ContextField } {
  if (!isRecord(raw)) return { ok: false, reason: "malformed" };
  const { capability, action } = raw;
  if (!isCapabilityId(capability) || typeof action !== "string" || !getCapability(capability).actions.includes(action)) {
    return { ok: false, reason: capability === "widgets" ? "unknown_operation" : "unsupported" };
  }
  if (capability === "configuration") {
    const parsed = parseConfigurationAction(raw);
    const grounded = groundAction(parsed, groundingText, configuration);
    if (grounded.kind === "intent") return { ok: true, action: { capability, intent: grounded.intent } };
    const field = grounded.field === undefined ? undefined : fieldFromSymbol(configuration, grounded.symbol, grounded.field);
    return { ok: false, reason: grounded.reason, ...(field === undefined ? {} : { field }) };
  }
  const validated = validateWidgetAction(raw, widgets);
  return validated.ok
    ? { ok: true, action: { capability, intent: validated.intent } }
    : { ok: false, reason: validated.reason };
}

function fieldFromSymbol(context: ConfigurationContext, symbol: string | undefined, fieldKey: string): ContextField | undefined {
  const etf = context.etfs.find((e) => e.symbol === symbol);
  return etf?.available.find((f) => f.fieldKey === fieldKey) ?? etf?.tracked.find((f) => f.fieldKey === fieldKey);
}

function actionDescriptor(action: ValidatedAction): { capability: "configuration" | "widgets"; action: string; symbol: string } {
  return { capability: action.capability, action: action.intent.action, symbol: action.intent.symbol };
}

function actionDetail(action: ValidatedAction, context: ConfigurationContext): ActionDetail | undefined {
  if (action.capability !== "widgets") return undefined;
  const intent = action.intent;
  const fieldKey = intent.action === "widget_add" ? intent.definition.fieldKey : intent.action === "widget_update" ? intent.changes.fieldKey : undefined;
  const field = fieldKey === undefined ? undefined : fieldFromSymbol(context, intent.symbol, fieldKey);
  return describeWidgetAction(intent, field);
}

function proposedResult(action: ValidatedAction, context: ConfigurationContext): ChatActionResult {
  const descriptor = actionDescriptor(action);
  const detail = actionDetail(action, context);
  const field =
    action.capability === "configuration" && (action.intent.action === "track_field" || action.intent.action === "untrack_field")
      ? fieldFromSymbol(context, action.intent.symbol, action.intent.field)
      : undefined;
  return {
    index: action.index,
    status: "proposed",
    ...descriptor,
    changed: false,
    ...(field === undefined ? {} : { field }),
    ...(detail === undefined ? {} : { detail }),
  };
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
  for (const action of actions) {
    const descriptor = actionDescriptor(action);
    const detail = actionDetail(action, configuration);
    if (failed) {
      results.push({ index: action.index, status: "not_run", ...descriptor, changed: false, ...(detail === undefined ? {} : { detail }) });
      continue;
    }
    const step = await runAction(action, deps, configuration).catch(() => FAILED);
    results.push({ index: action.index, ...descriptor, ...step, ...(detail === undefined ? {} : { detail }) });
    if (step.status === "failed") failed = true;
  }
  return results;
}

/** Drops a reply/question that contains the call's key or a key-shaped string; never logs the text. */
function applyKeyGuard(outcome: ActionListOutcome, apiKey: string | null): ActionListOutcome {
  if (outcome.kind === "answer") {
    return {
      kind: "answer",
      reply: outcome.reply === null || containsKeyMaterial(outcome.reply, apiKey) ? null : outcome.reply,
      question: outcome.question === null || containsKeyMaterial(outcome.question, apiKey) ? null : outcome.question,
    };
  }
  if (outcome.kind === "actions" && outcome.reply !== undefined && containsKeyMaterial(outcome.reply, apiKey)) {
    return { kind: "actions", actions: outcome.actions };
  }
  return outcome;
}

type AttemptEvaluation =
  | { status: "widget_context_error" }
  | { status: "answer"; reply: string | null; question: string | null }
  | { status: "interpreted"; outcome: InterpretedOutcome }
  | {
      status: "invalid";
      index: number | null;
      reason: string;
      symbol?: string;
      field?: ContextField;
      raw: unknown;
      failures?: readonly { index: number; reason: string; raw: unknown }[];
    }
  | { status: "valid"; actions: ValidatedAction[]; reply?: string };

/**
 * Runs the full validate-all-first pipeline over one model answer: key guard, then (for a json
 * schema answer) `stripSchemaNulls`, normalisation, `*` expansion and per-action validation. Pure
 * given its inputs; used once per model attempt (initial and, at most once, after correction).
 */
function evaluateAttempt(
  outcome: ActionListOutcome,
  apiKey: string | null,
  mode: StructuredOutputMode,
  context: ConfigurationContext,
  widgetState: WidgetContext | null,
  groundingText: string,
): AttemptEvaluation {
  const keyGuarded = applyKeyGuard(outcome, apiKey);
  if (keyGuarded.kind === "answer") {
    if (keyGuarded.reply === null && keyGuarded.question === null) {
      return { status: "interpreted", outcome: { kind: "unclear", reason: "malformed" } };
    }
    return { status: "answer", reply: keyGuarded.reply, question: keyGuarded.question };
  }
  if (keyGuarded.kind !== "actions") {
    if (keyGuarded.kind === "unclear" && keyGuarded.reason === "malformed") {
      return { status: "invalid", index: null, reason: "malformed", raw: undefined };
    }
    return { status: "interpreted", outcome: keyGuarded };
  }

  const rawActions = keyGuarded.actions.map((action) => {
    const stripped = mode === "json_schema" && isRecord(action) ? stripSchemaNulls(action) : action;
    return normaliseModelAction(stripped, context);
  });

  if (widgetState === null && rawActions.some((a) => isRecord(a) && a.capability === "widgets")) {
    return { status: "widget_context_error" };
  }
  const widgets: WidgetContext = widgetState ?? { etfs: [] };

  const validated: ValidatedAction[] = [];
  const failures: { index: number; reason: string; raw: unknown; symbol?: string; field?: ContextField }[] = [];
  for (let index = 0; index < rawActions.length; index += 1) {
    const rawAction = rawActions[index];
    if (!isRecord(rawAction)) {
      failures.push({ index: index + 1, reason: "malformed", raw: rawAction });
      continue;
    }
    const wasAll = rawAction[rawAction.capability === "widgets" ? "etf" : "symbol"] === "*";
    const resolved = resolveActionTargets(rawAction, context);
    if (!resolved.ok) {
      failures.push({
        index: index + 1,
        reason: resolved.reason,
        raw: rawAction,
        ...(resolved.symbol === undefined ? {} : { symbol: resolved.symbol }),
      });
      continue;
    }
    for (const target of resolved.actions) {
      const result = validateAction(target, groundingText, context, widgets);
      if (!result.ok) {
        const targetAction = wasAll ? target : rawAction;
        const symbol = wasAll
          ? (typeof target.etf === "string" ? target.etf : typeof target.symbol === "string" ? target.symbol : undefined)
          : undefined;
        failures.push({
          index: index + 1,
          reason: result.reason,
          raw: targetAction,
          ...(symbol === undefined ? {} : { symbol }),
          ...(result.field === undefined ? {} : { field: result.field }),
        });
        continue;
      }
      validated.push({ ...result.action, index: index + 1 });
    }
  }
  const firstFailure = failures[0];
  if (firstFailure !== undefined) {
    return {
      status: "invalid",
      index: firstFailure.index,
      reason: firstFailure.reason,
      ...(firstFailure.symbol === undefined ? {} : { symbol: firstFailure.symbol }),
      ...(firstFailure.field === undefined ? {} : { field: firstFailure.field }),
      raw: firstFailure.raw,
      failures: failures.map(({ index, reason, raw }) => ({ index, reason, raw })),
    };
  }
  return { status: "valid", actions: validated, ...(keyGuarded.reply === undefined ? {} : { reply: keyGuarded.reply }) };
}

/**
 * One message, in order: validate, resolve the provider, load context, interpret (with, at most,
 * one self-correction round — DEC-027 §3), execute at once or propose-then-wait-for-confirmation
 * (DEC-027 §4 / US-058 req. 1). Never throws; a caught value is never read, stored or returned.
 */
export async function handleChatMessage(
  raw: unknown,
  depsFactory: () => ChatDeps = createChatDeps,
  options: { history?: unknown; now?: () => number } = {},
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
  const history = prepareHistory(options.history);
  const now = options.now ?? Date.now;

  try {
    const deps = depsFactory();
    const active = await loadActiveProvider(deps.provider);
    if (!active.ok) return { kind: "unavailable", reason: active.reason };

    const context = await loadConfigurationContext(deps.config);
    let widgetState: WidgetContext | null;
    try {
      widgetState = await loadWidgetContext(context, deps.widgets);
    } catch (error) {
      logLoadError("chat", error);
      widgetState = null;
    }
    const withWidgetsContext = widgetState === null ? context : withWidgets(context, widgetState);
    const promptContext: ConfigurationContext = {
      ...withWidgetsContext,
      assistant: { provider: active.providerName, model: active.input.model },
    };

    const mode = structuredOutputFor(active.provider.id);
    const caller = createModelCaller({ provider: active.provider, input: active.input, mode, cache: deps.formatCache });
    const groundingText = `${historyGroundingText(history)}\n${message}`;

    const request1 = buildConfigurationRequest(message, promptContext, history);
    const attempt1 = await runConfigurationTurn(request1, caller.call);
    const eval1 = evaluateAttempt(attempt1.outcome, active.input.apiKey, mode, context, widgetState, groundingText);

    let finalEval: AttemptEvaluation = eval1;
    if (eval1.status === "invalid") {
      const canCorrect =
        caller.remaining() > 0 &&
        attempt1.text !== null &&
        !containsKeyMaterial(attempt1.text, active.input.apiKey);
      if (canCorrect) {
        const lines = eval1.failures?.map((failure) =>
          describeFailure(failure.index, failure.reason, failure.raw, context),
        ) ?? [describeFailure(eval1.index, eval1.reason, eval1.raw, context)];
        const correctionMessages = buildCorrectionMessages(history, message, attempt1.text as string, lines);
        const request2: GenerateRequest = { ...request1, messages: correctionMessages };
        const attempt2 = await runConfigurationTurn(request2, caller.call);
        if (attempt2.outcome.kind !== "provider_error") {
          finalEval = evaluateAttempt(attempt2.outcome, active.input.apiKey, mode, context, widgetState, groundingText);
        }
      }
    }

    if (finalEval.status === "widget_context_error") return { kind: "error" };
    if (finalEval.status === "answer") return { kind: "answered", reply: finalEval.reply, question: finalEval.question };
    if (finalEval.status === "interpreted") return { kind: "interpreted", outcome: finalEval.outcome };
    if (finalEval.status === "invalid") {
      if (finalEval.index === null) {
        return { kind: "interpreted", outcome: { kind: "unclear", reason: "malformed" } };
      }
      return {
        kind: "invalid_action",
        index: finalEval.index,
        reason: finalEval.reason,
        ...(finalEval.symbol === undefined ? {} : { symbol: finalEval.symbol }),
        ...(finalEval.field === undefined ? {} : { field: finalEval.field }),
      };
    }

    const validated: ValidatedAction[] = finalEval.actions;

    if (needsConfirmation(validated)) {
      const key = deps.planKey?.() ?? null;
      if (key === null) return { kind: "plan_refused", reason: "unavailable" };
      if (widgetState === null) return { kind: "error" };
      const fp = planFingerprint(validated, context, widgetState);
      const exp = now() + PLAN_TOKEN_TTL_MS;
      const token = signPlanToken({ plan: validated, fp, exp }, key);
      const results = validated.map((a) => proposedResult(a, context));
      return { kind: "proposed", results, token, ...(finalEval.reply === undefined ? {} : { reply: finalEval.reply }) };
    }

    const results = await executeActions(validated, deps, context);
    return { kind: "executed_actions", results, ...(finalEval.reply === undefined ? {} : { reply: finalEval.reply }) };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Confirms a previously proposed plan (DEC-027 §4): verifies the signed token, recomputes its
 * fingerprint against the current state (a mismatch refuses as `state_changed`, e.g. a replay or a
 * change made outside this plan), then executes it exactly as validated — no provider resolution,
 * no model call, no re-validation against the model. Never logs the token.
 */
export async function confirmChatPlan(
  rawToken: unknown,
  depsFactory: () => ChatDeps = createChatDeps,
  options: { now?: () => number } = {},
): Promise<ChatOutcome> {
  if (typeof rawToken !== "string" || rawToken.length === 0 || rawToken.length > PLAN_TOKEN_MAX_CHARS) {
    return { kind: "plan_refused", reason: "tampered" };
  }
  const now = options.now ?? Date.now;
  try {
    const deps = depsFactory();
    const key = deps.planKey?.() ?? null;
    if (key === null) return { kind: "plan_refused", reason: "unavailable" };

    const verification = verifyPlanToken(rawToken, key, now());
    if (!verification.ok) return { kind: "plan_refused", reason: verification.reason };

    const context = await loadConfigurationContext(deps.config);
    let widgetState: WidgetContext;
    try {
      widgetState = await loadWidgetContext(context, deps.widgets);
    } catch (error) {
      logLoadError("chat", error);
      return { kind: "error" };
    }

    const fp = planFingerprint(verification.plan, context, widgetState);
    if (fp !== verification.fp) return { kind: "plan_refused", reason: "state_changed" };

    const results = await executeActions(verification.plan as readonly ValidatedAction[], deps, context);
    return { kind: "executed_actions", results };
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
