import { createHash, timingSafeEqual } from "node:crypto";
import type { DailyJobResult } from "./daily-job";

export type CronEnv = { cronSecret: string | undefined; databaseUrl: string | undefined };

export type DailyCronDeps = {
  readEnv: () => CronEnv;
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
  const nonEmpty = secrets.filter((s) => s.length > 0);
  return JSON.stringify(body, (_key, value) => {
    if (typeof value !== "string") {
      return value;
    }
    let redacted = value;
    for (const secret of nonEmpty) {
      redacted = redacted.split(secret).join("[redacted]");
    }
    return redacted;
  });
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

  let result: DailyJobResult;
  try {
    result = await deps.run({ secrets });
  } catch (error) {
    console.error("[cron/daily] run could not start:", error instanceof Error ? error.name : "error");
    return jsonResponse(500, { error: "run could not start" }, secrets);
  }

  if (result.kind === "aborted") {
    console.error("[cron/daily] run failed:", result.reason);
    return jsonResponse(500, { error: "run failed", jobRunId: result.jobRunId, status: result.status }, secrets);
  }

  return jsonResponse(200, { jobRunId: result.jobRunId, status: result.status, etfs: result.etfs }, secrets);
}
