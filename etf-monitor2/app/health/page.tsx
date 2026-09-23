import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/lib/db";
import { getHealthStatus, type HealthStatus } from "@/lib/health";
import type { Locale } from "@/i18n/locale";

async function loadHealthStatus(): Promise<HealthStatus> {
  try {
    return await getHealthStatus(getDb());
  } catch (error) {
    return { dbConnected: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HealthPage() {
  const t = await getTranslations("Health");
  const locale = (await getLocale()) as Locale;
  const status = await loadHealthStatus();

  return (
    <div className="flex flex-1 flex-col items-center px-16 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-sm text-zinc-500">{t("database")}</dt>
            <dd>
              {status.dbConnected ? t("dbConnected") : t("dbUnreachable")}
            </dd>
            {!status.dbConnected && (
              <dd className="mt-1 text-sm text-red-600">{t("dbError", { message: status.error })}</dd>
            )}
          </div>

          {status.dbConnected && (
            <>
              <div>
                <dt className="text-sm text-zinc-500">{t("etfCount")}</dt>
                <dd>{status.etfCount}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">{t("fieldCatalogCount")}</dt>
                <dd>{status.fieldCatalogCount}</dd>
              </div>
            </>
          )}

          <div>
            <dt className="text-sm text-zinc-500">{t("locale")}</dt>
            <dd>{t(`localeName.${locale}`)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
