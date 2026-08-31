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

function CollectionCard({ item, index }) {
  return (
    <article
      className={`collection-card collection-${item.tone} reveal`}
      data-reveal="scale"
      data-parallax
      style={{ "--reveal-delay": `${index * 100}ms` }}
    >
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
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let observer = null;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.06, rootMargin: "0px 0px -3% 0px" },
      );

      elements.forEach((element) => observer.observe(element));
    }

    const root = document.documentElement;
    const header = document.querySelector(".site-header");
    const heroCopy = document.querySelector(".hero-copy");
    const heroImage = document.querySelector(".hero-image-frame");
    const statementMark = document.querySelector(".statement-mark");
    const parallaxElements = document.querySelectorAll("[data-parallax]");
    let animationFrame = null;
    let navigationAnimationFrame = null;

    const updateScrollEffects = () => {
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollableHeight = Math.max(
        root.scrollHeight - viewportHeight,
        1,
      );

      root.style.setProperty(
        "--scroll-progress",
        String(Math.min(scrollTop / scrollableHeight, 1)),
      );
      header?.classList.toggle("is-scrolled", scrollTop > 36);

      if (!prefersReducedMotion) {
        const heroProgress = Math.min(scrollTop / (viewportHeight * 0.9), 1);
        heroCopy?.style.setProperty(
          "--hero-copy-shift",
          `${scrollTop * -0.055}px`,
        );
        heroCopy?.style.setProperty(
          "--hero-content-opacity",
          String(Math.max(0.25, 1 - heroProgress * 0.9)),
        );
        heroImage?.style.setProperty(
          "--hero-image-y",
          `${Math.min(scrollTop * 0.08, 64)}px`,
        );
        statementMark?.style.setProperty(
          "--mark-rotation",
          `${scrollTop * 0.055}deg`,
        );

        parallaxElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const distance =
            (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
          const movement = Math.max(-1, Math.min(1, distance)) * -46;
          element.style.setProperty("--parallax-y", `${movement}px`);
        });
      }

      animationFrame = null;
    };

    const scheduleScrollEffects = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(updateScrollEffects);
      }
    };

    const handleAnchorNavigation = (event) => {
      const anchor = event.target.closest?.('a[href^="#"]');
      const targetSelector = anchor?.getAttribute("href");

      if (!targetSelector || targetSelector === "#") return;

      const target = document.querySelector(targetSelector);
      if (!target) return;

      event.preventDefault();

      if (navigationAnimationFrame !== null) {
        window.cancelAnimationFrame(navigationAnimationFrame);
      }

      const startPosition = window.scrollY;
      const headerOffset = header?.getBoundingClientRect().height ?? 0;
      const targetPosition = Math.max(
        target.getBoundingClientRect().top + startPosition - headerOffset + 1,
        0,
      );
      const distance = targetPosition - startPosition;

      if (prefersReducedMotion) {
        window.scrollTo(0, targetPosition);
        window.history.pushState(null, "", targetSelector);
        return;
      }

      const duration = Math.min(
        950,
        Math.max(550, Math.abs(distance) * 0.28),
      );
      let startTime = null;

      const animateNavigation = (currentTime) => {
        if (startTime === null) startTime = currentTime;

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;

        window.scrollTo(0, startPosition + distance * easedProgress);

        if (progress < 1) {
          navigationAnimationFrame =
            window.requestAnimationFrame(animateNavigation);
        } else {
          navigationAnimationFrame = null;
          window.history.pushState(null, "", targetSelector);
        }
      };

      navigationAnimationFrame =
        window.requestAnimationFrame(animateNavigation);
    };

    updateScrollEffects();
    window.addEventListener("scroll", scheduleScrollEffects, { passive: true });
    window.addEventListener("resize", scheduleScrollEffects);
    document.addEventListener("click", handleAnchorNavigation);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", scheduleScrollEffects);
      window.removeEventListener("resize", scheduleScrollEffects);
      document.removeEventListener("click", handleAnchorNavigation);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (navigationAnimationFrame !== null) {
        window.cancelAnimationFrame(navigationAnimationFrame);
      }
    };
  }, []);

  return (
    <div className="site-shell">
      <div className="scroll-progress" aria-hidden="true" />
      <Header />

      <main>
        <section className="hero" id="inicio">
          <div className="hero-grain" />
          <div className="hero-copy reveal is-visible" data-reveal="left">
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

          <div className="hero-visual reveal is-visible" data-reveal="scale">
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
          <div className="statement-mark reveal" data-reveal="scale">
            <CubeIcon />
          </div>
          <p className="reveal" data-reveal="clip">
            Criamos. <em>Imprimimos.</em> Realizamos.
          </p>
          <small
            className="reveal"
            data-reveal="scale"
            style={{ "--reveal-delay": "180ms" }}
          >
            Do conceito digital ao objeto real
          </small>
        </section>

        <section className="collections section-pad" id="colecoes">
          <div className="section-heading reveal" data-reveal="left">
            <div>
              <p className="eyebrow"><span /> Portfólio selecionado</p>
              <h2>Feito para<br /><em>impressionar.</em></h2>
            </div>
            <p>
              Coleções autorais e projetos sob medida que combinam tecnologia, matéria e um olhar atento aos detalhes.
            </p>
          </div>

          <div className="collection-grid">
            {collections.map((item, index) => (
              <CollectionCard item={item} index={index} key={item.number} />
            ))}
          </div>
        </section>

        <section className="pillars section-pad" id="sobre">
          <div className="pillars-intro reveal" data-reveal="left">
            <p className="eyebrow eyebrow-light"><span /> Nossos pilares</p>
            <h2>Ideias merecem<br /><em>boa execução.</em></h2>
            <p>
              A RAVA une repertório de design e fabricação digital para entregar peças que fazem sentido no uso, na forma e na presença.
            </p>
          </div>
          <div className="pillar-list">
            {pillars.map(([number, title, description], index) => (
              <article
                className="pillar reveal"
                data-reveal="right"
                style={{ "--reveal-delay": `${index * 90}ms` }}
                key={number}
              >
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
          <div className="process-title reveal" data-reveal="left">
            <p className="eyebrow"><span /> Como trabalhamos</p>
            <h2>Da ideia à peça,<br /><em>sem mistério.</em></h2>
          </div>
          <ol className="process-list">
            <li className="reveal" data-reveal="right">
              <span>01</span>
              <div><h3>Você conta a ideia</h3><p>Entendemos o objetivo, as referências, quantidades e prazos.</p></div>
            </li>
            <li className="reveal" data-reveal="right" style={{ "--reveal-delay": "90ms" }}>
              <span>02</span>
              <div><h3>Nós desenhamos</h3><p>Transformamos o conceito em um modelo pronto para produção.</p></div>
            </li>
            <li className="reveal" data-reveal="right" style={{ "--reveal-delay": "180ms" }}>
              <span>03</span>
              <div><h3>A RAVA materializa</h3><p>Imprimimos, finalizamos e entregamos seu projeto com cuidado.</p></div>
            </li>
          </ol>
        </section>

        <section className="cta-section" id="contato">
          <div className="cta-art" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="cta-copy reveal" data-reveal="clip">
            <p className="eyebrow eyebrow-light"><span /> Seu projeto começa aqui</p>
            <h2>Vamos tirar sua<br /><em>ideia do papel?</em></h2>
            <a className="button button-light" href={quoteHref}>
              Solicitar orçamento <ArrowIcon />
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand reveal" data-reveal="left">
          <img src={logo} alt="RAVA Studio 3D" />
          <p>Design que ganha forma.</p>
        </div>
        <div className="footer-links reveal" data-reveal="right">
          <div><span>Contato</span><a href={`mailto:${contactEmail}`}>{contactEmail}</a></div>
          <div><span>Social</span><a href="https://www.instagram.com/ravastudio3d/" target="_blank" rel="noreferrer">@ravastudio3d</a></div>
        </div>
        <div
          className="footer-bottom reveal"
          data-reveal="scale"
          style={{ "--reveal-delay": "120ms" }}
        >
          <span>© {new Date().getFullYear()} RAVA Studio 3D</span>
          <a href="#inicio">Voltar ao topo ↑</a>
        </div>
      </footer>
    </div>
  );
}
