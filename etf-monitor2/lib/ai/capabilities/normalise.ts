import { isRecord, WIDGET_OPERATIONS, type WidgetOperation } from "../../config/widgets";
import type { ConfigurationContext } from "./configuration/context";

/** Closed, exported synonym table (DEC-025 §7). Each entry folds to its canonical operation. */
export const OPERATION_SYNONYMS: Readonly<Record<WidgetOperation, readonly string[]>> = {
  change: ["change", "difference", "delta"],
  percent_change: ["percent_change", "pct_change", "percentage_change", "percent", "pct"],
  average: ["average", "avg", "mean"],
  min: ["min", "minimum", "lowest"],
  max: ["max", "maximum", "highest"],
};

const DIGIT_ONLY_RE = /^\s*\d+\s*$/;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function foldOperationToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

type FieldIndex = { keys: ReadonlySet<string>; foldMap: ReadonlyMap<string, string | null> };

/** Union of every fieldKey/label over every context ETF (active and inactive), keyed by a folded form. */
function buildFieldIndex(context: ConfigurationContext): FieldIndex {
  const keys = new Set<string>();
  const foldMap = new Map<string, string | null>();
  const addCandidate = (candidate: string, key: string) => {
    const folded = fold(candidate);
    if (folded === "") return;
    const existing = foldMap.get(folded);
    if (existing === undefined) {
      foldMap.set(folded, key);
    } else if (existing !== key) {
      foldMap.set(folded, null);
    }
  };
  for (const etf of context.etfs) {
    for (const field of [...etf.available, ...etf.tracked]) {
      keys.add(field.fieldKey);
      addCandidate(field.fieldKey.replace(/_/g, " "), field.fieldKey);
      addCandidate(field.labelRo, field.fieldKey);
      addCandidate(field.labelEn, field.fieldKey);
    }
  }
  return { keys, foldMap };
}

function resolveFieldValue(value: unknown, index: FieldIndex): unknown {
  if (typeof value !== "string") return value;
  if (index.keys.has(value)) return value;
  const match = index.foldMap.get(fold(value));
  return typeof match === "string" ? match : value;
}

function normaliseNumberString(value: unknown): unknown {
  if (typeof value !== "string" || !DIGIT_ONLY_RE.test(value)) return value;
  return parseInt(value.trim(), 10);
}

function normalisePeriodUnit(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const folded = value.trim().toLowerCase();
  if (folded === "day" || folded === "days") return "days";
  if (folded === "report" || folded === "reports") return "reports";
  return value;
}

function normaliseOperation(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const folded = foldOperationToken(value);
  for (const operation of WIDGET_OPERATIONS) {
    if (OPERATION_SYNONYMS[operation].includes(folded)) return operation;
  }
  return value;
}

/** Normalises the known slip-prone keys of a definition-shaped record; never adds/removes a key. */
function normaliseDefinitionRecord(record: Record<string, unknown>, index: FieldIndex): Record<string, unknown> {
  const next: Record<string, unknown> = { ...record };
  if ("periodAmount" in next) next.periodAmount = normaliseNumberString(next.periodAmount);
  if ("periodUnit" in next) next.periodUnit = normalisePeriodUnit(next.periodUnit);
  if ("operation" in next) next.operation = normaliseOperation(next.operation);
  if ("fieldKey" in next) next.fieldKey = resolveFieldValue(next.fieldKey, index);
  return next;
}

/** `symbol`<->`etf` rename, only when exactly one of the two keys is present (PL-4). */
function renameEtfSymbolKey(raw: Record<string, unknown>): Record<string, unknown> {
  const hasEtf = "etf" in raw;
  const hasSymbol = "symbol" in raw;
  if (raw.capability === "widgets" && hasSymbol && !hasEtf) {
    const { symbol, ...rest } = raw;
    return { ...rest, etf: symbol };
  }
  if (raw.capability === "configuration" && hasEtf && !hasSymbol) {
    const { etf, ...rest } = raw;
    return { ...rest, symbol: etf };
  }
  return raw;
}

/**
 * Tolerant, closed-list normalisation of one parsed model action before strict validation
 * (DEC-025 §7). Pure: never mutates `raw`, never throws, never adds/removes a key other than the
 * `symbol`/`etf` rename, and never touches `capability`, `action`, `name`, `title` or the
 * `etf`/`symbol` value. Anything it cannot confidently resolve is left exactly as given, so the
 * strict validators downstream still reject it.
 */
export function normaliseModelAction(raw: unknown, context: ConfigurationContext): unknown {
  if (!isRecord(raw)) return raw;
  const index = buildFieldIndex(context);
  const renamed = renameEtfSymbolKey(raw);

  const next: Record<string, unknown> = { ...renamed };
  if ("slot" in next) next.slot = normaliseNumberString(next.slot);
  if ("field" in next) next.field = resolveFieldValue(next.field, index);
  if (isRecord(next.definition)) next.definition = normaliseDefinitionRecord(next.definition, index);
  if (isRecord(next.changes)) next.changes = normaliseDefinitionRecord(next.changes, index);
  if (isRecord(next.match)) next.match = normaliseDefinitionRecord(next.match, index);
  if (Array.isArray(next.definitions)) {
    next.definitions = next.definitions.map((entry) => (isRecord(entry) ? normaliseDefinitionRecord(entry, index) : entry));
  }
  return next;
}
