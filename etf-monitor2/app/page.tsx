import { getDb } from "@/lib/db";
import { createHomeTableLoader } from "@/lib/monitoring/home";
import { HomeTable, type HomeTableProps } from "@/components/HomeTable";

async function loadHomeTableProps(): Promise<HomeTableProps> {
  try {
    const viewModel = await createHomeTableLoader(getDb())();
    return { status: "ok", viewModel };
  } catch {
    // AC9: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    return { status: "error" };
  }
}

export default async function Home() {
  const props = await loadHomeTableProps();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <main className="w-full max-w-5xl">
        <HomeTable {...props} />
      </main>
    </div>
  );
}
