import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../../messages/en.json";
import ro from "../../../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { TrackedFieldsView } from "@/lib/config/tracked-fields";

let mockListFieldsForEtf: (symbol: string) => Promise<TrackedFieldsView | null>;
let notFoundCalls = 0;

const NOT_FOUND_SENTINEL = new Error("NEXT_NOT_FOUND_SENTINEL");

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createEtfConfigDeps: () => ({}) }));
vi.mock("@/lib/config/tracked-fields", () => ({
  listFieldsForEtf: (symbol: string) => mockListFieldsForEtf(symbol),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundCalls += 1;
    throw NOT_FOUND_SENTINEL;
  },
}));
vi.mock("./actions", () => ({
  trackFieldAction: vi.fn(),
  untrackFieldAction: vi.fn(),
  moveFieldAction: vi.fn(),
}));

afterEach(() => {
  notFoundCalls = 0;
});

async function renderFieldsPage(locale: Locale, messages: typeof ro | typeof en, symbol = "BTBETRETF") {
  const { default: EtfFieldsPage } = await import("./page");
  const element = await EtfFieldsPage({ params: Promise.resolve({ symbol }) });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

const availableView: TrackedFieldsView = {
  etf: { symbol: "BTBETRETF", name: "BT Index", adapterKey: "brd-depositary", adapterAvailable: true, isActive: true },
  available: [
    { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset", unit: "RON", tracked: false, position: null },
    { fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit", unit: "RON", tracked: true, position: 1 },
  ],
  tracked: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit", unit: "RON", position: 1, available: true }],
};

describe("EtfFieldsPage (FP)", () => {
  it("FP-1: en render shows the English label, unit and track control for an available untracked field", async () => {
    mockListFieldsForEtf = async () => availableView;
    const html = await renderFieldsPage("en", en);
    expect(html).toContain("Net asset");
    expect(html).toContain(en.Admin.fields.units.RON);
    expect(html).toContain(en.Admin.fields.track);
    expect(html).toContain(en.Admin.fields.trackedHeading);
  });

  it("FP-2: ro render shows the Romanian label and never the English one", async () => {
    mockListFieldsForEtf = async () => availableView;
    const roHtml = await renderFieldsPage("ro", ro);
    expect(roHtml).toContain("Activ net");
    expect(roHtml).not.toContain("Net asset");
    const enHtml = await renderFieldsPage("en", en);
    expect(enHtml).not.toContain("Activ net");
  });

  it("FP-3: no-adapter ETF shows the translated message, no track control, and the flagged field with only untrack", async () => {
    const noAdapterView: TrackedFieldsView = {
      etf: { symbol: "BTBETRETF", name: "BT Index", adapterKey: null, adapterAvailable: false, isActive: true },
      available: [],
      tracked: [{ fieldKey: "nav_per_unit", labelRo: "nav_per_unit", labelEn: "nav_per_unit", unit: null, position: 1, available: false }],
    };
    mockListFieldsForEtf = async () => noAdapterView;
    const html = await renderFieldsPage("en", en);
    expect(html).toContain(en.Admin.fields.noAdapter);
    expect(html).toContain(en.Admin.fields.notAvailableNote);
    expect(html).toContain(en.Admin.fields.untrack);
    expect(html).not.toContain(en.Admin.fields.track + "<");
    expect(html).not.toContain(en.Admin.fields.moveUp);
    expect(html).not.toContain(en.Admin.fields.moveDown);
  });

  it("FP-4: unknown symbol calls notFound exactly once, outside the try/catch", async () => {
    mockListFieldsForEtf = async () => null;
    await expect(renderFieldsPage("en", en, "NOPE")).rejects.toThrow(NOT_FOUND_SENTINEL);
    expect(notFoundCalls).toBe(1);
  });

  it("FP-5: a database error gives a translated message, no secret-shaped text, notFound not called", async () => {
    mockListFieldsForEtf = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };
    const html = await renderFieldsPage("en", en);
    expect(html).toContain(en.Admin.fields.loadError);
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("secret");
    expect(notFoundCalls).toBe(0);
  });

  it("FP-6: exports force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
