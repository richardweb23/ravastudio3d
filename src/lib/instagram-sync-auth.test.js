import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleInstagramSync } from '../../supabase/functions/_shared/sync-handler.ts';
test('sincronização exige sessão autorizada antes de consultar a Meta', async () => {
  let calls = 0;
  const deps = { authorize: async bearer => bearer === 'Bearer ativo', sync: async () => { calls++; return 2; } };
  const req = token => new Request('https://example.invalid', { method: 'POST', headers: token ? { authorization: token } : {} });
  assert.equal((await handleInstagramSync(req(''), deps)).status, 403);
  assert.equal((await handleInstagramSync(req('Bearer inativo'), deps)).status, 403);
  assert.equal(calls, 0);
  const response = await handleInstagramSync(req('Bearer ativo'), deps);
  assert.equal(response.status, 200); assert.equal((await response.json()).total, 2); assert.equal(calls, 1);
  assert.equal((await handleInstagramSync(req('Bearer ativo'), { ...deps, authorize: async () => { throw Error('offline'); } })).status, 503);
});
