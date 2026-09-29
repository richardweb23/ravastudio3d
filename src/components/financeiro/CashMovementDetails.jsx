import { useEffect, useRef } from 'react';
import { formatBRLCents as money } from '../../lib/financeiro.js';
import './cash-details.css';

const date = value => value ? value.split('-').reverse().join('/') : '—';
const origins = { pedido: 'pedidos', venda: 'vendas', repasse: 'cadastros', despesa: 'financeiroContas', reembolso: 'financeiroReembolsos' };
export default function CashMovementDetails({ detail, label, onClose, onNavigate }) {
 const dialog = useRef(null);
 useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
 const originPage = origins[detail.tipo];
 return <dialog ref={dialog} className="panel modal-card cash-details" aria-labelledby="cash-details-title" onCancel={e => { e.preventDefault(); onClose(); }}>
  <header className="cash-details-heading"><div><span className="cash-details-eyebrow">Detalhes do movimento</span><h2 id="cash-details-title">{label}</h2></div><button type="button" className="cash-details-close" aria-label="Fechar detalhes" onClick={onClose}>×</button></header>
  <div className="cash-details-summary"><div><span>{detail.caixa}</span><strong>{money(detail.valor_centavos)}</strong></div><div className="cash-details-date"><span>Data do movimento</span><strong>{date(detail.data)}</strong>{detail.estornado && <span>Estornado</span>}{detail.estorno_de && <span>Estorno</span>}</div></div>
  <section className="cash-details-section"><h3>Descrição</h3><p>{detail.descricao}</p></section>
  {detail.origem && <section className="cash-details-section"><h3>{detail.origem.titulo || 'Origem do movimento'}</h3><dl className="cash-details-grid">
   <div><dt>Data de origem</dt><dd>{date(detail.origem.data)}</dd></div><div><dt>Valor de origem</dt><dd>{money(detail.origem.valor_centavos)}</dd></div>
   {detail.origem.parcela && <div><dt>Parcela</dt><dd>{detail.origem.parcela}</dd></div>}{detail.origem.metodo && <div><dt>Forma de pagamento</dt><dd>{detail.origem.metodo}</dd></div>}
   {detail.origem.quantidade != null && <div><dt>Quantidade</dt><dd>{detail.origem.quantidade} unidade(s){detail.origem.devolvida ? ' · Mercadoria devolvida' : ''}</dd></div>}
  </dl></section>}
  {detail.reembolso && <section className="cash-details-section"><h3>Reembolso · {detail.reembolso.socio}</h3><ul className="cash-details-items">{detail.reembolso.itens.map(i => <li key={i.pagamento_id}><span>{i.despesa}<small>Parcela {i.parcela}</small></span><strong>{money(i.valor_centavos)}</strong></li>)}</ul></section>}
  <dl className="cash-details-meta"><div><dt>Identificador da origem</dt><dd>{detail.origem_id || 'Abertura'}</dd></div><div><dt>Registrado em</dt><dd>{new Date(detail.created_at).toLocaleString('pt-BR')}</dd></div></dl>
  <footer className="actions cash-details-footer"><button type="button" onClick={onClose}>Fechar</button>{onNavigate && originPage && <button type="button" className="primary" onClick={() => { onClose(); onNavigate(originPage); }}>Abrir módulo de origem</button>}</footer>
 </dialog>;
}
