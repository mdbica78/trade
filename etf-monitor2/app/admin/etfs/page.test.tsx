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

async function renderPage(locale: Locale, messages: typeof ro | typeof en, symbol?: string | string[]) {
  const { default: Page } = await import("./page");
  const element = await Page({ searchParams: Promise.resolve(symbol === undefined ? {} : { symbol }) });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

const THREE_ETFS: EtfListItem[] = [
  { symbol: "BTBETRETF", name: "BT Index", adapterKey: "brd-depositary", adapterAvailable: true, isActive: true },
  { symbol: "ZZZETF", name: "Z fund", adapterKey: null, adapterAvailable: false, isActive: false },
  { symbol: "AAAETF", name: "A fund", adapterKey: "old-adapter", adapterAvailable: false, isActive: true },
];

describe("Admin ETFs page (PG)", () => {
  it("PG-2/PG-3: the selected ETF's panel shows its adapter, none marker, unregistered marker and state", async () => {
    mockAdapterKeys = ["brd-depositary"];
    mockListEtfs = async () => THREE_ETFS;

    const first = await renderPage("en", en);
    expect(first).toContain("BT Index");
    expect(first).toContain("brd-depositary");
    expect(first).toContain(en.Admin.etfs.active);

    const none = await renderPage("en", en, "ZZZETF");
    expect(none).toContain("Z fund");
    expect(none).toContain(en.Admin.etfs.adapterNone);
    expect(none).toContain(en.Admin.etfs.inactive);

    const unregistered = await renderPage("en", en, "AAAETF");
    expect(unregistered).toContain(`old-adapter (${en.Admin.etfs.adapterNotRegistered})`);

    const roHtml = await renderPage("ro", ro, "ZZZETF");
    expect(roHtml).toContain(ro.Admin.etfs.adapterNone);
  });

  it("EA-1: the panel links to /admin/etfs/<SYMBOL>/fields with the translated label", async () => {
    mockAdapterKeys = ["brd-depositary"];
    mockListEtfs = async () => THREE_ETFS;

    const enHtml = await renderPage("en", en, "aaaetf");
    expect(enHtml).toContain('href="/admin/etfs/AAAETF/fields"');
    expect(enHtml).toContain(en.Admin.etfs.fieldsLink);

    const roHtml = await renderPage("ro", ro, "AAAETF");
    expect(roHtml).toContain('href="/admin/etfs/AAAETF/fields"');
    expect(roHtml).toContain(ro.Admin.etfs.fieldsLink);
  });

  it("PG-SEL: selection is a native GET form with every symbol; a bad or repeated ?symbol falls back safely", async () => {
    mockAdapterKeys = [];
    mockListEtfs = async () => THREE_ETFS;

    const html = await renderPage("en", en);
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toContain('name="symbol"');
    for (const etf of THREE_ETFS) expect(html).toContain(`value="${etf.symbol}"`);

    const unknown = await renderPage("en", en, "<script>alert(1)</script>");
    expect(unknown).not.toContain("<script>alert(1)");
    expect(unknown).toContain('data-etf-details="BTBETRETF"');

    const repeated = await renderPage("en", en, ["ZZZETF", "AAAETF"]);
    expect(repeated).toContain('data-etf-details="ZZZETF"');
  });

  it("PG-ADD: the add form has one symbol input and no name input (US-060 AC2)", async () => {
    mockAdapterKeys = [];
    mockListEtfs = async () => THREE_ETFS;
    for (const [locale, messages] of [["en", en], ["ro", ro]] as const) {
      const html = await renderPage(locale, messages);
      expect(html).not.toContain('name="name"');
      expect(html).toContain(messages.Admin.etfs.addHint);
      expect((html.match(/<input type="text"/g) ?? []).length).toBe(1);
    }
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

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("LE-P6 (%s): a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/etfs line", async (locale, messages) => {
    const SENTINEL = "postgres://user:SENTINELPW@host/db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAdapterKeys = [];

    mockListEtfs = async () => {
      const err = Object.assign(new Error(`connection refused ${SENTINEL}`), { name: "NeonDbError", code: "ECONNREFUSED" });
      throw err;
    };
    const sentinelHtml = await renderPage(locale, messages);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));

    mockListEtfs = async () => {
      throw new Error("x");
    };
    const genericHtml = await renderPage(locale, messages);
    spy.mockRestore();

    expect(sentinelHtml).toBe(genericHtml);
    expect(sentinelHtml).toContain(messages.Admin.etfs.loadError);
    expect(sentinelHtml).not.toContain("SENTINELPW");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] admin\/etfs /);
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

  it("PG-7b: an ETF add through /admin/etfs fits inside maxDuration (US-029 AC9 ordering)", async () => {
    const mod = await import("./page");
    const { CRON_FETCH_TIMEOUT_MS, MIN_REQUESTS_PER_ETF } = await import("@/lib/ingestion/run-daily");
    const NON_FETCH_ALLOWANCE_MS = 15_000;
    const budget = MIN_REQUESTS_PER_ETF * CRON_FETCH_TIMEOUT_MS + NON_FETCH_ALLOWANCE_MS;
    expect(budget).toBeLessThanOrEqual(mod.maxDuration * 1000);
  });
});
