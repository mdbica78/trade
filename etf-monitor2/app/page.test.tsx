import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { HomeTableViewModel } from "@/lib/monitoring/home";

let mockLoad: () => Promise<HomeTableViewModel>;

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/monitoring/home", () => ({
  createHomeTableLoader: () => mockLoad,
}));
vi.mock("./home-display-actions", () => ({
  saveHomeDisplayAction: async () => ({ ok: false, error: "not_used_in_static_test" }),
}));

async function renderHomePage(locale: Locale, messages: typeof ro | typeof en) {
  const { default: Home } = await import("./page");
  const element = await Home();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Home page", () => {
  it("renders a row from the loaded view model", async () => {
    mockLoad = async () => ({
      columns: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
      rows: [
        {
          symbol: "BTBETRETF",
          name: "BT Bucharest ETF",
          adapterAvailable: true,
          latestPdfUrl: "https://bvb.ro/report.pdf",
          valueDate: "2026-09-22",
          cells: { nav_per_unit: { tracked: true, value: "11.171", delta: null } },
        },
      ],
    });

    const html = await renderHomePage("en", en);
    expect(html).toContain("BTBETRETF");
    expect(html).toContain("11.171");
    expect(html).toContain('href="https://bvb.ro/report.pdf"');
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("shows the translated empty-state message when there are no active ETFs (%s)", async (locale, messages) => {
    mockLoad = async () => ({ columns: [], rows: [] });

    const html = await renderHomePage(locale, messages);
    expect(html).toContain(messages.Home.empty);
  });

  it("shows a translated error message and never the raw exception text when the database read throws", async () => {
    mockLoad = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };

    const html = await renderHomePage("en", en);
    expect(html).toContain(en.Home.loadError);
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("secret");
  });

  it("US-030 AC8: a missing etf_report_links table (pre-migration) shows the same translated error, not the exception text", async () => {
    mockLoad = async () => {
      throw new Error('relation "etf_report_links" does not exist');
    };

    const html = await renderHomePage("en", en);
    expect(html).toContain(en.Home.loadError);
    expect(html).not.toContain("etf_report_links");
    expect(html).not.toContain("relation");
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("LE-P1 (%s): a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe home line", async (locale, messages) => {
    const SENTINEL = "postgres://user:SENTINELPW@host/db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockLoad = async () => {
      const err = Object.assign(new Error(`connection refused ${SENTINEL}`), { name: "NeonDbError", code: "ECONNREFUSED" });
      throw err;
    };
    const sentinelHtml = await renderHomePage(locale, messages);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));

    mockLoad = async () => {
      throw new Error("x");
    };
    const genericHtml = await renderHomePage(locale, messages);
    spy.mockRestore();

    expect(sentinelHtml).toBe(genericHtml);
    expect(sentinelHtml).toContain(messages.Home.loadError);
    expect(sentinelHtml).not.toContain("SENTINELPW");
    expect(sentinelHtml).not.toContain("://");
    expect(sentinelHtml).not.toContain("42P01");
    expect(sentinelHtml).not.toContain("NeonDbError");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] home /);
    expect(lines[0][0]).not.toContain("SENTINELPW");
  });

  it("ro and en renders never contain the other locale's differing text", async () => {
    mockLoad = async () => ({ columns: [], rows: [] });
    const roHtml = await renderHomePage("ro", ro);
    const enHtml = await renderHomePage("en", en);

    expect(roHtml).not.toContain(en.Home.empty);
    expect(enHtml).not.toContain(ro.Home.empty);
  });

  it("renders the translated title row and a Customize view button in both locales", async () => {
    mockLoad = async () => ({ columns: [], rows: [] });
    const roHtml = await renderHomePage("ro", ro);
    const enHtml = await renderHomePage("en", en);
    expect(roHtml).toContain(ro.HomeDisplay.title);
    expect(roHtml).toContain(ro.HomeDisplay.customizeView);
    expect(roHtml).not.toContain(en.HomeDisplay.title);
    expect(enHtml).toContain(en.HomeDisplay.title);
    expect(enHtml).toContain(en.HomeDisplay.customizeView);
    expect(enHtml).not.toContain(ro.HomeDisplay.title);
  });
});
