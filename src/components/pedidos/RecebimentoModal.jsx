import { useRef, useState } from 'react';
import { supabase } from '../../supabase.js';
import { CASH_BOXES } from '../../lib/vendas.js';
import { reaisToCents, centsToInput } from '../../lib/financeiro.js';
import { formatMoney, formatNumber, today } from '../../lib/formatters.js';
import { custoItensPedido, sugestaoRecebimento } from '../../lib/recebimentoPedido.js';

export default function RecebimentoModal({ order, items, materiais, balance, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [receiptBox, setReceiptBox] = useState('');
  const [materialAmount, setMaterialAmount] = useState('');
  const [otherAmount, setOtherAmount] = useState('');
  const [materialBox, setMaterialBox] = useState('Materiais Bonecos');
  const [otherBox, setOtherBox] = useState('Bonecos');
  const [edited, setEdited] = useState(false);
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState('pix');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), request = useRef(null);
  const cost = custoItensPedido(items, materiais);
  const total = Math.round(Number(order.valor_total || 0) * 100);
  function recalculate(value) {
    const suggestion = sugestaoRecebimento(reaisToCents(value), total, cost);
    setMaterialAmount(suggestion ? centsToInput(suggestion.materiais) : '');
    setOtherAmount(suggestion ? centsToInput(suggestion.restante) : '');
    setEdited(false);
  }
  async function submit(event) {
    event.preventDefault(); if (lock.current) return;
    const value = reaisToCents(amount), material = reaisToCents(materialAmount), other = reaisToCents(otherAmount);
    if (value <= 0 || value > Math.round(balance * 100)) { setError('Informe um valor válido até o saldo pendente.'); return; }
    if (!receiptBox) { setError('Selecione o caixa do recebimento.'); return; }
    if (receiptBox === 'divisao' && (material < 0 || other < 0 || material + other !== value || (material && !materialBox) || (other && !otherBox))) { setError('Informe destinos válidos e valores não negativos que somem o recebimento.'); return; }
    const rateio = receiptBox === 'divisao'
      ? [{caixa:materialBox,valor_centavos:material},{caixa:otherBox,valor_centavos:other}].filter(row => row.valor_centavos > 0)
      : [{caixa:receiptBox,valor_centavos:value}];
    const data = {pedido_id:order.id,valor_centavos:value,rateio,data:date,metodo:method,descricao:note || 'Recebimento de pedido'};
    const signature = JSON.stringify(data);
    if (request.current?.signature !== signature) request.current = {signature,id:crypto.randomUUID()};
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await supabase.rpc('financeiro_operar',{p_acao:'receber_pedido',p_requisicao:request.current.id,p_dados:data});
      if (result.error) throw result.error;
      onSaved();
    } catch (err) { setError(err.message || 'Não foi possível registrar o recebimento.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation"><form className="panel form modal-card receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title" onSubmit={submit}>
    <div className="modal-heading receipt-heading"><div><span className="receipt-eyebrow">PEDIDOS · FINANCEIRO</span><h2 id="receipt-title">Registrar recebimento</h2><p>Escolha onde registrar o valor recebido.</p></div><button type="button" className="close-modal" disabled={busy} onClick={onClose} aria-label="Fechar">×</button></div>
    <div className="receipt-body">
    <div className="receipt-summary"><div><span>Pedido de</span><strong>{order.cliente}</strong></div><div><span>Saldo pendente</span><strong>{formatMoney(balance)}</strong></div></div>
    <section className="receipt-cost"><h3>Custo de produção dos produtos</h3><ul>{items.map(item => { const product = materiais.find(row => row.id === item.material_id); return <li key={item.id}>{product?.nome || item.materiais?.nome || 'Produto'}{item.subtitulo ? ` — ${item.subtitulo}` : ''} · {formatNumber(item.quantidade)} × {product?.custo_medio == null ? 'custo indisponível' : formatMoney(product.custo_medio)}</li>; })}</ul><strong>Custo total: {cost == null ? 'indisponível' : formatMoney(cost / 100)}</strong><p>Referência baseada no custo atual dos produtos; não representa um débito automático.</p></section>
    <fieldset disabled={busy}>
      <div className="receipt-value-box"><label>Valor recebido (R$)<input type="number" min="0.01" step="0.01" required value={amount} onChange={event => { const value = event.target.value; setAmount(value); if (!edited) recalculate(value); }} /></label>
      <label>Caixa<select required value={receiptBox} onChange={event => { const box = event.target.value; setReceiptBox(box); setError(''); if (box === 'divisao' && !edited) recalculate(amount); }}><option value="">Selecione o caixa</option>{CASH_BOXES.map(box => <option key={box} value={box}>{box}</option>)}<option value="divisao">Divisão de caixa</option></select></label></div>
      {receiptBox === 'divisao' && <div className="receipt-allocation"><h3>Destino do recebimento</h3><div className="receipt-allocation-grid">
        <label>Valor para materiais (R$)<input type="number" min="0" step="0.01" value={materialAmount} onChange={event => { setMaterialAmount(event.target.value); setEdited(true); }} /></label>
        <label>Caixa para materiais<select value={materialBox} onChange={event => setMaterialBox(event.target.value)}>{CASH_BOXES.map(box=><option key={box}>{box}</option>)}</select></label>
        <label>Valor restante (R$)<input type="number" min="0" step="0.01" value={otherAmount} onChange={event => { setOtherAmount(event.target.value); setEdited(true); }} /></label>
        <label>Caixa para o restante<select value={otherBox} onChange={event => setOtherBox(event.target.value)}>{CASH_BOXES.map(box=><option key={box}>{box}</option>)}</select></label>
      </div><button type="button" className="link" onClick={() => recalculate(amount)}>Recalcular sugestão</button><p>Distribuído: {formatMoney((reaisToCents(materialAmount) + reaisToCents(otherAmount)) / 100)}</p></div>}
      <div className="receipt-date-method"><label>Data<input type="date" value={date} max={today()} onChange={event=>setDate(event.target.value)} required /></label>
      <label>Forma<select value={method} onChange={event=>setMethod(event.target.value)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label></div>
      <label>Observação<input value={note} onChange={event=>setNote(event.target.value)} /></label>
    </fieldset>
    {error && <p className="negative" role="alert">{error}</p>}
    </div>
    <div className="actions receipt-footer"><button className="primary" disabled={busy}>{busy ? 'Registrando…' : 'Registrar recebimento'}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div>
  </form></div>;
}
