import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('marcas preservam isolamento de leitura e não concedem edição', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated;
    create function public.usuario_ativo() returns boolean language sql stable
    as $$select coalesce(current_setting('test.ativo', true), '') = 'sim'$$;
    grant usage on schema public to anon, authenticated;`);
  await db.exec(readFileSync('supabase/migrations/202611230001_marcas_base.sql', 'utf8'));
  const rows = async sql => (await db.query(sql)).rows;
  assert.deepEqual((await rows('select slug from public.marcas order by slug')).map(x => x.slug), ['rava', 'rivoxel']);
  await db.exec('set role anon');
  await assert.rejects(rows('select * from public.marcas'), /permission denied/i);
  await db.exec('reset role; set role authenticated');
  assert.equal((await rows('select * from public.marcas')).length, 0);
  await db.exec("select set_config('test.ativo', 'sim', false)");
  assert.equal((await rows('select * from public.marcas')).length, 2);
  await assert.rejects(rows("insert into public.marcas(slug,nome) values ('outra','Outra')"), /permission denied/i);
});
