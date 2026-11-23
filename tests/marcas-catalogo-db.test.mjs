import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageTestSchema } from './storage-test-schema.mjs';

test('vinculação à Rava preserva cadastros legados e novos cadastros', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;`);
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  let material, categoria, indicacao;
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    if (file === '202610200001_catalogo.sql') await db.exec(storageTestSchema);
    if (file === '202611230002_marcas_catalogo_base.sql') {
      material = await one("insert into public.materiais(nome,quantidade_atual,custo_medio) values('Legado',7,12) returning *");
      categoria = await one("insert into public.catalogo_categorias(nome,slug,marketplace) values('Legada','legada',true) returning id");
      indicacao = await one("insert into public.catalogo_indicacoes(titulo,slug,categoria_id,link_marketplace) values('Indicação','indicacao',$1,'https://example.com') returning material_id", [categoria.id]);
    }
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  assert.deepEqual(await one('select * from public.materiais where id=$1', [material.id]), material);
  const brand = (await one("select id from public.marcas where slug='rava'")).id;
  assert.equal((await one('select marca_id from public.marca_materiais where material_id=$1', [material.id])).marca_id, brand);
  assert.equal((await one('select marca_id from public.marca_categorias_catalogo where categoria_id=$1', [categoria.id])).marca_id, brand);
  assert.equal((await one('select marca_id from public.marca_indicacoes_catalogo where material_id=$1', [indicacao.material_id])).marca_id, brand);
  const novo = await one("insert into public.materiais(nome) values('Novo') returning id");
  assert.equal((await one('select marca_id from public.marca_materiais where material_id=$1', [novo.id])).marca_id, brand);
  const novaCategoria = await one("insert into public.catalogo_categorias(nome,slug,marketplace) values('Nova','nova',true) returning id");
  const novaIndicacao = await one("insert into public.catalogo_indicacoes(titulo,slug,categoria_id,link_marketplace) values('Nova indicação','nova-indicacao',$1,'https://example.com') returning material_id", [novaCategoria.id]);
  assert.equal((await one('select marca_id from public.marca_categorias_catalogo where categoria_id=$1', [novaCategoria.id])).marca_id, brand);
  assert.equal((await one('select marca_id from public.marca_indicacoes_catalogo where material_id=$1', [novaIndicacao.material_id])).marca_id, brand);
  const rivoxel = (await one("select id from public.marcas where slug='rivoxel'")).id;
  await db.query('update public.marca_materiais set marca_id=$1 where material_id=$2', [rivoxel, novo.id]);
  await db.query('update public.marca_categorias_catalogo set marca_id=$1 where categoria_id=$2', [rivoxel, novaCategoria.id]);
  await db.query('update public.marca_indicacoes_catalogo set marca_id=$1 where material_id=$2', [rivoxel, novaIndicacao.material_id]);
  await db.query("insert into public.catalogo_produtos(material_id,slug,descricao,status,categoria_id) values($1,'legado-produto','Peça Rava','publicado',$2),($3,'novo-produto','Peça Rivoxel','publicado',$4)", [material.id,categoria.id,novo.id,novaCategoria.id]);
  await assert.rejects(db.query('update public.catalogo_produtos set categoria_id=$1 where material_id=$2', [novaCategoria.id, material.id]), /mesma marca/i);
  await assert.rejects(db.query('update public.catalogo_indicacoes set categoria_id=$1 where material_id=$2', [categoria.id, novaIndicacao.material_id]), /mesma marca/i);
  await db.query("update public.catalogo_indicacoes set status='publicado',descricao='Indicação Rivoxel' where material_id=$1", [novaIndicacao.material_id]);
  const catalog = async (marca, slug = null) => (await one('select public.catalogo_publico_marca($1, p_slug => $2) result', [marca,slug])).result;
  assert.equal((await catalog('rava')).total, 1);
  assert.equal((await catalog('rivoxel')).total, 2);
  assert.equal((await catalog('rava','novo-produto')).total, 0);
  assert.equal((await catalog('rivoxel','legado-produto')).total, 0);
  assert.equal((await catalog('inexistente')).total, 0);
  assert.deepEqual((await catalog('rava')).categorias.map(c => c.nome), ['Legada']);
  assert.equal((await one('select public.catalogo_publico() result')).result.total, 1);
  await db.exec('set role anon');
  assert.equal((await catalog('rivoxel')).total, 2);
  assert.equal((await catalog('rava','novo-produto')).total, 0);
  assert.equal((await one('select public.catalogo_publico() result')).result.total, 1);
  await assert.rejects(db.query('select * from public.marca_materiais'), /permission denied/i);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('update public.marca_materiais set marca_id=$1', [brand]), /permission denied/i);
  await assert.rejects(db.query("select public.salvar_categoria_marca(null,$1,'Teste','teste',true,false)", [rivoxel]), /não autorizado/i);
  await db.exec('reset role');
  const user = '10000000-0000-4000-8000-000000000005';
  await db.query('insert into auth.users(id,email) values($1,$2)', [user,'marcas@example.invalid']);
  await db.query("update public.profiles set ativo=true where id=$1", [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
  const criada = await one("select public.salvar_categoria_marca(null,$1,'Categoria Rivoxel','categoria-rivoxel',true,false) id", [rivoxel]);
  assert.equal((await one('select marca_id from public.marca_categorias_catalogo where categoria_id=$1', [criada.id])).marca_id, rivoxel);
  await assert.rejects(db.query("select public.salvar_categoria_marca($1,$2,'Legada','legada',true,true)", [categoria.id,rivoxel]), /outra marca/i);
});
