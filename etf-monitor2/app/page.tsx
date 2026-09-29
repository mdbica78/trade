import { getDb } from "@/lib/db";
import { createHomeTableLoader } from "@/lib/monitoring/home";
import { logLoadError } from "@/lib/log/load-error";
import { HomeTable, type HomeTableProps } from "@/components/HomeTable";

async function loadHomeTableProps(): Promise<HomeTableProps> {
  try {
    const viewModel = await createHomeTableLoader(getDb())();
    return { status: "ok", viewModel };
  } catch (error) {
    // AC9: never render the exception (it can carry connection details, AGENTS.md secrets rule).
    logLoadError("home", error);
    return { status: "error" };
  }
}

export default async function Home() {
  const props = await loadHomeTableProps();

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6">
      <main className="w-full max-w-[1000px]">
        <div data-table-scroll="">
          <HomeTable {...props} />
        </div>
      </main>
    </div>
  );
}
