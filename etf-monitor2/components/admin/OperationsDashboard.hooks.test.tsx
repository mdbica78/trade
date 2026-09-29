import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import type { OperationsView } from "@/lib/admin/operations";
import { OperationsDashboard } from "./OperationsDashboard";

describe("US-035 AC6: OH-1 run status hook", () => {
  it("OH-1 each run row's status cell carries data-run-status and the translated label", () => {
    const view: OperationsView = {
      runs: [
        { id: 1, startedAt: "2026-09-20T10:00:00Z", finishedAt: "2026-09-20T10:05:00Z", status: "success", etfsProcessed: 3, errorsCount: 0, log: { summary: null, entries: [] } },
      ],
      etfs: [],
      parseErrors: [],
    };
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <OperationsDashboard status="ok" view={view} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('data-run-status=""');
    expect(html).toContain(`<td data-run-status="">${en.Admin.operations.runStatus.success}</td>`);
  });
});
