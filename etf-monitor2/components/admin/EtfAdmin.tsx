import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EtfListItem } from "@/lib/config/etfs";
import type { AdminAction } from "./action-state";
import { ActionForm } from "./ActionForm";

export type EtfAdminActions = {
  add: AdminAction;
  setActive: AdminAction;
  setAdapter: AdminAction;
  redetect: AdminAction;
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
    <div className="flex flex-col gap-6">
      <div>
        <h2>{t("heading")}</h2>

        {etfs.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
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
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
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
    </div>
  );
}
