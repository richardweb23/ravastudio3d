import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { handleMetaWebhook } from '../../supabase/functions/_shared/meta-webhook.ts';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
test('webhook valida verificação, assinatura e armazenamento antes de confirmar', async () => {
  const saved = [];
  const options = { verifyToken: 'verificacao', appSecret: 'segredo', persist: async (...args) => saved.push(args) };
  const url = 'https://example.invalid/webhook';
  const verify = await handleMetaWebhook(new Request(`${url}?hub.mode=subscribe&hub.verify_token=verificacao&hub.challenge=abc`), options);
  assert.equal(verify.status, 200); assert.equal(await verify.text(), 'abc');
  assert.equal((await handleMetaWebhook(new Request(`${url}?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=abc`), options)).status, 403);
  const body = JSON.stringify({ object: 'instagram', entry: [] });
  const sign = 'sha256=' + createHmac('sha256', 'segredo').update(body).digest('hex');
  const request = () => new Request(url, { method: 'POST', body, headers: { 'x-hub-signature-256': sign } });
  assert.equal((await handleMetaWebhook(request(), options)).status, 200);
  assert.equal(saved.length, 1); assert.match(saved[0][0], /^[0-9a-f]{64}$/);
  assert.equal((await handleMetaWebhook(new Request(url, { method: 'POST', body }), options)).status, 403);
  assert.equal((await handleMetaWebhook(request(), { ...options, persist: async () => { throw Error('falha'); } })).status, 503);
  assert.equal((await handleMetaWebhook(request(), { ...options, appSecret: '' })).status, 503);
  assert.equal((await handleMetaWebhook(new Request(url, { method: 'POST', body: 'x'.repeat(262145) }), options)).status, 413);
});

test('webhook acorda o worker somente após persistir e tolera falha no acionamento', async () => {
  const actions = [];
  const body = JSON.stringify({ object: 'instagram', entry: [] });
  const signature = 'sha256=' + createHmac('sha256', 'segredo').update(body).digest('hex');
  const req = () => new Request('https://example.invalid', { method: 'POST', body, headers: { 'x-hub-signature-256': signature } });
  const options = { verifyToken: 'teste', appSecret: 'segredo', persist: async () => { actions.push('persistido'); }, wakeWorker: () => { actions.push('acordado'); throw Error('indisponível'); } };
  assert.equal((await handleMetaWebhook(req(), options)).status, 200);
  assert.deepEqual(actions, ['persistido', 'acordado']);
  actions.length = 0;
  assert.equal((await handleMetaWebhook(req(), { ...options, persist: async () => { throw Error('falha'); } })).status, 503);
  assert.deepEqual(actions, []);
});
