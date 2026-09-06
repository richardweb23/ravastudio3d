import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, "index.html"),
        gestao: resolve(__dirname, "gestao/index.html"),
      },
    },
  },
  server: {
    host: true,
  },
});
