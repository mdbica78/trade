import { defaultDailyCronDeps } from "@/lib/cron/default-deps";
import { handleDailyCron } from "@/lib/cron/daily-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleDailyCron(request, defaultDailyCronDeps);
}
