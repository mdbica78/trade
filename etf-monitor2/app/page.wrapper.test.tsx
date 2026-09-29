import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import type { HomeTableViewModel } from "@/lib/monitoring/home";

let mockLoad: () => Promise<HomeTableViewModel>;

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/monitoring/home", () => ({
  createHomeTableLoader: () => mockLoad,
}));

async function renderHomePage() {
  const { default: Home } = await import("./page");
  const element = await Home();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("US-035 AC7: home table scroll wrapper", () => {
  it("PW-1 the table sits inside a data-table-scroll wrapper", async () => {
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
    const html = await renderHomePage();
    const wrapperIdx = html.indexOf('data-table-scroll=""');
    const tableIdx = html.indexOf("<table");
    const tableCloseIdx = html.indexOf("</table>");
    expect(wrapperIdx).toBeGreaterThanOrEqual(0);
    expect(wrapperIdx).toBeLessThan(tableIdx);
    expect(tableCloseIdx).toBeGreaterThan(tableIdx);
  });

  it("PW-2 the empty state also renders inside the wrapper", async () => {
    mockLoad = async () => ({ columns: [], rows: [] });
    const html = await renderHomePage();
    const wrapperIdx = html.indexOf('data-table-scroll=""');
    expect(wrapperIdx).toBeGreaterThanOrEqual(0);
    expect(html).toContain(en.Home.empty);
  });

  it("PW-2 the error state also renders inside the wrapper", async () => {
    mockLoad = async () => {
      throw new Error("db down");
    };
    const html = await renderHomePage();
    const wrapperIdx = html.indexOf('data-table-scroll=""');
    expect(wrapperIdx).toBeGreaterThanOrEqual(0);
    expect(html).toContain(en.Home.loadError);
  });
});
