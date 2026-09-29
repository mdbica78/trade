import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/lib/db";
import { getHealthStatus, type HealthStatus } from "@/lib/health";
import { logLoadError } from "@/lib/log/load-error";
import type { Locale } from "@/i18n/locale";
import { failureText } from "./failure-text";

async function loadHealthStatus(): Promise<HealthStatus> {
  try {
    return await getHealthStatus(getDb());
  } catch (error) {
    logLoadError("health", error);
    return { dbConnected: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HealthPage() {
  const t = await getTranslations("Health");
  const locale = (await getLocale()) as Locale;
  const status = await loadHealthStatus();

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${status.dbConnected ? "bg-[var(--gain)]" : "bg-[var(--loss)]"}`}
          />
          <h1 className="text-lg font-semibold">{t("title")}</h1>
        </div>

        <dl className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 text-sm">
            <dt className="text-[var(--muted)]">{t("database")}</dt>
            <dd className={`font-mono ${status.dbConnected ? "text-[var(--gain)]" : "text-[var(--loss)]"}`}>
              {status.dbConnected ? t("dbConnected") : t("dbUnreachable")}
            </dd>
          </div>
          {!status.dbConnected && (
            <dd className="-mt-2 text-sm text-[var(--loss)]">{failureText(status, t)}</dd>
          )}

          {status.dbConnected && (
            <>
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 text-sm">
                <dt className="text-[var(--muted)]">{t("etfCount")}</dt>
                <dd className="font-mono text-[var(--text)]">{status.etfCount}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 text-sm">
                <dt className="text-[var(--muted)]">{t("fieldCatalogCount")}</dt>
                <dd className="font-mono text-[var(--text)]">{status.fieldCatalogCount}</dd>
              </div>
              {status.schema.missingTables.length > 0 && (
                <div role="alert" className="text-sm text-[var(--loss)]">
                  <p>{t("schemaStale")}</p>
                  <ul>
                    {status.schema.missingTables.map((n) => (
                      <li key={n} data-missing-table={n}>
                        <code>{n}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between text-sm">
            <dt className="text-[var(--muted)]">{t("locale")}</dt>
            <dd className="text-[var(--text)]">{t(`localeName.${locale}`)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
