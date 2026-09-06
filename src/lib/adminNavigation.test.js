import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdminPage, getAdminPageHref } from "./adminNavigation.js";

describe("navegacao administrativa", () => {
  it("abre o modulo informado pelo caminho", () => {
    assert.equal(
      getAdminPage("https://example.com/ravastudio3d/gestao/compras/"),
      "compras",
    );
    assert.equal(
      getAdminPage("https://example.com/ravastudio3d/gestao/calculadora-escala/"),
      "calculadoraEscala",
    );
    assert.equal(
      getAdminPage("https://example.com/ravastudio3d/gestao/financeiro/contas-a-pagar/"),
      "financeiroContas",
    );
  });

  it("gera rotas aninhadas do módulo financeiro", () => {
    assert.equal(
      getAdminPageHref("financeiroFaturas", { href: "https://example.com/ravastudio3d/gestao/" }),
      "/ravastudio3d/gestao/financeiro/faturas/",
    );
  });

  it("mantem compatibilidade com os links antigos", () => {
    assert.equal(getAdminPage("/ravastudio3d/gestao/?pagina=pedidos"), "pedidos");
  });

  it("recusa destinos desconhecidos", () => {
    assert.equal(getAdminPage("/ravastudio3d/gestao/inexistente/"), "dashboard");
  });

  it("preserva o subcaminho do GitHub Pages", () => {
    const location = { href: "https://example.com/ravastudio3d/gestao/?pagina=dashboard#token" };
    assert.equal(
      getAdminPageHref("estoquePorLocal", location),
      "/ravastudio3d/gestao/estoque/",
    );
    assert.equal(
      getAdminPageHref("dashboard", location),
      "/ravastudio3d/gestao/",
    );
  });
});
