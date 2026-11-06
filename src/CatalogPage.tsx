import type { CatalogProduct, CatalogResult } from "./catalogTypes";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import logo from "../logo.svg";
import { publicCatalog, catalogImageUrl } from "./services/catalogo.js";
import { catalogLink, catalogMoney, catalogWhatsapp, marketplaceUrl } from "./lib/catalogo.js";
import { catalogClickParameters, catalogSearchTerm, trackCatalogClick, trackCatalogEvent } from "./lib/catalogoAnalytics.js";
import ProductDetail from "./components/catalogo/ProductDetail.tsx";
import CatalogDialog from "./components/catalogo/CatalogDialog.tsx";
const currentSlug = () => new URLSearchParams(window.location.search).get("produto") || window.location.pathname.match(/^\/produto\/([a-z0-9-]+)\/?$/)?.[1] || null;
export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("novos");
  const [openMenu, setOpenMenu] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => window.matchMedia("(max-width: 640px)").matches ? "list" : "grid");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<CatalogResult>({ produtos: [], categorias: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [slug, setSlug] = useState(currentSlug);
  const [publishedPages, setPublishedPages] = useState<string[]>([]);
  const directEntry = useRef(currentSlug());
  const lastSearch = useRef("");
  const [detail, setDetail] = useState<CatalogProduct | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => { if (!(event.target instanceof Node && menuRef.current?.contains(event.target))) setOpenMenu(""); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu("");
        menuRef.current?.querySelector<HTMLElement>(`[data-catalog-trigger="${openMenu}"]`)?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [openMenu]);
  useEffect(() => { fetch('/catalogo-paginas.json', { cache: 'no-cache' }).then(response => response.ok ? response.json() : []).then(data => { if (Array.isArray(data)) setPublishedPages(data); }).catch(() => {}); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setOffset(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let current = true;
    let analyticsTimer: number | undefined;
    setLoading(true); setError("");
    publicCatalog({ p_busca: query, p_categoria: category || undefined, p_ordem: order, p_offset: offset }).then(data => {
      if (current) {
        setResult(previous => ({ ...data, produtos: offset ? [...new Map([...previous.produtos, ...data.produtos].map(p => [p.id, p])).values()] : data.produtos }));
        if (!query) lastSearch.current = '';
        const term = catalogSearchTerm(query);
        if (!offset && term && term !== lastSearch.current) analyticsTimer = window.setTimeout(() => {
          lastSearch.current = term;
          trackCatalogEvent('catalogo_busca', { termo_busca: term, resultado_busca: data.total ? 'com_resultados' : 'sem_resultados' });
        }, 1000);
      }
    }).catch(() => { if (current) setError("Não foi possível carregar os produtos. Tente novamente."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; window.clearTimeout(analyticsTimer); };
  }, [query, category, order, offset, retry]);
  useEffect(() => {
    const change = () => setSlug(currentSlug());
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  useEffect(() => {
    let current = true;
    setDetail(null);
    if (!slug) { setDetailStatus(""); setDetailLoading(false); return; }
    setDetailLoading(true);
    setDetailStatus("Carregando produto…");
    publicCatalog({ p_slug: slug }).then(data => {
      if (!current) return;
      const product = data.produtos[0];
      if (product && directEntry.current === slug) {
        directEntry.current = null;
        trackCatalogEvent('catalogo_acesso_direto', catalogClickParameters(product, 'acesso_direto', 'detalhes'));
      }
      setDetail(product || null);
      setDetailStatus(product ? "" : "Este produto não está disponível no catálogo.");
      if (product && product.slug !== slug) {
        window.history.replaceState(null, "", catalogLink(product.slug));
      }
    }).catch(() => { if (current) setDetailStatus("Não foi possível abrir este produto. Tente novamente."); }).finally(() => { if (current) setDetailLoading(false); });
    return () => { current = false; };
  }, [slug, retry]);
  function open(product: CatalogProduct) {
    directEntry.current = null;
    trackCatalogClick(product, 'ver_detalhes', 'lista');
    setDetail(null); setDetailLoading(true); setDetailStatus("");
    window.history.pushState(null, "", catalogLink(product.slug, window.location.origin, publishedPages.includes(product.slug))); setSlug(product.slug);
  }
  function close() {
    window.history.replaceState(null, "", "/catalogo/"); setSlug(null);
  }
  const orderOptions = [["novos", "Mais recentes"], ["destaque", "Destaques"], ["preco_asc", "Menor preço"], ["preco_desc", "Maior preço"]];
  const categoryName = result.categorias.find(item => String(item.id) === category)?.nome || "Todas as categorias";
  return <div className="catalog-site">
    <a className="catalog-skip" href="#produtos">Ir para os produtos</a>
    <header className="catalog-site-header"><a href="/" aria-label="RAVA Studio 3D — início"><img src={logo} alt="RAVA Studio 3D" /></a><a href="https://wa.me/5521984470594" target="_blank" rel="noopener noreferrer">Vamos conversar ↗</a></header>
    <main>
      <section className="catalog-hero"><h1>Nosso catálogo</h1><p>Criações em 3D para você. Escolha sua próxima peça.</p></section>
      <section id="produtos" className="catalog-products">
        <div className="catalog-discovery">
          <label className="catalog-search"><span className="catalog-visually-hidden">Buscar produto</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" maxLength={150} placeholder="Busque por produtos" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <div className="catalog-nav" ref={menuRef} aria-label="Navegar pelo catálogo">
            <div className="catalog-menu">
              <button className={`catalog-menu-trigger${category ? ' is-selected' : ''}`} type="button" data-catalog-trigger="category" aria-expanded={openMenu === 'category'} aria-controls="catalog-category-menu" onClick={() => setOpenMenu(openMenu === 'category' ? '' : 'category')}><span><small>Explorar</small><strong>{categoryName}</strong></span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg></button>
              {openMenu === 'category' && <div className="catalog-menu-panel" id="catalog-category-menu" role="group" aria-label="Categorias"><p>Escolha uma categoria</p>{[{ id: '', nome: 'Todas as categorias' }, ...result.categorias].map(item => <button key={item.id || 'all'} type="button" className={String(item.id) === category ? 'is-current' : ''} aria-pressed={String(item.id) === category} onClick={() => { const value = String(item.id); if (value !== category) trackCatalogEvent('catalogo_filtro_categoria', { produto_categoria: item.nome }); setCategory(value); setOffset(0); menuRef.current?.querySelector<HTMLElement>('[data-catalog-trigger=category]')?.focus(); setOpenMenu(''); }}>{item.nome}{String(item.id) === category && <span aria-hidden="true">✓</span>}</button>)}</div>}
            </div>
            <div className="catalog-menu catalog-menu-sort">
              <button className="catalog-menu-trigger" type="button" data-catalog-trigger="order" aria-expanded={openMenu === 'order'} aria-controls="catalog-order-menu" onClick={() => setOpenMenu(openMenu === 'order' ? '' : 'order')}><span><small>Ordenar</small><strong>{orderOptions.find(item => item[0] === order)?.[1]}</strong></span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg></button>
              {openMenu === 'order' && <div className="catalog-menu-panel" id="catalog-order-menu" role="group" aria-label="Ordenação"><p>Ordenar produtos</p>{orderOptions.map(([value, label]) => <button key={value} type="button" className={value === order ? 'is-current' : ''} aria-pressed={value === order} onClick={() => { setOrder(value); setOffset(0); menuRef.current?.querySelector<HTMLElement>('[data-catalog-trigger=order]')?.focus(); setOpenMenu(''); }}>{label}{value === order && <span aria-hidden="true">✓</span>}</button>)}</div>}
            </div>
          </div>
        </div>
        <div className="catalog-toolbar">
          <p className="catalog-count" role="status">{loading ? "Carregando…" : `${result.total} produto${result.total === 1 ? "" : "s"}`}</p>
          <div className="catalog-view-toggle" role="group" aria-label="Visualização dos produtos">
            <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>Colunas</button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" /></svg>Lista</button>
          </div>
        </div>
        {error ? <div className="catalog-message" role="alert">{error}<button onClick={() => setRetry(r => r + 1)}>Tentar novamente</button></div> : <>
          {!loading && !result.produtos.length && <div className="catalog-empty"><h2>{query || category ? "Nenhum produto encontrado" : "Novas criações estão chegando"}</h2><p>{query || category ? "Experimente outro nome ou categoria." : "Converse com a gente para conhecer as possibilidades."}</p></div>}
          <div className={`catalog-grid${view === "list" ? " catalog-list" : ""}`} aria-busy={loading}>{result.produtos.map(product => <article className="catalog-card" key={product.id}>
            <a className="catalog-card-open" href={catalogLink(product.slug, window.location.origin, publishedPages.includes(product.slug))} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); open(product); } }} aria-label={`Ver detalhes de ${product.nome}`}>
              <div className={`catalog-card-photo${product.marketplace ? ' catalog-card-photo-marketplace' : ''}`}>{product.imagens[0] || product.imagem_externa ? <img loading="lazy" decoding="async" src={product.imagens[0] ? catalogImageUrl(product.imagens[0].miniatura) : product.imagem_externa ?? undefined} alt={product.imagens[0]?.alt || product.nome} /> : <span>Imagem em breve</span>}{product.destaque && <span className="catalog-featured">Destaque</span>}</div>
              <div className="catalog-card-copy"><p className="catalog-eyebrow">{product.categoria || "Feito em 3D"}</p><h2>{product.nome}</h2>{product.resumo && <p>{product.resumo}</p>}{!product.marketplace && <div className="catalog-price">{product.promocional_centavos != null && <del>{catalogMoney(product.preco_centavos)}</del>}<strong>{catalogMoney(product.promocional_centavos ?? product.preco_centavos)}</strong></div>}<span className="catalog-view">Ver detalhes +</span></div>
            </a>
            {product.marketplace ? (marketplaceUrl(product.link_marketplace) ? <a className="catalog-card-contact" href={marketplaceUrl(product.link_marketplace) ?? undefined} target="_blank" rel="noopener noreferrer" onClick={() => trackCatalogClick(product, 'comprar_marketplace', 'lista')}>Comprar produto ↗</a> : <span className="catalog-card-contact">Link de compra indisponível</span>) : <a className="catalog-card-contact" href={catalogWhatsapp({ ...product, pagina_publicada: publishedPages.includes(product.slug) })} target="_blank" rel="noopener noreferrer" onClick={() => trackCatalogClick(product, 'pedir_whatsapp', 'lista')}>Pedir pelo WhatsApp ↗</a>}
          </article>)}</div>
          {result.produtos.length < result.total && <button className="catalog-more" disabled={loading} onClick={() => { trackCatalogEvent('catalogo_carregar_mais'); setOffset(result.produtos.length); }}>Carregar mais produtos</button>}
        </>}
      </section>
      <section className="catalog-review" aria-labelledby="catalog-review-title">
        <div><span className="catalog-review-star" aria-hidden="true">☆</span><h2 id="catalog-review-title">Sua experiência merece ser compartilhada</h2><p>Já comprou com a RAVA? Conte como foi e ajude outras pessoas a conhecer nosso trabalho.</p></div>
        <a href="https://g.page/r/CaRNI72q_6jFEBI/review" target="_blank" rel="noopener noreferrer" aria-label="Avalie a RAVA no Google (abre em nova aba)" onClick={() => trackCatalogEvent('catalogo_avaliacao_google')}>Avalie a RAVA no Google ↗</a>
      </section>
    </main>
    <footer className="catalog-footer"><span>RAVA Studio 3D © {new Date().getFullYear()}</span><span>Feito com criatividade, camada por camada.</span><a href="/">Conheça nosso site ↗</a></footer>
    {detail && <ProductDetail key={detail.id} product={{ ...detail, pagina_publicada: publishedPages.includes(detail.slug) }} onClose={close} />}
    {slug && !detail && <CatalogDialog title={detailLoading ? "Carregando produto" : "Detalhes do produto"} onClose={close}>
      {detailLoading ? <div className="catalog-product-loading" role="status">
        <span className="catalog-spinner" aria-hidden="true" />
        <p>Buscando os detalhes para você…</p>
      </div> : <div className="catalog-product-loading" role="alert">
        <p>{detailStatus}</p>
        <button className="catalog-more" type="button" onClick={() => { setDetailLoading(true); setRetry(r => r + 1); }}>Tentar novamente</button>
      </div>}
    </CatalogDialog>}
  </div>;
}
