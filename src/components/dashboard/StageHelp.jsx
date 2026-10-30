import { useEffect, useId, useRef, useState } from 'react';
export default function StageHelp({ label, children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const id = useId();
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  return <span ref={root} className="stage-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" aria-label={`Quando usar: ${label}`} aria-expanded={open} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}>ⓘ</button>
    {open && <span id={id} role="tooltip" className="stage-help-tip">{children}</span>}
  </span>;
}
