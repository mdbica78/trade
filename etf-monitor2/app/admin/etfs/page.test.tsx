import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { EtfListItem } from "@/lib/config/etfs";

let mockListEtfs: () => Promise<EtfListItem[]>;
let mockAdapterKeys: string[];

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createEtfConfigDeps: () => ({}) }));
vi.mock("@/lib/config/etfs", () => ({
  listEtfs: () => mockListEtfs(),
  registeredAdapterKeys: () => mockAdapterKeys,
}));
vi.mock("./actions", () => ({
  addEtfAction: vi.fn(),
  setEtfActiveAction: vi.fn(),
  setEtfAdapterAction: vi.fn(),
  redetectEtfAdapterAction: vi.fn(),
}));

async function renderPage(locale: Locale, messages: typeof ro | typeof en) {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Admin ETFs page (PG)", () => {
  it("PG-2/PG-3: shows adapter key, none marker, unregistered marker and active/inactive states", async () => {
    mockAdapterKeys = ["brd-depositary"];
    mockListEtfs = async () => [
      { symbol: "BTBETRETF", name: "BT Index", adapterKey: "brd-depositary", adapterAvailable: true, isActive: true },
      { symbol: "ZZZETF", name: "Z fund", adapterKey: null, adapterAvailable: false, isActive: false },
      { symbol: "AAAETF", name: "A fund", adapterKey: "old-adapter", adapterAvailable: false, isActive: true },
    ];

    const enHtml = await renderPage("en", en);
    expect(enHtml).toContain("BTBETRETF");
    expect(enHtml).toContain("brd-depositary");
    expect(enHtml).toContain(en.Admin.etfs.adapterNone);
    expect(enHtml).toContain(en.Admin.etfs.adapterNotRegistered);
    expect(enHtml).toContain(en.Admin.etfs.active);
    expect(enHtml).toContain(en.Admin.etfs.inactive);

    const roHtml = await renderPage("ro", ro);
    expect(roHtml).toContain(ro.Admin.etfs.adapterNone);
  });

  it("EA-1: each row links to /admin/etfs/<SYMBOL>/fields with the translated label", async () => {
    mockAdapterKeys = ["brd-depositary"];
    mockListEtfs = async () => [
      { symbol: "BTBETRETF", name: "BT Index", adapterKey: "brd-depositary", adapterAvailable: true, isActive: true },
    ];

    const enHtml = await renderPage("en", en);
    expect(enHtml).toContain('href="/admin/etfs/BTBETRETF/fields"');
    expect(enHtml).toContain(en.Admin.etfs.fieldsLink);

    const roHtml = await renderPage("ro", ro);
    expect(roHtml).toContain('href="/admin/etfs/BTBETRETF/fields"');
    expect(roHtml).toContain(ro.Admin.etfs.fieldsLink);
  });

  it("PG-4: shows the translated empty-state message when there are no ETFs", async () => {
    mockAdapterKeys = [];
    mockListEtfs = async () => [];
    const html = await renderPage("en", en);
    expect(html).toContain(en.Admin.etfs.empty);
  });

  it("PG-5/AC9: shows a translated error message and never the raw exception when the database read throws", async () => {
    mockAdapterKeys = [];
    mockListEtfs = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };
    const html = await renderPage("en", en);
    expect(html).toContain(en.Admin.etfs.loadError);
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("secret");
  });

  it("PG-6: ro and en renders never contain the other locale's differing text", async () => {
    mockAdapterKeys = [];
    mockListEtfs = async () => [];
    const roHtml = await renderPage("ro", ro);
    const enHtml = await renderPage("en", en);
    expect(roHtml).not.toContain(en.Admin.etfs.empty);
    expect(enHtml).not.toContain(ro.Admin.etfs.empty);
  });

  it("PG-7: exports force-dynamic and maxDuration = 60", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
    expect(mod.maxDuration).toBe(60);
  });
});
