import { PGlite } from '@electric-sql/pglite';
import { readFileSync,readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageTestSchema } from './storage-test-schema.mjs';

test('catálogo: códigos, histórico, permissões, publicação, aliases e ciclo das imagens',async t=>{
 const db=new PGlite(); t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;`);
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 let legacy;
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
  if(file==='202610200001_catalogo.sql'){
   legacy=await one("insert into public.materiais(nome,custo_medio,quantidade_atual) values('Produto vendido',27.43,0) returning *");
   await db.exec(storageTestSchema);
  }
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
 }
 const after=await one('select * from public.materiais where id=$1',[legacy.id]);
 assert.equal(Number(after.codigo),1); delete after.codigo;assert.deepEqual(after,legacy);
 const user='10000000-0000-4000-8000-000000000001';
 await db.query('insert into auth.users(id,email) values($1,$2)',[user,'catalog-test@example.invalid']);
 await db.query("update public.profiles set ativo=true,perfil='administrador' where id=$1",[user]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec('set role authenticated');
 const save=async(id,data,v=null)=>(await one('select to_jsonb(public.salvar_catalogo($1,$2,$3)) r',[id,data,v])).r;
 const pub=async(args={})=>(await one("select public.catalogo_publico($1,$2,$3,$4,$5) r",[args.search||'',args.category||null,args.order||'destaque',args.offset||0,args.slug||null])).r;
 const image=async(action,id,img=null,data={})=>(await one('select public.operar_imagem_catalogo($1,$2,$3,$4) r',[action,id,img,data])).r;
 const product=legacy.id;
 assert.equal((await pub()).total,0);
 let c=await save(product,{slug:'produto-vendido',descricao:'Peça com acabamento',preco_centavos:2590});
 assert.equal(c.status,'rascunho');
 await assert.rejects(save(product,{...c,status:'publicado',descricao:''},c.versao),/check/i);
 await assert.rejects(save(product,{...c,preco_centavos:-1},c.versao),/check/i);
 await assert.rejects(save(product,{...c,promocional_centavos:3000},c.versao),/check/i);
 c=await save(product,{...c,status:'publicado',promocional_centavos:1990},c.versao);
 await assert.rejects(save(product,c,0),/outra sessão/i);
 await assert.rejects(db.query('update public.materiais set codigo=999 where id=$1',[product]),/permanente/i);
 const historical=await one('select custo_medio,quantidade_atual,categoria from public.materiais where id=$1',[product]);
 c=await save(product,{...c,titulo:'Novo título',slug:'novo-titulo'},c.versao);
 assert.deepEqual(await one('select custo_medio,quantidade_atual,categoria from public.materiais where id=$1',[product]),historical);
 assert.equal((await pub({slug:'produto-vendido'})).produtos[0].slug,'novo-titulo');
 const next=await one("insert into public.materiais(nome) values('Outro') returning id,codigo");
 assert.equal(Number(next.codigo),2);
 await assert.rejects(save(next.id,{slug:'produto-vendido'}),/pertence/i);
 const duplicate=(await one('select public.duplicar_catalogo($1) id',[product])).id;
 assert.equal((await one('select status from public.catalogo_produtos where material_id=$1',[duplicate])).status,'rascunho');
 assert.equal(Number((await one('select quantidade_atual from public.materiais where id=$1',[duplicate])).quantidade_atual),0);
 await one('select public.duplicar_catalogo($1) id',[next.id]);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('catalogo-produtos','arquivo-nao-catalogado.webp')"),/row-level/i);
 const ready=[];
 for(let n=0;n<8;n++){
  const im=await image('reservar',product,null,{arquivo:`foto-${n}.jpg`});
  await assert.rejects(image('confirmar',product,im.id),/incompleto/i);
  await db.query("insert into storage.objects(bucket_id,name) values('catalogo-produtos',$1),('catalogo-produtos',$2)",[im.caminho,im.miniatura]);
  await image('confirmar',product,im.id);ready.push(im);
 }
 await assert.rejects(image('reservar',product,null,{arquivo:'nona.jpg'}),/8 imagens/i);
 const replacement=await image('reservar',product,null,{arquivo:'nova.jpg',substitui:ready[0].id});
 await assert.rejects(image('reservar',product,null,{arquivo:'duplicada.jpg',substitui:ready[0].id}),/indispon/i);
 await db.query("insert into storage.objects(bucket_id,name) values('catalogo-produtos',$1),('catalogo-produtos',$2)",[replacement.caminho,replacement.miniatura]);
 await image('confirmar',product,replacement.id);
 assert.equal((await pub()).produtos[0].imagens.length,8);
 assert.equal((await pub()).produtos[0].imagens[0].id,replacement.id);
 await assert.rejects(image('concluir_exclusao',product,ready[0].id),/arquivos/i);
 await db.query("delete from storage.objects where name=any($1)",[[ready[0].caminho,ready[0].miniatura]]);
 await image('concluir_exclusao',product,ready[0].id);
 const remaining=[replacement,...ready.slice(1)];
 await image('ordenar',product,null,{ids:remaining.map(i=>i.id).reverse()});
 assert.equal((await pub()).produtos[0].imagens[0].id,ready[7].id);
 await assert.rejects(image('ordenar',product,null,{ids:[ready[7].id,ready[7].id]}),/alteradas/i);
 await assert.rejects(db.query('select public.excluir_catalogo($1)',[product]),/imagens/i);
 await db.exec('set role anon');
 const visible=await pub();assert.equal(visible.total,1);
 assert.equal(visible.produtos[0].preco_centavos,2590);
 for(const forbidden of ['custo_medio','quantidade_atual','categoria_interna','versao','filamento_gramas']) assert.equal(forbidden in visible.produtos[0],false);
 await assert.rejects(db.query('select * from public.catalogo_produtos'),/permission denied/i);
 await assert.rejects(save(product,c,c.versao),/permission denied/i);
 await db.exec('reset role');
 await db.query("update public.profiles set ativo=false where id=$1",[user]);
 await db.exec('set role authenticated');
 assert.equal((await db.query('select * from public.catalogo_imagens')).rows.length,0);
 await assert.rejects(image('reservar',product,null,{arquivo:'negada.jpg'}),/autorizado/i);
 await assert.rejects(db.query("insert into public.catalogo_categorias(nome,slug) values('Teste','teste')"),/row-level/i);
 await db.exec('reset role');
 await db.query("update public.profiles set ativo=true where id=$1",[user]);
 await db.exec('set role authenticated');
 c=await save(product,{...c,status:'inativo'},c.versao);
 assert.equal((await pub()).total,0);
 for(const im of remaining){
  await image('remover',product,im.id);
  await db.query('delete from storage.objects where name=any($1)',[[im.caminho,im.miniatura]]);
  await image('concluir_exclusao',product,im.id);
 }
 await db.query('select public.excluir_catalogo($1)',[product]);
 assert.deepEqual(await one('select custo_medio,quantidade_atual,categoria from public.materiais where id=$1',[product]),historical);
 assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 // Public pagination/filtering and independent categories, including stockless products.
 const category=(await one("insert into public.catalogo_categorias(nome,slug) values('Decoração','decoracao') returning id")).id;
 for(let n=0;n<26;n++){
  const id=(await one("insert into public.materiais(nome) values($1) returning id",['Peça '+n])).id;
  await save(id,{slug:'peca-'+n,descricao:'Descrição',preco_centavos:n*100,categoria_id:category,status:'publicado'});
 }
 // Data de inclusão no catálogo define a ordem, inclusive entre páginas.
 await db.exec('reset role');
 for(let n=0;n<26;n++) await db.query("update public.catalogo_produtos set created_at = timestamptz '2025-01-01 00:00:00+00' + ($1::int * interval '1 minute'), destaque=($1=0) where slug=$2",[n,'peca-'+n]);
 await db.exec('set role authenticated');
 const recent1=await pub({category,order:'novos'}), recent2=await pub({category,order:'novos',offset:24});
 assert.equal(recent1.produtos.length,24); assert.equal(recent1.produtos[0].slug,'peca-25');
 assert.equal(recent1.produtos[23].slug,'peca-2'); assert.deepEqual(recent2.produtos.map(p=>p.slug),['peca-1','peca-0']);
 assert.equal((await pub({category,order:'destaque'})).produtos[0].slug,'peca-0');
 // Produtos Marketplace preservam o link e nunca expõem destinos inseguros.
 const market=(await one("insert into public.catalogo_categorias(nome,slug,marketplace) values('Indicações','indicacoes',true) returning id")).id;
 const mid=(await one("insert into public.materiais(nome) values('Indicado') returning id")).id;
 await assert.rejects(save(mid,{slug:'indicado',descricao:'Produto',categoria_id:market,status:'publicado'}),/link de compra/i);
 await assert.rejects(save(mid,{slug:'indicado',descricao:'Produto',categoria_id:market,status:'publicado',link_marketplace:'javascript:alert(1)'}),/check/i);
 let mp=await save(mid,{slug:'indicado',descricao:'Produto',categoria_id:market,status:'publicado',link_marketplace:'https://loja.example/produto?ref=123'});
 assert.equal((await pub({search:'Indicado'})).produtos[0].link_marketplace,'https://loja.example/produto?ref=123');
 assert.equal((await pub({search:'Indicado'})).produtos[0].marketplace,true);
 mp=await save(mid,{...mp,link_marketplace:'https://loja.example/novo'},mp.versao);
 assert.equal((await pub({search:'Indicado'})).produtos[0].link_marketplace,'https://loja.example/novo');
 mp=await save(mid,{...mp,categoria_id:category},mp.versao);
 assert.equal((await pub({search:'Indicado'})).produtos[0].marketplace,false);
 assert.equal((await pub({search:'Indicado'})).produtos[0].link_marketplace,null);
 await save(mid,{...mp,status:'inativo'},mp.versao);
 // Indicações são independentes de materiais e estoque e aparecem na vitrine.
 const beforeCounts=await one('select (select count(*) from public.materiais)::int materiais,(select count(*) from public.estoque_por_local)::int estoque');
 const standalone=(await one("insert into public.catalogo_indicacoes(titulo,slug,descricao,preco_centavos,categoria_id,link_marketplace,status,imagem_externa) values('Peça indicada','peca-indicada','Descrição externa',900,$1,'https://loja.example/item','publicado','https://loja.example/foto.jpg') returning *",[market]));
 assert.deepEqual(await one('select (select count(*) from public.materiais)::int materiais,(select count(*) from public.estoque_por_local)::int estoque'),beforeCounts);
 let publicItem=(await pub({search:'Peça indicada'})).produtos[0];
 assert.equal(publicItem.id,standalone.material_id); assert.equal(publicItem.marketplace,true); assert.equal(publicItem.imagem_externa,'https://loja.example/foto.jpg');
 assert.equal((await pub({slug:'peca-indicada'})).produtos[0].link_marketplace,'https://loja.example/item');
 await assert.rejects(db.query("update public.catalogo_indicacoes set link_marketplace='javascript:alert(1)' where material_id=$1",[standalone.material_id]),/check/i);
 await assert.rejects(db.query("update public.catalogo_indicacoes set categoria_id=$1 where material_id=$2",[category,standalone.material_id]),/Marketplace/i);
 await db.query('delete from public.catalogo_indicacoes where material_id=$1',[standalone.material_id]);
 assert.equal((await pub({slug:'peca-indicada'})).total,0);
 const page1=await pub({category,order:'preco_asc'});
 assert.equal(page1.total,26);assert.equal(page1.produtos.length,24);assert.equal(page1.produtos[0].preco_centavos,0);
 assert.equal((await pub({category,order:'preco_desc'})).produtos[0].preco_centavos,2500);
 assert.equal((await pub({category,offset:24})).produtos.length,2);
 assert.equal((await pub({search:'Peça 25'})).total,1);
 await db.query('update public.catalogo_categorias set ativa=false where id=$1',[category]);
 assert.equal((await pub()).total,0);
 await assert.rejects(db.query('delete from public.catalogo_categorias where id=$1',[category]),/foreign key/i);
 // Rollback refuses a remaining bucket, then preserves the original Gestão record.
 await db.exec('reset role');
 const down=readFileSync('supabase/rollback/202610200001_catalogo.sql','utf8');
 await assert.rejects(db.exec(down),/bucket/i);
 await db.exec('rollback');
 await db.exec("delete from storage.buckets where id='catalogo-produtos'");
 await db.exec(down);
 assert.equal((await one("select to_regclass('public.catalogo_produtos') value")).value,null);
 assert.deepEqual(await one('select custo_medio,quantidade_atual,categoria from public.materiais where id=$1',[product]),historical);
});
