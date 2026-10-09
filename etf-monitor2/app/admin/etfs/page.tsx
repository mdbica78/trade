import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { listEtfs, registeredAdapterKeys } from "@/lib/config/etfs";
import { loadOrError } from "@/lib/log/load-error";
import { EtfAdmin, type EtfAdminProps } from "@/components/admin/EtfAdmin";
import { addEtfAction, redetectEtfAdapterAction, setEtfActiveAction, setEtfAdapterAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function loadEtfAdminProps(selectedSymbol: string | undefined): Promise<EtfAdminProps> {
  const result = await loadOrError("admin/etfs", async () => {
    const deps = createEtfConfigDeps(getDb());
    const etfs = await listEtfs(deps);
    const adapterKeys = registeredAdapterKeys(deps);
    return {
      status: "ok" as const,
      etfs,
      adapterKeys,
      selectedSymbol,
      actions: {
        add: addEtfAction,
        setActive: setEtfActiveAction,
        setAdapter: setEtfAdapterAction,
        redetect: redetectEtfAdapterAction,
      },
    };
  });
  return result.status === "ok" ? result.value : { status: "error" };
}

export default async function AdminEtfsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string | string[] }>;
}) {
  const symbolParam = (await searchParams)?.symbol;
  const props = await loadEtfAdminProps(Array.isArray(symbolParam) ? symbolParam[0] : symbolParam);
  return <EtfAdmin {...props} />;
}
