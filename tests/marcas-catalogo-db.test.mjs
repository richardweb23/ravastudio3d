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
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.marca_materiais'), /permission denied/i);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('update public.marca_materiais set marca_id=$1', [brand]), /permission denied/i);
});
