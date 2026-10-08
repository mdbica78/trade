import type { GenerateMessage } from "./providers/types";
import type { ChatOutcome } from "./chat";

export const HISTORY_MESSAGES = 21;
export const HISTORY_MESSAGE_MAX_CHARS = 400;
export const HISTORY_TOTAL_MAX_CHARS = 6000;
export const HISTORY_OLDEST_MIN_CHARS = 120;
export const HISTORY_RAW_MAX_CHARS = 64_000;

/** Cuts `text` to exactly `max` characters by removing the middle, keeping head and tail context. */
export function middleCut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  const tail = max - 1 - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

function isGenerateMessage(value: unknown): value is GenerateMessage {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.content === "string" &&
    record.content.trim() !== ""
  );
}

/**
 * Re-parses the client-supplied history. Never throws: malformed input becomes `[]`. Enforces
 * the 21-message window, a 400-char per-message cut, then shrinks the oldest messages (never
 * dropping any) until the total is at most 6000 chars.
 */
export function prepareHistory(raw: unknown): GenerateMessage[] {
  if (typeof raw !== "string" || raw.length > HISTORY_RAW_MAX_CHARS) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const kept = parsed.filter(isGenerateMessage).map((m) => ({ role: m.role, content: m.content.trim() }));
  const windowed = kept.slice(-HISTORY_MESSAGES);
  const cut = windowed.map((m) => ({ ...m, content: middleCut(m.content, HISTORY_MESSAGE_MAX_CHARS) }));

  let total = cut.reduce((sum, m) => sum + m.content.length, 0);
  let i = 0;
  while (total > HISTORY_TOTAL_MAX_CHARS && i < cut.length) {
    const before = cut[i]!.content.length;
    const shortened = middleCut(cut[i]!.content, HISTORY_OLDEST_MIN_CHARS);
    cut[i] = { ...cut[i]!, content: shortened };
    total -= before - shortened.length;
    i += 1;
  }
  return cut;
}

/** Only the user turns, joined — used to ground a reference across turns (e.g. a symbol named earlier). */
export function historyGroundingText(history: readonly GenerateMessage[]): string {
  return history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
}

/** The assistant turn the client stores and sends back next time; never a key, never raw exception text. */
export function historyMemo(outcome: ChatOutcome): string {
  switch (outcome.kind) {
    case "key_request":
      return "[key request refused]";
    case "invalid_message":
    case "unavailable":
      return `[nothing done: ${outcome.kind}]`;
    case "answered":
      return [outcome.reply, outcome.question].filter((t): t is string => t !== null).join("\n\n");
    case "interpreted": {
      const inner = outcome.outcome;
      if (inner.kind === "provider_error") return `[nothing done: ${inner.kind} ${inner.error}]`;
      return `[nothing done: ${inner.kind}]`;
    }
    case "invalid_action":
      return `[nothing done: action ${outcome.index} ${outcome.reason}${outcome.symbol === undefined ? "" : ` ${outcome.symbol}`}]`;
    case "executed_actions": {
      const lines = outcome.results.map((r) => `${r.status}: ${r.action} — ${r.symbol}`);
      const memo = `[${lines.join("; ")}]`;
      return outcome.reply === undefined ? memo : `${outcome.reply}\n\n${memo}`;
    }
    case "proposed": {
      const lines = outcome.results.map((r) => `${r.status}: ${r.action} — ${r.symbol}`);
      const memo = `[proposed, waiting for confirmation: ${lines.join("; ")}]`;
      return outcome.reply === undefined ? memo : `${outcome.reply}\n\n${memo}`;
    }
    case "plan_refused":
      return `[nothing done: plan_refused ${outcome.reason}]`;
    case "error":
      return "[nothing done: error]";
  }
}
