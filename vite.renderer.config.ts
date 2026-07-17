import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: resolve("src/renderer"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve("src/renderer/src"),
      "@shared": resolve("src/shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});
