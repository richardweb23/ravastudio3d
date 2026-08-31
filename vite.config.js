import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: '/ravastudio3d/',
  server: {
    host: true,
  },
});
