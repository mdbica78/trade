import { getDb } from "@/lib/db";
import { createOperationsLoader } from "@/lib/admin/operations";
import { OperationsDashboard, type OperationsDashboardProps } from "@/components/admin/OperationsDashboard";

export const dynamic = "force-dynamic";

async function load(): Promise<OperationsDashboardProps> {
  try {
    const view = await createOperationsLoader(getDb())();
    return { status: "ok", view };
  } catch {
    // Never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function OperationsPage() {
  const props = await load();
  return <OperationsDashboard {...props} />;
}
