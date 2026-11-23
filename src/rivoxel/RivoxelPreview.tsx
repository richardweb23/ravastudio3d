import { ProductCard } from './ProductCard';
import { useEffect, useMemo, useState } from 'react';
import type { CatalogResult } from '../catalogTypes';
import { publicCatalogForBrand } from '../services/catalogo.js';
import Catalog from './Catalog';
import { catalog, empty, home, instagram, links, photo, productUrl, whatsapp } from './shared';
import logo from './assets/logo-branca.png';
import pato from './assets/pato-kratos.webp';
import naruto from './assets/naruto-kyuubi.webp';

const contact = whatsapp('Olá! Quero um orçamento para uma peça personalizada da Rivoxel.');
const nav = [[home, 'Início'], [catalog, 'Catálogo'], [links, 'Links']];
const pieces = [
  { image: pato, name: 'Pato Kratos', alt: 'Boneco de pato com machado e armadura' },
  { image: naruto, name: 'Naruto e Kyuubi', alt: 'Miniatura de Naruto com a raposa Kyuubi' },
];

function Showcase() {
  const [selected, select] = useState(0);
  const piece = pieces[selected];
  return <section className="showcase">
    <div className="intro">
      <p className="eyebrow">Colecionáveis em impressão 3D</p>
      <h1>Seu universo<br /><em>em 3D.</em></h1>
      <p className="lead">Bonecos, articulados e peças personalizadas para quem leva o universo geek para a estante.</p>
      <a className="rv-button rv-button-primary" href={catalog}>Explorar catálogo</a>
    </div>
    <figure className="piece-view">
      <img src={piece.image} alt={piece.alt} width="1080" height="1350" />
      <figcaption>
        <strong aria-live="polite">{piece.name}</strong>
        <div className="selectors" aria-label="Escolher peça">
          {pieces.map((item, i) => <button key={item.name} type="button" aria-pressed={selected === i}
            aria-label={'Ver ' + item.name} onClick={() => select(i)}><img src={item.image} alt="" /></button>)}
        </div>
      </figcaption>
    </figure>
  </section>;
}

function Home() {
  const [vitrine, setVitrine] = useState<CatalogResult>(empty);
  const [vitrineDestaques, setDestaques] = useState<CatalogResult>(empty);
  useEffect(() => {
    let active = true;
    publicCatalogForBrand('rivoxel', { p_ordem: 'novos' }).then(data => { if (active) setVitrine(data); }).catch(() => {});
    publicCatalogForBrand('rivoxel', { p_ordem: 'destaque' }).then(data => { if (active) setDestaques(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const cardsCategorias = useMemo(() => vitrine.categorias.filter(c => !c.pai_id).map(c => {
    const filhos = new Set(vitrine.categorias.filter(f => f.pai_id === c.id).map(f => f.id));
    const product = vitrine.produtos.find(p => p.categoria_id && (p.categoria_id === c.id || filhos.has(p.categoria_id)) && photo(p));
    return { ...c, image: product ? photo(product, 'principal') : '' };
  }).filter(c => c.image).slice(0, 6), [vitrine]);
  const destaques = vitrineDestaques.produtos.filter(p => p.destaque).slice(0, 4);
  const novidades = vitrine.produtos.length >= 3 ? vitrine.produtos.slice(0, 4) : [];

  return <>
    <Showcase />
    {cardsCategorias.length > 0 && <section className="rv-section"><h2>Categorias</h2><div className="rv-category-grid">
      {cardsCategorias.map(c => <a className="rv-category" key={c.id} href={catalog + '?categoria=' + encodeURIComponent(c.id)}>
        <img src={c.image} alt="" loading="lazy" /><span>{c.nome}</span></a>)}</div></section>}
    {[{ title: 'Destaques', products: destaques }, { title: 'Novidades', products: novidades }].map(({ title, products }) =>
      products.length > 0 && <section key={title} className="rv-section"><div className="rv-section-heading">
        <h2>{title}</h2><a href={catalog}>Ver catálogo</a></div><div className="rv-product-grid">
        {products.map(p => <ProductCard key={p.id} product={p} />)}</div></section>)}
    <section className="studio" id="personalizados">
      <div><p className="eyebrow">Peças personalizadas</p><h2>Da ideia<br />à estante.</h2></div>
      <div><p>Tem um personagem ou projeto em mente? Envie sua referência para o estúdio.</p>
        <ol><li>Escolha o modelo</li><li>Combine os detalhes</li><li>Acompanhe a produção</li><li>Receba sua peça</li></ol>
        <a className="rv-button" href={contact}>Pedir orçamento</a></div>
    </section>
    <section className="about" id="sobre"><h2>Sobre a Rivoxel</h2><p>Somos um estúdio de impressão 3D que cria colecionáveis e peças personalizadas inspiradas na cultura geek. Conheça as peças no <a href={instagram}>Instagram da Rivoxel</a>.</p></section>
  </>;
}

function Links() {
  const channels = [
    [catalog, 'Catálogo', 'Explore as peças da Rivoxel'],
    [contact, 'WhatsApp', 'Orçamentos e personalizados'],
    [instagram, 'Instagram', '@rivoxel.3d'],
    [home, 'Site da Rivoxel', 'Visite a página inicial'],
  ];
  return <section className="link-page"><img src={logo} alt="Rivoxel" /><h1>Links da Rivoxel</h1>
    <div>{channels.map(([url, title, hint]) => <a key={url} href={url}>
      <strong>{title}</strong><span>{hint}</span></a>)}</div></section>;
}

export default function RivoxelPreview() {
  const path = window.location.pathname.replace(/\/?$/, '/');
  useEffect(() => {
    if (path !== home) return;
    const oldProduct = new URLSearchParams(window.location.search).get('produto');
    if (oldProduct) window.location.replace(productUrl(oldProduct));
    else if (window.location.hash === '#catalogo') window.location.replace(catalog);
  }, [path]);
  return <div className="rivoxel-preview">
    <header className="mast"><a href={home}><img src={logo} alt="Rivoxel, início" /></a>
      <nav aria-label="Navegação principal">{nav.map(([url, title]) => <a key={url} href={url}
        aria-current={path === url ? 'page' : undefined}>{title}</a>)}</nav>
      <small>Homologação</small>
    </header>
    <main>{path === links ? <Links /> : path === catalog ? <Catalog /> : <Home />}</main>
    <footer className="colophon"><span>© {new Date().getFullYear()} Rivoxel</span>
      <nav aria-label="Rodapé"><a href={catalog}>Catálogo</a><a href={links}>Links</a><a href={contact}>Contato</a></nav></footer>
  </div>;
}
