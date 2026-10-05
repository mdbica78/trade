import { getDb } from "@/lib/db";
import { createOperationsLoader } from "@/lib/admin/operations";
import { loadOrError } from "@/lib/log/load-error";
import { OperationsDashboard, type OperationsDashboardProps } from "@/components/admin/OperationsDashboard";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const loaded = await loadOrError("admin/operations", () => createOperationsLoader(getDb())());
  const props: OperationsDashboardProps =
    loaded.status === "ok" ? { status: "ok", view: loaded.value } : { status: "error" };
  return <OperationsDashboard {...props} />;
}
