import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMainCatalog } from '../../supabase/functions/_shared/main-catalog.ts';

test('catálogo principal é consultado por API pública e falhas não geram produtos parciais', async () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: `id-${i}`, nome: `Peça ${i}`, slug: `peca-${i}`, preco_centavos: i * 100, promocional_centavos: null }));
  const offsets = [];
  const options = { url: 'https://principal.supabase.co', publishableKey: 'public-key', ids: ['id-24'], request: async (_, init) => { const { p_offset } = JSON.parse(init.body); offsets.push(p_offset); return Response.json({ total: rows.length, produtos: rows.slice(p_offset, p_offset + 24) }); } };
  const result = await readMainCatalog(options);
  assert.equal(result[0].preco_centavos, 2400); assert.deepEqual(offsets, [0, 24]);
  await assert.rejects(readMainCatalog({ ...options, request: async () => Response.json({ total: 25, produtos: rows.slice(0, 1) }) }), /incompleta/);
});
