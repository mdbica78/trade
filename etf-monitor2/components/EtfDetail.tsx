import { useTranslations } from "next-intl";
import { HistoryTable } from "./HistoryTable";
import type { EtfHistory } from "@/lib/monitoring/history";

export type EtfDetailProps = { status: "error" } | { status: "ok"; history: EtfHistory };

/**
 * Presentational only — receives the loaded history as props (US-018 AC6/AC7), so it renders
 * without a database in tests, the same pattern as `HomeTable` (Sprint 1 audit W3: hooks cannot
 * be used in an async Server Component). `status: "error"` never shows the underlying exception
 * (AGENTS.md secrets rule / AC6): the caller (`app/etf/[symbol]/page.tsx`) is responsible for
 * catching it.
 */
export function EtfDetail(props: EtfDetailProps) {
  const t = useTranslations("EtfDetail");

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { etf, fields, rows } = props.history;

  return (
    <>
      <h1>
        {etf.symbol} <span>{etf.name}</span>
      </h1>
      {fields.length === 0 ? (
        <p>{t("noTrackedFields")}</p>
      ) : rows.length === 0 ? (
        <p>{t("noHistory")}</p>
      ) : (
        <HistoryTable fields={fields} rows={rows} />
      )}
    </>
  );
}
