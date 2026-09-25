import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { createEtfHistoryLoader } from "@/lib/monitoring/history";
import { EtfDetail, type EtfDetailProps } from "@/components/EtfDetail";

type Loaded = { status: "ok"; history: NonNullable<Awaited<ReturnType<ReturnType<typeof createEtfHistoryLoader>>>> } | { status: "notFound" } | { status: "error" };

async function load(symbol: string): Promise<Loaded> {
  try {
    const history = await createEtfHistoryLoader(getDb())(symbol);
    return history ? { status: "ok", history } : { status: "notFound" };
  } catch {
    // AC6: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function EtfDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const loaded = await load(symbol);

  // Outside the try/catch above: notFound() works by throwing, and must never be swallowed
  // into the error state (US-018 plan R1).
  if (loaded.status === "notFound") {
    notFound();
  }

  const detailProps: EtfDetailProps = loaded.status === "ok" ? loaded : { status: "error" };

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <main className="w-full max-w-5xl">
        <EtfDetail {...detailProps} />
      </main>
    </div>
  );
}
