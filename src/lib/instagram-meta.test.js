import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaCommentWithinWindow, sendMetaPrivateReply } from '../../supabase/functions/_shared/meta-private-reply.ts';

test('resposta privada do login unificado usa ID do comentário e exige confirmação da Meta', async () => {
  let call;
  const options = { apiVersion: 'v25.0', accountId: '123', commentId: '456', token: 'segredo', message: 'Olá', request: async (url, init) => { call = { url, init }; return Response.json({ recipient_id: '7', message_id: '8' }); } };
  assert.equal((await sendMetaPrivateReply(options)).status, 'confirmed');
  assert.equal(call.url, 'https://graph.facebook.com/v25.0/123/messages');
  assert.deepEqual(JSON.parse(call.init.body), { recipient: { comment_id: '456' }, message: { text: 'Olá' } });
  assert.equal((await sendMetaPrivateReply({ ...options, request: async () => new Response('', { status: 500 }) })).status, 'unknown');
  assert.equal((await sendMetaPrivateReply({ ...options, request: async () => new Response('', { status: 400 }) })).status, 'rejected');
  assert.equal((await sendMetaPrivateReply({ ...options, request: async () => Response.json({}) })).status, 'unknown');
});
test('janela conservadora ignora lives e comentários fora do período', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  assert.equal(metaCommentWithinWindow('2026-11-06T12:00:00Z', 'POST', now), true);
  assert.equal(metaCommentWithinWindow('2026-10-31T12:00:00Z', 'POST', now), false);
  assert.equal(metaCommentWithinWindow('2026-11-06T12:00:00Z', 'LIVE', now), false);
});
