import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // unpdf's extractText dynamically imports 'unpdf/pdfjs' with a static specifier; keeping it
  // external means Node resolves it from node_modules in the deployed function exactly as
  // Vitest/tsx already do, instead of relying on webpack to bundle pdf.js correctly.
  serverExternalPackages: ["unpdf"],
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
