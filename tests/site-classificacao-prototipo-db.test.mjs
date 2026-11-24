import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageTestSchema } from './storage-test-schema.mjs';

test('classificação do site não altera os dados operacionais', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create function public.usuario_ativo() returns boolean language sql stable as $$
      select current_setting('teste.usuario_ativo',true)='sim'
    $$;
    create table public.materiais(id uuid primary key, nome text, categoria text, custo numeric, quantidade numeric, codigo bigint);
    create table public.catalogo_categorias(id uuid primary key, ativa boolean, marketplace boolean);
    create table public.catalogo_produtos(material_id uuid primary key references public.materiais(id), titulo text default '', preco numeric,
      slug text, descricao text, resumo text, preco_centavos bigint, promocional_centavos bigint, categoria_id uuid, link_marketplace text,
      material text, dimensoes text, peso_gramas numeric, cores text, personalizavel boolean, prazo text, destaque boolean, ordem integer,
      created_at timestamptz default now(), status text);
    create table public.catalogo_indicacoes(material_id uuid primary key, titulo text, slug text, descricao text, resumo text,
      preco_centavos bigint, promocional_centavos bigint, categoria_id uuid, link_marketplace text, material text, dimensoes text,
      peso_gramas numeric, cores text, personalizavel boolean, prazo text, destaque boolean, ordem integer, created_at timestamptz default now(), status text, imagem_externa text);
    create table public.catalogo_slugs(slug text primary key, material_id uuid);
    create table public.catalogo_imagens(id uuid, material_id uuid, caminho text, miniatura text, alt text, estado text, ordem integer);
    create table public.caixas(id uuid primary key, valor numeric);
    insert into public.materiais values ('10000000-0000-4000-8000-000000000001','Teste','Bonecos',12,5,1);
    insert into public.catalogo_produtos(material_id,preco,slug,status) values ('10000000-0000-4000-8000-000000000001',20,'teste','publicado');
    insert into public.catalogo_slugs values ('teste','10000000-0000-4000-8000-000000000001');
    insert into public.catalogo_categorias values ('40000000-0000-4000-8000-000000000001',true,true);
    insert into public.catalogo_indicacoes(material_id,titulo,slug,categoria_id,status) values ('30000000-0000-4000-8000-000000000001','Indicação','indicacao','40000000-0000-4000-8000-000000000001','publicado');
    insert into public.caixas values ('20000000-0000-4000-8000-000000000001',120);
  `);
  await db.exec(readFileSync('supabase/propostas/catalogo_site_categorias.sql', 'utf8'));
  const product = '10000000-0000-4000-8000-000000000001';
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const before = await one('select to_jsonb(m) material,(select to_jsonb(c) from public.caixas c) caixa,(select to_jsonb(p) from public.catalogo_produtos p) catalogo from public.materiais m');
  const sub = await one("insert into public.site_subcategorias(principal_id,nome) values('rivoxel','Bonecos geek') returning id");
  await db.exec("select set_config('teste.usuario_ativo','sim',false); set role authenticated");
  const nova = await one("select public.site_salvar_subcategoria(null,'rava','Decoração',true) id");
  await db.query("select public.site_classificar_indicacao($1,'rava',$2)", ['30000000-0000-4000-8000-000000000001', nova.id]);
  await assert.rejects(db.query("select public.site_classificar_indicacao($1,'rivoxel',$2)", ['30000000-0000-4000-8000-000000000001', nova.id]), /subcategoria ativa/i);
  await db.query("select public.site_classificar_produto($1,'rivoxel',$2)", [product, sub.id]);
  const config = (await one('select public.site_configuracao_catalogo() config')).config;
  assert.deepEqual(config.principais.map(c => c.nome), ['Rava', 'Rivoxel']);
  assert.equal(config.produtos.find(c => c.produto_id === product).principal_id, 'rivoxel');
  assert.deepEqual(await one('select principal_id,subcategoria_id from public.site_classificacao_produtos where produto_id=$1', [product]), { principal_id: 'rivoxel', subcategoria_id: sub.id });
  const catalog = async (principal, subcategoria = null) => (await one('select public.site_catalogo_publico($1,p_subcategoria_id => $2) result', [principal, subcategoria])).result;
  assert.equal((await catalog('rava')).total, 1);
  assert.equal((await catalog('rivoxel')).total, 1);
  assert.deepEqual((await catalog('rivoxel')).produtos.map(p => p.id), [product]);
  assert.deepEqual((await catalog('rivoxel')).categorias.map(c => c.nome), ['Bonecos geek']);
  assert.equal((await catalog('rava', sub.id)).total, 0);
  assert.equal((await catalog('rivoxel', sub.id)).total, 1);
  await assert.rejects(db.query("select public.site_classificar_produto($1,'rava',$2)", [product, sub.id]), /subcategoria ativa/i);
  await db.query("select public.site_classificar_produto($1,'rava',null)", [product]);
  await db.exec('reset role');
  const after = await one('select to_jsonb(m) material,(select to_jsonb(c) from public.caixas c) caixa,(select to_jsonb(p) from public.catalogo_produtos p) catalogo from public.materiais m');
  assert.deepEqual(after, before);
  await db.exec("select set_config('teste.usuario_ativo','nao',false); set role authenticated");
  await assert.rejects(db.query("select public.site_classificar_produto($1,'rivoxel',null)", [product]), /não autorizado/i);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select public.site_configuracao_catalogo()'), /permission denied/i);
  assert.equal((await catalog('rava')).total, 2);
  assert.equal((await catalog('rivoxel')).total, 0);
  await assert.rejects(db.query('select * from public.site_classificacao_produtos'), /permission denied/i);
});

test('consulta por categoria principal usa o schema anterior e filtra antes da paginação', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;`);
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < '202611230001').sort()) {
    if (file === '202610200001_catalogo.sql') await db.exec(storageTestSchema);
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const before = await one("select pg_get_functiondef('public.catalogo_publico(text,uuid,text,integer,text)'::regprocedure) as definicao");
  await db.exec(readFileSync('supabase/propostas/catalogo_site_categorias.sql', 'utf8'));
  assert.deepEqual(await one("select pg_get_functiondef('public.catalogo_publico(text,uuid,text,integer,text)'::regprocedure) as definicao"), before);
  await db.exec(`
    insert into public.materiais(id,nome,categoria) values
      ('10000000-0000-4000-8000-000000000001','Rava teste','Rava'),
      ('10000000-0000-4000-8000-000000000002','Rivoxel teste','Bonecos'),
      ('10000000-0000-4000-8000-000000000003','Rivoxel rascunho','Rivoxel');
    insert into public.catalogo_produtos(material_id,slug,descricao,status,preco_centavos) values
      ('10000000-0000-4000-8000-000000000001','rava-teste','Peça Rava','publicado',1000),
      ('10000000-0000-4000-8000-000000000002','rivoxel-teste','Peça Rivoxel','publicado',2000),
      ('10000000-0000-4000-8000-000000000003','rivoxel-rascunho','Peça oculta','rascunho',3000);
    insert into public.catalogo_slugs(slug,material_id) select slug,material_id from public.catalogo_produtos;
    insert into public.site_subcategorias(id,principal_id,nome) values
      ('20000000-0000-4000-8000-000000000001','rava','Decoração'),
      ('20000000-0000-4000-8000-000000000002','rivoxel','Geek');
    insert into public.site_classificacao_produtos values
      ('10000000-0000-4000-8000-000000000001','rava','20000000-0000-4000-8000-000000000001'),
      ('10000000-0000-4000-8000-000000000002','rivoxel','20000000-0000-4000-8000-000000000002'),
      ('10000000-0000-4000-8000-000000000003','rivoxel',null);
    set role anon;
  `);
  const query = async (brand, sub = null, slug = null) => (await one('select public.site_catalogo_publico($1,p_subcategoria_id => $2,p_slug => $3) r', [brand,sub,slug])).r;
  assert.deepEqual((await query('rava')).produtos.map(p => p.nome), ['Rava teste']);
  assert.deepEqual((await query('rivoxel')).produtos.map(p => p.nome), ['Rivoxel teste']);
  assert.deepEqual((await query('rivoxel')).categorias.map(c => c.nome), ['Geek']);
  assert.equal((await query('rava','20000000-0000-4000-8000-000000000002')).total, 0);
  assert.equal((await query('rivoxel','20000000-0000-4000-8000-000000000002')).total, 1);
  assert.equal((await query('rava',null,'rivoxel-teste')).total, 0);
  assert.equal((await query('rivoxel',null,'rivoxel-rascunho')).total, 0);
  await db.exec(`reset role;
    insert into public.materiais(nome,categoria) select 'Rava extra '||n,'Rava' from generate_series(1,25) n;
    insert into public.catalogo_produtos(material_id,slug,descricao,status,preco_centavos)
      select id,'rava-extra-'||codigo,'Peça extra','publicado',1000 from public.materiais where nome like 'Rava extra %';
    insert into public.site_classificacao_produtos(produto_id,principal_id)
      select id,'rava' from public.materiais where nome like 'Rava extra %';
    set role anon;`);
  assert.equal((await query('rava')).total, 26);
  assert.equal((await query('rava')).produtos.length, 24);
  assert.equal((await query('rivoxel')).total, 1);
  assert.equal((await one("select public.site_catalogo_publico('rava',p_offset => 24) r")).r.produtos.length, 2);
  await db.exec("reset role; update public.site_subcategorias set ativa=false where id='20000000-0000-4000-8000-000000000002'; set role anon");
  assert.equal((await query('rivoxel')).total, 0);
  assert.deepEqual((await query('rivoxel')).categorias, []);
});

