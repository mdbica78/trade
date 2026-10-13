import { getCronHour, setCronHour, type CronConfigDeps, type SetCronHourResult } from "./cron";

/** AC4 (US-064, DEC-031 §3). */
export const DEPLOY_HOOK_TIMEOUT_MS = 10_000;

export type RedeployResult = "applying" | "not_configured" | "failed";

/**
 * POSTs the Vercel Deploy Hook so the next build picks up a changed cron hour. Never throws, and
 * never lets the hook URL (a secret) reach a log line, a return value or a thrown error.
 */
export async function requestRedeploy(deps: {
  hookUrl: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<RedeployResult> {
  const hookUrl = deps.hookUrl;
  if (!hookUrl || hookUrl.trim() === "") {
    return "not_configured";
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEPLOY_HOOK_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(hookUrl, { method: "POST", signal: controller.signal, cache: "no-store" });
    if (response.ok) {
      return "applying";
    }
    console.error(`[admin/cron] deploy hook failed status=${response.status}`);
    return "failed";
  } catch (error) {
    const name = (error as { name?: unknown } | undefined)?.name;
    console.error(`[admin/cron] deploy hook failed name=${typeof name === "string" && /^[A-Za-z]\w{0,40}$/.test(name) ? name : "Error"}`);
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

export type SaveCronHourResult =
  | { ok: false; error: "invalid_hour" }
  | { ok: true; hour: number; apply: "unchanged" | RedeployResult };

/**
 * Saves the hour, then redeploys only if it actually changed (AC5). The save is never undone or
 * hidden by a hook failure: once `setCronHour` has resolved successfully, everything after it is
 * wrapped so it can only ever report `apply: "failed"`, never throw.
 */
export async function saveCronHourAndApply(
  input: unknown,
  deps: { config: CronConfigDeps; redeploy: () => Promise<RedeployResult> },
): Promise<SaveCronHourResult> {
  const previous = await getCronHour(deps.config);
  const result: SetCronHourResult = await setCronHour(input, deps.config);
  if (!result.ok) {
    return result;
  }
  if (previous === result.hour) {
    return { ok: true, hour: result.hour, apply: "unchanged" };
  }
  let apply: RedeployResult;
  try {
    apply = await deps.redeploy();
  } catch {
    apply = "failed";
  }
  return { ok: true, hour: result.hour, apply };
}
