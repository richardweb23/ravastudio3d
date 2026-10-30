import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderAdvanceWarning, orderTooltip, orderStages } from './orderBoard.js';
test('avisos de avanço consideram apenas pendências do pedido e preservam liberdade de etapa', () => {
 const order = {id:'a', situacao:'bloqueado', situacao_descricao:'Falta filamento'};
 const tasks = [{pedido_id:'a',concluido:false},{pedido_id:'a',concluido:true},{pedido_id:'b',concluido:false}];
 assert.equal(orderStages.length,4);
 assert.equal(orderAdvanceWarning(order,tasks,'em_preparacao'),'');
 for(const status of ['pronto','entregue']) {
  assert.match(orderAdvanceWarning(order,tasks,status),/^1 subtarefa/);
  assert.match(orderAdvanceWarning(order,tasks,status),/Falta filamento/);
 }
 assert.equal(orderAdvanceWarning({...order,situacao:'normal'},[{pedido_id:'a',concluido:true}], 'pronto'),'');
});
test('tooltip não mistura pedidos do mesmo cliente ou pagamentos estornados', () => {
 const order={id:'a',cliente:'Maria',valor_total:100};
 const data={pedidoItens:[{pedido_id:'a',materiais:{nome:'Kit A'},quantidade:1,preco_unitario:100},{pedido_id:'b',materiais:{nome:'Kit B'}}],pagamentos:[{pedido_id:'b',valor:90},{pedido_id:'a',valor:20},{pedido_id:'a',valor:50,estornado_em:'2026-10-30'}]};
 const tip=orderTooltip(order,data);
 assert.match(tip,/Kit A/); assert.doesNotMatch(tip,/Kit B/); assert.match(tip,/80,00/);
});
