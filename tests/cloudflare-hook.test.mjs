import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triggerBuild } from '../scripts/acionar-build-cloudflare.mjs';

const hook = 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/12345678-1234-1234-1234-123456789abc';

test('envia apenas ao endpoint oficial e exige confirmação do build', async () => {
  let calls = 0;
  const id = await triggerBuild(hook, async (url, options) => {
    calls++;
    assert.equal(url, hook);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({ success: true, result: { build_uuid: 'teste' } }) };
  });
  assert.equal(id, 'teste');
  assert.equal(calls, 1);
  await assert.rejects(triggerBuild('https://exemplo.com/', () => { throw Error('não deve chamar'); }), /inválido/);
  await assert.rejects(triggerBuild(hook, async () => ({ ok: true, json: async () => ({ success: false }) })), /não confirmou/);
  await assert.rejects(triggerBuild(hook, async () => { throw Error(hook); }), error => !error.message.includes(hook));
});
