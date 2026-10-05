"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localizedLabel } from "@/lib/format/label";
import type { HomeDisplayPanelModel } from "@/lib/monitoring/home";
import {
  panelModelFromSave,
  toHomeDisplaySaveInput,
  toggleHomeDisplayColumn,
  toggleHomeDisplayEtf,
  toggleHomeDisplaySwitch,
  type HomeDisplayActionResult,
  type HomeDisplaySaveInput,
} from "./home-display-state";

type Props = {
  initial: HomeDisplayPanelModel;
  initialOpen?: boolean;
  saveAction: (input: HomeDisplaySaveInput) => Promise<HomeDisplayActionResult>;
};

export function HomeCustomizePanel({ initial, initialOpen = false, saveAction }: Props) {
  const t = useTranslations("HomeDisplay");
  const locale = useLocale();
  const [open, setOpen] = useState(initialOpen);
  const [draft, setDraft] = useState(initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(next: HomeDisplayPanelModel) {
    const previous = draft;
    setDraft(next);
    setSaveFailed(false);
    startTransition(async () => {
      try {
        const result = await saveAction(toHomeDisplaySaveInput(next));
        if (result.ok) {
          setDraft(panelModelFromSave(next, result.display));
        } else {
          setDraft(previous);
          setSaveFailed(true);
        }
      } catch {
        setDraft(previous);
        setSaveFailed(true);
      }
    });
  }

  return (
    <>
      <div className="home-title-row" data-home-title-row="">
        <h1>{t("title")}</h1>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="home-customize-panel"
          onClick={() => setOpen((current) => !current)}
        >
          {t("customizeView")}
        </button>
      </div>
      {open && (
        <section className="home-customize-panel" id="home-customize-panel" data-customize-panel="">
          <fieldset className="home-customize-group" disabled={isPending}>
            <legend>{t("etfsGroup")}</legend>
            {draft.etfs.map((etf) => (
              <label className="home-customize-option" key={etf.etfId}>
                <input
                  type="checkbox"
                  checked={etf.visible}
                  onChange={() => save(toggleHomeDisplayEtf(draft, etf.etfId))}
                />
                <span>{etf.symbol}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="home-customize-group" disabled={isPending}>
            <legend>{t("valuesGroup")}</legend>
            {draft.columns.map((column) => (
              <label className="home-customize-option" key={column.fieldKey}>
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => save(toggleHomeDisplayColumn(draft, column.fieldKey))}
                />
                <span>{localizedLabel(column, locale)}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="home-customize-group" disabled={isPending}>
            <legend>{t("changesGroup")}</legend>
            {([
              ["showAbsolute", "absolute"],
              ["showPercent", "percent"],
              ["showArrow", "arrow"],
            ] as const).map(([name, label]) => (
              <label className="home-customize-option" key={name}>
                <input
                  type="checkbox"
                  checked={draft[name]}
                  onChange={() => save(toggleHomeDisplaySwitch(draft, name))}
                />
                <span>{t(label)}</span>
              </label>
            ))}
          </fieldset>
          {saveFailed && <p role="alert">{t("saveError")}</p>}
        </section>
      )}
    </>
  );
}
