import { useEffect, useState } from "react";
import logo from "../logo.svg";
import casaImage from "./assets/colecao-casa.webp";
import corporativaImage from "./assets/colecao-corporativa.webp";
import natalImage from "./assets/colecao-natal.webp";

const contactEmail = "contato@ravastudio3d.com.br";
const quoteHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Orçamento — RAVA Studio 3D")}`;

const collections = [
  {
    number: "01",
    label: "Casa & decoração",
    title: "Objetos que transformam espaços.",
    description:
      "Vasos orgânicos, luminárias, cachepôs geométricos e organizadores com design autoral.",
    image: casaImage,
    alt: "Vasos, luminária e organizadores produzidos em impressão 3D",
    tone: "light",
  },
  {
    number: "02",
    label: "Brindes corporativos",
    title: "Sua marca em outra dimensão.",
    description:
      "Chaveiros, placas, displays e kits personalizados para experiências de marca memoráveis.",
    image: corporativaImage,
    alt: "Brindes corporativos personalizados em preto e dourado",
    tone: "dark",
  },
  {
    number: "03",
    label: "Coleções especiais",
    title: "Pequenas séries. Grandes detalhes.",
    description:
      "Coleções sazonais e edições limitadas produzidas com cuidado em cada acabamento.",
    image: natalImage,
    alt: "Coleção natalina de peças decorativas impressas em 3D",
    tone: "green",
  },
];

const pillars = [
  ["01", "Impressão de qualidade", "Acabamento preciso e materiais selecionados."],
  ["02", "Tecnologia e precisão", "Equipamentos atuais para resultados consistentes."],
  ["03", "Design que ganha forma", "Do conceito digital ao objeto real."],
  ["04", "Ideias em 3 dimensões", "Soluções sob medida, sem formatos prontos."],
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function CubeIcon({ index = 0 }) {
  const paths = [
    <g key="layers">
      <path d="m12 3 8 4.6-8 4.6L4 7.6 12 3Z" />
      <path d="m4 12 8 4.6 8-4.6" />
      <path d="m4 16.4 8 4.6 8-4.6" />
    </g>,
    <g key="cube">
      <path d="m12 3 8 4.6v8.8L12 21l-8-4.6V7.6L12 3Z" />
      <path d="m4 7.6 8 4.6 8-4.6M12 12.2V21" />
    </g>,
    <g key="precision">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4m-10-7v14M5 12h14" />
    </g>,
    <g key="spark">
      <path d="m12 2 1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2Z" />
      <path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />
    </g>,
  ];

  return (
    <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[index]}
    </svg>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <a className="brand" href="#inicio" onClick={closeMenu} aria-label="RAVA Studio 3D — início">
        <img src={logo} alt="RAVA Studio 3D" />
      </a>

      <button
        className={menuOpen ? "menu-toggle is-open" : "menu-toggle"}
        type="button"
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
      </button>

      <nav className={menuOpen ? "nav is-open" : "nav"} aria-label="Navegação principal">
        <a href="#colecoes" onClick={closeMenu}>Coleções</a>
        <a href="#sobre" onClick={closeMenu}>O estúdio</a>
        <a href="#processo" onClick={closeMenu}>Processo</a>
        <a href="#contato" onClick={closeMenu}>Contato</a>
        <a className="nav-cta" href={quoteHref} onClick={closeMenu}>
          Solicitar orçamento <ArrowIcon />
        </a>
      </nav>
    </header>
  );
}

function CollectionCard({ item }) {
  return (
    <article className={`collection-card collection-${item.tone} reveal`}>
      <img src={item.image} alt={item.alt} loading="lazy" />
      <div className="collection-overlay" />
      <div className="collection-topline">
        <span>{item.number}</span>
        <span>{item.label}</span>
      </div>
      <div className="collection-copy">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <a href={quoteHref} aria-label={`Solicitar orçamento para ${item.label}`}>
          Quero um projeto <ArrowIcon />
        </a>
      </div>
    </article>
  );
}

