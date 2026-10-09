import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * DEC-019 §5: some PGlite `beforeEach` hooks and `app/chat/page.safety.test.tsx` CPS-1 only time
 * out under the whole suite's concurrent load on this machine's WSL1 drvfs volume (Sprint 6 N5,
 * Sprint 7 W5) — they pass alone well under the previous default. 30s gives headroom without
 * masking a real hang.
 */
const TEST_TIMEOUT_MS = 30_000;
const HOOK_TIMEOUT_MS = 30_000;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "spikes"],
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: HOOK_TIMEOUT_MS,
    server: {
      deps: {
        inline: ["next-intl"],
      },
    },
  },
});
