import { useEffect, useId, useRef } from "react";
export default function CatalogDialog({ title, onClose, children, busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="catalog-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === ref.current && !busy) onClose(); }}>
    <div className="catalog-dialog-content">
      <header className="catalog-dialog-header"><h2 id={titleId}>{title}</h2><button type="button" aria-label="Fechar" disabled={busy} onClick={onClose}>×</button></header>
      {children}
    </div>
  </dialog>;
}
