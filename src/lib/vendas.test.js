import { test } from "node:test";
import assert from "node:assert/strict";
import { saleTotal, saleQuantity, salesByBox } from "./vendas.js";
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

test('totais por caixa respeitam mês, devoluções e padrão das vendas antigas', () => {
 const sales=[
  {pago:true,data:'2026-09-01',quantidade:2,preco_unitario:10},
  {pago:true,data:'2026-09-02',caixa:'Rava',quantidade:3,preco_unitario:10},
  {pago:true,data:'2026-09-03',caixa:'Bonecos',quantidade:1,preco_unitario:15},
  {pago:true,data:'2026-09-04',caixa:'Rava',quantidade:5,preco_unitario:10,devolvida_em:'2026-09-05'},
  {pago:true,data:'2026-08-01',caixa:'Bonecos',quantidade:8,preco_unitario:10}
 ];
 assert.deepEqual(salesByBox(sales,'2026-09'),{Rivoxel:20,Rava:30,Bonecos:15});
 sales[0].caixa='Bonecos';
 assert.deepEqual(salesByBox(sales,'2026-09'),{Rivoxel:0,Rava:30,Bonecos:35});
 assert.deepEqual(salesByBox([],'2026-09'),{Rivoxel:0,Rava:0,Bonecos:0});
});

test('caixa só contabiliza pagamento confirmado, sem alterar o total vendido', () => {
 const sale = {data:'2026-09-23',caixa:'Bonecos',quantidade:1,preco_unitario:110,pago:false};
 assert.equal(saleTotal(sale),110);
 assert.equal(salesByBox([sale],'2026-09').Bonecos,0);
 assert.equal(salesByBox([{...sale,pago:undefined}],'2026-09').Bonecos,0);
 assert.equal(salesByBox([{...sale,pago:true}],'2026-09').Bonecos,110);
 assert.equal(salesByBox([{...sale,pago:true,devolvida_em:'2026-09-23'}],'2026-09').Bonecos,0);
});
