import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('prioridade: salva ordem atomicamente, rejeita quadro desatualizado e reinicia ao mudar etapa', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated;
    create type public.status_pedido as enum ('recebido', 'em_producao', 'pronto', 'entregue');
    create table public.pedidos (id uuid primary key, status public.status_pedido not null);
    insert into public.pedidos values
    ('00000000-0000-0000-0000-000000000001','recebido'),
    ('00000000-0000-0000-0000-000000000002','recebido');`);
  await db.exec(readFileSync('supabase/migrations/202610270001_prioridade_pedidos.sql', 'utf8'));
  const a = '00000000-0000-0000-0000-000000000001';
  const b = '00000000-0000-0000-0000-000000000002';
  const reorder = ids => db.query("select public.ordenar_pedidos('recebido', $1::uuid[])", [ids]);
  await reorder([b, a]);
  const rows = async () => (await db.query('select id, prioridade from public.pedidos order by prioridade')).rows;
  assert.deepEqual(await rows(), [{ id: b, prioridade: 1 }, { id: a, prioridade: 2 }]);
  await assert.rejects(reorder([a, a]), /quadro mudou/);
  await assert.rejects(reorder([a]), /quadro mudou/);
  assert.equal((await rows())[0].id, b);
  await reorder([a, b]);
  assert.equal((await rows())[0].id, a);
  await db.query("update public.pedidos set status='em_producao' where id=$1", [a]);
  assert.equal((await db.query('select prioridade from public.pedidos where id=$1', [a])).rows[0].prioridade, null);
  await assert.rejects(reorder([a, b]), /quadro mudou/);
});
