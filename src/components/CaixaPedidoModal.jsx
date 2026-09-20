import { useEffect, useRef, useState } from 'react';
import CaixaSelect from './CaixaSelect.jsx';
export default function CaixaPedidoModal({ onDone }) {
  const dialog = useRef(null);
  const [caixa,setCaixa] = useState('');
  useEffect(() => { const node=dialog.current; node.showModal(); return () => node.close(); },[]);
  return <dialog ref={dialog} className="modal-card registration-dialog" aria-labelledby="caixa-pedido-title" onCancel={event => { event.preventDefault(); onDone(null); }}><form className="panel form" onSubmit={event => { event.preventDefault(); onDone(caixa); }}><h2 id="caixa-pedido-title">Caixa da venda</h2><p>Escolha a caixa para as vendas deste pedido.</p><CaixaSelect value={caixa} onChange={event => setCaixa(event.target.value)} /><div className="actions"><button className="primary">Confirmar entrega</button><button type="button" onClick={() => onDone(null)}>Cancelar</button></div></form></dialog>;
}
