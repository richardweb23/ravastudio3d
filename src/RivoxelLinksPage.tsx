import logo from './rivoxel/assets/logo-branca.png';
import { rivoxelUrls } from './lib/rivoxel-urls.js';

const urls = rivoxelUrls(window.location.hostname);

const links = [
  { title: 'Conheça nosso catálogo', description: 'Explore nossos produtos em impressão 3D', href: urls.catalog },
  { title: 'Fale conosco no WhatsApp', description: '+55 21 98447-0594', href: 'https://wa.me/5521984470594' },
  { title: 'Acompanhe no Instagram', description: '@rivoxel.3d', href: 'https://www.instagram.com/rivoxel.3d/' },
  { title: 'Conheça nosso site', description: 'Ideias que ganham forma', href: urls.home },
];

export default function RivoxelLinksPage() {
  return <main className="links-shell">
    <header className="links-header">
      <div className="links-logo"><img src={logo} alt="Rivoxel" /></div>
      <p className="links-eyebrow">DESIGN · IMPRESSÃO · POSSIBILIDADES</p>
      <h1>Rivoxel</h1>
      <p className="links-tagline">Transformamos ideias em realidade.</p>
    </header>
    <nav className="links-actions" aria-label="Links úteis da Rivoxel">
      {links.map(link => <a className="links-card" href={link.href} key={link.title}>
        <span className="links-icon" aria-hidden="true">◇</span>
        <span><strong>{link.title}</strong><small>{link.description}</small></span>
        <span className="links-card-end" aria-hidden="true">↗</span>
      </a>)}
    </nav>
    <footer className="links-footer"><span className="links-footer-line" /><p>Rivoxel © {new Date().getFullYear()}</p><p>Feito com criatividade, camada por camada.</p></footer>
  </main>;
}
