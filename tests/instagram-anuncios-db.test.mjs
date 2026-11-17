import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('anúncios preservam associação explícita e não expõem dados diretamente', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role; grant usage on schema public to anon, authenticated, service_role');
  await db.exec(readFileSync('supabase/instagram-draft/202611070002_instagram_separado.sql', 'utf8'));
  await db.exec(`insert into public.instagram_eventos_brutos(digest,payload) values (repeat('a',64), '{"object":"instagram","entry":[{"changes":[{"field":"comments","value":{"media":{"id":"123","media_product_type":"AD"}}}]}]}'::jsonb)`);
  await db.exec(readFileSync('supabase/instagram-draft/202611170001_instagram_anuncios.sql', 'utf8'));
  assert.deepEqual((await db.query('select id, publicacao_original_id from public.instagram_anuncios')).rows, [{ id: '123', publicacao_original_id: null }]);
  await db.exec("insert into public.instagram_publicacoes(id) values ('456'); update public.instagram_anuncios set publicacao_original_id='456' where id='123'; select public.instagram_registrar_anuncio('123')");
  assert.equal((await db.query("select publicacao_original_id from public.instagram_anuncios where id='123'")).rows[0].publicacao_original_id, '456');
  await assert.rejects(db.exec("update public.instagram_anuncios set publicacao_original_id='999' where id='123'"), /foreign key/i);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec('select * from public.instagram_anuncios'), /permission denied/i);
  await assert.rejects(db.exec("select public.instagram_registrar_anuncio('100')"), /permission denied/i);
});
