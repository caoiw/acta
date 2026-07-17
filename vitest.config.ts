import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve("src/renderer/src"),
      "@shared": resolve("src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/shared/**/*.ts", "src/main/store.ts"],
    },
  },
});
