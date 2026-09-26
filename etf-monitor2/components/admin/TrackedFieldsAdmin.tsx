import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { TrackedFieldsView } from "@/lib/config/tracked-fields";
import type { AdminActionState } from "./action-state";
import { ActionForm } from "./ActionForm";

export type TrackedFieldsActions = {
  track: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  untrack: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  move: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
};

export type TrackedFieldsAdminProps =
  | { status: "error" }
  | { status: "ok"; symbol: string; view: TrackedFieldsView; actions: TrackedFieldsActions };

const KNOWN_UNITS = ["RON", "count"] as const;

export function TrackedFieldsAdmin(props: TrackedFieldsAdminProps) {
  const t = useTranslations("Admin.fields");
  const locale = useLocale();

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { view, actions } = props;
  const label = (item: { labelRo: string; labelEn: string }) => (locale === "ro" ? item.labelRo : item.labelEn);
  const unitLabel = (unit: string | null) =>
    unit === null
      ? t("units.none")
      : (KNOWN_UNITS as readonly string[]).includes(unit)
        ? t(`units.${unit as (typeof KNOWN_UNITS)[number]}`)
        : unit;

  const notTrackedAvailable = view.available.filter((f) => !f.tracked);
  const anyFlagged = view.tracked.some((f) => !f.available);
  const lastPosition = view.tracked.length;

  return (
    <div>
      <h2>{t("heading", { symbol: view.etf.symbol })}</h2>
      <p>
        <Link href="/admin/etfs">{t("backLink")}</Link>
      </p>

      {!view.etf.adapterAvailable ? <p>{t("noAdapter")}</p> : null}

      <p>{t("orderNote")}</p>
      <p>{t("nextRunNote")}</p>
      {anyFlagged ? <p>{t("notAvailableNote")}</p> : null}

      <h3>{t("trackedHeading")}</h3>
      {view.tracked.length === 0 ? (
        <p>{t("emptyTracked")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("positionColumn")}</th>
              <th>{t("fieldColumn")}</th>
              <th>{t("unitColumn")}</th>
              <th>{t("actionsColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {view.tracked.map((field) => (
              <tr key={field.fieldKey}>
                <td>{field.position}</td>
                <td>
                  {label(field)}
                  {!field.available ? ` (${t("notAvailable")})` : null}
                </td>
                <td>{unitLabel(field.unit)}</td>
                <td>
                  <ActionForm action={actions.untrack} submitLabel={t("untrack")}>
                    <input type="hidden" name="symbol" value={view.etf.symbol} />
                    <input type="hidden" name="fieldKey" value={field.fieldKey} />
                  </ActionForm>
                  {field.available && field.position > 1 ? (
                    <ActionForm action={actions.move} submitLabel={t("moveUp")}>
                      <input type="hidden" name="symbol" value={view.etf.symbol} />
                      <input type="hidden" name="fieldKey" value={field.fieldKey} />
                      <input type="hidden" name="direction" value="up" />
                    </ActionForm>
                  ) : null}
                  {field.available && field.position < lastPosition ? (
                    <ActionForm action={actions.move} submitLabel={t("moveDown")}>
                      <input type="hidden" name="symbol" value={view.etf.symbol} />
                      <input type="hidden" name="fieldKey" value={field.fieldKey} />
                      <input type="hidden" name="direction" value="down" />
                    </ActionForm>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view.etf.adapterAvailable ? (
        <>
          <h3>{t("availableHeading")}</h3>
          {notTrackedAvailable.length === 0 ? (
            <p>{t("emptyAvailable")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("fieldColumn")}</th>
                  <th>{t("unitColumn")}</th>
                  <th>{t("actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {notTrackedAvailable.map((field) => (
                  <tr key={field.fieldKey}>
                    <td>{label(field)}</td>
                    <td>{unitLabel(field.unit)}</td>
                    <td>
                      <ActionForm action={actions.track} submitLabel={t("track")}>
                        <input type="hidden" name="symbol" value={view.etf.symbol} />
                        <input type="hidden" name="fieldKey" value={field.fieldKey} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </div>
  );
}
