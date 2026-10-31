import { test } from 'node:test';
import assert from 'node:assert/strict';
import { custoItensPedido, sugestaoRecebimento } from './recebimentoPedido.js';
test('sugestão proporcional respeita parciais, limites e centavos', () => {
 assert.deepEqual(sugestaoRecebimento(7500,15000,3500),{materiais:1750,restante:5750});
 assert.deepEqual(sugestaoRecebimento(1,300,100),{materiais:0,restante:1});
 assert.deepEqual(sugestaoRecebimento(500,1000,3000),{materiais:500,restante:0});
 assert.deepEqual(sugestaoRecebimento(500,1000,0),{materiais:0,restante:500});
 assert.equal(sugestaoRecebimento(500,0,100),null); assert.equal(sugestaoRecebimento(500,1000,null),null);
});
test('custo combina quantidade, valor atual e detecta produtos ausentes', () => {
 const items=[{material_id:'a',quantidade:2},{material_id:'b',quantidade:0.5}];
 assert.equal(custoItensPedido(items,[{id:'a',custo_medio:10},{id:'b',custo_medio:3}]),2150);
 assert.equal(custoItensPedido(items,[{id:'a',custo_medio:10}]),null);
});
