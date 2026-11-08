import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processInstagramQueueItem } from '../../supabase/functions/_shared/queue-processor.ts';
import { decideInstagramReply } from './instagram.js';

test('fluxo simulado prepara preços atuais, evita duplicidade e confirma antes da resposta pública', async () => {
  const comments = [{ id: 'c1', mediaId: 'p1', authorId: 'u1', text: 'Qual o preço?' }];
  const seen = new Set(), calls = [], states = [];
  let price = 2500;
  const deps = {
    claim: async () => ({ digest: 'evento', tentativa_id: 'teste', payload: {} }),
    finish: async () => true, parse: () => comments, ownAccountId: 'rava',
    reserve: async c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; },
    record: async (_, status) => states.push(status),
    decide: async c => decideInstagramReply({ comment: c.text, automationEnabled: true, postEnabled: true, metaEligible: true,
      keywords: ['preço'], products: [{ nome: 'Peça', slug: 'peca', preco_centavos: price, promocional_centavos: null, disponivel: true }],
      missingProduct: 'ignorar', productTemplate: 'Confira {produtos}', fallbackTemplate: '{catalogo} {whatsapp}',
      publicReply: 'Enviado!', catalogUrl: 'https://example.com', whatsappUrl: 'https://wa.me/5511999999999', maxLength: 1000 }),
    sendPrivate: async (_, message) => { calls.push(['privada', message]); return { status: 'confirmed' }; },
    sendPublic: async () => { calls.push(['publica']); return { status: 'confirmed' }; },
  };
  price = 3500;
  assert.equal(await processInstagramQueueItem(deps), 'processed');
  assert.match(calls[0][1], /35,00/); assert.deepEqual(calls.map(call => call[0]), ['privada', 'publica']);
  assert.equal(await processInstagramQueueItem(deps), 'processed');
  assert.equal(calls.length, 2); assert.equal(states.at(-1), 'enviado');
});
