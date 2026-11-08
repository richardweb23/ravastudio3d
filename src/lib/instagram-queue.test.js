import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processInstagramQueueItem } from '../../supabase/functions/_shared/queue-processor.ts';

test('fila conclui o lote após processamento e preserva deduplicação por comentário', async () => {
  const comment = { id: '1', text: 'valor', mediaId: '2', authorId: '3' };
  const states = [], reserved = new Set(); let finished;
  const adapters = { ownAccountId: 'own', claim: async () => ({ digest: 'digest', tentativa_id: 'lease', payload: {} }), finish: async (_, state) => { finished = state; return true; }, parse: () => [comment, comment], reserve: async item => { if (reserved.has(item.id)) return false; reserved.add(item.id); return true; }, record: async (_, state) => states.push(state), decide: async () => ({ eligible: true, message: 'detalhes' }), sendPrivate: async () => ({ status: 'confirmed' }), sendPublic: async () => { throw Error('unexpected'); } };
  assert.equal(await processInstagramQueueItem(adapters), 'processed');
  assert.equal(finished, 'concluido'); assert.deepEqual(states, ['envio_privado_iniciado', 'envio_privado_confirmado']);
  assert.equal(await processInstagramQueueItem({ ...adapters, parse: () => { throw Error('payload inválido'); } }), 'failed');
  assert.equal(await processInstagramQueueItem({ ...adapters, claim: async () => null }), 'empty');
  assert.equal(await processInstagramQueueItem({ ...adapters, finish: async () => false }), 'lease_lost');
});
