import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { EtfListItem } from "@/lib/config/etfs";
import { EtfAdmin, type EtfAdminActions, type EtfAdminProps } from "./EtfAdmin";

const actions: EtfAdminActions = { add: vi.fn(), setActive: vi.fn(), setAdapter: vi.fn(), redetect: vi.fn() };

const ETFS: EtfListItem[] = [
  { symbol: "AAAETF", name: "A fund", adapterKey: "brd-depositary", adapterAvailable: true, isActive: true },
  { symbol: "BBBETF", name: "B fund", adapterKey: null, adapterAvailable: false, isActive: false },
];

function render(locale: Locale, messages: typeof ro | typeof en, props: EtfAdminProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <EtfAdmin {...props} />
    </NextIntlClientProvider>,
  );
}

const ok = (selectedSymbol?: string, etfs: readonly EtfListItem[] = ETFS): EtfAdminProps => ({
  status: "ok",
  etfs,
  adapterKeys: ["brd-depositary"],
  actions,
  selectedSymbol,
});

describe("EtfAdmin (US-060)", () => {
  it("EA-S1: selector lists every symbol, marks the selected one, and submits by GET without JavaScript", () => {
    for (const [locale, messages] of [["en", en], ["ro", ro]] as const) {
      const html = render(locale, messages, ok("BBBETF"));
      expect(html).toMatch(/<form[^>]*method="get"/);
      expect(html).toContain(messages.Admin.etfs.selectLabel);
      expect(html).toContain(messages.Admin.etfs.selectSubmit);
      expect(html).toContain('<option value="AAAETF">AAAETF</option>');
      expect(html).toContain(`<option value="BBBETF" selected="">BBBETF (${messages.Admin.etfs.inactive})</option>`);
    }
  });

  it("EA-S2: the panel shows only the selected ETF, with its actions (state toggle, adapter, re-detect, fields link)", () => {
    const html = render("en", en, ok("BBBETF"));
    expect(html).toContain('data-etf-details="BBBETF"');
    expect(html).toContain("B fund");
    expect(html).not.toContain("A fund");
    expect(html).toContain(en.Admin.etfs.activate);
    expect(html).not.toContain(`>${en.Admin.etfs.remove}<`);
    expect(html).toContain(en.Admin.etfs.setAdapterSubmit);
    expect(html).toContain(en.Admin.etfs.redetectSubmit);
    expect(html).toContain('href="/admin/etfs/BBBETF/fields"');
    expect(html).toContain('name="active" value="true"');

    const active = render("en", en, ok("AAAETF"));
    expect(active).toContain(`>${en.Admin.etfs.remove}<`);
    expect(active).toContain('name="active" value="false"');
  });

  it("EA-S3: an absent, blank or unknown selection falls back to the first ETF; matching is case-insensitive", () => {
    for (const selected of [undefined, "", "  ", "NOPE"]) {
      expect(render("en", en, ok(selected))).toContain('data-etf-details="AAAETF"');
    }
    expect(render("en", en, ok(" bbbetf "))).toContain('data-etf-details="BBBETF"');
  });

  it("EA-A1: the add form has exactly one symbol input, no name input, and a hint, in both locales", () => {
    for (const [locale, messages] of [["en", en], ["ro", ro]] as const) {
      const html = render(locale, messages, ok());
      const addSection = html.slice(html.indexOf(messages.Admin.etfs.addHeading));
      expect(addSection).toContain(messages.Admin.etfs.addHint);
      expect(addSection).toContain('name="symbol"');
      expect(addSection).not.toContain('name="name"');
      expect((addSection.match(/<input /g) ?? []).length).toBe(1);
    }
  });

  it("EA-E1: no ETFs shows the empty state and still offers the add form; an error status shows only the load error", () => {
    const empty = render("en", en, ok(undefined, []));
    expect(empty).toContain(en.Admin.etfs.empty);
    expect(empty).toContain(en.Admin.etfs.addHeading);

    const error = render("ro", ro, { status: "error" });
    expect(error).toContain(ro.Admin.etfs.loadError);
    expect(error).not.toContain(ro.Admin.etfs.addHeading);
  });
});
