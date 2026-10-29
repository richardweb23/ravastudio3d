import { useEffect, useRef, useState } from "react";
import logo from "../logo.svg";

const PIX = "21984470594";
const QR = "/qr-pix-svg.svg";
const WHATSAPP = "https://wa.me/5521984470594?text=Ol%C3%A1%21%20Conheci%20a%20RAVA%20Studio%203D%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.";

function Icon({ name }) {
  const paths = {
    star: <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3.2 9.6l6.3-.9L12 3Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    catalog: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    copy: <><rect x="9" y="3" width="12" height="13" rx="3" /><path d="M15 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h4" /></>,
    qr: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><path d="M15 15h3v3h3v3h-6v-3M21 12v3M12 3v3M3 12h3m6 0v3m0 6v-3" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    arrow: <path d="M6 18 18 6M6 6h12v12" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    whatsapp: <path fill="currentColor" stroke="none" d="M20.52 3.48A11.87 11.87 0 0 0 12.04 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.9 11.9 0 0 0 5.79 1.48h.01c6.57 0 11.92-5.35 11.93-11.93 0-3.18-1.24-6.17-3.46-8.43ZM12.05 21.83a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.9 9.9 0 0 1-1.52-5.29c0-5.47 4.45-9.92 9.92-9.92a9.85 9.85 0 0 1 7.01 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.94 9.92Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.69.25-1.29.17-1.42-.07-.12-.27-.2-.57-.34Z" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function LinksPage() {
  const dialog = useRef(null);
  const manual = useRef(null);
  const timer = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const pixCopied = Boolean(feedback) && !manualCopy;
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (manualCopy) { manual.current?.focus(); manual.current?.select(); } }, [manualCopy]);

  async function copyPix() {
    let copied = false;
    try { await navigator.clipboard.writeText(PIX); copied = true; } catch {
      const field = document.createElement("textarea");
      field.value = PIX;
      field.setAttribute("aria-label", "Chave Pix");
      field.style.cssText = "position:fixed;left:0;top:0;opacity:0;";
      const previous = document.activeElement;
      (dialog.current?.open ? dialog.current : document.body).appendChild(field);
      field.select();
      try { copied = document.execCommand("copy"); } catch { /* Manual option below. */ }
      field.remove();
      previous?.focus();
    }
    clearTimeout(timer.current);
    setManualCopy(!copied);
    setFeedback(copied ? "Chave Pix copiada com sucesso!" : "Não foi possível copiar automaticamente. Selecione e copie a chave abaixo.");
    if (copied) timer.current = setTimeout(() => setFeedback(""), 5000);
  }
  const manualField = <label className="links-manual">Chave Pix<input ref={manual} value={PIX} readOnly onFocus={event => event.target.select()} /></label>;
  return <main className="links-shell">
    <header className="links-header">
      <div className="links-logo"><img src={logo} alt="Logo oficial RAVA Studio 3D" width="112" height="85" /></div>
      <p className="links-eyebrow">DESIGN · IMPRESSÃO · POSSIBILIDADES</p>
      <h1>RAVA Studio 3D</h1>
      <p className="links-tagline">Transformamos ideias em realidade.</p>
    </header>
    <nav className="links-actions" aria-label="Links úteis da RAVA">
      <a className="links-card" href="/catalogo/"><span className="links-icon"><Icon name="catalog" /></span><span><strong>Conheça nosso catálogo</strong><small>Explore nossos produtos em impressão 3D</small></span><span className="links-card-end"><Icon name="arrow" /></span></a>
      <a className="links-card" href="https://g.page/r/CaRNI72q_6jFEBI/review" target="_blank" rel="noopener noreferrer"><span className="links-icon"><Icon name="star" /></span><span><strong>Avalie a RAVA no Google</strong><small>Conte como foi sua experiência com a gente</small></span><span className="links-card-end"><Icon name="arrow" /></span><span className="links-sr-only"> (abre em nova aba)</span></a>
      <button className={`links-card${pixCopied ? " links-card-copied" : ""}`} onClick={copyPix}><span className="links-icon"><Icon name={pixCopied ? "check" : "copy"} /></span><span><strong>{pixCopied ? "Chave Pix copiada!" : "Copiar chave Pix"}</strong><small>{PIX}</small></span><span className="links-card-end" aria-hidden="true">{pixCopied ? "Copiado!" : "Copiar"}</span></button>
      <button className="links-card" aria-haspopup="dialog" onClick={() => { setFeedback(""); setManualCopy(false); setModalOpen(true); dialog.current.showModal(); }}><span className="links-icon"><Icon name="qr" /></span><span><strong>QR Code Pix</strong><small>Abra, escaneie ou baixe</small></span><span className="links-card-end"><Icon name="qr" /></span></button>
      <a className="links-card" href={WHATSAPP} target="_blank" rel="noopener noreferrer"><span className="links-icon"><Icon name="whatsapp" /></span><span><strong>Fale conosco no WhatsApp</strong><small>+55 21 98447-0594</small></span><span className="links-card-end"><Icon name="arrow" /></span><span className="links-sr-only"> (abre em nova aba)</span></a>
      <a className="links-card" href="https://ravastudio3d.com.br" target="_blank" rel="noopener noreferrer"><span className="links-icon"><Icon name="globe" /></span><span><strong>Conheça nosso site</strong><small>Ideias que ganham forma</small></span><span className="links-card-end"><Icon name="arrow" /></span><span className="links-sr-only"> (abre em nova aba)</span></a>
    </nav>
    <div className={`links-feedback${!modalOpen && pixCopied ? " links-feedback-success" : ""}`} role="status" aria-live="polite">{!modalOpen && feedback}</div>
    {manualCopy && !modalOpen && manualField}
    <footer className="links-footer"><span className="links-footer-line" /><p>RAVA Studio 3D © 2026</p><p>Feito com criatividade, camada por camada.</p></footer>
    <dialog ref={dialog} className="links-dialog" aria-labelledby="pix-title" aria-describedby="pix-description" onClose={() => { setModalOpen(false); setManualCopy(false); setFeedback(""); }} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close(); } }}>
      <button className="links-close" autoFocus onClick={() => dialog.current.close()} aria-label="Fechar QR Code">×</button>
      <p className="links-eyebrow">PAGAMENTO VIA PIX</p><h2 id="pix-title">QR Code Pix</h2><p id="pix-description">Escaneie com o aplicativo do seu banco.</p>
      {qrFailed ? <p className="links-qr-error" role="alert">Não foi possível carregar o QR Code. Use a chave Pix abaixo.</p> : <div className="links-qr"><img src={QR} alt="QR Code Pix da RAVA Studio 3D" width="300" height="300" onLoad={() => setQrLoaded(true)} onError={() => setQrFailed(true)} /></div>}
      <p className="links-pix-key">{PIX}</p>
      <button className="links-modal-button" onClick={copyPix}><Icon name={pixCopied ? "check" : "copy"} />{pixCopied ? "Chave Pix copiada!" : "Copiar chave Pix"}</button>
      {qrLoaded && !qrFailed && <a className="links-modal-button links-download" href={QR} download="qr-pix-svg.svg"><Icon name="download" />Baixar QR Code</a>}
      <div className={`links-feedback${pixCopied ? " links-feedback-success" : ""}`} role="status" aria-live="polite">{feedback}</div>
      {manualCopy && modalOpen && manualField}
    </dialog>
  </main>;
}
