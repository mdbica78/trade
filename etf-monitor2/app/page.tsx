import { getDb } from "@/lib/db";
import { createHomeTableLoader } from "@/lib/monitoring/home";
import { logLoadError } from "@/lib/log/load-error";
import { HomeTable, type HomeTableProps } from "@/components/HomeTable";
import { HomeCustomizePanel } from "@/components/HomeCustomizePanel";
import type { HomeDisplayPanelModel } from "@/lib/monitoring/home";
import { saveHomeDisplayAction } from "./home-display-actions";

const EMPTY_CUSTOMIZATION: HomeDisplayPanelModel = {
  saved: false,
  showAbsolute: true,
  showPercent: true,
  showArrow: true,
  etfs: [],
  columns: [],
};

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
        <HomeCustomizePanel
          initial={props.status === "ok" ? props.viewModel.customization ?? EMPTY_CUSTOMIZATION : EMPTY_CUSTOMIZATION}
          saveAction={saveHomeDisplayAction}
        />
        <div data-table-scroll="">
          <HomeTable {...props} />
        </div>
      </main>
    </div>
  );
}
