import { useEffect, useRef, useState } from 'react';
export default function useCaixaPedido() {
  const pending = useRef(null);
  const [open,setOpen] = useState(false);
  useEffect(() => () => { pending.current?.(null); pending.current=null; },[]);
  function requestCaixa() {
    if (pending.current) return Promise.resolve(null);
    setOpen(true);
    return new Promise(resolve => { pending.current=resolve; });
  }
  function finishCaixa(value) { pending.current?.(value); pending.current=null; setOpen(false); }
  return { open,requestCaixa,finishCaixa };
}
