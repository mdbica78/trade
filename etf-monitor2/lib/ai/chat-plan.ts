import { Buffer } from "node:buffer";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CONFIGURATION_ACTIONS, type ConfigurationIntent } from "./capabilities/configuration/intent";
import { WIDGET_ACTIONS } from "./capabilities/widgets/capability";
import type { WidgetIntent } from "./capabilities/widgets/intent";
import type { ConfigurationContext } from "./capabilities/configuration/context";
import type { WidgetContext } from "./capabilities/widgets/context";

export type PlannedAction =
  | { index: number; capability: "configuration"; intent: ConfigurationIntent }
  | { index: number; capability: "widgets"; intent: WidgetIntent };

/**
 * US-058 req. 1 (DEC-027 §4): any `remove_etf`/`untrack_field`, or widget_clear + widget_replace
 * together touching more than one distinct ETF, needs the user's confirmation before it runs.
 * A single-ETF clear/replace, and every add/track/widget_add/widget_update (incl. on `*`), does not.
 */
export function needsConfirmation(plan: readonly PlannedAction[]): boolean {
  const clearOrReplaceSymbols = new Set<string>();
  for (const action of plan) {
    if (action.capability === "configuration" && (action.intent.action === "remove_etf" || action.intent.action === "untrack_field")) {
      return true;
    }
    if (action.capability === "widgets" && (action.intent.action === "widget_clear" || action.intent.action === "widget_replace")) {
      clearOrReplaceSymbols.add(action.intent.symbol);
    }
  }
  return clearOrReplaceSymbols.size > 1;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = canonicalize(record[key]);
    return out;
  }
  return value;
}

/** A deterministic JSON string: object keys sorted recursively, array order preserved. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function planSymbols(plan: readonly PlannedAction[]): string[] {
  return [...new Set(plan.map((action) => action.intent.symbol))].sort();
}

/**
 * A SHA-256 hex digest of the state every plan symbol depends on (T-11): the active set, and per
 * plan symbol its active flag, tracked field keys and widgets (by slot). Replaying a confirmed
 * token against a fingerprint mismatch is refused as `state_changed`. An ETF that no longer exists
 * maps to `null`.
 */
export function planFingerprint(
  plan: readonly PlannedAction[],
  configuration: ConfigurationContext,
  widgets: WidgetContext,
): string {
  const activeSymbols = configuration.etfs
    .filter((etf) => etf.isActive)
    .map((etf) => etf.symbol)
    .sort();

  const etfsPayload: Record<string, unknown> = {};
  for (const symbol of planSymbols(plan)) {
    const etf = configuration.etfs.find((e) => e.symbol === symbol);
    if (etf === undefined) {
      etfsPayload[symbol] = null;
      continue;
    }
    const widgetState = widgets.etfs.find((w) => w.symbol === symbol);
    const sortedWidgets = [...(widgetState?.widgets ?? [])]
      .sort((a, b) => a.slot - b.slot)
      .map((w) => ({
        slot: w.slot,
        operation: w.operation,
        fieldKey: w.fieldKey,
        periodUnit: w.periodUnit,
        periodAmount: w.periodAmount,
        ...(w.title === undefined ? {} : { title: w.title }),
      }));
    etfsPayload[symbol] = {
      active: etf.isActive,
      tracked: etf.tracked.map((f) => f.fieldKey).sort(),
      widgets: sortedWidgets,
    };
  }

  return createHash("sha256")
    .update(canonicalJson({ active: activeSymbols, etfs: etfsPayload }))
    .digest("hex");
}

export const PLAN_TOKEN_VERSION = 1;
export const PLAN_TOKEN_TTL_MS = 600_000;
export const PLAN_TOKEN_MAX_CHARS = 64_000;

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/** Signs `{v, plan, fp, exp, n}` as `<base64url payload>.<base64url HMAC-SHA256 signature>`. `n` (a 16-byte nonce) is injectable for deterministic tests. */
export function signPlanToken(
  input: { plan: readonly PlannedAction[]; fp: string; exp: number; n?: string },
  key: Uint8Array,
): string {
  const n = input.n ?? base64url(randomBytes(16));
  const payload = canonicalJson({ v: PLAN_TOKEN_VERSION, plan: input.plan, fp: input.fp, exp: input.exp, n });
  const payloadSegment = base64url(Buffer.from(payload, "utf8"));
  const signature = createHmac("sha256", Buffer.from(key)).update(payloadSegment).digest();
  return `${payloadSegment}.${base64url(signature)}`;
}

export type PlanVerification =
  | { ok: true; plan: readonly PlannedAction[]; fp: string }
  | { ok: false; reason: "tampered" | "expired" };

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const FINGERPRINT_RE = /^[0-9a-f]{64}$/;

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlannedActionShape(value: unknown): value is PlannedAction {
  if (!isRecordLike(value)) return false;
  const index = value.index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 1) return false;
  const capability = value.capability;
  if (capability !== "configuration" && capability !== "widgets") return false;
  const intent = value.intent;
  if (!isRecordLike(intent)) return false;
  const closedActions: readonly string[] = capability === "configuration" ? CONFIGURATION_ACTIONS : WIDGET_ACTIONS;
  if (typeof intent.action !== "string" || !closedActions.includes(intent.action)) return false;
  return typeof intent.symbol === "string";
}

/**
 * Verifies a signed plan token (T-12). Order: type/length, exactly two base64url segments, HMAC
 * compare (`timingSafeEqual`, length checked first), JSON parse, then the payload shape
 * (`v === 1`, 64-hex `fp`, finite `exp`, string `n`, a non-empty `plan` whose items each pass a
 * shape guard) — only once all of that holds is `exp` compared against `nowMs`. Any failure before
 * that point is `tampered`, never `expired`: the signature is checked before expiry.
 */
export function verifyPlanToken(token: unknown, key: Uint8Array, nowMs: number): PlanVerification {
  if (typeof token !== "string" || token.length === 0 || token.length > PLAN_TOKEN_MAX_CHARS) {
    return { ok: false, reason: "tampered" };
  }
  const segments = token.split(".");
  if (segments.length !== 2) return { ok: false, reason: "tampered" };
  const [payloadSegment, signatureSegment] = segments as [string, string];
  if (!BASE64URL_RE.test(payloadSegment) || !BASE64URL_RE.test(signatureSegment)) {
    return { ok: false, reason: "tampered" };
  }

  const expectedSignature = createHmac("sha256", Buffer.from(key)).update(payloadSegment).digest();
  const actualSignature = Buffer.from(signatureSegment, "base64url");
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return { ok: false, reason: "tampered" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "tampered" };
  }
  if (!isRecordLike(parsed)) return { ok: false, reason: "tampered" };
  if (parsed.v !== PLAN_TOKEN_VERSION) return { ok: false, reason: "tampered" };
  const fp = parsed.fp;
  if (typeof fp !== "string" || !FINGERPRINT_RE.test(fp)) return { ok: false, reason: "tampered" };
  const exp = parsed.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return { ok: false, reason: "tampered" };
  if (typeof parsed.n !== "string") return { ok: false, reason: "tampered" };
  const plan = parsed.plan;
  if (!Array.isArray(plan) || plan.length === 0 || !plan.every(isPlannedActionShape)) {
    return { ok: false, reason: "tampered" };
  }

  if (exp <= nowMs) return { ok: false, reason: "expired" };

  return { ok: true, plan: plan as readonly PlannedAction[], fp };
}
