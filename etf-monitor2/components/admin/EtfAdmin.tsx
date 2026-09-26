import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EtfListItem } from "@/lib/config/etfs";
import type { AdminActionState } from "./action-state";
import { ActionForm } from "./ActionForm";

export type EtfAdminActions = {
  add: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  setActive: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  setAdapter: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  redetect: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
};

export type EtfAdminProps =
  | { status: "error" }
  | { status: "ok"; etfs: readonly EtfListItem[]; adapterKeys: readonly string[]; actions: EtfAdminActions };

export function EtfAdmin(props: EtfAdminProps) {
  const t = useTranslations("Admin.etfs");

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { etfs, adapterKeys, actions } = props;

  return (
    <div>
      <h2>{t("heading")}</h2>

      {etfs.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("symbolColumn")}</th>
              <th>{t("nameColumn")}</th>
              <th>{t("adapterColumn")}</th>
              <th>{t("statusColumn")}</th>
              <th>{t("actionsColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {etfs.map((etf) => (
              <tr key={etf.symbol}>
                <td>{etf.symbol}</td>
                <td>{etf.name}</td>
                <td>
                  {etf.adapterKey === null
                    ? t("adapterNone")
                    : etf.adapterAvailable
                      ? etf.adapterKey
                      : `${etf.adapterKey} (${t("adapterNotRegistered")})`}
                </td>
                <td>{etf.isActive ? t("active") : t("inactive")}</td>
                <td>
                  <ActionForm action={actions.setActive} submitLabel={etf.isActive ? t("remove") : t("activate")}>
                    <input type="hidden" name="symbol" value={etf.symbol} />
                    <input type="hidden" name="active" value={etf.isActive ? "false" : "true"} />
                  </ActionForm>
                  <ActionForm action={actions.setAdapter} submitLabel={t("setAdapterSubmit")}>
                    <input type="hidden" name="symbol" value={etf.symbol} />
                    <label>
                      {t("adapterLabel")}
                      <select name="adapterKey" defaultValue={etf.adapterAvailable ? etf.adapterKey ?? "" : ""}>
                        <option value="">{t("noneOption")}</option>
                        {adapterKeys.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </label>
                  </ActionForm>
                  <ActionForm action={actions.redetect} submitLabel={t("redetectSubmit")}>
                    <input type="hidden" name="symbol" value={etf.symbol} />
                  </ActionForm>
                  <Link href={`/admin/etfs/${encodeURIComponent(etf.symbol)}/fields`}>{t("fieldsLink")}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{t("addHeading")}</h3>
      <ActionForm action={actions.add} submitLabel={t("addSubmit")}>
        <label>
          {t("symbolLabel")}
          <input type="text" name="symbol" />
        </label>
        <label>
          {t("nameLabel")}
          <input type="text" name="name" />
        </label>
      </ActionForm>
    </div>
  );
}
