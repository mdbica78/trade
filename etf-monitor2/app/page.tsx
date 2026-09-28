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
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <main className="w-full max-w-6xl">
        <HomeTable {...props} />
      </main>
    </div>
  );
}
