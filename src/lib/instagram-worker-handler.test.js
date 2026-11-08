import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { handleInstagramWorker } from '../../supabase/functions/_shared/worker-handler.ts';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
test('worker autentica chamadas, bloqueia envios e permite manutenção separada', async () => {
  let runs = 0, cleans = 0;
  const deps = { secret: 'segredo', ready: true, run: async () => { runs++; return 'empty'; }, clean: async () => { cleans++; } };
  const req = (token, suffix = '') => new Request('https://example.invalid/' + suffix, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await handleInstagramWorker(req('errado'), deps)).status, 403);
  assert.equal((await handleInstagramWorker(req('segredo'), deps)).status, 503);
  assert.equal(runs, 0);
  assert.equal((await handleInstagramWorker(req('segredo', '?maintenance=1'), deps)).status, 200);
  assert.equal(cleans, 1);
  assert.equal((await handleInstagramWorker(req('segredo'), { ...deps, sendEnabled: 'true' })).status, 200);
  assert.equal(runs, 1);
});
test('cadastro no Vault exige segredo e nao executa worker', async () => {
  let setups = 0, runs = 0;
  const deps = { secret: 'segredo', ready: true, run: async () => { runs++; return 'empty'; }, clean: async () => {}, setupVault: async () => { setups++; } };
  const req = token => new Request('https://example.invalid/?setup_vault=1', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await handleInstagramWorker(req('errado'), deps)).status, 403);
  assert.equal((await handleInstagramWorker(req('segredo'), deps)).status, 200);
  assert.equal(setups, 1); assert.equal(runs, 0);
});
