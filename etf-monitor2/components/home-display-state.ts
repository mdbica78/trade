import { comparePanelColumns } from "@/lib/monitoring/panel-order";
import type { HomeDisplayPanelModel } from "@/lib/monitoring/home";
import type { HomeDisplay } from "@/lib/config/home-display";

export type HomeDisplaySaveInput = {
  showAbsolute: boolean;
  showPercent: boolean;
  showArrow: boolean;
  columns: readonly {
    fieldKey: string;
    position: number;
    showAbsolute: boolean | null;
    showPercent: boolean | null;
    showArrow: boolean | null;
  }[];
  etfs: readonly { etfId: number; visible: boolean }[];
};

export type HomeDisplayActionResult =
  | { ok: true; display: HomeDisplay }
  | { ok: false; error: string };

export type HomeDisplaySwitch = "showAbsolute" | "showPercent" | "showArrow";

export function toggleHomeDisplayEtf(
  state: HomeDisplayPanelModel,
  etfId: number,
): HomeDisplayPanelModel {
  return {
    ...state,
    etfs: state.etfs.map((etf) =>
      etf.etfId === etfId ? { ...etf, visible: !etf.visible } : etf,
    ),
  };
}

export function toggleHomeDisplayColumn(
  state: HomeDisplayPanelModel,
  fieldKey: string,
): HomeDisplayPanelModel {
  const target = state.columns.find((column) => column.fieldKey === fieldKey);
  if (target === undefined) return state;
  const visible = !target.visible;
  const selected = state.columns.filter((column) => column.visible && column.fieldKey !== fieldKey);
  if (visible) selected.push({ ...target, visible: true });
  const selectedColumns = selected.map((column, position) => ({ ...column, position }));
  const remaining = state.columns
    .filter((column) => column.fieldKey === fieldKey ? !visible : !column.visible)
    .map((column) => ({ ...column, visible: false, position: null }))
    .sort(comparePanelColumns);
  return { ...state, columns: [...selectedColumns, ...remaining] };
}

export function toggleHomeDisplaySwitch(
  state: HomeDisplayPanelModel,
  switchName: HomeDisplaySwitch,
): HomeDisplayPanelModel {
  return { ...state, [switchName]: !state[switchName] };
}

export function toHomeDisplaySaveInput(state: HomeDisplayPanelModel): HomeDisplaySaveInput {
  return {
    showAbsolute: state.showAbsolute,
    showPercent: state.showPercent,
    showArrow: state.showArrow,
    columns: state.columns
      .filter((column) => column.visible)
      .map((column, position) => ({
        fieldKey: column.fieldKey,
        position,
        showAbsolute: column.showAbsolute,
        showPercent: column.showPercent,
        showArrow: column.showArrow,
      })),
    etfs: state.etfs.map(({ etfId, visible }) => ({ etfId, visible })),
  };
}

export function panelModelFromSave(
  previous: Pick<HomeDisplayPanelModel, "columns">,
  saved: HomeDisplay,
): HomeDisplayPanelModel {
  const savedColumns = new Map(saved.columns.map((column) => [column.fieldKey, column]));
  const catalogueOrders = new Map(previous.columns.map((column) => [column.fieldKey, column.catalogueOrder]));
  const columns = saved.catalogue.map((field) => {
    const configured = savedColumns.get(field.fieldKey);
    return {
      ...field,
      visible: configured !== undefined,
      position: configured?.position ?? null,
      catalogueOrder: catalogueOrders.get(field.fieldKey) ?? Number.MAX_SAFE_INTEGER,
      showAbsolute: configured?.showAbsolute ?? null,
      showPercent: configured?.showPercent ?? null,
      showArrow: configured?.showArrow ?? null,
    };
  }).sort(comparePanelColumns);
  return {
    saved: saved.saved,
    showAbsolute: saved.showAbsolute,
    showPercent: saved.showPercent,
    showArrow: saved.showArrow,
    etfs: saved.etfs,
    columns,
  };
}
