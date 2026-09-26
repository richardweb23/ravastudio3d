import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('caixa e reembolsos: migração, saldos, integridade e recebimentos',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const user=randomUUID();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;`);
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 let historical,richard,xandy;
 for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()){
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
  if(file==='202609050001_initial_schema.sql'){
   await db.query('insert into auth.users(id,email) values($1,$2)',[user,'cash-test@example.invalid']);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
   await db.query("update public.profiles set perfil='administrador' where id=$1",[user]);
  }
  if(file==='202609230001_pagamento_vendas.sql'){
   richard=(await one("select id from public.financeiro_socios where nome ilike 'Richard%'")).id;
   xandy=(await one("select id from public.financeiro_socios where id<>$1",[richard])).id;
   const d=(await one("insert into public.financeiro_despesas(nome,valor_total_centavos,forma_pagamento,primeiro_vencimento) values('Despesa histórica',256933,'pix',current_date-40) returning id")).id;
   historical=(await one('insert into public.financeiro_parcelas(despesa_id,numero,total_parcelas,valor_centavos,vencimento) values($1,1,1,256933,current_date-40) returning id',[d])).id;
   await db.query("select public.salvar_pagamentos_parcela($1,jsonb_build_array(jsonb_build_object('valor_centavos',256933,'data_pagamento',current_date-40,'pago_por_tipo','socio','socio_id',$2::text)))",[historical,richard]);
  }
 }
 await db.exec('set role authenticated');
 const date=(await one("select current_date::text as d")).d;
 const earlier=(await one("select (current_date-30)::text as d")).d;
 const op=async(action,data,key=randomUUID())=>(await one('select public.financeiro_operar($1,$2::jsonb,$3) r',[action,JSON.stringify(data),key])).r;
 const summary=async()=>(await one('select public.financeiro_resumo() r')).r;
 const saldo=async(box)=>Number((await summary()).caixas.find(c=>c.nome===box).saldo_centavos);
 const partner=async()=> (await summary()).socios.find(s=>s.id===richard);
 let reimbursement,movement;
 await t.test('histórico gera crédito integral, sem caixa e sem presumir reembolso',async()=>{
  assert.equal(Number((await partner()).saldo_centavos),256933);
  assert.equal((await summary()).abertura,null);
  await assert.rejects(op('reembolso',{data:date,caixa:'Rava',socio_id:richard,valor_centavos:50000}),/abertura/i);
 });
 await t.test('abertura única não contabiliza novamente despesas históricas',async()=>{
  await op('abertura',{data:earlier,saldos:{Rava:100000,Rivoxel:0,Bonecos:0}});
  assert.equal(await saldo('Rava'),100000);
  assert.equal(Number((await partner()).saldo_centavos),256933);
  await assert.rejects(op('abertura',{data:earlier,saldos:{Rava:1,Rivoxel:0,Bonecos:0}}),/já registrada/i);
 });
 await t.test('reembolso parcial vincula despesa e bloqueia desfazer a baixa; repetição não duplica',async()=>{
  const payload={data:date,caixa:'Rava',socio_id:richard,valor_centavos:50000,descricao:'Devolução parcial'};
  const key=randomUUID();reimbursement=await op('reembolso',payload,key);
  assert.deepEqual(await op('reembolso',payload,key),reimbursement);
  assert.equal(Number((await partner()).saldo_centavos),206933);
  assert.equal(await saldo('Rava'),50000);
  assert.equal(Number((await one('select sum(valor_centavos) n from public.financeiro_reembolso_itens where reembolso_id=$1',[reimbursement.id])).n),50000);
  await assert.rejects(db.query('select public.excluir_pagamentos_parcela($1)',[historical]),/reembolsado/i);
  await assert.rejects(op('reembolso',{...payload,valor_centavos:50001},key),/reutilizado/i);
  await assert.rejects(op('reembolso',{...payload,valor_centavos:60000}),/insuficiente/i);
  await assert.rejects(op('reembolso',{...payload,valor_centavos:300000}),/crédito/i);
 });
 await t.test('estorno de reembolso restaura caixa e crédito, sem apagar a despesa',async()=>{
  await op('estorno',{data:date,movimento_id:reimbursement.movimento_id,descricao:'Correção'});
  assert.equal(Number((await partner()).saldo_centavos),256933);
  assert.equal(await saldo('Rava'),100000);
  assert.equal((await one('select pago from public.financeiro_parcelas where id=$1',[historical])).pago,true);
 });
 await t.test('despesa dividida gera créditos individuais e apenas uma saída de caixa',async()=>{
  const d=(await one("select public.salvar_despesa_financeira(null,jsonb_build_object('nome','Dividida','valor_total_centavos',30000,'forma_pagamento','pix','quantidade_parcelas',1,'primeiro_vencimento',current_date)) id")).id;
  const p=(await one('select id from public.financeiro_parcelas where despesa_id=$1',[d])).id;
  const payments=[{valor_centavos:10000,data_pagamento:date,pago_por_tipo:'socio',socio_id:richard},{valor_centavos:10000,data_pagamento:date,pago_por_tipo:'socio',socio_id:xandy},{valor_centavos:10000,data_pagamento:date,pago_por_tipo:'caixa',caixa:'Rava'}];
  await db.query('select public.salvar_pagamentos_parcela($1,$2::jsonb)',[p,JSON.stringify(payments)]);
  assert.equal(await saldo('Rava'),90000);assert.equal(Number((await partner()).saldo_centavos),266933);
  await assert.rejects(db.query('select public.salvar_pagamentos_parcela($1,$2::jsonb)',[p,JSON.stringify(payments)]),/já paga/i);
  await assert.rejects(db.query('delete from public.financeiro_despesas where id=$1',[d]),/histórico|operações/i);
  await db.query('select public.excluir_pagamentos_parcela($1)',[p]);
  assert.equal(await saldo('Rava'),100000);assert.equal(Number((await partner()).saldo_centavos),256933);
  assert.equal(Number((await one('select count(*) n from public.financeiro_pagamentos_parcela where parcela_id=$1',[p])).n),3);
  assert.equal((await one('select pago from public.financeiro_parcelas where id=$1',[p])).pago,false);
 });
 await t.test('recebimento futuro não financia saída retroativa, estorno sem saldo é bloqueado',async()=>{
  movement=await op('entrada',{data:date,caixa:'Bonecos',valor_centavos:10000,descricao:'Entrada teste'});
  await assert.rejects(op('reembolso',{data:earlier,caixa:'Bonecos',socio_id:richard,valor_centavos:5000}),/insuficiente/i);
  const r=await op('reembolso',{data:date,caixa:'Bonecos',socio_id:richard,valor_centavos:5000});
  await assert.rejects(op('estorno',{data:date,movimento_id:movement.movimento_id,descricao:'Erro'}),/insuficiente/i);
  await op('estorno',{data:date,movimento_id:r.movimento_id,descricao:'Correção'});
 });
 await t.test('pedido antecipado com desconto e entrega não duplica entrada',async()=>{
  const source=(await one("select id from public.locais_estoque where tipo='principal' limit 1")).id;
  const product=(await one("select public.salvar_material(null,'Produto pedido',2,10,$1) id",[source])).id;
  const order=(await one("insert into public.pedidos(cliente,local_estoque_id,valor_total,desconto) values('Cliente teste',$1,180,20) returning id",[source])).id;
  await db.query('insert into public.pedido_itens(pedido_id,material_id,quantidade,preco_unitario) values($1,$2,2,100)',[order,product]);
  const before=await saldo('Rivoxel');
  const receipt=await op('receber_pedido',{pedido_id:order,data:date,caixa:'Rivoxel',valor_centavos:5000,metodo:'pix'});
  assert.equal(await saldo('Rivoxel'),before+5000);
  await assert.rejects(db.query('delete from public.pedidos where id=$1',[order]),/histórico/i);
  await db.query("select public.alterar_status_pedido($1,'entregue','Bonecos')",[order]);
  assert.equal(await saldo('Rivoxel'),before+5000);
  await op('receber_pedido',{pedido_id:order,data:date,caixa:'Rivoxel',valor_centavos:13000,metodo:'pix'});
  assert.equal(await saldo('Rivoxel'),before+18000);
  await assert.rejects(op('receber_pedido',{pedido_id:order,data:date,caixa:'Rivoxel',valor_centavos:1,metodo:'pix'}),/saldo do pedido/i);
  await op('estorno',{data:date,movimento_id:receipt.movimento_id,descricao:'Duplicação corrigida'});
  assert.equal(await saldo('Rivoxel'),before+13000);
 });
 await t.test('venda recebe na data real; devolução do estoque não devolve dinheiro',async()=>{
  const source=(await one("select id from public.locais_estoque where tipo='principal' limit 1")).id;
  const product=(await one("select public.salvar_material(null,'Boneco',2,2,$1) id",[source])).id;
  const id=(await one("select public.registrar_venda($1,$2,null,1,110,current_date-1,'Bonecos',false,current_date) id",[product,source])).id;
  const before=await saldo('Bonecos');
  await db.query('select public.alterar_pagamento_venda($1,true,0,current_date)',[id]);
  assert.equal(await saldo('Bonecos'),before+11000);
  const receipt=await one("select *,data::text as data_texto from public.financeiro_movimentos where tipo='venda' and origem_id=$1",[id]);
  assert.equal(receipt.data_texto,date);
  await db.query("select public.devolver_venda($1,$2,'Devolução',1)",[id,source]);
  assert.equal(await saldo('Bonecos'),before+11000);
  await op('devolucao_cliente',{data:date,movimento_id:receipt.id,valor_centavos:11000,descricao:'Pix devolvido'});
  assert.equal(await saldo('Bonecos'),before);
  await assert.rejects(op('devolucao_cliente',{data:date,movimento_id:receipt.id,valor_centavos:1,descricao:'Duplicada'}),/acima do recebido/i);
  await assert.rejects(op('estorno',{data:date,movimento_id:receipt.id,descricao:'Erro'}),/primeiro a devolução/i);
 });
 await t.test('escrita direta e usuário inativo não contornam saldos',async()=>{
  await assert.rejects(db.query("insert into public.financeiro_movimentos(caixa,data,valor_centavos,tipo,descricao) values('Rava',current_date,100,'entrada','Fraude')"),/permission/i);
  await assert.rejects(db.query('delete from public.financeiro_pagamentos_parcela'),/histórico|operações|permission/i);
  await db.exec('reset role');await db.query('update public.profiles set ativo=false where id=$1',[user]);await db.exec('set role authenticated');
  await assert.rejects(op('entrada',{data:date,caixa:'Rava',valor_centavos:100,descricao:'Teste'}),/autorizado/i);
  assert.equal((await one('select public.financeiro_resumo() r')).r,null);
 });
});
