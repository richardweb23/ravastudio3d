import OrderSubtasks from "./OrderSubtasks.jsx";
import OrderWorkflow from "./OrderWorkflow.jsx";
﻿import { useEffect, useRef, useState } from "react";
import Status from "../Status.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { formatMoney, formatNumber } from "../../lib/formatters.js";

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada";

export default function PedidoDetalhes({ order, items, financial, onClose, onItemStatusChange, onDescriptionSave, subtasks = [], onSubtaskChange, onSituationSave, onStatusChange }) {
  const dialog = useRef(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState(order.observacao || "");
  const [descriptionMessage, setDescriptionMessage] = useState(null);
  async function saveDescription(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setDescriptionMessage(null);
    try {
      await onDescriptionSave(order, description);
      setDescriptionMessage({ text: "Descrição salva.", error: false });
    } catch (error) {
      setDescriptionMessage({ text: error.message || "Não foi possível salvar a descrição. Tente novamente.", error: true });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function changeCompletion(item, checked) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try { await onItemStatusChange(item, checked); }
    finally { saving.current = false; setBusy(false); }
  }
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} className="panel modal-card order-details-dialog" aria-labelledby="order-details-title" onCancel={event => { event.preventDefault(); if (!saving.current) onClose(); }}>
    <div className="order-dialog-layout" inert={busy} aria-busy={busy}>
    <div className="modal-heading">
      <div><h2 id="order-details-title">Detalhes do pedido</h2><p>{order.cliente}</p></div>
      <button autoFocus type="button" className="close-modal" aria-label="Fechar detalhes" onClick={onClose}>×</button>
    </div>
    <div className="order-dialog-body">
    <div className="order-details-meta">
      <div><span>Status do pedido</span><Status value={order.status} /></div>
      <div><span>Data do pedido</span><strong>{dateLabel(order.data_pedido)}</strong></div>
      <div><span>Previsão de entrega</span><strong>{dateLabel(order.previsao_entrega)}</strong></div>
    </div>
    <OrderWorkflow order={order} onStatusChange={onStatusChange} onSituationSave={onSituationSave} />
    <OrderSubtasks order={order} tasks={subtasks} onChange={onSubtaskChange} editable />
    <h3>Itens do pedido</h3>
    <div className="table-wrap"><table className="order-details-items">
      <thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th><th scope="col">Valor unitário</th><th scope="col">Subtotal</th>{onItemStatusChange && <th scope="col">Concluído</th>}</tr></thead>
      <tbody>{items.length ? items.map(item => <tr key={item.id}>
        <td><strong>{item.materiais?.nome || "Produto"}</strong>{item.subtitulo && <small>{item.subtitulo}</small>}</td>
        <td>{formatNumber(item.quantidade)}</td><td>{formatMoney(item.preco_unitario)}</td><td>{formatMoney(Number(item.quantidade) * Number(item.preco_unitario))}</td>
        {onItemStatusChange && <td><input className="order-item-completed" type="checkbox" checked={Boolean(item.concluido)} disabled={busy || order.status === "entregue"} aria-label={`Concluído: ${item.materiais?.nome || "Produto"} ${item.subtitulo || ""}`} onChange={event => changeCompletion(item, event.target.checked)} /></td>}
      </tr>) : <tr><td colSpan={onItemStatusChange ? 5 : 4}>Nenhum item neste pedido.</td></tr>}</tbody>
    </table></div>
    <dl className="order-details-totals">
      <div><dt>Desconto</dt><dd>{formatMoney(order.desconto || 0)}</dd></div>
      <div><dt>Total do pedido</dt><dd>{formatMoney(order.valor_total)}</dd></div>
      <div><dt>Status pagamento</dt><dd><StatusBadge value={financial.status}>{financial.status === "pago" ? "Quitado" : financial.status === "parcial" ? "Parcial" : "Pendente"}</StatusBadge></dd></div>
      <div><dt>Pago</dt><dd>{formatMoney(financial.paid)}</dd></div>
      <div><dt>Restante</dt><dd className={financial.balance ? "negative" : ""}>{formatMoney(financial.balance)}</dd></div>
    </dl>
    {onDescriptionSave ? <form className="order-details-note" onSubmit={saveDescription}>
      <h3><label htmlFor="order-description">Descrição do pedido / observações</label></h3>
      <textarea id="order-description" rows={4} value={description} onChange={event => { setDescription(event.target.value); setDescriptionMessage(null); }} placeholder="Descreva os detalhes e a personalização do pedido" />
      <div className="actions"><button className="primary" type="submit" disabled={busy || description === (order.observacao || "")}>Salvar descrição</button></div>
      {descriptionMessage && <p role={descriptionMessage.error ? "alert" : "status"}>{descriptionMessage.text}</p>}
    </form> : order.observacao && <section className="order-details-note"><h3>Observação / personalização</h3><p>{order.observacao}</p></section>}
    </div>
    <div className="actions order-dialog-footer"><button type="button" onClick={onClose}>Fechar</button></div>
    </div>
    {busy && <div className="board-update-overlay" role="status"><div className="board-update-indicator"><span className="board-update-spinner" aria-hidden="true" /><span>Salvando alterações…</span></div></div>}
  </dialog>;
}
