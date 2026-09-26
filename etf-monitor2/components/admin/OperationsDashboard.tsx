import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";
import { formatDateTime } from "@/lib/format/datetime";
import { formatNumber } from "@/lib/format/number";
import { formatReportDate } from "@/lib/format/date";
import { isKnownOutcomeCode } from "@/lib/admin/run-log";
import { isKnownReportStatus, isKnownRunStatus } from "@/lib/admin/operations";
import type { EtfOperationalStatus, NonOkReport, OperationsRun, OperationsView } from "@/lib/admin/operations";
import type { RunLogEntry } from "@/lib/admin/run-log";

export type OperationsDashboardProps = { status: "error" } | { status: "ok"; view: OperationsView };

const SAFE_URL_RE = /^https?:\/\//i;

function RunLogEntryRow({ entry, locale }: { entry: RunLogEntry; locale: Locale }) {
  const t = useTranslations("Admin.operations");

  if (entry.kind === "aborted") {
    return (
      <li data-log-entry="aborted">
        <span>{t("logAborted")}</span> <span>{entry.detail}</span>
      </li>
    );
  }
  if (entry.kind === "stale") {
    return <li data-log-entry="stale">{t("logStale")}</li>;
  }
  if (entry.kind === "unparsed") {
    return <li data-log-entry="unparsed">{entry.text}</li>;
  }

  const codeLabel = isKnownOutcomeCode(entry.code) ? t(`outcome.${entry.code}`) : entry.code;
  return (
    <li data-log-entry="etf">
      <span data-log-symbol="">{entry.symbol}</span>{" "}
      <span data-log-code="">{codeLabel}</span>{" "}
      {entry.reportDate !== undefined ? <span data-log-date="">{formatReportDate(entry.reportDate, locale)}</span> : null}{" "}
      <span>{t("detailLabel")}</span> <span data-log-detail="">{entry.detail}</span>
    </li>
  );
}

function RunRow({ run, locale }: { run: OperationsRun; locale: Locale }) {
  const t = useTranslations("Admin.operations");
  const statusLabel = isKnownRunStatus(run.status) ? t(`runStatus.${run.status}`) : run.status;
  const endState: "finished" | "did-not-finish" | "running" =
    run.status === "running" ? "running" : run.finishedAt === null ? "did-not-finish" : "finished";

  return (
    <tr data-run-id={run.id} data-run-end={endState}>
      <td>{formatDateTime(run.startedAt, locale)}</td>
      <td>
        {endState === "finished" && run.finishedAt !== null ? formatDateTime(run.finishedAt, locale) : null}
        {endState === "did-not-finish" ? t("didNotFinish") : null}
      </td>
      <td>{statusLabel}</td>
      <td>{run.etfsProcessed}</td>
      <td>{run.errorsCount}</td>
      <td>
        <ul>
          {run.log.entries.map((entry, index) => (
            <RunLogEntryRow key={index} entry={entry} locale={locale} />
          ))}
        </ul>
      </td>
    </tr>
  );
}

function EtfStatusRow({ etf, locale }: { etf: EtfOperationalStatus; locale: Locale }) {
  const t = useTranslations("Admin.operations");
  return (
    <tr data-etf-symbol={etf.symbol} data-adapter-missing={!etf.adapterAvailable}>
      <td>{etf.symbol}</td>
      <td>{etf.isActive ? t("active") : t("inactive")}</td>
      <td>{!etf.adapterAvailable ? t("adapterMissing") : null}</td>
      <td>
        {etf.lastOk === null
          ? t("never")
          : etf.lastOk.fetchedAt !== null
            ? t("lastSuccessValue", { date: formatReportDate(etf.lastOk.reportDate, locale), time: formatDateTime(etf.lastOk.fetchedAt, locale) })
            : t("lastSuccessDateOnly", { date: formatReportDate(etf.lastOk.reportDate, locale) })}
      </td>
    </tr>
  );
}

function ParseErrorRow({ report, locale }: { report: NonOkReport; locale: Locale }) {
  const t = useTranslations("Admin.operations");
  const statusLabel = isKnownReportStatus(report.status) ? t(`reportStatus.${report.status}`) : report.status;
  const safeUrl = report.sourceUrl !== null && SAFE_URL_RE.test(report.sourceUrl) ? report.sourceUrl : null;

  return (
    <tr data-report-id={report.id}>
      <td>{report.symbol}</td>
      <td>{formatReportDate(report.reportDate, locale)}</td>
      <td>{statusLabel}</td>
      <td>{report.errorMessage}</td>
      <td>{safeUrl !== null ? <a href={safeUrl} target="_blank" rel="noopener noreferrer">{t("pdfLink")}</a> : null}</td>
      <td>
        {report.values.length === 0 ? (
          t("noValues")
        ) : (
          <ul>
            {report.values.map((value) => (
              <li key={value.fieldKey}>
                {t("valueLine", {
                  label: locale === "ro" ? value.labelRo : value.labelEn,
                  value: value.numericValue === null ? t("noValue") : formatNumber(value.numericValue, locale),
                })}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

export function OperationsDashboard(props: OperationsDashboardProps) {
  const t = useTranslations("Admin.operations");
  const locale = useLocale() as Locale;

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { view } = props;

  return (
    <div>
      <h2>{t("heading")}</h2>

      <section>
        <h3>{t("runsHeading")}</h3>
        {view.runs.length === 0 ? (
          <p>{t("runsEmpty")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("startedColumn")}</th>
                <th>{t("finishedColumn")}</th>
                <th>{t("statusColumn")}</th>
                <th>{t("processedColumn")}</th>
                <th>{t("errorsColumn")}</th>
                <th>{t("logColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {view.runs.map((run) => (
                <RunRow key={run.id} run={run} locale={locale} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>{t("etfsHeading")}</h3>
        {view.etfs.length === 0 ? (
          <p>{t("etfsEmpty")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("symbolColumn")}</th>
                <th>{t("activeColumn")}</th>
                <th>{t("adapterColumn")}</th>
                <th>{t("lastSuccessColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {view.etfs.map((etf) => (
                <EtfStatusRow key={etf.symbol} etf={etf} locale={locale} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>{t("parseErrorsHeading")}</h3>
        {view.parseErrors.length === 0 ? (
          <p>{t("parseErrorsEmpty")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("symbolColumn")}</th>
                <th>{t("reportDateColumn")}</th>
                <th>{t("statusColumn")}</th>
                <th>{t("errorMessageColumn")}</th>
                <th>{t("pdfColumn")}</th>
                <th>{t("valuesColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {view.parseErrors.map((report) => (
                <ParseErrorRow key={report.id} report={report} locale={locale} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
