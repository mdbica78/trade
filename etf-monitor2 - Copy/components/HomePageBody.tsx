import { HomeTable, type HomeTableProps } from "./HomeTable";
import { HomeCustomizePanel } from "./HomeCustomizePanel";
import type { HomeDisplayPanelModel } from "@/lib/monitoring/home";
import type { toHomeDisplaySaveInput, HomeDisplayActionResult } from "./home-display-state";

export type HomePageBodyProps = {
  tableProps: HomeTableProps;
  customization: HomeDisplayPanelModel;
  saveAction: (input: ReturnType<typeof toHomeDisplaySaveInput>) => Promise<HomeDisplayActionResult>;
  /** Opens the Customize panel without a click (AC11's QA render harness only; default matches the live page). */
  initialOpen?: boolean;
};

/**
 * The whole home-page body (title row, Customize panel, table). Extracted so the QA render
 * harness (scripts/qa/render-home.ts, US-036 AC11) renders byte-identical markup to the real
 * page instead of a re-created copy.
 */
export function HomePageBody({ tableProps, customization, saveAction, initialOpen }: HomePageBodyProps) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6">
      <main className="w-full max-w-[1000px]">
        <HomeCustomizePanel initial={customization} initialOpen={initialOpen} saveAction={saveAction} />
        <div data-table-scroll="">
          <HomeTable {...tableProps} />
        </div>
      </main>
    </div>
  );
}
