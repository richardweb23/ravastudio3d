import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atender, atenderRivoxel, produtoRavaPublicado } from '../../workers/entrada.ts';

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

test('Rivoxel publicada serve arquivos próprios apenas com ativação explícita', async () => {
  const assets = { async fetch(req) { const url = new URL(req.url); return new Response(url.pathname + url.search); } };
  for (const [path, expected] of [['/', '/rivoxel-site/'], ['/catalogo/?produto=peca', '/rivoxel-site/catalogo/?produto=peca'], ['/links/', '/rivoxel-site/links/'], ['/robots.txt', '/rivoxel-site/robots.txt'], ['/sitemap.xml', '/rivoxel-site/sitemap.xml']]) {
    const response = await atender(new Request('https://rivoxel.com.br' + path), assets, true);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), expected);
    assert.equal(response.headers.get('x-robots-tag'), null);
  }
  for (const path of ['/gestao/', '/rivoxel-site/', '/rivoxel-preview/']) {
    assert.equal((await atender(new Request('https://rivoxel.com.br' + path), assets, true)).status, 404);
  }
  assert.equal((await atender(new Request('https://ravastudio3d.com.br/rivoxel-site/'), assets, true)).status, 404);
  assert.equal((await atender(new Request('https://rivoxel.com.br/'), assets)).status, 503);
});

test('página estática da Rava respeita a classificação atual e falha fechada', async () => {
  const assets = { async fetch() { return Response.json({ url: 'https://teste.supabase.co', key: 'sb_publishable_teste' }); } };
  const req = new Request('https://ravastudio3d.com.br/produto/peca/');
  let body;
  const consulta = data => async (_url, options) => { body = JSON.parse(options.body); return Response.json(data); };
  assert.equal(await produtoRavaPublicado(req, assets, consulta({ produtos: [{ slug: 'peca' }], total: 1 })), null);
  assert.deepEqual(body, { p_principal_id: 'rava', p_slug: 'peca' });
  const moved = await produtoRavaPublicado(req, assets, consulta({ produtos: [], total: 0 }));
  assert.equal(moved.status, 404);
  assert.equal(moved.headers.get('cache-control'), 'no-store');
  assert.equal((await produtoRavaPublicado(req, assets, async () => { throw new Error('offline'); })).status, 503);
  assert.equal((await produtoRavaPublicado(req, assets, consulta({ produtos: null, total: 0 }))).status, 503);
  assert.equal((await produtoRavaPublicado(new Request('https://ravastudio3d.com.br/produto/INVALIDO/'), assets)).status, 404);
  assert.equal((await atender(new Request('https://ravastudio3d.com.br/site-catalog-config.json'), assets, true)).status, 404);
});

test('página Rava validada não é armazenada no navegador', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ produtos: [{ slug: 'peca' }], total: 1 });
  try {
    const assets = { async fetch(req) {
      if (new URL(req.url).pathname === '/site-catalog-config.json') return Response.json({ url: 'https://teste.supabase.co', key: 'sb_publishable_teste' });
      return new Response('produto', { headers: { 'Cache-Control': 'max-age=3600' } });
    } };
    const response = await atender(new Request('https://ravastudio3d.com.br/produto/peca/'), assets, true);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { globalThis.fetch = originalFetch; }
});
