import type { getTranslations } from "next-intl/server";
import type { HealthStatus } from "@/lib/health";

type Translator = Awaited<ReturnType<typeof getTranslations<"Health">>>;
type FailureStatus = Extract<HealthStatus, { dbConnected: false }>;

export function failureText(status: FailureStatus, t: Translator): string {
  if ("timedOut" in status) {
    return t("dbTimeout");
  }
  if ("error" in status) {
    return t("dbError", { message: status.error });
  }
  const _exhaustive: never = status;
  throw new Error(`Unhandled HealthStatus failure member: ${JSON.stringify(_exhaustive)}`);
}
