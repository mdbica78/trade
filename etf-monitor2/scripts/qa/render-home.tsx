import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { locales, type Locale } from "../../i18n/locale";
import { HomePageBody } from "../../components/HomePageBody";
import type { HomeDisplayActionResult } from "../../components/home-display-state";
import { RENDER_HOME_CUSTOMIZATION, RENDER_HOME_FIXTURE } from "./render-home-fixture";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const MESSAGES: Record<Locale, typeof en | typeof ro> = { en, ro };

/** No server/database in the harness (US-036 AC11): the panel never actually saves. */
async function noopSaveAction(): Promise<HomeDisplayActionResult> {
  return { ok: false, error: "not available in the QA render harness" };
}

/** Include every emitted stylesheet: the build may split application CSS across chunks. */
export function findBuildCss(nextDir: string): string[] {
  const cssDir = path.join(nextDir, "static", "css");
  const files = readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort();
  if (files.length === 0) throw new Error("No build CSS found; run pnpm build before rendering QA fixtures");
  return files.map((file) => path.join(cssDir, file));
}

function renderPage(locale: Locale, theme: Theme, stylesheetHrefs: string[]): string {
  const messages = MESSAGES[locale];
  const body = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <HomePageBody
        tableProps={{ status: "ok", viewModel: RENDER_HOME_FIXTURE }}
        customization={RENDER_HOME_CUSTOMIZATION}
        saveAction={noopSaveAction}
        initialOpen={true}
      />
    </NextIntlClientProvider>,
  );
  const links = stylesheetHrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  return `<!DOCTYPE html>
<html lang="${locale}" data-theme="${theme}">
<head><meta charset="utf-8">${links}</head>
<body>${body}</body>
</html>
`;
}

/**
 * Renders the actual shipped home-page component tree (HomePageBody, unmodified from
 * app/page.tsx) against a committed fixture, one HTML file per theme x locale, for a human to
 * open in a browser (US-036 AC11). Requires a completed `pnpm build`; never touches a database.
 */
export function renderHomeQaFiles(outDir: string, nextDir: string): string[] {
  const stylesheets = findBuildCss(nextDir);
  mkdirSync(outDir, { recursive: true });
  const hrefs = stylesheets.map((stylesheet, index) => {
    const name = `build-${index}.css`;
    copyFileSync(stylesheet, path.join(outDir, name));
    return `./${name}`;
  });
  const written: string[] = [];
  for (const locale of locales) {
    for (const theme of THEMES) {
      const html = renderPage(locale, theme, hrefs);
      const filePath = path.join(outDir, `home-${locale}-${theme}.html`);
      writeFileSync(filePath, html, "utf8");
      written.push(filePath);
    }
  }
  return written;
}

async function main() {
  const outDir = process.argv[2] ?? path.join(process.cwd(), ".qa-render", "home");
  const nextDir = path.join(process.cwd(), ".next");
  const files = renderHomeQaFiles(outDir, nextDir);
  for (const file of files) {
    console.log(`wrote ${file}`);
  }
}

if (process.env.VITEST === undefined) {
  void main();
}
