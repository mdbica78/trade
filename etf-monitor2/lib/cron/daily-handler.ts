import { createHash, timingSafeEqual } from "node:crypto";
import { redactSecrets } from "../ingestion/job-run-summary";
import type { DailyJobResult } from "./daily-job";

export type CronEnv = { cronSecret: string | undefined; databaseUrl: string | undefined };

export type DailyCronDeps = {
  readEnv: () => CronEnv;
  now: () => Date;
  /** The effective schedule hour (UTC, 0–23): the saved setting, or the default when none is saved. */
  readCronHour: () => Promise<number>;
  run: (ctx: { secrets: readonly string[] }) => Promise<DailyJobResult>;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function isCorrectBearer(header: string | null, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`;
  return timingSafeEqual(digest(header ?? ""), digest(expected));
}

function redact(body: unknown, secrets: readonly string[]): string {
  return JSON.stringify(body, (_key, value) => (typeof value === "string" ? redactSecrets(value, secrets) : value));
}

function jsonResponse(status: number, body: unknown, secrets: readonly string[]): Response {
  return new Response(redact(body, secrets), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function handleDailyCron(request: Request, deps: DailyCronDeps): Promise<Response> {
  const env = deps.readEnv();
  const secrets = [env.cronSecret ?? "", env.databaseUrl ?? ""];

  if (env.cronSecret === undefined || env.cronSecret.trim() === "") {
    return jsonResponse(500, { error: "cron not configured" }, secrets);
  }

  const authorization = request.headers.get("authorization");
  if (!isCorrectBearer(authorization, env.cronSecret)) {
    return jsonResponse(401, { error: "unauthorized" }, secrets);
  }

  // Authenticated, but not yet the configured hour: no database write, no run row (DEC-030 §3/§4).
  let hour: number;
  try {
    hour = await deps.readCronHour();
  } catch (error) {
    console.error("[cron/daily] schedule could not be read:", error instanceof Error ? error.name : "error");
    return jsonResponse(500, { error: "run could not start" }, secrets);
  }
  if (deps.now().getUTCHours() < hour) {
    return jsonResponse(200, { skipped: "not_scheduled_hour" }, secrets);
  }

  let result: DailyJobResult;
  try {
    result = await deps.run({ secrets });
  } catch (error) {
    console.error("[cron/daily] run could not start:", error instanceof Error ? error.name : "error");
    return jsonResponse(500, { error: "run could not start" }, secrets);
  }

  if (result.kind === "skipped") {
    return jsonResponse(200, { skipped: result.reason }, secrets);
  }

  if (result.kind === "aborted") {
    console.error("[cron/daily] run failed:", result.reason);
    return jsonResponse(500, { error: "run failed", jobRunId: result.jobRunId, status: result.status }, secrets);
  }

  return jsonResponse(200, { jobRunId: result.jobRunId, status: result.status, etfs: result.etfs }, secrets);
}
