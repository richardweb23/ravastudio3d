import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('banco separado não depende do catálogo ou autenticação do banco principal', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; grant usage on schema public to anon, authenticated');
  await db.exec(readFileSync('supabase/instagram-draft/202611070002_instagram_separado.sql', 'utf8'));
  assert.equal((await db.query('select ativa from public.instagram_configuracao')).rows[0].ativa, false);
  await db.exec("insert into public.instagram_publicacoes(id) values('123'); insert into public.instagram_publicacao_produtos values('123','10000000-0000-4000-8000-000000000001')");
  assert.equal((await db.query("select * from public.instagram_vinculos('123')")).rows.length, 1);
  await db.exec("select public.instagram_reservar_comentario('456','123','oi'); select public.instagram_registrar_estado('456','ignorado','Sem palavra-chave')");
  assert.equal((await db.query("select detalhe from public.instagram_atividade where comentario_id='456'")).rows[0].detalhe, 'Sem palavra-chave');
  await db.exec('set role authenticated');
  await assert.rejects(db.exec('select * from public.instagram_configuracao'), /permission denied/i);
  await assert.rejects(db.exec("select * from public.instagram_vinculos('123')"), /permission denied/i);
});
