import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseMetaComment, replyToMetaComment, verifyMetaComment } from '../../supabase/functions/_shared/meta-comments.ts';

test('diagnóstico mostra campos ausentes sem retornar dados ou credenciais', async () => {
  const result = await diagnoseMetaComment({ apiVersion: 'v27.0', token: 'secret', request: async () => Response.json({ id: '123', from: { id: '789', username: 'pessoa' }, media: { id: '456' }, timestamp: '2026-11-07T00:00:00Z' }) }, '123');
  assert.equal(result.from.present, true); assert.equal(result['media{media_product_type}'].value, null); assert.equal(result.hidden.value, null);
  assert.doesNotMatch(JSON.stringify(result), /secret|pessoa|789/);
});

test('confere comentário e envia resposta pública pelo contrato da Meta', async () => {
  const comment = { id: '123', mediaId: '456', authorId: '789' };
  let called;
  const config = { apiVersion: 'v25.0', token: 'secret', request: async (url, init) => { called = { url: String(url), init }; return Response.json(init.method === 'POST' ? { id: '12' } : { id: '123', from: { id: '789' }, media: { id: '456', media_product_type: 'FEED' }, hidden: false, timestamp: '2026-11-07T00:00:00Z' }); } };
  assert.equal((await verifyMetaComment(config, comment)).belongsToAccount, true);
  assert.match(new URL(called.url).searchParams.get('fields'), /media\{id,media_product_type\}/);
  assert.equal((await replyToMetaComment(config, comment, 'Enviado!')).status, 'confirmed');
  assert.equal(new URL(called.url).pathname, '/v25.0/123/replies');
  assert.equal(new URL(called.url).searchParams.get('message'), 'Enviado!');
  assert.equal((await verifyMetaComment(config, { ...comment, mediaId: '1' })).belongsToAccount, false);
});
