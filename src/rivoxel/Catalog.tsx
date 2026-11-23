import { ProductCard } from './ProductCard';
import { useEffect, useMemo, useState } from 'react';
import type { CatalogProduct, CatalogResult } from '../catalogTypes';
import { catalogCategories, catalogMoney, marketplaceUrl } from '../lib/catalogo.js';
import { catalogImageUrl, publicCatalogForBrand } from '../services/catalogo.js';
import { catalog, empty, whatsapp } from './shared';

export default function Catalog() {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState(() => new URLSearchParams(window.location.search).get('categoria') || '');
  const [ordem, setOrdem] = useState('novos');
  const [offset, setOffset] = useState(0);
  const [resultado, setResultado] = useState<CatalogResult>(empty);
  const [vitrine, setVitrine] = useState<CatalogResult>(empty);
  const [detalhe, setDetalhe] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const slug = new URLSearchParams(window.location.search).get('produto') || '';
  const [detalheLoading, setDetalheLoading] = useState(Boolean(slug));
  const [detalheError, setDetalheError] = useState('');
  const [imagemSelecionada, setImagemSelecionada] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    publicCatalogForBrand('rivoxel', { p_ordem: 'novos' }).then(data => { if (active) setVitrine(data); }).catch(() => {});
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    let current = true;
    if (slug) return;
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      publicCatalogForBrand('rivoxel', { p_busca: busca.trim(), p_categoria: categoria || undefined, p_offset: offset, p_ordem: ordem })
        .then(data => { if (current) setResultado(previous => ({ ...data, produtos: offset ? [...new Map([...previous.produtos, ...data.produtos].map(p => [p.id, p])).values()] : data.produtos })); })
        .catch(() => { if (current) setError('Não foi possível carregar o catálogo de homologação.'); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [busca, categoria, offset, ordem, slug]);
  useEffect(() => {
    let current = true;
    if (!slug) return;
    publicCatalogForBrand('rivoxel', { p_slug: slug })
      .then(data => { if (current) setDetalhe(data.produtos[0] || null); })
      .catch(() => { if (current) setDetalheError('Não foi possível carregar este produto.'); })
      .finally(() => { if (current) setDetalheLoading(false); });
    return () => { current = false; };
  }, [slug]);
  const categorias = useMemo(() => catalogCategories(resultado.categorias), [resultado.categorias]);

  return <>
      {!slug && <section id="catalogo" className="rv-section rv-catalog" aria-labelledby="rv-catalog-title"><div className="rv-section-heading"><div><h1 id="rv-catalog-title">Catálogo</h1></div></div>
        <div className="rv-catalog-layout"><aside className="rv-filters" aria-label="Filtros do catálogo"><h3>Filtros</h3><label>Buscar produto<input type="search" placeholder="O que você procura?" maxLength={150} value={busca} onChange={e => { setBusca(e.target.value); setOffset(0); }} /></label><label>Categoria<select value={categoria} onChange={e => { setCategoria(e.target.value); setOffset(0); }}><option value="">Todas as categorias</option>{categorias.map(c => <option value={c.id} key={c.id}>{c.pai_id ? '↳ ' : ''}{c.nome}</option>)}</select></label><label>Ordenar por<select value={ordem} onChange={e => { setOrdem(e.target.value); setOffset(0); }}><option value="novos">Mais recentes</option><option value="destaque">Destaques</option><option value="preco_asc">Menor preço</option><option value="preco_desc">Maior preço</option></select></label></aside>
          <div className="rv-results">{error && <p role="alert">{error}</p>}<div className="rv-results-bar"><span role="status">{loading ? 'Carregando peças…' : `${resultado.total} ${resultado.total === 1 ? 'peça encontrada' : 'peças encontradas'}`}</span></div>{!error && !loading && !resultado.produtos.length && <div className="rv-empty"><strong>Nenhuma peça encontrada.</strong><p>Experimente outra busca ou categoria.</p></div>}<div className="rv-product-grid">{resultado.produtos.map(p => <ProductCard key={p.id} product={p} />)}</div>{resultado.produtos.length < resultado.total && <button className="rv-button rv-button-ghost rv-more" type="button" disabled={loading} onClick={() => setOffset(resultado.produtos.length)}>Carregar mais peças</button>}</div></div>
      </section>}
      {slug && <section id="detalhes" className="rv-section rv-detail" aria-label="Detalhes do produto"><a className="rv-back" href={catalog}>Voltar ao catálogo</a>{detalheLoading ? <p role="status">Carregando produto…</p> : detalheError ? <p role="alert">{detalheError}</p> : detalhe ? <><div className="rv-detail-layout"><div><div className="rv-detail-image">{detalhe.imagens[imagemSelecionada] ? <img src={catalogImageUrl(detalhe.imagens[imagemSelecionada].caminho)} alt={detalhe.imagens[imagemSelecionada].alt || detalhe.nome} /> : detalhe.imagem_externa ? <img src={detalhe.imagem_externa} alt={detalhe.nome} /> : <span>Imagem indisponível</span>}</div>{detalhe.imagens.length > 1 && <div className="rv-thumbnails" aria-label="Imagens do produto">{detalhe.imagens.map((image, index) => <button key={image.id} type="button" aria-label={`Exibir imagem ${index + 1}`} aria-pressed={index === imagemSelecionada} onClick={() => setImagemSelecionada(index)}><img src={catalogImageUrl(image.miniatura)} alt="" /></button>)}</div>}</div><div><p className="rv-kicker"><span /> {detalhe.categoria || 'RIVOXEL / 3D'}</p><h2>{detalhe.nome}</h2>{detalhe.preco_centavos != null && <strong className="rv-detail-price">{catalogMoney(detalhe.promocional_centavos ?? detalhe.preco_centavos)}</strong>}<p>{detalhe.descricao}</p><dl>{detalhe.material && <><dt>Material</dt><dd>{detalhe.material}</dd></>}{detalhe.dimensoes && <><dt>Dimensões</dt><dd>{detalhe.dimensoes}</dd></>}{detalhe.cores && <><dt>Cores</dt><dd>{detalhe.cores}</dd></>}{detalhe.prazo && <><dt>Prazo</dt><dd>{detalhe.prazo}</dd></>}</dl>{detalhe.marketplace && marketplaceUrl(detalhe.link_marketplace) ? <a className="rv-button rv-button-primary" href={marketplaceUrl(detalhe.link_marketplace) || undefined} target="_blank" rel="noopener noreferrer">Ver opção de compra</a> : <a className="rv-button rv-button-primary" href={whatsapp(`Olá! Vi ${detalhe.nome} no catálogo da Rivoxel e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp</a>}</div></div>{vitrine.produtos.some(p => p.id !== detalhe.id) && <div className="rv-related"><h3>Mais da Rivoxel</h3><div className="rv-product-grid">{vitrine.produtos.filter(p => p.id !== detalhe.id).slice(0,4).map(p => <ProductCard key={p.id} product={p} />)}</div></div>}</> : <p>Produto não encontrado ou indisponível.</p>}</section>}
  </>;
}