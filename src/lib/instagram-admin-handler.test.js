import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleInstagramAdmin } from '../../supabase/functions/_shared/admin-handler.ts';

test('painel autoriza a sessão antes de acessar dados e restringe ações', async () => {
  let calls = 0;
  const deps = { authorize: async token => token === 'Bearer valido', execute: async action => { calls++; return { action }; } };
  const req = (token, payload) => new Request('https://example.invalid', { method: 'POST', headers: token ? { authorization: token } : {}, body: JSON.stringify(payload) });
  assert.equal((await handleInstagramAdmin(req('', { action: 'overview' }), deps)).status, 403);
  assert.equal((await handleInstagramAdmin(req('Bearer invalido', { action: 'overview' }), deps)).status, 403);
  assert.equal((await handleInstagramAdmin(req('Bearer valido', { action: 'qualquer' }), deps)).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handleInstagramAdmin(req('Bearer valido', { action: 'overview', data: { x: 'x'.repeat(33000) } }), deps)).status, 413);
  assert.deepEqual(await (await handleInstagramAdmin(req('Bearer valido', { action: 'overview' }), deps)).json(), { action: 'overview' });
  assert.equal(calls, 1);
});