test('transferência de homologação preserva produtos, preços e categorias anteriores', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;`);
  let originalDuplication, originalPublicCatalog;
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    if (file === '202610200001_catalogo.sql') await db.exec(storageTestSchema);
    if (file === '202611230003_catalogo_por_marca.sql') originalPublicCatalog = (await db.query("select pg_get_functiondef('public.catalogo_publico(text,uuid,text,integer,text)'::regprocedure) definition")).rows[0].definition;
    if (file === '202611230006_duplicar_produto_marca.sql') originalDuplication = (await db.query("select pg_get_functiondef('public.duplicar_catalogo(uuid)'::regprocedure) definition")).rows[0].definition;
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  await db.exec(`
    insert into public.materiais(id,nome,categoria,custo_medio,quantidade_atual) values
      ('10000000-0000-4000-8000-000000000011','Produto A','Bonecos',3,7),
      ('10000000-0000-4000-8000-000000000012','Produto B','Rivoxel',5,9),
      ('10000000-0000-4000-8000-000000000013','Rascunho','Rava',6,2);
    update public.marca_materiais set marca_id=(select id from public.marcas where slug='rivoxel') where material_id='10000000-0000-4000-8000-000000000012';
    insert into public.catalogo_categorias(id,nome,slug,marketplace) values
      ('20000000-0000-4000-8000-000000000011','Decoração','decoracao-teste',true),
      ('20000000-0000-4000-8000-000000000012','Geek','geek-teste',false);
    update public.marca_categorias_catalogo set marca_id=(select id from public.marcas where slug='rivoxel') where categoria_id='20000000-0000-4000-8000-000000000012';
    insert into public.catalogo_produtos(material_id,slug,descricao,status,preco_centavos,categoria_id) values
      ('10000000-0000-4000-8000-000000000011','produto-a','Descrição A','publicado',1000,'20000000-0000-4000-8000-000000000011'),
      ('10000000-0000-4000-8000-000000000012','produto-b','Descrição B','publicado',2000,'20000000-0000-4000-8000-000000000012'),
      ('10000000-0000-4000-8000-000000000013','rascunho-transferencia','Rascunho','rascunho',3000,null);
    insert into public.catalogo_slugs(slug,material_id) select slug,material_id from public.catalogo_produtos;
    insert into public.catalogo_indicacoes(material_id,titulo,slug,descricao,status,preco_centavos,categoria_id,link_marketplace) values
      ('30000000-0000-4000-8000-000000000011','Indicação','indicacao-teste','Descrição','publicado',500,'20000000-0000-4000-8000-000000000011','https://example.com');
    insert into public.pedidos(id,cliente) values ('40000000-0000-4000-8000-000000000011','Cliente fictício');
    insert into public.pedido_itens(pedido_id,material_id,quantidade,preco_unitario) values ('40000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000011',1,10);
  `);
  const snapshot = () => one(`select
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.materiais m) materiais,
    (select jsonb_agg(to_jsonb(p) order by p.material_id) from public.catalogo_produtos p) produtos,
    (select jsonb_agg(to_jsonb(c) order by c.id) from public.catalogo_categorias c) categorias,
    (select jsonb_agg(to_jsonb(i) order by i.material_id) from public.catalogo_indicacoes i) indicacoes,
    (select jsonb_agg(to_jsonb(c) order by c.nome) from public.financeiro_caixas c) caixas,
    (select jsonb_agg(to_jsonb(p) order by p.id) from public.pedidos p) pedidos,
    (select jsonb_agg(to_jsonb(i) order by i.id) from public.pedido_itens i) itens_pedido`);
  const before = await snapshot();
  const oldRava = (await one("select public.catalogo_publico_marca('rava') r")).r;
  const oldRivoxel = (await one("select public.catalogo_publico_marca('rivoxel') r")).r;
  const salvarMaterial = (await one("select pg_get_functiondef('public.salvar_material(uuid,text,numeric,numeric,uuid,text,numeric,numeric)'::regprocedure) definition")).definition;
  await db.exec(readFileSync('supabase/propostas/catalogo_site_categorias.sql', 'utf8'));
  const transfer = readFileSync('supabase/propostas/catalogo_site_transferencia_homologacao.sql', 'utf8');
  await db.exec("insert into public.catalogo_categorias(id,nome,slug,pai_id) values ('20000000-0000-4000-8000-000000000013','Subnível','subnivel-teste','20000000-0000-4000-8000-000000000011')");
  await assert.rejects(db.exec(transfer), /mais de um nível/i);
  await db.exec("rollback; delete from public.catalogo_categorias where id='20000000-0000-4000-8000-000000000013'");
  assert.equal((await one('select count(*)::int n from public.site_subcategorias')).n, 0);
  await db.exec(transfer);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await one("select count(*)::int n from public.site_classificacao_produtos where produto_id='10000000-0000-4000-8000-000000000013'")).n, 0);
  for (const [brand, previous] of [['rava', oldRava], ['rivoxel', oldRivoxel]]) {
    const next = (await one('select public.site_catalogo_publico($1) r', [brand])).r;
    assert.deepEqual(next.produtos.map(p => p.id).sort(), previous.produtos.map(p => p.id).sort());
    assert.deepEqual(next.categorias.map(c => c.nome).sort(), previous.categorias.map(c => c.nome).sort());
  }
  await assert.rejects(db.exec(transfer), /já contém dados/i);
  await db.exec('rollback');
  assert.deepEqual(await snapshot(), before);
  await db.exec(readFileSync('supabase/propostas/catalogo_site_indicacoes_compatibilidade.sql', 'utf8'));
  await db.exec(readFileSync('supabase/propostas/catalogo_site_isolar_operacional_homologacao.sql', 'utf8'));
  assert.equal((await one("select pg_get_functiondef('public.duplicar_catalogo(uuid)'::regprocedure) definition")).definition, originalDuplication);
  assert.equal((await one("select pg_get_functiondef('public.catalogo_publico(text,uuid,text,integer,text)'::regprocedure) definition")).definition, originalPublicCatalog);
  assert.equal((await one("select pg_get_functiondef('public.salvar_material(uuid,text,numeric,numeric,uuid,text,numeric,numeric)'::regprocedure) definition")).definition, salvarMaterial);
  assert.equal((await one("select count(*)::int n from pg_trigger where tgrelid='public.materiais'::regclass and tgname='marca_rava_material' and not tgisinternal")).n, 0);
  const fresh = (await one("insert into public.materiais(nome,categoria,quantidade_atual,custo_medio) values('Novo operacional','Bonecos',4,3) returning id")).id;
  assert.equal((await one('select count(*)::int n from public.marca_materiais where material_id=$1', [fresh])).n, 0);
  const user = '50000000-0000-4000-8000-000000000001';
  await db.query('insert into auth.users(id,email) values($1,$2)', [user,'operador@example.invalid']);
  await db.query('update public.profiles set ativo=true where id=$1', [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  const local = (await one("insert into public.locais_estoque(nome,tipo) values('Teste operacional','principal') returning id")).id;
  const operational = (await one("select public.salvar_material(null,'Produto de estoque',2,4,$1,'Bonecos',0,0) id", [local])).id;
  assert.equal((await one('select count(*)::int n from public.marca_materiais where material_id=$1', [operational])).n, 0);
  assert.equal(Number((await one('select quantidade from public.estoque_por_local where material_id=$1 and local_id=$2', [operational,local])).quantidade), 4);
  await db.query("select public.salvar_catalogo($1,jsonb_build_object('slug','novo-operacional','categoria_id',$2::text),null)", [fresh,'20000000-0000-4000-8000-000000000012']);
  assert.equal((await one('select m.slug from public.marca_materiais mm join public.marcas m on m.id=mm.marca_id where mm.material_id=$1', [fresh])).slug, 'rivoxel');
  const copy = (await one('select public.duplicar_catalogo($1) id', [fresh])).id;
  const copyData = await one('select m.categoria,m.quantidade_atual,c.status from public.materiais m join public.catalogo_produtos c on c.material_id=m.id where m.id=$1', [copy]);
  assert.equal(copyData.categoria, 'Bonecos');
  assert.equal(Number(copyData.quantidade_atual), 0);
  assert.equal(copyData.status, 'rascunho');
  await db.exec('set role authenticated');
  const newIndication = (await one(`insert into public.catalogo_indicacoes(titulo,slug,descricao,status,preco_centavos,categoria_id,link_marketplace)
    values('Nova indicação','nova-indicacao-isolada','Descrição','publicado',1250,null,'https://example.com') returning material_id`)).material_id;
  const geek = (await one("select id from public.site_subcategorias where principal_id='rivoxel' and nome='Geek'")).id;
  await db.query("select public.site_classificar_indicacao($1,'rivoxel',$2)", [newIndication,geek]);
  const site = (await one("select public.site_catalogo_publico('rivoxel') r")).r;
  assert.ok(site.produtos.some(p => p.id === newIndication && p.categoria === 'Geek' && p.marketplace));
  assert.equal((await one('select categoria_id from public.catalogo_indicacoes where material_id=$1', [newIndication])).categoria_id, null);
  assert.equal((await one("select categoria_id from public.catalogo_indicacoes where slug='indicacao-teste'")).categoria_id, '20000000-0000-4000-8000-000000000011');
  await db.exec("update public.catalogo_categorias set ativa=false where id='20000000-0000-4000-8000-000000000011'");
  await db.exec("update public.catalogo_indicacoes set resumo='Editada' where slug='indicacao-teste'");
  assert.equal((await one("select public.site_catalogo_publico('rava') r")).r.total, 2);
});

test('padrão Rava alcança somente publicações existentes e conserva o catálogo legado', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;`);
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < '202611230001').sort()) {
    if (file === '202610200001_catalogo.sql') await db.exec(storageTestSchema);
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  await db.exec(`
    insert into public.materiais(id,nome,categoria,custo_medio,quantidade_atual) values
      ('10000000-0000-4000-8000-000000000021','Publicado Bonecos','Bonecos',3,7),
      ('10000000-0000-4000-8000-000000000022','Publicado Rivoxel operacional','Rivoxel',5,9),
      ('10000000-0000-4000-8000-000000000023','Rascunho','Rava',4,2),
      ('10000000-0000-4000-8000-000000000024','Fora do catálogo','Rava',8,3);
    insert into public.catalogo_categorias(id,nome,slug,marketplace) values
      ('20000000-0000-4000-8000-000000000021','Decoração','decoracao-base',true);
    insert into public.catalogo_produtos(material_id,slug,descricao,status,preco_centavos,categoria_id) values
      ('10000000-0000-4000-8000-000000000021','publicado-bonecos','Descrição','publicado',1000,'20000000-0000-4000-8000-000000000021'),
      ('10000000-0000-4000-8000-000000000022','publicado-sem-categoria','Descrição','publicado',2000,null),
      ('10000000-0000-4000-8000-000000000023','rascunho-rava','Rascunho','rascunho',3000,null);
    insert into public.catalogo_slugs(slug,material_id) select slug,material_id from public.catalogo_produtos;
    insert into public.catalogo_indicacoes(material_id,titulo,slug,descricao,status,preco_centavos,categoria_id,link_marketplace) values
      ('30000000-0000-4000-8000-000000000021','Indicação publicada','indicacao-publicada','Descrição','publicado',500,'20000000-0000-4000-8000-000000000021','https://example.com'),
      ('30000000-0000-4000-8000-000000000022','Indicação rascunho','indicacao-rascunho','Descrição','rascunho',700,'20000000-0000-4000-8000-000000000021','https://example.com');
  `);
  const snapshot = () => one(`select
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.materiais m) materiais,
    (select jsonb_agg(to_jsonb(p) order by p.material_id) from public.catalogo_produtos p) produtos,
    (select jsonb_agg(to_jsonb(i) order by i.material_id) from public.catalogo_indicacoes i) indicacoes,
    (select jsonb_agg(to_jsonb(c) order by c.nome) from public.financeiro_caixas c) caixas`);
  const before = await snapshot();
  const previous = (await one('select public.catalogo_publico() r')).r;
  await db.exec(readFileSync('supabase/propostas/catalogo_site_categorias.sql', 'utf8'));
  await db.exec(readFileSync('supabase/propostas/catalogo_site_padrao_rava_publicados.sql', 'utf8'));
  await db.exec(readFileSync('supabase/propostas/catalogo_site_indicacoes_compatibilidade.sql', 'utf8'));
  assert.deepEqual(await snapshot(), before);
  const classifications = (await db.query('select produto_id,principal_id from public.site_classificacao_produtos order by produto_id')).rows;
  assert.deepEqual(classifications, [
    { produto_id: '10000000-0000-4000-8000-000000000021', principal_id: 'rava' },
    { produto_id: '10000000-0000-4000-8000-000000000022', principal_id: 'rava' },
  ]);
  assert.deepEqual((await db.query('select indicacao_id,principal_id from public.site_classificacao_indicacoes')).rows,
    [{ indicacao_id: '30000000-0000-4000-8000-000000000021', principal_id: 'rava' }]);
  const next = (await one("select public.site_catalogo_publico('rava') r")).r;
  assert.deepEqual(next.produtos.map(p => p.id).sort(), previous.produtos.map(p => p.id).sort());
  const comparable = products => products.map(({ categoria_id: _id, ...product }) => product).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(comparable(next.produtos), comparable(previous.produtos));
  assert.deepEqual(next.categorias.map(c => c.nome).sort(), previous.categorias.map(c => c.nome).sort());
  assert.equal((await one("select public.site_catalogo_publico('rivoxel') r")).r.total, 0);
  await db.exec("update public.catalogo_categorias set ativa=false where id='20000000-0000-4000-8000-000000000021'");
  assert.equal((await one("select public.site_catalogo_publico('rava') r")).r.total, 3);
  await db.exec("update public.site_subcategorias set ativa=false where nome='Decoração' and principal_id='rava'");
  assert.equal((await one("select public.site_catalogo_publico('rava') r")).r.total, 1);
});
