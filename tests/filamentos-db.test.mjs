import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('filamentos: entradas, baixas, isolamento de caixas, histórico e permissões', async t => {
 const db = new PGlite(); t.after(() => db.close());
 const user = randomUUID();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;`);
 const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
 for (const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync('supabase/migrations/'+f,'utf8').replace('create extension if not exists pgcrypto;',''));
 }
 await db.query('insert into auth.users(id,email) values($1,$2)',[user,'filamentos@example.invalid']);
 await db.query("update public.profiles set perfil='administrador',ativo=true where id=$1",[user]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec('set role authenticated');
 const marca=(await one("insert into public.filamento_marcas(nome,valor_medio_centavos) values('Marca teste',10000) returning id")).id;
 const date=(await one('select current_date::text as d')).d;
 const base={marca_id:marca,cor_nome:'Azul',cor_hex:'#123ABC',tipo:'PLA',categoria:'Matte',caixa:'Rivoxel',quantidade_gramas:1000,valor_kg_centavos:10000,data:date,observacao:'Entrada de teste'};
 const move=async(action,data,key=randomUUID())=>(await one('select public.movimentar_filamento($1,$2::jsonb,$3) id',[action,JSON.stringify(data),key])).id;
 const row=async id=>one('select * from public.filamento_estoque where id=$1',[id]);
 let id;
 await t.test('entrada idempotente e marca única',async()=>{
  const key=randomUUID();id=await move('entrada',base,key);
  assert.equal(await move('entrada',base,key),id);
  assert.equal(Number((await row(id)).quantidade_gramas),1000);
  await assert.rejects(move('entrada',{...base,quantidade_gramas:2000},key),/reutilizado/);
  await assert.rejects(db.query("insert into public.filamento_marcas(nome,valor_medio_centavos) values(' MARCA TESTE ',9000)"),/unique/i);
 });
 await t.test('reposição agrupa a variação e calcula custo médio ponderado',async()=>{
  assert.equal(await move('entrada',{...base,cor_nome:' azul ',quantidade_gramas:2000,valor_kg_centavos:16000}),id);
  assert.equal(Number((await row(id)).quantidade_gramas),3000);
  assert.equal(Number((await row(id)).custo_medio_centavos),14000);
 });
 await t.test('estoque é independente para cada caixa, tipo e categoria',async()=>{
  for(const difference of [{caixa:'Rava'},{caixa:'Bonecos'},{tipo:'PETG'},{categoria:'Silk'},{categoria:'Duo Color'}]) {
   const other=await move('entrada',{...base,...difference});assert.notEqual(other,id);
   assert.equal(Number((await row(other)).quantidade_gramas),1000);
  }
 });
 await t.test('baixa fracionada preserva custo e registra motivo; repetição não desconta novamente',async()=>{
  const key=randomUUID(), data={estoque_id:id,quantidade_gramas:250,data:date,observacao:'Impressão do pedido'};
  await move('baixa',data,key);await move('baixa',data,key);
  assert.equal(Number((await row(id)).quantidade_gramas),2750);
  assert.equal(Number((await row(id)).custo_medio_centavos),14000);
  const movement=await one('select * from public.filamento_movimentos where requisicao=$1',[key]);
  assert.equal(movement.observacao,data.observacao);assert.equal(movement.criado_por,user);
 });
 await t.test('baixa excessiva, sem motivo, quantidade inválida e escrita direta são bloqueadas',async()=>{
  const data={estoque_id:id,quantidade_gramas:3000,data:date,observacao:'Teste'};
  await assert.rejects(move('baixa',data),/insuficiente/);
  await assert.rejects(move('baixa',{...data,quantidade_gramas:1,observacao:''}),/motivo/);
  for(const quantidade_gramas of [0,-1,0.5,null]) await assert.rejects(move('entrada',{...base,quantidade_gramas}));
  await assert.rejects(move('entrada',{...base,caixa:'Outro'}));
  await assert.rejects(db.query('update public.filamento_estoque set quantidade_gramas=0'),/permission/);
  await assert.rejects(db.query('delete from public.filamento_movimentos'),/permission/);
  assert.equal(Number((await row(id)).quantidade_gramas),2750);
 });
 await t.test('zerar e repor não preserva custo do estoque antigo',async()=>{
  await move('baixa',{estoque_id:id,quantidade_gramas:2750,data:date,observacao:'Consumo final'});
  assert.equal(Number((await row(id)).quantidade_gramas),0);
  await move('entrada',{...base,quantidade_gramas:500,valor_kg_centavos:20000});
  assert.equal(Number((await row(id)).custo_medio_centavos),20000);
 });
 await t.test('remover baixa devolve somente ao estoque original, uma vez, preservando histórico',async()=>{
  const stockId=await move('entrada',{...base,cor_nome:'Verde',quantidade_gramas:1000,valor_kg_centavos:10000});
  const otherBox=await move('entrada',{...base,cor_nome:'Verde',caixa:'Bonecos',quantidade_gramas:1000});
  const key=randomUUID();await move('baixa',{estoque_id:stockId,quantidade_gramas:250,data:date,observacao:'Consumo incorreto'},key);
  const movement=await one('select * from public.filamento_movimentos where requisicao=$1',[key]);
  const undo=()=>one('select public.remover_baixa_filamento($1) id',[movement.id]);
  assert.equal((await undo()).id,stockId);await undo();
  assert.equal(Number((await row(stockId)).quantidade_gramas),1000);
  assert.equal(Number((await row(otherBox)).quantidade_gramas),1000);
  assert.equal(Number((await one('select count(*) n from public.filamento_movimentos where estorno_de=$1',[movement.id])).n),1);
  assert.equal((await one('select observacao from public.filamento_movimentos where id=$1',[movement.id])).observacao,'Consumo incorreto');
  const reversal=await one('select * from public.filamento_movimentos where estorno_de=$1',[movement.id]);
  assert.equal(reversal.criado_por,user);assert.equal(Number(reversal.quantidade_gramas),250);
  await assert.rejects(one('select public.remover_baixa_filamento($1)',[reversal.id]),/Somente baixas/);
  await assert.rejects(one('select public.remover_baixa_filamento($1)',[randomUUID()]),/não encontrada/);
  await assert.rejects(db.query('update public.filamento_movimentos set estorno_de=null where id=$1',[reversal.id]),/permission/);
 });
 await t.test('remoção após reposição restaura peso e custo original sem alterar entrada',async()=>{
  const stockId=await move('entrada',{...base,cor_nome:'Vermelho',quantidade_gramas:1000,valor_kg_centavos:10000});
  const key=randomUUID();await move('baixa',{estoque_id:stockId,quantidade_gramas:1000,data:date,observacao:'Baixa total'},key);
  await move('entrada',{...base,cor_nome:'Vermelho',quantidade_gramas:1000,valor_kg_centavos:20000});
  const movement=await one('select id from public.filamento_movimentos where requisicao=$1',[key]);
  await one('select public.remover_baixa_filamento($1)',[movement.id]);
  assert.equal(Number((await row(stockId)).quantidade_gramas),2000);
  assert.equal(Number((await row(stockId)).custo_medio_centavos),15000);
  const entry=await one("select id from public.filamento_movimentos where estoque_id=$1 and tipo='entrada' limit 1",[stockId]);
  await assert.rejects(one('select public.remover_baixa_filamento($1)',[entry.id]),/Somente baixas/);
 });
 await t.test('inativo e anônimo não acessam nem alteram o estoque',async()=>{
  await db.exec('reset role');await db.query('update public.profiles set ativo=false where id=$1',[user]);await db.exec('set role authenticated');
  assert.equal((await db.query('select * from public.filamento_estoque')).rows.length,0);
  await assert.rejects(move('entrada',base),/autorizado/);
  await assert.rejects(one('select public.remover_baixa_filamento($1)',[randomUUID()]),/autorizado/);
  await db.exec('set role anon');await assert.rejects(move('entrada',base),/permission/);
  await assert.rejects(one('select public.remover_baixa_filamento($1)',[randomUUID()]),/permission/);
 });
});
