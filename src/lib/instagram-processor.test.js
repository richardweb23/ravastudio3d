import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processInstagramComment } from '../../supabase/functions/_shared/comment-processor.ts';

test('processador reserva uma vez e só responde publicamente após confirmação privada', async () => {
  const reserved = new Set(), states = [], calls = [];
  const comment = { id: '1', text: 'valor?', mediaId: '2', authorId: '3' };
  const deps = { ownAccountId: 'own', store: { reserve: async id => { if (reserved.has(id)) return false; reserved.add(id); return true; }, record: async (_, status) => { states.push(status); } }, decide: async () => ({ eligible: true, message: 'detalhes', publicReply: 'enviado' }), sendPrivate: async () => { calls.push('privada'); return { status: 'confirmed' }; }, sendPublic: async () => { calls.push('publica'); return { status: 'confirmed' }; } };
  const results = await Promise.all([processInstagramComment(comment, deps), processInstagramComment(comment, deps)]);
  assert.deepEqual(results.sort(), ['confirmed', 'duplicate']);
  assert.deepEqual(calls, ['privada', 'publica']);
  assert.deepEqual(states, ['envio_privado_iniciado', 'envio_privado_confirmado', 'resposta_publica_iniciada', 'enviado']);
  assert.equal(await processInstagramComment({ ...comment, id: '4', authorId: 'own' }, deps), 'own_comment');
});

test('resultado privado incerto não envia confirmação nem repete automaticamente', async () => {
  let reserved = false, publicCalls = 0; const states = [];
  const deps = { ownAccountId: 'own', store: { reserve: async () => { if (reserved) return false; reserved = true; return true; }, record: async (_, status) => states.push(status) }, decide: async () => ({ eligible: true, message: 'detalhes', publicReply: 'enviado' }), sendPrivate: async () => { throw Error('timeout'); }, sendPublic: async () => { publicCalls++; return { status: 'confirmed' }; } };
  const comment = { id: '1', text: 'valor', mediaId: '2', authorId: '3' };
  assert.equal(await processInstagramComment(comment, deps), 'unknown');
  assert.equal(await processInstagramComment(comment, deps), 'duplicate');
  assert.equal(publicCalls, 0); assert.deepEqual(states, ['envio_privado_iniciado', 'envio_privado_incerto']);
});
