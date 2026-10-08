import { isRecord, WIDGET_OPERATIONS, WIDGET_PERIOD_UNITS } from "../config/widgets";
import { middleCut } from "./chat-history";
import type { ConfigurationContext } from "./capabilities/configuration/context";
import type { GenerateMessage } from "./providers/types";

export const CORRECTION_PREVIOUS_MAX_CHARS = 4000;
export const CORRECTION_MAX_LINES = 10;

const CORRECTION_HEADER = "Your previous answer could not be used:";
const CORRECTION_FOOTER =
  'Answer the user\'s latest message again with one corrected JSON object only. If a detail is ' +
  'missing, ask in "question" with "actions":[].';

function symbolFromRaw(raw: Record<string, unknown>): string | undefined {
  const value = raw.capability === "widgets" ? raw.etf : raw.symbol;
  return typeof value === "string" ? value : undefined;
}

function nestedObject(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const candidate = raw.definition ?? raw.match ?? raw.changes;
  return isRecord(candidate) ? candidate : undefined;
}

function fieldKeyFromRaw(raw: Record<string, unknown>): string | undefined {
  if (typeof raw.field === "string") return raw.field;
  const nested = nestedObject(raw);
  return typeof nested?.fieldKey === "string" ? nested.fieldKey : undefined;
}

function operationFromRaw(raw: Record<string, unknown>): unknown {
  return nestedObject(raw)?.operation;
}

function periodUnitFromRaw(raw: Record<string, unknown>): unknown {
  return nestedObject(raw)?.periodUnit;
}

function periodAmountFromRaw(raw: Record<string, unknown>): unknown {
  return nestedObject(raw)?.periodAmount;
}

/**
 * Builds the grounded parts of one correction line from closed codes and data-block values only
 * (T-7): never a model-invented symbol, field, title or free text. A symbol/field that is not in
 * the current configuration context is silently dropped, not echoed back.
 */
function describeActionFailure(index: number, reason: string, raw: unknown, configuration: ConfigurationContext): string {
  const parts: string[] = [];
  if (isRecord(raw)) {
    const symbol = symbolFromRaw(raw);
    const etf = symbol === undefined ? undefined : configuration.etfs.find((e) => e.symbol === symbol);
    if (symbol !== undefined && etf !== undefined) parts.push(symbol);

    const fieldKey = fieldKeyFromRaw(raw);
    if (fieldKey !== undefined && etf !== undefined && etf.available.some((f) => f.fieldKey === fieldKey)) {
      parts.push(fieldKey);
    }

    const operation = operationFromRaw(raw);
    if (typeof operation === "string" && (WIDGET_OPERATIONS as readonly string[]).includes(operation)) {
      parts.push(operation);
    }

    const periodUnit = periodUnitFromRaw(raw);
    if (typeof periodUnit === "string" && (WIDGET_PERIOD_UNITS as readonly string[]).includes(periodUnit)) {
      parts.push(periodUnit);
    }

    const periodAmount = periodAmountFromRaw(raw);
    if (typeof periodAmount === "number" && Number.isInteger(periodAmount) && periodAmount >= 1 && periodAmount <= 365) {
      parts.push(String(periodAmount));
    }

    const slot = raw.slot;
    if (slot === "all" || (typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= 6)) {
      parts.push(String(slot));
    }
  }
  const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `action ${index}: ${reason}${suffix}`;
}

/**
 * One correction line: either the whole envelope was unparseable (`index === null`), or one
 * action at `index` (1-based) failed with `reason`. Never echoes free text from the model.
 */
export function describeFailure(
  index: number | null,
  reason: string,
  raw: unknown,
  configuration: ConfigurationContext,
): string {
  if (index === null) {
    return 'answer: unparseable (one JSON object {"reply","actions","question"} expected)';
  }
  return describeActionFailure(index, reason, raw, configuration);
}

/**
 * Builds the one extra turn pair sent for the single correction round (DEC-027 §3): the user's
 * message again, the previous (middle-cut) model answer, then a user turn naming only closed
 * failure reasons and grounded values. This text never enters grounding for a later turn (T-7) —
 * only `history` + the original `message` do.
 */
export function buildCorrectionMessages(
  history: readonly GenerateMessage[],
  message: string,
  previousText: string,
  lines: readonly string[],
): GenerateMessage[] {
  const cappedLines =
    lines.length > CORRECTION_MAX_LINES
      ? [...lines.slice(0, CORRECTION_MAX_LINES), `… and ${lines.length - CORRECTION_MAX_LINES} more`]
      : lines;
  const body = [CORRECTION_HEADER, ...cappedLines, CORRECTION_FOOTER].join("\n");
  return [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: middleCut(previousText, CORRECTION_PREVIOUS_MAX_CHARS) },
    { role: "user", content: body },
  ];
}
