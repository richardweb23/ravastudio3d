import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const local = mode === "localtest";
  const envDir = local ? resolve(projectDir, "development") : resolve(projectDir);
  if (local) {
    const env = loadEnv(mode, envDir, "VITE_");
    let url;
    try { url = new URL(env.VITE_SUPABASE_URL); } catch { /* Validated below. */ }
    if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
      throw new Error("Ambiente de testes exige Supabase local. Configure development/.env com URL localhost; produção foi bloqueada.");
    }
    if (!(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)) {
      throw new Error("Copie a chave pública do Supabase local para development/.env. Consulte LOCAL_DEVELOPMENT.md.");
    }
  }
  return {
  envDir,
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        site: resolve(projectDir, "index.html"),
        gestao: resolve(projectDir, "gestao/index.html"),
      },
    },
  },
  server: {
    host: local ? "127.0.0.1" : true,
  },
  };
});
