import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageTestSchema } from './storage-test-schema.mjs';

test('board: migrações, subtarefas, isolamento, permissões e entrega', async t => {
 const db=new PGlite(); t.after(()=>db.close());
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  if(file==='202610200001_catalogo.sql') await db.exec(storageTestSchema);
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
 }
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const uid='10000000-0000-4000-8000-000000000001';
 await db.query('insert into auth.users(id,email) values($1,$2)',[uid,'board@example.invalid']);
 await db.query("update public.profiles set ativo=true,perfil='administrador' where id=$1",[uid]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.exec('set role authenticated');
 const a=await one("insert into public.pedidos(cliente) values('Mesmo cliente') returning *");
 const b=await one("insert into public.pedidos(cliente) values('Mesmo cliente') returning *");
 assert.equal(a.situacao,'normal');
 await db.query("select public.alterar_status_pedido($1,'em_preparacao')",[a.id]);
 assert.equal((await one('select status from public.pedidos where id=$1',[a.id])).status,'em_preparacao');
 const task=await one("insert into public.pedido_subtarefas(pedido_id,titulo) values($1,'  Imprimir tampa  ') returning *",[a.id]);
 assert.equal(task.titulo,'Imprimir tampa');
 assert.equal((await one('select count(*)::int n from public.pedido_subtarefas where pedido_id=$1',[b.id])).n,0);
 await db.query('update public.pedido_subtarefas set concluido=true,titulo=$1 where id=$2',['Tampa impressa',task.id]);
 assert.equal((await one('select concluido from public.pedido_subtarefas where id=$1',[task.id])).concluido,true);
 await assert.rejects(db.query('update public.pedido_subtarefas set pedido_id=$1 where id=$2',[b.id,task.id]),/transferida/);
 for(const title of ['   ', 'x'.repeat(151)]) await assert.rejects(db.query('insert into public.pedido_subtarefas(pedido_id,titulo) values($1,$2)',[a.id,title]),/check/);
 await assert.rejects(db.query("update public.pedidos set situacao='bloqueado' where id=$1",[a.id]),/check/);
 await assert.rejects(db.query("update public.pedidos set situacao_descricao=$1 where id=$2",['x'.repeat(251),a.id]),/check/);
 await db.query("update public.pedidos set situacao='bloqueado',situacao_descricao='Sem filamento' where id=$1",[a.id]);
 await db.query("select public.alterar_status_pedido($1,'pronto')",[a.id]);
 assert.equal((await one('select situacao from public.pedidos where id=$1',[a.id])).situacao,'bloqueado');
 // A edição comercial recria os itens: o vínculo da checklist deve sobreviver.
 const material=await one("insert into public.materiais(nome) values('Kit') returning id");
 await db.query('insert into public.pedido_itens(pedido_id,material_id,quantidade,preco_unitario) values($1,$2,1,100)',[a.id,material.id]);
 await db.query('delete from public.pedido_itens where pedido_id=$1',[a.id]);
 await db.query('insert into public.pedido_itens(pedido_id,material_id,quantidade,preco_unitario) values($1,$2,2,100)',[a.id,material.id]);
 assert.equal((await one('select count(*)::int n from public.pedido_subtarefas where pedido_id=$1',[a.id])).n,1);
 const removed=await one("insert into public.pedido_subtarefas(pedido_id,titulo) values($1,'Excluir') returning id",[a.id]);
 await db.query('delete from public.pedido_subtarefas where id=$1',[removed.id]);
 await db.exec('reset role');
 await db.query('update public.profiles set ativo=false where id=$1',[uid]);
 await db.exec('set role authenticated');
 assert.equal((await one('select count(*)::int n from public.pedido_subtarefas')).n,0);
 await assert.rejects(db.query("insert into public.pedido_subtarefas(pedido_id,titulo) values($1,'Negada')",[a.id]),/row-level security/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.pedido_subtarefas'),/permission denied/);
 await db.exec('reset role');
 await db.query('update public.profiles set ativo=true where id=$1',[uid]);
 // Fixture entregue sem executar movimentação financeira; regressões de entrega têm suíte própria.
 await db.exec('alter table public.pedidos disable trigger proteger_status_pedido');
 await db.query("update public.pedidos set status='entregue' where id=$1",[a.id]);
 await db.exec('alter table public.pedidos enable trigger proteger_status_pedido; set role authenticated');
 await assert.rejects(db.query("insert into public.pedido_subtarefas(pedido_id,titulo) values($1,'Não permitido')",[a.id]),/entregues/);
 await assert.rejects(db.query('update public.pedido_subtarefas set concluido=false where id=$1',[task.id]),/entregues/);
 await assert.rejects(db.query('delete from public.pedido_subtarefas where id=$1',[task.id]),/entregues/);
 assert.equal((await one('select count(*)::int n from public.pedido_subtarefas where pedido_id=$1',[a.id])).n,1);
});
