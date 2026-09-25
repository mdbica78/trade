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

async function renderHomePage(locale: Locale, messages: typeof ro | typeof en) {
  const { default: Home } = await import("./page");
  const element = await Home();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
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

  it("ro and en renders never contain the other locale's differing text", async () => {
    mockLoad = async () => ({ columns: [], rows: [] });
    const roHtml = await renderHomePage("ro", ro);
    const enHtml = await renderHomePage("en", en);

    expect(roHtml).not.toContain(en.Home.empty);
    expect(enHtml).not.toContain(ro.Home.empty);
  });
});
