import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageTestSchema } from './storage-test-schema.mjs';

test('renomeação preserva saldos, pagamentos, histórico, idempotência e estorno', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;`);
  const migration = '202611010002_renomear_caixa_materiais.sql';
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < migration).sort()) {
    await db.exec((file === '202610200001_catalogo.sql' ? storageTestSchema : '') + readFileSync('supabase/migrations/' + file, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const user = randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [user, 'renomear@example.invalid']);
  await db.query("update public.profiles set ativo=true,perfil='administrador' where id=$1", [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
  const date = (await one('select current_date::text d')).d;
  const op = async (action, data, key = randomUUID()) => (await one('select public.financeiro_operar($1,$2::jsonb,$3) r', [action, JSON.stringify(data), key])).r;
  await op('abertura', { data: date, saldos: { Rivoxel: 0, Rava: 0, Bonecos: 10000, 'Materiais Bonecos': 0 } });
  const request = randomUUID();
  const payload = { data: date, caixa: 'Bonecos', caixa_destino: 'Materiais Bonecos', valor_centavos: 2000, descricao: 'Reposição' };
  const transfer = await op('transferencia', payload, request);
  const order = (await one("insert into public.pedidos(cliente,valor_total) values('Cliente',100) returning id")).id;
  const receipt = await op('receber_pedido', { pedido_id: order, data: date, valor_centavos: 3000, metodo: 'pix', descricao: 'Pagamento', rateio: [{ caixa: 'Materiais Bonecos', valor_centavos: 1000 }, { caixa: 'Bonecos', valor_centavos: 2000 }] });
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec(readFileSync('supabase/migrations/' + migration, 'utf8'));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
  const summary = (await one('select public.financeiro_resumo() r')).r;
  assert.equal(Number(summary.caixas.find(c => c.nome === 'Materiais').saldo_centavos), 3000);
  assert.equal(summary.caixas.some(c => c.nome === 'Materiais Bonecos'), false);
  assert.equal((await one('select caixa from public.pedido_pagamentos where id=$1', [receipt.id])).caixa, 'Materiais');
  const statement = (await one("select public.financeiro_extrato('Materiais',null,null,null,0) r")).r;
  assert.equal(statement.length, 2);
  assert.deepEqual(await op('transferencia', payload, request), transfer);
  await op('estorno', { data: date, movimento_id: receipt.movimento_id, descricao: 'Estorno do recebimento' });
  await op('estorno', { data: date, movimento_id: transfer.movimento_id, descricao: 'Estorno da transferência' });
  const after = (await one('select public.financeiro_resumo() r')).r;
  assert.equal(Number(after.caixas.find(c => c.nome === 'Materiais').saldo_centavos), 0);
});
