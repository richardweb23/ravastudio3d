import { useEffect, useState } from 'react';
import logo from '../logo.svg';
import catalogQr from './assets/catalog-qr.svg';
import jewelry from './assets/produtos/joias-limpo.jpg';
import lamp from './assets/produtos/luminaria-limpo.jpg';
import home from './assets/produtos/home-limpo.jpg';
import dinner from './assets/produtos/jantar-harmony.jpg';
import natal from './assets/produtos/natal-limpo.jpg';

const whatsapp = 'https://wa.me/5521984470594';
const pieces = [
  { image: lamp, title: 'Decoração', note: 'Peças que valorizam e transformam ambientes.', alt: 'Luminária escultural com cúpula ondulada' },
  { image: jewelry, title: 'Organizadores', note: 'Soluções para deixar seu dia a dia mais bonito.', alt: 'Organizador de joias em tons terrosos' },
  { image: dinner, title: 'Conjunto Jantar Costela de Adão Harmony', note: 'Um toque de natureza para a sua mesa.', alt: 'Mesa posta com o Conjunto Jantar Costela de Adão Harmony' },
  { image: natal, title: 'Peças temáticas', note: 'Detalhes especiais para celebrar cada ocasião.', alt: 'Conjunto decorativo de Natal' },
];

function Arrow() { return <span aria-hidden="true">↗</span>; }

function Header() {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <a className="brand" href="#inicio" aria-label="RAVA Studio 3D — início" onClick={() => setOpen(false)}><img src={logo} alt="RAVA Studio 3D" /></a>
    <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>{open ? 'Fechar' : 'Menu'} <span aria-hidden="true">{open ? '×' : '☰'}</span></button>
    <nav id="site-nav" className={`nav${open ? ' is-open' : ''}`} aria-label="Navegação principal">
      <a href="#inicio" onClick={() => setOpen(false)}>Início</a><a href="/catalogo/" onClick={() => setOpen(false)}>Catálogo</a><a href="/links/" onClick={() => setOpen(false)}>Links</a><a href="#colecoes" onClick={() => setOpen(false)}>Produtos</a><a href="#sobre" onClick={() => setOpen(false)}>Sobre</a><a href="#contato" onClick={() => setOpen(false)}>Contato</a>
      <a className="nav-management-link" href="/gestao/#/" aria-label="Acessar área de gestão" title="Área de gestão"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" /></svg></a>
    </nav>
  </header>;
}

export default function App() {
  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.querySelector('.site-shell');
    const elements = root.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    root.classList.add('motion-ready');
    elements.forEach(element => observer.observe(element));
    return () => { observer.disconnect(); root.classList.remove('motion-ready'); };
  }, []);
  return <div className="site-shell" id="inicio">
    <div className="landing-intro">
    <Header />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><h1 id="hero-title">Transformamos<br />ideias em peças<br />únicas com<br /><em>impressão 3D</em></h1><p className="hero-lead">Peças decorativas, organizadores e presentes criativos feitos em impressão 3D.</p><div className="hero-actions"><a className="button button-dark" href="/catalogo/"><span className="button-layers" aria-hidden="true">◇</span> Ver catálogo <Arrow /></a><a className="text-link" href="#colecoes">Conheça nossos produtos</a></div></div>
        <div className="hero-scene" role="img" aria-label="Composição de produtos decorativos, organizadores e peças natalinas da RAVA" />
      </section>
    </div>
    <main>
      <section className="collection-section section-pad" id="colecoes" aria-label="Produtos RAVA">
        <div className="piece-grid">{pieces.map((piece, index) => <article className="piece" data-reveal key={piece.title}><a className="piece-image" href="/catalogo/" aria-label={`${piece.title}: conhecer o catálogo`}><img src={piece.image} alt={piece.alt} loading="lazy" /><span className="piece-index">0{index + 1}</span><span className="piece-arrow" aria-hidden="true">↗</span></a><div className="piece-heading"><h3>{piece.title}</h3><p>{piece.note}</p></div></article>)}</div>
      </section>

      <section className="about-rava" id="sobre" data-reveal aria-labelledby="about-title">
        <div className="about-rava-image"><img src={home} alt="Conjunto decorativo Home em tons de bege" loading="lazy" /><span>CRIATIVIDADE EM CADA CAMADA</span></div>
        <div className="about-rava-copy"><p className="about-rava-eyebrow">PRAZER, SOMOS A RAVA</p><h2 id="about-title">Ideias que ganham<br /><em>lugar na sua vida.</em></h2><p>Somos um estúdio criativo de impressão 3D. Transformamos ideias em peças decorativas, organizadores e presentes para trazer personalidade aos pequenos momentos do dia a dia.</p><div className="about-rava-values"><span>✧ Criatividade</span><span>◇ Impressão 3D</span><span>♡ Para presentear</span></div><a href="/catalogo/" className="under-link">Conheça nossas peças <Arrow /></a></div>
      </section>

      <section className="reviews-invitation" data-reveal aria-labelledby="reviews-title"><div className="reviews-invitation-icon" aria-hidden="true">✳</div><div className="reviews-invitation-copy"><p>FEITO COM CARINHO, COMPARTILHADO POR VOCÊ</p><h2 id="reviews-title">Sua experiência faz parte da nossa história.</h2><span>Conheça as avaliações da RAVA no Google e conte como foi a sua experiência.</span></div><a href="https://share.google/mbWULh1XzVSmqHxgr" target="_blank" rel="noopener noreferrer">Ver avaliações no Google <Arrow /></a></section>

      <section className="catalog-invitation" data-reveal><a className="catalog-qr" href="/catalogo/" aria-label="Acessar o catálogo da RAVA"><img src={catalogQr} alt="QR Code para o catálogo da RAVA" /></a><div className="catalog-invitation-copy"><h2>Acesse nosso catálogo completo</h2><a href="/catalogo/">ravastudio3d.com.br/catalogo <Arrow /></a></div></section>
    </main>
    <footer className="footer" id="contato"><div className="footer-top"><div className="footer-brand"><img src={logo} alt="RAVA Studio 3D" /></div><p className="footer-description">Peças em impressão 3D que<br />decoram, organizam e inspiram.</p><div className="footer-contact"><strong>Acompanhe a RAVA</strong><a href="https://www.instagram.com/ravastudio3d/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a><a href="tel:+5521984470594">(21) 98447-0594</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} RAVA Studio 3D</span><div><a href="/gestao/#/">Área de gestão</a><a href="#inicio">Voltar ao topo ↑</a></div></div></footer>
  </div>;
}
