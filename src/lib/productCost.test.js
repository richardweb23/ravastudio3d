import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filamentProductionCost as cost, updateProductFilament as change } from './productCost.js';
test('custo do filamento usa centavos exatos e preserva o custo manual', () => {
 assert.equal(cost(150,90),'13.50');
 assert.equal(cost(1,5),'0.01');
 assert.equal(cost('0.001','90'), '0.00');
 for(const pair of [[0,90],[150,0],['',''],[null,90]]) assert.equal(cost(...pair),null);
 for(const pair of [[-1,90],[1,-2],['NaN',90],[1,Infinity],[1,'90.001'],['1.0001',90]]) assert.throws(()=>cost(...pair));
 let form={custo_medio:'25.00',filamento_gramas:0,filamento_valor_kg:0};
 form=change(form,'filamento_gramas','150');assert.equal(form.custo_medio,'25.00');
 form=change(form,'filamento_valor_kg','90');assert.equal(form.custo_medio,'13.50');
 form=change(form,'filamento_gramas','200');assert.equal(form.custo_medio,'18.00');
 form=change(form,'filamento_valor_kg','');assert.equal(form.custo_medio,'18.00');
 form={...form,custo_medio:'22.00'};
 form=change(form,'filamento_valor_kg','100');assert.equal(form.custo_medio,'20.00');
});
