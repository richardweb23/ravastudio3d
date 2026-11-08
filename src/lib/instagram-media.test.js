import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncMetaMedia } from '../../supabase/functions/_shared/meta-media.ts';

test('sincronização pagina apenas no host oficial e detecta cursor repetido', async () => {
  const pages = [], urls = [];
  const options = { accountId: '123', apiVersion: 'v27.0', token: 'token', save: async items => pages.push(items), request: async url => { urls.push(String(url)); return Response.json(urls.length === 1 ? { data: [{ id: '1' }], paging: { next: 'https://untrusted.invalid', cursors: { after: 'next' } } } : { data: [{ id: '2' }] }); } };
  assert.equal(await syncMetaMedia(options), 2); assert.equal(pages.length, 2);
  assert.ok(urls.every(url => new URL(url).hostname === 'graph.facebook.com'));
  await assert.rejects(syncMetaMedia({ ...options, request: async () => Response.json({ data: [], paging: { next: 'x', cursors: { after: 'same' } } }) }), /Paginação incompleta/);
});
