import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('custo de produto: migração preserva legado e cálculo persiste no custo existente',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;`);
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 let legacy;
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
  if(file==='202610160001_custo_filamento_produto.sql') legacy=(await one("insert into public.materiais(nome,custo_medio) values('Legado',27.43) returning id")).id;
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
 }
 const user=randomUUID();await db.query('insert into auth.users(id,email) values($1,$2)',[user,'cost@example.invalid']);
 await db.query("update public.profiles set ativo=true,perfil='administrador' where id=$1",[user]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');
 const source=(await one("select id from public.locais_estoque where tipo='principal' limit 1")).id;
 const row=id=>one('select * from public.materiais where id=$1',[id]);
 const save=async(id,grams,kg,cost,quantity=0)=>(await one("select public.salvar_material($1,'Produto',$2,$3,$4,'Rava',$5,$6) id",[id,cost,quantity,source,grams,kg])).id;
 assert.equal(Number((await row(legacy)).custo_medio),27.43);
 assert.equal(Number((await row(legacy)).filamento_gramas),0);assert.equal(Number((await row(legacy)).filamento_valor_kg),0);
 await save(legacy,0,0,27.43);assert.equal(Number((await row(legacy)).custo_medio),27.43);
 await save(legacy,150,0,30);assert.equal(Number((await row(legacy)).custo_medio),30);
 await save(legacy,150,90,999);assert.equal(Number((await row(legacy)).custo_medio),13.5);
 await save(legacy,200,90,999);assert.equal(Number((await row(legacy)).custo_medio),18);
 await save(legacy,200,0,null);assert.equal(Number((await row(legacy)).custo_medio),18);
 await save(legacy,200,0,31.25);assert.equal(Number((await row(legacy)).custo_medio),31.25);
 await save(legacy,null,null,null);assert.equal(Number((await row(legacy)).custo_medio),31.25);
 const id=await save(null,150,90,999,5);
 assert.equal(Number((await row(id)).custo_medio),13.5);
 const stock=await one('select * from public.estoque_por_local where material_id=$1',[id]);
 await save(id,1,5,0,5);assert.equal(Number((await row(id)).custo_medio),0.01);
 assert.deepEqual(await one('select * from public.estoque_por_local where material_id=$1',[id]),stock);
 await db.query('update public.materiais set custo_medio=999 where id=$1',[id]);assert.equal(Number((await row(id)).custo_medio),0.01);
 await db.query('update public.materiais set filamento_gramas=0 where id=$1',[id]);assert.equal(Number((await row(id)).custo_medio),0.01);
 await db.query('update public.materiais set custo_medio=7.12 where id=$1',[id]);assert.equal(Number((await row(id)).custo_medio),7.12);
 for(const pair of [[-1,90],[1,-1],['NaN',90],['Infinity',90],[1,90.001],[1.0001,90]]) await assert.rejects(save(id,...pair,0,5),/inválidos/i);
 assert.equal(Number((await row(id)).custo_medio),7.12);
 await assert.rejects(db.query('update public.materiais set filamento_gramas=-1 where id=$1',[id]),/check/i);
 await assert.rejects(db.query("select public.salvar_material($1,'',0,5,$2,'Rava',150,90)",[id,source]),/nome/i);
 assert.equal(Number((await row(id)).custo_medio),7.12);
 const manual=await save(null,0,0,12.34);assert.equal(Number((await row(manual)).custo_medio),12.34);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(save(id,150,90,0,5),/autorizado/i);
});
