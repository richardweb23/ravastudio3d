import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInstagramDatabaseAdapter } from '../../supabase/functions/_shared/database-adapter.ts';

test('adaptador usa apenas funções autorizadas e não expõe segredos em erros', async () => {
  const calls = [];
  const fetchMock = async (url, options) => { calls.push([url, JSON.parse(options.body)]); return new Response(url.endsWith('instagram_reservar_evento') ? '[]' : 'true'); };
  const adapter = createInstagramDatabaseAdapter('https://project.supabase.co', 'secret-test', fetchMock);
  assert.equal(await adapter.claim(), null);
  assert.equal(await adapter.reserve({ id: '1', mediaId: '2', text: 'valor', authorId: '3' }), true);
  assert.deepEqual(calls[1][1], { p_id: '1', p_publicacao_id: '2', p_comentario: 'valor' });
  const failing = createInstagramDatabaseAdapter('https://project.supabase.co', 'secret-test', async () => new Response('secret-test', { status: 500 }));
  await assert.rejects(failing.claim(), error => !error.message.includes('secret-test'));
});
