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
  | {
      status: "ok";
      etfs: readonly EtfListItem[];
      adapterKeys: readonly string[];
      actions: EtfAdminActions;
      /** Raw `?symbol=` value; unknown or absent falls back to the first ETF. */
      selectedSymbol?: string;
    };

export function EtfAdmin(props: EtfAdminProps) {
  const t = useTranslations("Admin.etfs");

  if (props.status === "error") {
    return <p role="alert">{t("loadError")}</p>;
  }

  const { etfs, adapterKeys, actions, selectedSymbol } = props;
  const wanted = selectedSymbol?.trim().toUpperCase();
  const selected = etfs.find((etf) => etf.symbol === wanted) ?? etfs[0];

  return (
    <div className="flex flex-col gap-6">
      <h2>{t("heading")}</h2>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4" data-etf-panel>
          {selected === undefined ? (
            <p>{t("empty")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <form method="get" className="flex flex-wrap items-end gap-2">
                <label>
                  {t("selectLabel")}
                  <select name="symbol" defaultValue={selected.symbol}>
                    {etfs.map((etf) => (
                      <option key={etf.symbol} value={etf.symbol}>
                        {etf.symbol}
                        {etf.isActive ? "" : ` (${t("inactive")})`}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">{t("selectSubmit")}</button>
              </form>

              <div data-etf-details={selected.symbol}>
                <h3>{t("detailsHeading")}</h3>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
                  <dt className="text-[var(--muted)]">{t("symbolColumn")}</dt>
                  <dd>{selected.symbol}</dd>
                  <dt className="text-[var(--muted)]">{t("nameColumn")}</dt>
                  <dd>{selected.name}</dd>
                  <dt className="text-[var(--muted)]">{t("statusColumn")}</dt>
                  <dd className={selected.isActive ? "text-[var(--gain)]" : "text-[var(--muted)]"}>
                    {selected.isActive ? t("active") : t("inactive")}
                  </dd>
                  <dt className="text-[var(--muted)]">{t("adapterColumn")}</dt>
                  <dd>
                    {selected.adapterKey === null
                      ? t("adapterNone")
                      : selected.adapterAvailable
                        ? selected.adapterKey
                        : `${selected.adapterKey} (${t("adapterNotRegistered")})`}
                  </dd>
                </dl>
              </div>

              <div>
                <h3>{t("actionsColumn")}</h3>
                <ActionForm
                  action={actions.setActive}
                  submitLabel={selected.isActive ? t("remove") : t("activate")}
                >
                  <input type="hidden" name="symbol" value={selected.symbol} />
                  <input type="hidden" name="active" value={selected.isActive ? "false" : "true"} />
                </ActionForm>
                <ActionForm action={actions.setAdapter} submitLabel={t("setAdapterSubmit")}>
                  <input type="hidden" name="symbol" value={selected.symbol} />
                  <label>
                    {t("adapterLabel")}
                    <select
                      name="adapterKey"
                      defaultValue={selected.adapterAvailable ? (selected.adapterKey ?? "") : ""}
                    >
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
                  <input type="hidden" name="symbol" value={selected.symbol} />
                </ActionForm>
                <Link href={`/admin/etfs/${encodeURIComponent(selected.symbol)}/fields`}>{t("fieldsLink")}</Link>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
          <h3>{t("addHeading")}</h3>
          <p className="mb-2 text-sm text-[var(--muted)]">{t("addHint")}</p>
          <ActionForm action={actions.add} submitLabel={t("addSubmit")}>
            <label>
              {t("symbolLabel")}
              <input type="text" name="symbol" autoComplete="off" autoCapitalize="characters" />
            </label>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
