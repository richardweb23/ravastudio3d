/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import logo from "../logo.svg";
import { publicCatalog, catalogImageUrl } from "./services/catalogo.js";
import { catalogMoney, catalogWhatsapp } from "./lib/catalogo.js";
import ProductDetail from "./components/catalogo/ProductDetail.jsx";
export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("destaque");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState({ produtos: [], categorias: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [slug, setSlug] = useState(() => new URLSearchParams(window.location.search).get("produto"));
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setOffset(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    publicCatalog({ p_busca: query, p_categoria: category || null, p_ordem: order, p_offset: offset }).then(data => {
      if (current) setResult(previous => ({ ...data, produtos: offset ? [...new Map([...previous.produtos, ...data.produtos].map(p => [p.id, p])).values()] : data.produtos }));
    }).catch(() => { if (current) setError("Não foi possível carregar os produtos. Tente novamente."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query, category, order, offset, retry]);
  useEffect(() => {
    const change = () => setSlug(new URLSearchParams(window.location.search).get("produto"));
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  useEffect(() => {
    let current = true;
    setDetail(null);
    if (!slug) { setDetailStatus(""); return; }
    setDetailStatus("Carregando produto…");
    publicCatalog({ p_slug: slug }).then(data => {
      if (!current) return;
      const product = data.produtos[0];
      setDetail(product || null);
      setDetailStatus(product ? "" : "Este produto não está disponível no catálogo.");
      if (product && product.slug !== slug) {
        const url = new URL(window.location.href); url.searchParams.set("produto", product.slug);
        window.history.replaceState(null, "", url);
      }
    }).catch(() => { if (current) setDetailStatus("Não foi possível abrir este produto. Tente novamente."); });
    return () => { current = false; };
  }, [slug, retry]);
  function open(product) {
    const url = new URL(window.location.href); url.searchParams.set("produto", product.slug);
    window.history.pushState(null, "", url); setSlug(product.slug);
  }
  function close() {
    const url = new URL(window.location.href); url.searchParams.delete("produto");
    window.history.replaceState(null, "", url); setSlug(null);
  }
  return <div className="catalog-site">
    <a className="catalog-skip" href="#produtos">Ir para os produtos</a>
    <header className="catalog-site-header"><a href="/" aria-label="RAVA Studio 3D — início"><img src={logo} alt="RAVA Studio 3D" /></a><a href="https://wa.me/5521984470594" target="_blank" rel="noopener noreferrer">Vamos conversar ↗</a></header>
    <main>
      <section className="catalog-hero"><p className="catalog-eyebrow">CRIATIVIDADE EM CADA CAMADA</p><h1>Ideias que ganham <em>forma.</em></h1><p>Explore nossas criações em impressão 3D.<br />Encontre sua próxima peça ou personalize uma ideia com a gente.</p></section>
      <section id="produtos" className="catalog-products">
        <div className="catalog-filters">
          <label>Buscar produto<input type="search" maxLength={150} placeholder="O que você procura?" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label>Categoria<select value={category} onChange={e => { setCategory(e.target.value); setOffset(0); }}><option value="">Todas as categorias</option>{result.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Ordenar por<select value={order} onChange={e => { setOrder(e.target.value); setOffset(0); }}><option value="destaque">Destaques</option><option value="preco_asc">Menor preço</option><option value="preco_desc">Maior preço</option></select></label>
        </div>
        {detailStatus && <div className="catalog-message" role="status">{detailStatus}<button onClick={close}>Fechar</button><button onClick={() => setRetry(r => r + 1)}>Tentar novamente</button></div>}
        <p className="catalog-count" role="status">{loading ? "Carregando…" : `${result.total} produto${result.total === 1 ? "" : "s"}`}</p>
        {error ? <div className="catalog-message" role="alert">{error}<button onClick={() => setRetry(r => r + 1)}>Tentar novamente</button></div> : <>
          {!loading && !result.produtos.length && <div className="catalog-empty"><h2>{query || category ? "Nenhum produto encontrado" : "Novas criações estão chegando"}</h2><p>{query || category ? "Experimente outro nome ou categoria." : "Converse com a gente para conhecer as possibilidades."}</p></div>}
          <div className="catalog-grid" aria-busy={loading}>{result.produtos.map(product => <article className="catalog-card" key={product.id}>
            <button className="catalog-card-open" onClick={() => open(product)} aria-label={`Ver detalhes de ${product.nome}`}>
              <div className="catalog-card-photo">{product.imagens[0] ? <img loading="lazy" decoding="async" src={catalogImageUrl(product.imagens[0].miniatura)} alt={product.imagens[0].alt || product.nome} /> : <span>Imagem em breve</span>}{product.destaque && <span className="catalog-featured">Destaque</span>}</div>
              <div className="catalog-card-copy"><p className="catalog-eyebrow">{product.categoria || "Feito em 3D"}</p><h2>{product.nome}</h2>{product.resumo && <p>{product.resumo}</p>}<div className="catalog-price">{product.promocional_centavos != null && <del>{catalogMoney(product.preco_centavos)}</del>}<strong>{catalogMoney(product.promocional_centavos ?? product.preco_centavos)}</strong></div><span className="catalog-view">Ver detalhes +</span></div>
            </button>
            <a className="catalog-card-contact" href={catalogWhatsapp(product)} target="_blank" rel="noopener noreferrer">Pedir pelo WhatsApp ↗</a>
          </article>)}</div>
          {result.produtos.length < result.total && <button className="catalog-more" disabled={loading} onClick={() => setOffset(result.produtos.length)}>Carregar mais produtos</button>}
        </>}
      </section>
    </main>
    <footer className="catalog-footer"><span>RAVA Studio 3D © {new Date().getFullYear()}</span><span>Feito com criatividade, camada por camada.</span><a href="/">Conheça nosso site ↗</a></footer>
    {detail && <ProductDetail key={detail.id} product={detail} onClose={close} />}
  </div>;
}