export default function App() {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="site-shell">
      <Header />

      <main>
        <section className="hero" id="inicio">
          <div className="hero-grain" />
          <div className="hero-copy reveal is-visible">
            <p className="eyebrow"><span /> RAVA Studio 3D</p>
            <h1>
              Design que<br />
              <em>ganha forma.</em>
            </h1>
            <p className="hero-lead">
              Criamos objetos, experiências e produtos personalizados através da impressão 3D.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="#colecoes">
                Explorar coleções <ArrowIcon />
              </a>
              <a className="text-link" href={quoteHref}>
                Fale sobre sua ideia <ArrowIcon />
              </a>
            </div>
          </div>

          <div className="hero-visual reveal is-visible">
            <div className="hero-image-frame">
              <img src={casaImage} alt="Objetos de decoração produzidos pela RAVA Studio 3D" fetchPriority="high" />
              <div className="hero-stamp">
                <span>feito em</span>
                <strong>3D</strong>
                <span>com precisão</span>
              </div>
            </div>
            <div className="hero-caption">
              <span>Coleção Casa</span>
              <span>2026 — 01</span>
            </div>
          </div>

          <div className="hero-index" aria-hidden="true">01</div>
        </section>

        <section className="statement" aria-label="Manifesto RAVA">
          <div className="statement-mark"><CubeIcon /></div>
          <p className="reveal">
            Criamos. <em>Imprimimos.</em> Realizamos.
          </p>
          <small>Do conceito digital ao objeto real</small>
        </section>

        <section className="collections section-pad" id="colecoes">
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow"><span /> Portfólio selecionado</p>
              <h2>Feito para<br /><em>impressionar.</em></h2>
            </div>
            <p>
              Coleções autorais e projetos sob medida que combinam tecnologia, matéria e um olhar atento aos detalhes.
            </p>
          </div>

          <div className="collection-grid">
            {collections.map((item) => <CollectionCard item={item} key={item.number} />)}
          </div>
        </section>

        <section className="pillars section-pad" id="sobre">
          <div className="pillars-intro reveal">
            <p className="eyebrow eyebrow-light"><span /> Nossos pilares</p>
            <h2>Ideias merecem<br /><em>boa execução.</em></h2>
            <p>
              A RAVA une repertório de design e fabricação digital para entregar peças que fazem sentido no uso, na forma e na presença.
            </p>
          </div>
          <div className="pillar-list">
            {pillars.map(([number, title, description], index) => (
              <article className="pillar reveal" key={number}>
                <span className="pillar-number">{number}</span>
                <CubeIcon index={index} />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="process section-pad" id="processo">
          <div className="process-title reveal">
            <p className="eyebrow"><span /> Como trabalhamos</p>
            <h2>Da ideia à peça,<br /><em>sem mistério.</em></h2>
          </div>
          <ol className="process-list">
            <li className="reveal">
              <span>01</span>
              <div><h3>Você conta a ideia</h3><p>Entendemos o objetivo, as referências, quantidades e prazos.</p></div>
            </li>
            <li className="reveal">
              <span>02</span>
              <div><h3>Nós desenhamos</h3><p>Transformamos o conceito em um modelo pronto para produção.</p></div>
            </li>
            <li className="reveal">
              <span>03</span>
              <div><h3>A RAVA materializa</h3><p>Imprimimos, finalizamos e entregamos seu projeto com cuidado.</p></div>
            </li>
          </ol>
        </section>

        <section className="cta-section" id="contato">
          <div className="cta-art" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="cta-copy reveal">
            <p className="eyebrow eyebrow-light"><span /> Seu projeto começa aqui</p>
            <h2>Vamos tirar sua<br /><em>ideia do papel?</em></h2>
            <a className="button button-light" href={quoteHref}>
              Solicitar orçamento <ArrowIcon />
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img src={logo} alt="RAVA Studio 3D" />
          <p>Design que ganha forma.</p>
        </div>
        <div className="footer-links">
          <div><span>Contato</span><a href={`mailto:${contactEmail}`}>{contactEmail}</a></div>
          <div><span>Social</span><a href="https://www.instagram.com/ravastudio3d/" target="_blank" rel="noreferrer">@ravastudio3d</a></div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} RAVA Studio 3D</span>
          <a href="#inicio">Voltar ao topo ↑</a>
        </div>
      </footer>
    </div>
  );
}
