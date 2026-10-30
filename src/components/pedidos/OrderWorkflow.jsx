import { useRef, useState } from 'react';
import { orderStages, orderSituations } from '../../lib/orderBoard.js';
export default function OrderWorkflow({ order, onStatusChange, onSituationSave }) {
  const [situation, setSituation] = useState(order.situacao || 'normal');
  const [description, setDescription] = useState(order.situacao_descricao || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const lock = useRef(false);
  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(null);
    try { await action(); } catch (err) { setMessage({ error: true, text: err.message || 'Não foi possível salvar.' }); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!onSituationSave) return <section className="order-workflow"><h3>Situação: {orderSituations[order.situacao || 'normal']}</h3>{order.situacao_descricao && <p>{order.situacao_descricao}</p>}</section>;
  return <section className="order-workflow" aria-busy={busy}>
    <fieldset disabled={busy || order.status === 'entregue'}>
      <legend>Etapa e situação atual</legend>
      {onStatusChange && <label>Etapa<select value={order.status} onChange={event => run(async () => { const ok = await onStatusChange(order, event.target.value); if (ok === false) throw new Error('Não foi possível alterar a etapa.'); })}>{orderStages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{order.status === 'entregue' && <option value="entregue">Entregue</option>}</select></label>}
      <form onSubmit={event => { event.preventDefault(); run(async () => { await onSituationSave(order, situation, description.trim()); setMessage({ text: 'Situação salva.' }); }); }}>
        <label>Situação<select value={situation} onChange={event => { setSituation(event.target.value); setMessage(null); }}>{Object.entries(orderSituations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Descrição da situação<textarea rows={2} maxLength={250} required={situation !== 'normal'} value={description} onChange={event => { setDescription(event.target.value); setMessage(null); }} placeholder="Ex.: Aguardando filamento branco para imprimir a tampa" /></label>
        <small>{description.length}/250 caracteres</small>
        <button className="primary" type="submit" disabled={situation !== 'normal' && !description.trim()}>Salvar situação</button>
      </form>
    </fieldset>
    {busy && <p role="status">Salvando…</p>}
    {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </section>;
}
