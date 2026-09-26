import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { listEtfs, registeredAdapterKeys } from "@/lib/config/etfs";
import { EtfAdmin, type EtfAdminProps } from "@/components/admin/EtfAdmin";
import { addEtfAction, redetectEtfAdapterAction, setEtfActiveAction, setEtfAdapterAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function loadEtfAdminProps(): Promise<EtfAdminProps> {
  try {
    const deps = createEtfConfigDeps(getDb());
    const etfs = await listEtfs(deps);
    const adapterKeys = registeredAdapterKeys(deps);
    return {
      status: "ok",
      etfs,
      adapterKeys,
      actions: {
        add: addEtfAction,
        setActive: setEtfActiveAction,
        setAdapter: setEtfAdapterAction,
        redetect: redetectEtfAdapterAction,
      },
    };
  } catch {
    // AC9: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function AdminEtfsPage() {
  const props = await loadEtfAdminProps();
  return <EtfAdmin {...props} />;
}
