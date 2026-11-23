import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atender } from '../../workers/entrada.ts';

test('Worker separa domínios e preserva assets da Rava', async () => {
  let calls = 0;
  const assets = { async fetch(req) { calls++; return new Response(new URL(req.url).pathname); } };
  for (const url of ['https://ravastudio3d.com.br/gestao/', 'https://feat-multi-brand.rivoxel.com.br/catalogo/']) {
    const response = await atender(new Request(url), assets);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), new URL(url).pathname);
  }
  for (const path of ['/', '/gestao/', '/produto/outro/', '/assets/gestao.js']) {
    const response = await atender(new Request(`https://rivoxel.com.br${path}`), assets);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  const invalid = await atender(new Request('https://rivoxel.com.br.atacante.test/'), assets);
  assert.equal(invalid.status, 404);
  const restricted = await atender(new Request('https://ravastudio3d.com.br/rivoxel-preview/'), assets);
  assert.equal(restricted.status, 404);
  const preview = await atender(new Request('https://feat-multi-brand.rivoxel.com.br/rivoxel-preview/'), assets);
  assert.equal(preview.status, 200);
  assert.equal(calls, 3);
});
