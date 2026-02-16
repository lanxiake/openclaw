import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@openclaw/db": path.resolve(__dirname, "../../src/db"),
    },
  },
});
