import { localDetailsPage, parseLocalDetailsPage } from "./consignacao.js";

export const adminPageRoutes = Object.freeze({
  dashboard: "",
  estoque: "produtos",
  estoquePorLocal: "estoque",
  compras: "compras",
  vendas: "vendas",
  pedidos: "pedidos",
  cadastros: "cadastros",
  tarefas: "tarefas",
  calculadora: "calculadora-custos",
  calculadoraEscala: "calculadora-escala",
  estimativaImpressao: "estimativa-impressao",
  historico: "historico",
  financeiro: "financeiro",
  financeiroCaixa: "financeiro/caixa",
  financeiroReembolsos: "financeiro/reembolsos",
  financeiroContas: "financeiro/contas-a-pagar",
  financeiroDespesas: "financeiro/despesas",
  financeiroParcelas: "financeiro/parcelas",
  financeiroFaturas: "financeiro/faturas",
  financeiroCartoes: "financeiro/cartoes",
  financeiroCategorias: "financeiro/categorias",
});

export const adminPageIds = new Set(Object.keys(adminPageRoutes));

const routePages = Object.fromEntries(
  Object.entries(adminPageRoutes).map(([page, route]) => [route, page]),
);

// Links antigos do cadastro agora levam ao quadro de tarefas.
routePages["tarefas/cadastrar"] = "tarefas";

function resolveRoute(route) {
  const detail = /^locais-vendedores\/(local|vendedor)\/([0-9a-f-]+)$/i.exec(route);
  if (detail) {
    const page = localDetailsPage(detail[1].toLowerCase(), detail[2]);
    return parseLocalDetailsPage(page) ? page : "dashboard";
  }
  return routePages[route] || "dashboard";
}

function asUrl(location) {
  if (typeof location === "string") return new URL(location, "https://local.invalid");
  if (location?.href) return new URL(location.href);
  return new URL(
    `${location?.pathname || "/gestao/"}${location?.search || ""}${location?.hash || ""}`,
    "https://local.invalid",
  );
}

export function getAdminPage(location = window.location) {
  const url = asUrl(location);
  const hashRoute = url.hash.startsWith("#/")
    ? decodeURIComponent(url.hash.slice(2)).replace(/^\/+|\/+$/g, "")
    : null;
  if (hashRoute !== null) return resolveRoute(hashRoute);

  const legacyPage = url.searchParams.get("pagina");
  if (legacyPage === "cadastrarTarefas") return "tarefas";
  if (adminPageIds.has(legacyPage)) return legacyPage;

  const marker = "/gestao/";
  const markerIndex = url.pathname.toLowerCase().indexOf(marker);
  if (markerIndex === -1) return "dashboard";

  const route = url.pathname
    .slice(markerIndex + marker.length)
    .replace(/^\/+|\/+$/g, "");

  return resolveRoute(route);
}

export function getAdminPageHref(page, location = window.location) {
  const url = asUrl(location);
  const marker = "/gestao/";
  const markerIndex = url.pathname.toLowerCase().indexOf(marker);
  const managementRoot = markerIndex === -1
    ? "/gestao/"
    : url.pathname.slice(0, markerIndex + marker.length);
  const detail = parseLocalDetailsPage(page);
  const route = detail ? `locais-vendedores/${detail.type}/${detail.id}` : adminPageRoutes[page] ?? adminPageRoutes.dashboard;

  return `${managementRoot}#/${route}`;
}
