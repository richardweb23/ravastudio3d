import { useEffect, useState } from 'react';
import type { CatalogProduct, CatalogResult } from '../catalogTypes';
import { catalogCategories, catalogMoney } from '../lib/catalogo.js';
import { catalogImageUrl, publicCatalogForBrand } from '../services/catalogo.js';

// Esta página é distribuída apenas no build de homologação.
export default function RivoxelPreview() {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [offset, setOffset] = useState(0);
  const [resultado, setResultado] = useState<CatalogResult>({ produtos: [], categorias: [], total: 0 });
  const [detalhe, setDetalhe] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slug, setSlug] = useState(() => new URLSearchParams(window.location.search).get('produto') || '');

  useEffect(() => {
    const sync = () => setSlug(new URLSearchParams(window.location.search).get('produto') || '');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      publicCatalogForBrand('rivoxel', { p_busca: busca.trim(), p_categoria: categoria || undefined, p_offset: offset, p_ordem: 'novos' })
        .then(data => { if (current) setResultado(previous => ({ ...data, produtos: offset ? [...new Map([...previous.produtos, ...data.produtos].map(p => [p.id, p])).values()] : data.produtos })); })
        .catch(() => { if (current) setError('Não foi possível carregar o catálogo de homologação.'); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [busca, categoria, offset]);
  useEffect(() => {
    let current = true;
    if (!slug) return;
    publicCatalogForBrand('rivoxel', { p_slug: slug })
      .then(data => { if (current) setDetalhe(data.produtos[0] || null); })
      .catch(() => { if (current) setError('Não foi possível carregar este produto.'); });
    return () => { current = false; };
  }, [slug]);

  function abrir(slugProduto: string) {
    setDetalhe(null);
    const url = new URL(window.location.href);
    if (slugProduto) url.searchParams.set('produto', slugProduto); else url.searchParams.delete('produto');
    window.history.pushState(null, '', url);
    setSlug(slugProduto);
  }
  return <div className="rivoxel-preview">
    <div className="rivoxel-preview-notice">Ambiente de homologação · identidade visual provisória</div>
    <header><strong>Rivoxel</strong><a href="#catalogo">Catálogo</a></header>
    <main>
      <section><p>Prévia de desenvolvimento</p><h1>Catálogo Rivoxel</h1><p>Esta página reúne apenas os produtos publicados para a Rivoxel no ambiente de teste.</p></section>
      <section id="catalogo" aria-label="Catálogo de homologação">
        <div className="rivoxel-preview-filters">
          <label>Buscar produto<input type="search" value={busca} onChange={e => { setBusca(e.target.value); setOffset(0); }} /></label>
          <label>Categoria<select value={categoria} onChange={e => { setCategoria(e.target.value); setOffset(0); }}><option value="">Todas as categorias</option>{catalogCategories(resultado.categorias).map(c => <option value={c.id} key={c.id}>{c.pai_id ? '↳ ' : ''}{c.nome}</option>)}</select></label>
        </div>
        {error && <p role="alert">{error}</p>}
        <p role="status">{loading ? 'Carregando…' : `${resultado.total} produto(s)`}</p>
        {!loading && !resultado.produtos.length && <p>Nenhum produto publicado nesta marca no ambiente de teste.</p>}
        <div className="rivoxel-preview-grid">{resultado.produtos.map(product => {
          const image = product.imagens[0]?.miniatura ? catalogImageUrl(product.imagens[0].miniatura) : product.imagem_externa;
          return <article key={product.id}>{image && <img src={image} alt={product.nome} loading="lazy" />}<h2>{product.nome}</h2>{product.categoria && <p>{product.categoria}</p>}<p>{product.preco_centavos != null ? catalogMoney(product.promocional_centavos ?? product.preco_centavos) : ''}</p><button type="button" onClick={() => abrir(product.slug)}>Ver detalhes</button></article>;
        })}</div>
        {resultado.produtos.length < resultado.total && <button type="button" disabled={loading} onClick={() => setOffset(resultado.produtos.length)}>Carregar mais</button>}
      </section>
      {slug && <section className="rivoxel-preview-detail" aria-label="Detalhes do produto"><button type="button" onClick={() => abrir('')}>Voltar ao catálogo</button>{detalhe ? <><h2>{detalhe.nome}</h2><p>{detalhe.descricao}</p></> : <p>Produto não encontrado ou indisponível.</p>}</section>}
    </main>
    <footer>Rivoxel · conteúdo de homologação</footer>
  </div>;
}
