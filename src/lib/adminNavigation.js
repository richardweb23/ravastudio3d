export const adminPageRoutes = Object.freeze({
  dashboard: "",
  estoque: "produtos",
  estoquePorLocal: "estoque",
  compras: "compras",
  vendas: "vendas",
  pedidos: "pedidos",
  cadastros: "cadastros",
  calculadora: "calculadora-custos",
  calculadoraEscala: "calculadora-escala",
  historico: "historico",
  financeiro: "financeiro",
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

function asUrl(location) {
  if (typeof location === "string") return new URL(location, "https://local.invalid");
  if (location?.href) return new URL(location.href);
  return new URL(
    `${location?.pathname || "/gestao/"}${location?.search || ""}`,
    "https://local.invalid",
  );
}

export function getAdminPage(location = window.location) {
  const url = asUrl(location);
  const legacyPage = url.searchParams.get("pagina");
  if (adminPageIds.has(legacyPage)) return legacyPage;

  const marker = "/gestao/";
  const markerIndex = url.pathname.toLowerCase().indexOf(marker);
  if (markerIndex === -1) return "dashboard";

  const route = url.pathname
    .slice(markerIndex + marker.length)
    .replace(/^\/+|\/+$/g, "");

  return routePages[route] || "dashboard";
}

export function getAdminPageHref(page, location = window.location) {
  const url = asUrl(location);
  const marker = "/gestao/";
  const markerIndex = url.pathname.toLowerCase().indexOf(marker);
  const managementRoot = markerIndex === -1
    ? "/gestao/"
    : url.pathname.slice(0, markerIndex + marker.length);
  const route = adminPageRoutes[page] ?? adminPageRoutes.dashboard;

  return route ? `${managementRoot}${route}/` : managementRoot;
}
