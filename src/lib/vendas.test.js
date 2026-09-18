import { test } from "node:test";
import assert from "node:assert/strict";
import { saleTotal, saleQuantity } from "./vendas.js";
import { summarizeConsignment, summarizeLocations, repasseStatus } from "./consignacao.js";

test("devolução zera receita e unidades líquidas sem apagar valores originais", () => {
  const sale = { quantidade: 2, preco_unitario: 12.5 };
  const returned = { ...sale, devolvida_em: "2026-09-18" };
  assert.equal(saleTotal(sale),25);
  assert.equal(saleTotal(returned),0);
  assert.equal(saleQuantity(returned),0);
  assert.equal(returned.quantidade,2);
});
test("resumos de consignação removem receita, quantidade vendida e repasse das devoluções", () => {
  const active = { local_id: "l", material_id: "p", quantidade: 2, total_centavos: 3000, repasse_total_centavos: 600, acordo_registrado: true };
  const returned = { ...active, devolvida_em: "2026-09-18" };
  const report = summarizeConsignment({ vendas: [active,returned], estoque: [{material_id:"p",quantidade:3}] });
  assert.equal(report.vendido,3000);
  assert.equal(report.pendente,600);
  assert.equal(report.products[0].vendida,2);
  assert.equal(repasseStatus(returned),"devolvida");
  assert.deepEqual(summarizeLocations({ vendas:[returned] }).l, { unidades:0,vendido:0,pendente:0 });
});
