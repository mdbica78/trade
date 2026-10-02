import { getDb } from "@/lib/db";
import { createHomeTableLoader } from "@/lib/monitoring/home";
import { logLoadError } from "@/lib/log/load-error";
import type { HomeTableProps } from "@/components/HomeTable";
import { HomePageBody } from "@/components/HomePageBody";
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
    <HomePageBody
      tableProps={props}
      customization={props.status === "ok" ? props.viewModel.customization ?? EMPTY_CUSTOMIZATION : EMPTY_CUSTOMIZATION}
      saveAction={saveHomeDisplayAction}
    />
  );
}
