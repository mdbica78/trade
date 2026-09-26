import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { listFieldsForEtf } from "@/lib/config/tracked-fields";
import { TrackedFieldsAdmin, type TrackedFieldsAdminProps } from "@/components/admin/TrackedFieldsAdmin";
import { moveFieldAction, trackFieldAction, untrackFieldAction } from "./actions";

export const dynamic = "force-dynamic";

type Loaded = { status: "ok"; view: NonNullable<Awaited<ReturnType<typeof listFieldsForEtf>>> } | { status: "notFound" } | { status: "error" };

async function load(symbol: string): Promise<Loaded> {
  try {
    const view = await listFieldsForEtf(symbol, createEtfConfigDeps(getDb()));
    return view ? { status: "ok", view } : { status: "notFound" };
  } catch {
    // AC8: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function EtfFieldsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const loaded = await load(symbol);

  // Outside the try/catch above: notFound() works by throwing, and must never be swallowed
  // into the error state (US-018 plan R1 pattern).
  if (loaded.status === "notFound") {
    notFound();
  }

  const props: TrackedFieldsAdminProps =
    loaded.status === "ok"
      ? {
          status: "ok",
          symbol: loaded.view.etf.symbol,
          view: loaded.view,
          actions: { track: trackFieldAction, untrack: untrackFieldAction, move: moveFieldAction },
        }
      : { status: "error" };

  return <TrackedFieldsAdmin {...props} />;
}
