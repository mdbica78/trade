import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { listFieldsForEtf } from "@/lib/config/tracked-fields";
import { loadOrError } from "@/lib/log/load-error";
import { TrackedFieldsAdmin, type TrackedFieldsAdminProps } from "@/components/admin/TrackedFieldsAdmin";
import { moveFieldAction, trackFieldAction, untrackFieldAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EtfFieldsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const loaded = await loadOrError("admin/etf-fields", () => listFieldsForEtf(symbol, createEtfConfigDeps(getDb())));

  // Outside the try/catch above: notFound() works by throwing, and must never be swallowed
  // into the error state (US-018 plan R1 pattern).
  if (loaded.status === "error") {
    return <TrackedFieldsAdmin status="error" />;
  }
  if (loaded.value === null) notFound();

  const props: TrackedFieldsAdminProps = {
    status: "ok",
    view: loaded.value,
    actions: { track: trackFieldAction, untrack: untrackFieldAction, move: moveFieldAction },
  };
  return <TrackedFieldsAdmin {...props} />;
}
