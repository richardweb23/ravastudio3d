import type { Order, OrderItem, Subtask } from "../../adminTypes";
import { errorMessage } from "../../adminTypes";
import type { OrderActions } from "../../adminTypes";
import OrderSubtasks from "./OrderSubtasks.tsx";
import OrderWorkflow from "./OrderWorkflow.tsx";
﻿import { useEffect, useRef, useState } from "react";
import Status from "../Status.tsx";
import StatusBadge from "../StatusBadge.tsx";
import { formatMoney, formatNumber } from "../../lib/formatters.js";

const dateLabel = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada";

export default function PedidoDetalhes({ order, items, financial, onClose, onItemStatusChange, onDescriptionSave, onLinksSave, subtasks = [], onSubtaskChange, onSituationSave, onStatusChange }: OrderActions & { order: Order; items: OrderItem[]; financial: { paid: number; balance: number; status: string }; onClose: () => void; subtasks?: Subtask[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState(order.observacao || "");
  const [descriptionMessage, setDescriptionMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [newLink, setNewLink] = useState("");
  const [newColor, setNewColor] = useState("");
  const [editingColor, setEditingColor] = useState<number | null>(null);
  const [colorValue, setColorValue] = useState("");
  const [linkMessage, setLinkMessage] = useState<{ text: string; error: boolean } | null>(null);
  async function saveLinks(links: string[], colors: string[]) {
    if (!onLinksSave || saving.current) return false;
    saving.current = true;
    setBusy(true);
    setLinkMessage(null);
    try {
      await onLinksSave(order, links, colors);
      setLinkMessage({ text: "Links atualizados.", error: false });
      return true;
    } catch (error) {
      setLinkMessage({ text: errorMessage(error, "Não foi possível atualizar os links. Tente novamente."), error: true });
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function addLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const link = newLink.trim();
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      setLinkMessage({ text: "Informe um link válido que comece com http:// ou https://.", error: true });
      return;
    }
    const colors = (order.links || []).map((_, index) => order.links_cores?.[index] || "");
    if (await saveLinks([...(order.links || []), link], [...colors, newColor.trim()])) { setNewLink(""); setNewColor(""); }
  }
  async function saveDescription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setDescriptionMessage(null);
    try {
      await onDescriptionSave?.(order, description);
      setDescriptionMessage({ text: "Descrição salva.", error: false });
    } catch (error) {
      setDescriptionMessage({ text: errorMessage(error, "Não foi possível salvar a descrição. Tente novamente."), error: true });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function changeCompletion(item: OrderItem, checked: boolean) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try { await onItemStatusChange?.(item, checked); }
    finally { saving.current = false; setBusy(false); }
  }
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
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
    <section className="order-details-section order-details-products" aria-labelledby="order-items-title">
    <h3 id="order-items-title">Itens do pedido</h3>
    <div className="table-wrap"><table className="order-details-items">
      <thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th><th scope="col">Valor unitário</th><th scope="col">Subtotal</th>{onItemStatusChange && <th scope="col">Concluído</th>}</tr></thead>
      <tbody>{items.length ? items.map(item => <tr key={item.id}>
        <td><strong>{item.materiais?.nome || "Produto"}</strong>{item.subtitulo && <small>{item.subtitulo}</small>}<small>Estoque: {item.locais_estoque?.nome || order.locais_estoque?.nome || "Estoque principal"} · Caixa: {item.caixa || (order.status === 'entregue' ? 'Conforme venda' : 'Definir na entrega')}</small></td>
        <td>{formatNumber(item.quantidade)}</td><td>{formatMoney(item.preco_unitario)}</td><td>{formatMoney(Number(item.quantidade) * Number(item.preco_unitario))}</td>
        {onItemStatusChange && <td><input className="order-item-completed" type="checkbox" checked={Boolean(item.concluido)} disabled={busy || order.status === "entregue"} aria-label={`Concluído: ${item.materiais?.nome || "Produto"} ${item.subtitulo || ""}`} onChange={event => changeCompletion(item, event.target.checked)} /></td>}
      </tr>) : <tr><td colSpan={onItemStatusChange ? 5 : 4}>Nenhum item neste pedido.</td></tr>}</tbody>
    </table></div>
    </section>
    <section className="order-details-section order-details-financial" aria-labelledby="order-financial-title">
    <h3 id="order-financial-title">Resumo financeiro</h3>
    <dl className="order-details-totals">
      <div><dt>Desconto</dt><dd>{formatMoney(order.desconto || 0)}</dd></div>
      <div><dt>Total do pedido</dt><dd>{formatMoney(order.valor_total)}</dd></div>
      <div><dt>Status pagamento</dt><dd><StatusBadge value={financial.status}>{financial.status === "pago" ? "Quitado" : financial.status === "parcial" ? "Parcial" : "Pendente"}</StatusBadge></dd></div>
      <div><dt>Pago</dt><dd>{formatMoney(financial.paid)}</dd></div>
      <div><dt>Restante</dt><dd className={financial.balance ? "negative" : ""}>{formatMoney(financial.balance)}</dd></div>
    </dl>
    </section>
    {(onLinksSave || !!order.links?.length) && <section className="order-details-section order-links" aria-labelledby="order-links-details-title">
      <h3 id="order-links-details-title">Links do pedido</h3>
      {!!order.links?.length && <ul>{order.links.map((link, index) => {
        try {
          const url = new URL(link);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
          return <li key={`${index}-${link}`}><div className="order-link-content">{order.links_cores?.[index] && <span>Cor: <strong>{order.links_cores[index]}</strong></span>}<a href={url.href} target="_blank" rel="noopener noreferrer">{link}</a>
            {onLinksSave && editingColor === index && <form className="order-edit-color" onSubmit={async event => { event.preventDefault(); const colors = order.links.map((_, position) => position === index ? colorValue.trim() : order.links_cores?.[position] || ""); if (await saveLinks(order.links, colors)) setEditingColor(null); }}>
              <label>Cor do link {index + 1}<input value={colorValue} onChange={event => setColorValue(event.target.value)} maxLength={100} placeholder="Ex.: Branco" /></label>
              <div><button type="submit" disabled={busy}>Salvar cor</button><button type="button" onClick={() => setEditingColor(null)} disabled={busy}>Cancelar</button></div>
            </form>}
          </div>{onLinksSave && <div className="order-link-actions"><button type="button" className="link" aria-label={`Editar cor do link ${index + 1}`} disabled={busy} onClick={() => { setEditingColor(index); setColorValue(order.links_cores?.[index] || ""); }}>Editar cor</button><button type="button" className="danger-text" aria-label={`Remover link ${index + 1}`} disabled={busy} onClick={async () => { if (await saveLinks(order.links.filter((_, position) => position !== index), order.links.map((_, position) => order.links_cores?.[position] || "").filter((_, position) => position !== index))) setEditingColor(null); }}>Remover</button></div>}</li>;
        } catch { return null; }
      })}</ul>}
      {onLinksSave && <form className="order-details-link-form" onSubmit={addLink}>
        <label htmlFor="order-new-link-color">Cor</label>
        <input id="order-new-link-color" type="text" value={newColor} onChange={event => setNewColor(event.target.value)} placeholder="Ex.: Branco" maxLength={100} disabled={busy || (order.links || []).length >= 20} />
        <label htmlFor="order-new-link">Adicionar link</label>
        <div><input id="order-new-link" type="url" value={newLink} onChange={event => { setNewLink(event.target.value); setLinkMessage(null); }} placeholder="https://exemplo.com" maxLength={2048} required disabled={busy || (order.links || []).length >= 20} />
          <button type="submit" disabled={busy || (order.links || []).length >= 20}>Adicionar link</button></div>
      </form>}
      {linkMessage && <p role={linkMessage.error ? "alert" : "status"}>{linkMessage.text}</p>}
    </section>}
    {onDescriptionSave ? <form className="order-details-note order-details-section" onSubmit={saveDescription}>
      <h3><label htmlFor="order-description">Descrição do pedido / observações</label></h3>
      <textarea id="order-description" rows={4} value={description} onChange={event => { setDescription(event.target.value); setDescriptionMessage(null); }} placeholder="Descreva os detalhes e a personalização do pedido" />
      <div className="actions"><button className="primary" type="submit" disabled={busy || description === (order.observacao || "")}>Salvar descrição</button></div>
      {descriptionMessage && <p role={descriptionMessage.error ? "alert" : "status"}>{descriptionMessage.text}</p>}
    </form> : order.observacao && <section className="order-details-note order-details-section"><h3>Observação / personalização</h3><p>{order.observacao}</p></section>}
    <OrderSubtasks order={order} tasks={subtasks} onChange={onSubtaskChange} editable />
    </div>
    <div className="actions order-dialog-footer"><button type="button" onClick={onClose}>Fechar</button></div>
    </div>
    {busy && <div className="board-update-overlay" role="status"><div className="board-update-indicator"><span className="board-update-spinner" aria-hidden="true" /><span>Salvando alterações…</span></div></div>}
  </dialog>;
}
