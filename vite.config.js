import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const managementRoutes = [
  "produtos",
  "estoque",
  "compras",
  "vendas",
  "pedidos",
  "cadastros",
  "calculadora-custos",
  "calculadora-escala",
  "historico",
  "financeiro",
  "financeiro/contas-a-pagar",
  "financeiro/despesas",
  "financeiro/parcelas",
  "financeiro/faturas",
  "financeiro/cartoes",
  "financeiro/categorias",
];

const managementInputs = Object.fromEntries(
  managementRoutes.map((route) => [
    `gestao-${route}`,
    resolve(__dirname, "gestao", route, "index.html"),
  ]),
);

export default defineConfig({
  plugins: [react()],
  base: "/ravastudio3d/",
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, "index.html"),
        gestao: resolve(__dirname, "gestao/index.html"),
        ...managementInputs,
      },
    },
  },
  server: {
    host: true,
  },
});
