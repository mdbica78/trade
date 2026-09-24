import { createHash, timingSafeEqual } from "node:crypto";
import type { DailyRunSummary } from "../ingestion/run-daily";

export type CronEnv = { cronSecret: string | undefined; databaseUrl: string | undefined };

export type DailyCronDeps = {
  readEnv: () => CronEnv;
  run: () => Promise<DailyRunSummary>;
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

  let summary: DailyRunSummary;
  try {
    summary = await deps.run();
  } catch (error) {
    console.error("[cron/daily] run could not start:", error instanceof Error ? error.name : "error");
    return jsonResponse(500, { error: "run could not start" }, secrets);
  }

  return jsonResponse(200, summary, secrets);
}
