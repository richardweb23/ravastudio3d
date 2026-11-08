import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { verifyMetaSignature } from '../../supabase/functions/_shared/meta-signature.ts';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
test('assinatura do webhook usa corpo original e rejeita segredo ou assinatura incorretos', async () => {
  const bytes = new TextEncoder().encode('{"object":"instagram"}');
  const signature = 'sha256=' + createHmac('sha256', 'segredo-teste').update(bytes).digest('hex');
  assert.equal(await verifyMetaSignature(bytes, signature, 'segredo-teste'), true);
  assert.equal(await verifyMetaSignature(bytes, signature, 'outro'), false);
  assert.equal(await verifyMetaSignature(new TextEncoder().encode('{ "object":"instagram"}'), signature, 'segredo-teste'), false);
  assert.equal(await verifyMetaSignature(bytes, 'sha256=xyz', 'segredo-teste'), false);
  assert.equal(await verifyMetaSignature(bytes, signature, ''), false);
});
