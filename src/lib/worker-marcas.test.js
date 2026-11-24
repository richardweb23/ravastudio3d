import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atender, atenderRivoxel } from '../../workers/entrada.ts';

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

test('roteamento preparado da Rivoxel serve as próprias páginas e conserva a consulta', async () => {
  const assets = { async fetch(req) {
    const url = new URL(req.url);
    return new Response(url.pathname + url.search, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } };
  for (const [path, expected] of [
    ['/', '/rivoxel-preview/'],
    ['/catalogo/?produto=peca', '/rivoxel-preview/catalogo/?produto=peca'],
    ['/links/', '/rivoxel-preview/links/'],
    ['/assets/site.js', '/assets/site.js'],
  ]) {
    const response = await atenderRivoxel(new Request(`https://rivoxel.com.br${path}`), assets);
    assert.equal(await response.text(), expected);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  const redirect = await atenderRivoxel(new Request('https://rivoxel.com.br/catalogo?produto=peca'), assets);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), 'https://rivoxel.com.br/catalogo/?produto=peca');
  for (const path of ['/gestao/', '/rivoxel-preview/', '/produto/peca/', '/desconhecida/']) {
    assert.equal((await atenderRivoxel(new Request(`https://rivoxel.com.br${path}`), assets)).status, 404);
  }
});

test('alias de homologação usa as URLs da Rivoxel sem ativar domínio público', async () => {
  const assets = { async fetch(req) { return new Response(new URL(req.url).pathname); } };
  const alias = 'https://feat-multi-brand-ravastudio3d.studiorava3d.workers.dev';
  for (const [path, expected] of [['/', '/rivoxel-preview/'], ['/catalogo/', '/rivoxel-preview/catalogo/'], ['/links/', '/rivoxel-preview/links/']]) {
    const response = await atender(new Request(alias + path), assets);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), expected);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  assert.equal((await atender(new Request(alias + '/gestao/'), assets)).status, 404);
  assert.equal((await atender(new Request('https://rivoxel.com.br/'), assets)).status, 503);
});
