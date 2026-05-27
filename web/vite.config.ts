import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../web-dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3170",
      "/health": "http://localhost:3170",
    },
  },
});
