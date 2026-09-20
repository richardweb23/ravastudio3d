import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesProductCategory, saleProductCategory } from './produtos.js';
import { saleTotal } from './vendas.js';

test('filtro de produtos usa categoria do cadastro e não a caixa financeira', () => {
  const sales = [
    { materiais:{categoria:'Rava'},caixa:'Bonecos',quantidade:2,preco_unitario:10 },
    { materiais:{categoria:'Bonecos'},caixa:'Rava',quantidade:3,preco_unitario:15 },
    { materiais:{categoria:'Rava'},caixa:'Rava',quantidade:1,preco_unitario:10,devolvida_em:'2026-09-20' }
  ];
  const filtered=sales.filter(sale => matchesProductCategory(sale,'Rava'));
  assert.equal(filtered.length,2);
  assert.equal(filtered.reduce((total,sale)=>total+saleTotal(sale),0),20);
  assert.equal(sales.filter(sale => matchesProductCategory(sale,'')).length,3);
  assert.equal(matchesProductCategory(sales[0],'Bonecos'),false);
  sales[0].materiais.categoria='Bonecos';
  assert.equal(matchesProductCategory(sales[0],'Bonecos'),true);
  assert.equal(sales[0].caixa,'Bonecos');
  assert.equal(saleProductCategory({}),'Rivoxel');
});
