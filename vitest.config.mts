import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@/": src("./src/"),
      // Next aliases `server-only` at build time; outside Next it is a no-op.
      "server-only": src("./tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/setup.ts"],
    // Route tests share one database, so test files run one at a time.
    fileParallelism: false,
    server: {
      deps: {
        // next-auth imports "next/server" without an extension, which Node's
        // ESM loader rejects; letting Vite transform these resolves it.
        inline: ["next-auth", "@upstart13-com/aiden-auth"],
      },
    },
  },
}));
