import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogClickParameters, catalogSearchTerm, trackCatalogClick, trackCatalogEvent } from './catalogoAnalytics.js';

test('cliques do catálogo identificam produto, ação e local sem dados pessoais', () => {
  const product = { id: 'p1', nome: 'Vaso', categoria: 'Decoração', link_marketplace: 'https://example.com/?cliente=privado' };
  const params = catalogClickParameters(product, 'comprar_marketplace', 'detalhes');
  assert.deepEqual(params, { produto_id: 'p1', produto_nome: 'Vaso', produto_categoria: 'Decoração', tipo_clique: 'comprar_marketplace', local_clique: 'detalhes' });
  const calls = [];
  globalThis.window = { gtag: (...args) => calls.push(args) };
  try {
    trackCatalogClick(product, 'comprar_marketplace', 'detalhes');
    assert.deepEqual(calls, [['event', 'catalogo_clique_produto', params]]);
    delete window.gtag;
    assert.doesNotThrow(() => trackCatalogClick(product, 'ver_detalhes', 'lista'));
  } finally { delete globalThis.window; }
});

test('buscas descartam informações de contato evidentes e eventos independentes são enviados', () => {
  assert.equal(catalogSearchTerm('  vaso decorativo  '), 'vaso decorativo');
  for (const term of ['', 'nome@example.com', '(21) 99999-9999', 'https://exemplo.com']) assert.equal(catalogSearchTerm(term), null);
  const calls = [];
  globalThis.window = { gtag: (...args) => calls.push(args) };
  try {
    trackCatalogEvent('catalogo_busca', { termo_busca: 'vaso', resultado_busca: 'sem_resultados' });
    trackCatalogEvent('catalogo_carregar_mais');
    assert.deepEqual(calls, [['event', 'catalogo_busca', { termo_busca: 'vaso', resultado_busca: 'sem_resultados' }], ['event', 'catalogo_carregar_mais', {}]]);
  } finally { delete globalThis.window; }
});
