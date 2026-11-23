import { useEffect, useMemo, useState } from 'react';
import type { CatalogProduct, CatalogResult } from '../catalogTypes';
import { catalogCategories, catalogMoney, marketplaceUrl } from '../lib/catalogo.js';
import { catalogImageUrl, publicCatalogForBrand } from '../services/catalogo.js';
import logo from './assets/logo-branca.png';
import pato from './assets/pato-kratos.png';
import naruto from './assets/naruto-kyuubi.png';

const instagram = 'https://www.instagram.com/rivoxel.3d/';
const whatsapp = (message: string) => `https://wa.me/5521984470594?text=${encodeURIComponent(message)}`;
const empty: CatalogResult = { produtos: [], categorias: [], total: 0 };
const photo = (product: CatalogProduct, size: 'principal' | 'miniatura' = 'miniatura') => {
  const image = product.imagens?.[0];
  return image ? catalogImageUrl(size === 'principal' ? image.caminho : image.miniatura) : product.imagem_externa || '';
};

// Esta página é distribuída apenas no build de homologação.
export default function RivoxelPreview() {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ordem, setOrdem] = useState('novos');
  const [offset, setOffset] = useState(0);
  const [resultado, setResultado] = useState<CatalogResult>(empty);
  const [vitrine, setVitrine] = useState<CatalogResult>(empty);
  const [vitrineDestaques, setVitrineDestaques] = useState<CatalogResult>(empty);
  const [detalhe, setDetalhe] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slug, setSlug] = useState(() => new URLSearchParams(window.location.search).get('produto') || '');
  const [detalheLoading, setDetalheLoading] = useState(Boolean(slug));
  const [detalheError, setDetalheError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [imagemSelecionada, setImagemSelecionada] = useState(0);

  useEffect(() => {
    let current = true;
    publicCatalogForBrand('rivoxel', { p_ordem: 'novos' }).then(data => { if (current) setVitrine(data); }).catch(() => {});
    publicCatalogForBrand('rivoxel', { p_ordem: 'destaque' }).then(data => { if (current) setVitrineDestaques(data); }).catch(() => {});
    return () => { current = false; };
  }, []);
  useEffect(() => {
    const sync = () => { const next = new URLSearchParams(window.location.search).get('produto') || ''; setDetalhe(null); setDetalheError(''); setDetalheLoading(Boolean(next)); setImagemSelecionada(0); setSlug(next); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      publicCatalogForBrand('rivoxel', { p_busca: busca.trim(), p_categoria: categoria || undefined, p_offset: offset, p_ordem: ordem })
        .then(data => { if (current) setResultado(previous => ({ ...data, produtos: offset ? [...new Map([...previous.produtos, ...data.produtos].map(p => [p.id, p])).values()] : data.produtos })); })
        .catch(() => { if (current) setError('Não foi possível carregar o catálogo de homologação.'); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [busca, categoria, offset, ordem]);
  useEffect(() => {
    let current = true;
    if (!slug) return;
    publicCatalogForBrand('rivoxel', { p_slug: slug })
      .then(data => { if (current) setDetalhe(data.produtos[0] || null); })
      .catch(() => { if (current) setDetalheError('Não foi possível carregar este produto.'); })
      .finally(() => { if (current) setDetalheLoading(false); });
    return () => { current = false; };
  }, [slug]);
  useEffect(() => { if (slug) document.getElementById('detalhes')?.scrollIntoView(); }, [slug]);

  function abrir(slugProduto: string) {
    if (slugProduto === slug) return;
    setDetalhe(null); setDetalheError(''); setDetalheLoading(Boolean(slugProduto)); setImagemSelecionada(0);
    const url = new URL(window.location.href);
    if (slugProduto) { url.searchParams.set('produto', slugProduto); url.hash = 'detalhes'; }
    else { url.searchParams.delete('produto'); url.hash = 'catalogo'; }
    window.history.pushState(null, '', url); setSlug(slugProduto);
  }
  function escolherCategoria(id: string) {
    setCategoria(id); setBusca(''); setOffset(0); setMenuOpen(false);
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  }
  const categorias = useMemo(() => catalogCategories(resultado.categorias), [resultado.categorias]);
  const cardsCategorias = useMemo(() => vitrine.categorias.filter(c => !c.pai_id).map(c => {
    const filhos = new Set(vitrine.categorias.filter(f => f.pai_id === c.id).map(f => f.id));
    const product = vitrine.produtos.find(p => p.categoria_id && (p.categoria_id === c.id || filhos.has(p.categoria_id)) && photo(p));
    return { ...c, image: product ? photo(product, 'principal') : '' };
  }).filter(c => c.image).slice(0, 6), [vitrine]);
  const destaques = vitrineDestaques.produtos.filter(p => p.destaque).slice(0, 4);
  const novidades = vitrine.produtos.length >= 3 ? vitrine.produtos.slice(0, 4) : [];
  const productCard = (product: CatalogProduct) => {
    const image = photo(product);
    return <article className="rv-product" key={product.id}>
      <button type="button" className="rv-product-image" onClick={() => abrir(product.slug)} aria-label={`Ver detalhes de ${product.nome}`}>
        {image ? <img src={image} alt={product.nome} loading="lazy" /> : <span>Imagem indisponível</span>}
        <span className="rv-product-tag">RIVOXEL / 3D</span>
      </button>
      <div className="rv-product-info"><p>{product.categoria || 'IMPRESSÃO 3D'}</p><h3>{product.nome}</h3>
        {product.preco_centavos != null && <strong>{catalogMoney(product.promocional_centavos ?? product.preco_centavos)}</strong>}
        <button type="button" onClick={() => abrir(product.slug)}>Ver detalhes </button>
      </div>
    </article>;
  };

  return <div className="rivoxel-preview" id="inicio">
    <div className="rv-notice">AMBIENTE DE HOMOLOGAÇÃO <span>·</span> Catálogo e conteúdo de teste</div>
    <header className="rv-header"><a className="rv-brand" href="#inicio" aria-label="Rivoxel, início"><img src={logo} alt="Rivoxel" /></a>
      <button className="rv-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="rv-nav" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? 'Fechar' : 'Menu'} <span aria-hidden="true">☰</span></button>
      <nav id="rv-nav" className={menuOpen ? 'rv-nav is-open' : 'rv-nav'} aria-label="Navegação principal">
        <a href="#inicio" onClick={() => setMenuOpen(false)}>Início</a><a href="#catalogo" onClick={() => setMenuOpen(false)}>Catálogo</a><a href="#personalizados" onClick={() => setMenuOpen(false)}>Personalizados</a><a href="#sobre" onClick={() => setMenuOpen(false)}>Sobre</a><a href="#contato" onClick={() => setMenuOpen(false)}>Contato</a>
      </nav>
      <a className="rv-header-cta" href="#catalogo">Explorar catálogo </a>
    </header>
    <main>
      <section className="rv-hero" aria-labelledby="rv-title"><div className="rv-hero-copy"><p className="rv-kicker"><span /> IMPRESSÃO 3D · UNIVERSO GEEK</p><h1 id="rv-title">SEU UNIVERSO<br /><em>EM 3D.</em></h1><p className="rv-hero-description">Bonecos, articulados, colecionáveis e peças criativas que transformam imaginação em realidade.</p><div className="rv-hero-actions"><a className="rv-button rv-button-primary" href="#catalogo">Explorar catálogo </a><a className="rv-button rv-button-ghost" href={whatsapp('Olá! Quero solicitar uma peça personalizada da Rivoxel.')} target="_blank" rel="noopener noreferrer">Solicitar personalizado</a></div><div className="rv-hero-foot"><span>CRIATIVIDADE EM CADA CAMADA</span><span>RIVOXEL STUDIO / 3D</span></div></div>
        <div className="rv-hero-art"><div className="rv-orbit rv-orbit-one"/><div className="rv-orbit rv-orbit-two"/><div className="rv-hero-photo rv-hero-photo-main"><img src={pato} alt="Boneco colecionável impresso em 3D com machado" /></div><div className="rv-hero-photo rv-hero-photo-small"><img src={naruto} alt="Miniatura de personagem em impressão 3D" /></div><span className="rv-art-caption"><b>FEITO EM 3D</b><br />O impossível ganha forma.</span><span className="rv-art-cross" aria-hidden="true">✳</span></div>
      </section>
      <div className="rv-strip" aria-hidden="true"><span>COLECIONÁVEIS</span><i /> <span>CRIATIVIDADE</span><i /> <span>IMPRESSÃO 3D</span><i /> <span>PEÇAS PERSONALIZADAS</span><i /> <span>UNIVERSO GEEK</span></div>
      {cardsCategorias.length > 0 && <section className="rv-section" id="categorias"><div className="rv-section-heading"><div><p className="rv-kicker"><span /> ENCONTRE SUA PRÓXIMA PEÇA</p><h2>EXPLORE SEU <em>UNIVERSO.</em></h2></div><a href="#catalogo">Ver catálogo </a></div><div className="rv-category-grid">{cardsCategorias.map(c => <button className="rv-category" key={c.id} type="button" onClick={() => escolherCategoria(c.id)}><img src={c.image} alt="" loading="lazy" /><span>{c.nome}</span></button>)}</div></section>}
      {destaques.length > 0 && <section className="rv-section"><div className="rv-section-heading"><div><p className="rv-kicker"><span /> ESCOLHAS EM DESTAQUE</p><h2>DESTAQUES <em>RIVOXEL.</em></h2></div><a href="#catalogo">Ver todos </a></div><div className="rv-product-grid">{destaques.map(productCard)}</div></section>}
      {novidades.length > 0 && <section className="rv-section rv-new"><div className="rv-section-heading"><div><p className="rv-kicker"><span /> CHEGARAM POR AQUI</p><h2>ACABARAM DE <em>CHEGAR.</em></h2></div></div><div className="rv-product-grid">{novidades.map(productCard)}</div></section>}
      <section id="catalogo" className="rv-section rv-catalog" aria-labelledby="rv-catalog-title"><div className="rv-section-heading"><div><p className="rv-kicker"><span /> EXPLORE TODAS AS PEÇAS</p><h2 id="rv-catalog-title">CATÁLOGO <em>RIVOXEL.</em></h2></div><p className="rv-section-note">Encontre sua próxima criação.</p></div>
        <div className="rv-catalog-layout"><aside className="rv-filters" aria-label="Filtros do catálogo"><h3>Filtros <span>✳</span></h3><label>Buscar produto<input type="search" placeholder="O que você procura?" maxLength={150} value={busca} onChange={e => { setBusca(e.target.value); setOffset(0); }} /></label><label>Categoria<select value={categoria} onChange={e => { setCategoria(e.target.value); setOffset(0); }}><option value="">Todas as categorias</option>{categorias.map(c => <option value={c.id} key={c.id}>{c.pai_id ? '↳ ' : ''}{c.nome}</option>)}</select></label><label>Ordenar por<select value={ordem} onChange={e => { setOrdem(e.target.value); setOffset(0); }}><option value="novos">Mais recentes</option><option value="destaque">Destaques</option><option value="preco_asc">Menor preço</option><option value="preco_desc">Maior preço</option></select></label></aside>
          <div className="rv-results">{error && <p role="alert">{error}</p>}<div className="rv-results-bar"><span role="status">{loading ? 'Carregando peças…' : `${resultado.total} ${resultado.total === 1 ? 'peça encontrada' : 'peças encontradas'}`}</span><span>RIVOXEL / CATÁLOGO</span></div>{!loading && !resultado.produtos.length && <div className="rv-empty"><strong>Nenhuma peça encontrada.</strong><p>Experimente outra busca ou categoria.</p></div>}<div className="rv-product-grid">{resultado.produtos.map(productCard)}</div>{resultado.produtos.length < resultado.total && <button className="rv-button rv-button-ghost rv-more" type="button" disabled={loading} onClick={() => setOffset(resultado.produtos.length)}>Carregar mais peças</button>}</div></div>
      </section>
      {slug && <section id="detalhes" className="rv-section rv-detail" aria-label="Detalhes do produto"><button className="rv-back" type="button" onClick={() => abrir('')}>Voltar ao catálogo</button>{detalheLoading ? <p role="status">Carregando produto…</p> : detalheError ? <p role="alert">{detalheError}</p> : detalhe ? <><div className="rv-detail-layout"><div><div className="rv-detail-image">{detalhe.imagens[imagemSelecionada] ? <img src={catalogImageUrl(detalhe.imagens[imagemSelecionada].caminho)} alt={detalhe.imagens[imagemSelecionada].alt || detalhe.nome} /> : detalhe.imagem_externa ? <img src={detalhe.imagem_externa} alt={detalhe.nome} /> : <span>Imagem indisponível</span>}</div>{detalhe.imagens.length > 1 && <div className="rv-thumbnails" aria-label="Imagens do produto">{detalhe.imagens.map((image, index) => <button key={image.id} type="button" aria-label={`Exibir imagem ${index + 1}`} aria-pressed={index === imagemSelecionada} onClick={() => setImagemSelecionada(index)}><img src={catalogImageUrl(image.miniatura)} alt="" /></button>)}</div>}</div><div><p className="rv-kicker"><span /> {detalhe.categoria || 'RIVOXEL / 3D'}</p><h2>{detalhe.nome}</h2>{detalhe.preco_centavos != null && <strong className="rv-detail-price">{catalogMoney(detalhe.promocional_centavos ?? detalhe.preco_centavos)}</strong>}<p>{detalhe.descricao}</p><dl>{detalhe.material && <><dt>Material</dt><dd>{detalhe.material}</dd></>}{detalhe.dimensoes && <><dt>Dimensões</dt><dd>{detalhe.dimensoes}</dd></>}{detalhe.cores && <><dt>Cores</dt><dd>{detalhe.cores}</dd></>}{detalhe.prazo && <><dt>Prazo</dt><dd>{detalhe.prazo}</dd></>}</dl>{detalhe.marketplace && marketplaceUrl(detalhe.link_marketplace) ? <a className="rv-button rv-button-primary" href={marketplaceUrl(detalhe.link_marketplace) || undefined} target="_blank" rel="noopener noreferrer">Ver opção de compra</a> : <a className="rv-button rv-button-primary" href={whatsapp(`Olá! Vi ${detalhe.nome} no catálogo da Rivoxel e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp</a>}</div></div>{vitrine.produtos.some(p => p.id !== detalhe.id) && <div className="rv-related"><h3>Mais da Rivoxel</h3><div className="rv-product-grid">{vitrine.produtos.filter(p => p.id !== detalhe.id).slice(0,4).map(productCard)}</div></div>}</> : <p>Produto não encontrado ou indisponível.</p>}</section>}
      <section id="personalizados" className="rv-custom"><div className="rv-custom-graphic" aria-hidden="true"><span>R</span><span>V</span></div><div className="rv-custom-copy"><p className="rv-kicker"><span /> PROJETOS PERSONALIZADOS</p><h2>SUA IDEIA.<br /><em>NOSSA IMPRESSÃO.</em></h2><p>Tem uma ideia diferente? Transformamos criatividade em peças 3D personalizadas, desenvolvidas para surpreender.</p><a className="rv-button rv-button-primary" href={whatsapp('Olá! Quero solicitar um orçamento de uma peça personalizada da Rivoxel.')} target="_blank" rel="noopener noreferrer">Solicitar orçamento </a></div></section>
      <section className="rv-section rv-process"><div className="rv-section-heading"><div><p className="rv-kicker"><span /> DA IDEIA À SUA COLEÇÃO</p><h2>COMO <em>FUNCIONA.</em></h2></div><p className="rv-section-note">Sua próxima peça começa aqui.</p></div><div className="rv-steps">{[['01','ESCOLHA','Encontre o modelo que combina com você.'],['02','PERSONALIZE','Consulte opções e personalizações.'],['03','PRODUÇÃO','Sua peça ganha forma em impressão 3D.'],['04','RECEBA','Sua criação pronta para fazer parte do seu universo.']].map(([num,title,text])=><article key={num}><span>{num}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section id="sobre" className="rv-about"><div><p className="rv-kicker"><span /> SOBRE A RIVOXEL</p><h2>CRIATIVIDADE<br /><em>SEM LIMITES.</em></h2></div><div><p>A Rivoxel transforma ideias em peças 3D criativas, colecionáveis e personalizadas. Tecnologia e atenção aos detalhes para dar forma ao que move a sua imaginação.</p><a href={instagram} target="_blank" rel="noopener noreferrer">Conheça nosso Instagram </a></div></section>
    </main>
    <footer id="contato" className="rv-footer"><div className="rv-footer-main"><div><img src={logo} alt="Rivoxel" /><p>Seu universo em 3D.<br />Criatividade que ganha forma.</p></div><div><h2>EXPLORE</h2><a href="#inicio">Início</a><a href="#catalogo">Catálogo</a><a href="#personalizados">Personalizados</a><a href="#sobre">Sobre</a></div><div><h2>FALE COM A GENTE</h2><a href={instagram} target="_blank" rel="noopener noreferrer">Instagram</a><a href={whatsapp('Olá! Gostaria de saber mais sobre a Rivoxel.')} target="_blank" rel="noopener noreferrer">WhatsApp</a></div><div className="rv-footer-cta"><p>TEM UMA IDEIA?</p><a href={whatsapp('Olá! Quero solicitar um orçamento de uma peça personalizada da Rivoxel.')} target="_blank" rel="noopener noreferrer">Vamos criar juntos </a></div></div><div className="rv-footer-bottom"><span>© {new Date().getFullYear()} RIVOXEL</span><span>SEU UNIVERSO EM 3D.</span><span>HOMOLOGAÇÃO</span></div></footer>
  </div>;
}
