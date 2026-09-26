import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { OperationsView } from "@/lib/admin/operations";
import { OperationsDashboard, type OperationsDashboardProps } from "./OperationsDashboard";

function render(locale: Locale, messages: typeof ro | typeof en, props: OperationsDashboardProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <OperationsDashboard {...props} />
    </NextIntlClientProvider>,
  );
}

const emptyView: OperationsView = { runs: [], etfs: [], parseErrors: [] };

describe("OperationsDashboard (OD)", () => {
  it("OD-error: an error status shows the translated load error and nothing else, both locales", () => {
    for (const [locale, messages] of [["ro", ro], ["en", en]] as const) {
      const html = render(locale, messages, { status: "error" });
      expect(html).toContain(messages.Admin.operations.loadError);
    }
  });

  it("OD-empty: empty view shows the three empty states", () => {
    const html = render("en", en, { status: "ok", view: emptyView });
    expect(html).toContain(en.Admin.operations.runsEmpty);
    expect(html).toContain(en.Admin.operations.etfsEmpty);
    expect(html).toContain(en.Admin.operations.parseErrorsEmpty);
  });

  it("OD-R1: run rows show translated status, counts, and did-not-finish/running end states", () => {
    const view: OperationsView = {
      runs: [
        { id: 1, startedAt: "2026-09-20T10:00:00Z", finishedAt: "2026-09-20T10:05:00Z", status: "success", etfsProcessed: 3, errorsCount: 0, log: { summary: null, entries: [] } },
        { id: 2, startedAt: "2026-09-21T10:00:00Z", finishedAt: "2026-09-21T10:05:00Z", status: "partial", etfsProcessed: 3, errorsCount: 1, log: { summary: null, entries: [] } },
        { id: 3, startedAt: "2026-09-22T10:00:00Z", finishedAt: null, status: "failed", etfsProcessed: 0, errorsCount: 0, log: { summary: null, entries: [] } },
        { id: 4, startedAt: "2026-09-23T10:00:00Z", finishedAt: null, status: "running", etfsProcessed: 0, errorsCount: 0, log: { summary: null, entries: [] } },
      ],
      etfs: [],
      parseErrors: [],
    };
    const html = render("en", en, { status: "ok", view });

    expect(html).toMatch(/data-run-id="1"[^>]*data-run-end="finished"/);
    expect(html).toContain(en.Admin.operations.runStatus.success);
    expect(html).toMatch(/data-run-id="2"[^>]*data-run-end="finished"/);
    expect(html).toContain(en.Admin.operations.runStatus.partial);
    expect(html).toMatch(/data-run-id="3"[^>]*data-run-end="did-not-finish"/);
    expect(html).toContain(en.Admin.operations.didNotFinish);
    expect(html).toMatch(/data-run-id="4"[^>]*data-run-end="running"/);
    expect(html).toContain(en.Admin.operations.runStatus.running);
  });

  it("OD-L1/OD-L2: log entries show translated outcome, date, detail; unknown code shows raw text", () => {
    const view: OperationsView = {
      runs: [
        {
          id: 1,
          startedAt: "2026-09-22T10:00:00Z",
          finishedAt: "2026-09-22T10:05:00Z",
          status: "partial",
          etfsProcessed: 2,
          errorsCount: 1,
          log: {
            summary: null,
            entries: [
              { kind: "etf", symbol: "AAA", code: "ok", reportDate: "2026-09-22", detail: "stored 2 values" },
              { kind: "etf", symbol: "BBB", code: "some_future_code", detail: "raw detail here" },
              { kind: "aborted", detail: "boom" },
              { kind: "stale" },
              { kind: "unparsed", text: "garbage line" },
            ],
          },
        },
      ],
      etfs: [],
      parseErrors: [],
    };
    const html = render("en", en, { status: "ok", view });
    expect(html).toContain(en.Admin.operations.outcome.ok);
    expect(html).toContain("2026-09-22");
    expect(html).toContain("stored 2 values");
    expect(html).toContain("some_future_code");
    expect(html).toContain("raw detail here");
    expect(html).toContain(en.Admin.operations.logAborted);
    expect(html).toContain("boom");
    expect(html).toContain(en.Admin.operations.logStale);
    expect(html).toContain("garbage line");
  });

  it("OD-E1/OD-E2: last successful extraction, never, and inactive", () => {
    const view: OperationsView = {
      runs: [],
      etfs: [
        { symbol: "AAA", isActive: true, adapterAvailable: true, lastOk: { reportDate: "2026-09-20", fetchedAt: "2026-09-20T09:15:00Z" } },
        { symbol: "BBB", isActive: true, adapterAvailable: true, lastOk: null },
        { symbol: "CCC", isActive: false, adapterAvailable: true, lastOk: { reportDate: "2026-09-18", fetchedAt: null } },
      ],
      parseErrors: [],
    };
    const html = render("en", en, { status: "ok", view });
    expect(html).toContain("2026-09-20");
    expect(html).toContain(en.Admin.operations.never);
    expect(html).toContain(en.Admin.operations.inactive);
    expect(html).toMatch(/data-etf-symbol="CCC"/);
  });

  it("OD-E3: adapter-missing flag", () => {
    const view: OperationsView = {
      runs: [],
      etfs: [
        { symbol: "AAA", isActive: true, adapterAvailable: true, lastOk: null },
        { symbol: "BBB", isActive: true, adapterAvailable: false, lastOk: null },
      ],
      parseErrors: [],
    };
    const html = render("en", en, { status: "ok", view });
    expect(html).toMatch(/data-etf-symbol="AAA" data-adapter-missing="false"/);
    expect(html).toMatch(/data-etf-symbol="BBB" data-adapter-missing="true"/);
    const bbbMatch = html.match(/<tr data-etf-symbol="BBB"[\s\S]*?<\/tr>/)?.[0] ?? "";
    expect(bbbMatch).toContain(en.Admin.operations.adapterMissing);
  });

  it("OD-P1/OD-P2: parse error row shows message, values, and a safe PDF link; unsafe/absent URLs render no link", () => {
    const view: OperationsView = {
      runs: [],
      etfs: [],
      parseErrors: [
        {
          id: 10,
          symbol: "AAA",
          reportDate: "2026-09-22",
          status: "parse_error",
          errorMessage: "missing fields: nav_per_unit",
          sourceUrl: "https://bvb.ro/x.pdf",
          values: [{ fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net assets", numericValue: "415591664.27" }],
        },
        {
          id: 11,
          symbol: "BBB",
          reportDate: "2026-09-21",
          status: "no_adapter",
          errorMessage: null,
          sourceUrl: "javascript:alert(1)",
          values: [],
        },
      ],
    };
    const enHtml = render("en", en, { status: "ok", view });
    expect(enHtml).toContain("missing fields: nav_per_unit");
    expect(enHtml).toContain("Net assets");
    expect(enHtml).toContain("415591664.27");
    expect(enHtml.match(/target="_blank"/g)).toHaveLength(1);
    const bbbRow = enHtml.match(/<tr data-report-id="11"[\s\S]*?<\/tr>/)?.[0] ?? "";
    expect(bbbRow).not.toContain("<a ");

    const roHtml = render("ro", ro, { status: "ok", view });
    expect(roHtml).toContain("Activ net");
    expect(roHtml).toContain("415591664,27");
  });

  it("OD-B1: ro and en never contain the other locale's differing text", () => {
    const view: OperationsView = {
      runs: [{ id: 1, startedAt: "2026-09-22T10:00:00Z", finishedAt: null, status: "running", etfsProcessed: 0, errorsCount: 0, log: { summary: null, entries: [] } }],
      etfs: [],
      parseErrors: [],
    };
    const roHtml = render("ro", ro, { status: "ok", view });
    const enHtml = render("en", en, { status: "ok", view });
    expect(roHtml).not.toContain(en.Admin.operations.heading);
    expect(enHtml).not.toContain(ro.Admin.operations.heading);
    expect(roHtml).toContain(ro.Admin.operations.heading);
    expect(enHtml).toContain(en.Admin.operations.heading);
  });

  it("OD-S1: a script tag in a log detail, error message, or unparsed line is escaped, never executable HTML", () => {
    const view: OperationsView = {
      runs: [
        {
          id: 1,
          startedAt: "2026-09-22T10:00:00Z",
          finishedAt: null,
          status: "running",
          etfsProcessed: 0,
          errorsCount: 0,
          log: {
            summary: null,
            entries: [
              { kind: "etf", symbol: "AAA", code: "ok", detail: "<script>alert(1)</script>" },
              { kind: "unparsed", text: "<script>alert(2)</script>" },
            ],
          },
        },
      ],
      etfs: [],
      parseErrors: [
        { id: 1, symbol: "AAA", reportDate: "2026-09-22", status: "parse_error", errorMessage: "<script>alert(3)</script>", sourceUrl: null, values: [] },
      ],
    };
    const html = render("en", en, { status: "ok", view });
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });
});
