import assert from "node:assert/strict";
import { test } from "node:test";
import { moneyInputCents, validQuantity, summarizeLocations, summarizeConsignment, filterConsignmentSales, localDetailsPage } from "./consignacao.js";
import { getAdminPage, getAdminPageHref } from "./adminNavigation.js";

test("valores monetários aceitam formato brasileiro sem truncar entradas inválidas", () => {
  assert.equal(moneyInputCents("15,00"), 1500);
  assert.equal(moneyInputCents("0,29"), 29);
  assert.equal(moneyInputCents("1.234,56"), 123456);
  assert.equal(moneyInputCents("15.50"), 1550);
  for (const value of ["", "abc", "-1", "1,234", "NaN", "10.001.000,00"]) assert.throws(() => moneyInputCents(value));
});
test("quantidade não pode exceder estoque nem deixar saldo negativo", () => {
  assert.equal(validQuantity("2", 5), 2);
  assert.equal(validQuantity("-2", 5, true), -2);
  for (const value of [0, -1, 1.5, 6, "texto"]) assert.throws(() => validQuantity(value, 5));
  assert.throws(() => validQuantity(-6, 5, true));
});
test("resumo mantém o valor histórico e calcula repasses a partir de vendas vinculadas", () => {
  const sale = { id: "s", material_id: "p", quantidade: 2, total_centavos: 3000, repasse_total_centavos: 600, acordo_registrado: true, pagamento_id: null, data: "2026-09-15" };
  const input = { materiais: [{ id: "p", nome: "Chaveiro" }], estoque: [{ material_id: "p", quantidade: 3 }], acordos: [{ material_id: "p", preco_centavos: 1500, repasse_centavos: 300 }], vendas: [sale], movimentos: [{ material_id: "p", tipo: "entrada", quantidade: 5 }] };
  let report = summarizeConsignment(input);
  assert.deepEqual([report.unidades, report.potencial, report.vendido, report.pendente, report.pago], [3, 4500, 3000, 600, 0]);
  assert.equal(report.products[0].enviada, 5);
  assert.equal(report.products[0].vendida, 2);
  report = summarizeConsignment({ ...input, acordos: [{ material_id: "p", preco_centavos: 2000, repasse_centavos: 900 }], vendas: [{ ...sale, pagamento_id: "pag" }] });
  assert.deepEqual([report.potencial, report.vendido, report.pendente, report.pago], [6000, 3000, 0, 600]);
});
test("histórico filtra status e período sem esconder registros sem acordo em Todos", () => {
  const sales = [{ data: "2026-09-10", acordo_registrado: true, repasse_total_centavos: 100 }, { data: "2026-09-15", acordo_registrado: true, repasse_total_centavos: 200, pagamento_id: "p" }, { data: "2025-01-01", acordo_registrado: false, repasse_total_centavos: 0 }];
  assert.equal(filterConsignmentSales(sales).length, 3);
  assert.equal(filterConsignmentSales(sales, "pendente").length, 1);
  assert.equal(filterConsignmentSales(sales, "pago", "2026-09-14", "2026-09-16").length, 1);
  assert.equal(filterConsignmentSales(sales, "pago", "2026-09-16").length, 0);
});
test("rotas individuais de locais e vendedores suportam acesso direto e retorno", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  for (const type of ["local", "vendedor"]) {
    const page = localDetailsPage(type, id);
    const href = getAdminPageHref(page, "https://example.com/rava/gestao/");
    assert.equal(href, "/rava/gestao/#/locais-vendedores/" + type + "/" + id);
    assert.equal(getAdminPage(href), page);
    assert.equal(getAdminPage("/gestao/locais-vendedores/" + type + "/" + id), page);
  }
  assert.equal(getAdminPage("/gestao/#/locais-vendedores/local/invalido"), "dashboard");
});

test("indicadores da listagem isolam locais e excluem repasses já pagos", () => {
  const estoque = [{ local_id: "a", material_id: "p", quantidade: 3 }, { local_id: "a", material_id: "q", quantidade: 2 }, { local_id: "b", material_id: "p", quantidade: 7 }];
  const vendas = [
    { local_id: "a", material_id: "p", quantidade: 2, total_centavos: 3000, repasse_total_centavos: 600, acordo_registrado: true },
    { local_id: "a", material_id: "q", quantidade: 1, total_centavos: 1500, repasse_total_centavos: 300, acordo_registrado: true, pagamento_id: "pago" },
    { local_id: "b", material_id: "p", quantidade: 1, total_centavos: 2000, repasse_total_centavos: 400, acordo_registrado: true },
    { local_id: "c", material_id: "p", quantidade: 1, total_centavos: 1000, repasse_total_centavos: 0, acordo_registrado: false },
  ];
  const summaries = summarizeLocations({ estoque, vendas });
  assert.deepEqual(summaries.a, { unidades: 5, vendido: 4500, pendente: 600 });
  assert.deepEqual(summaries.b, { unidades: 7, vendido: 2000, pendente: 400 });
  assert.deepEqual(summaries.c, { unidades: 0, vendido: 1000, pendente: 0 });
  assert.deepEqual(summarizeLocations({}), {});
});
