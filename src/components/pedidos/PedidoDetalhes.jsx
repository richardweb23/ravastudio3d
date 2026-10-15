import { useEffect, useRef } from "react";
import Status from "../Status.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { formatMoney, formatNumber } from "../../lib/formatters.js";

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada";

export default function PedidoDetalhes({ order, items, financial, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} className="panel modal-card order-details-dialog" aria-labelledby="order-details-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading">
      <div><h2 id="order-details-title">Detalhes do pedido</h2><p>{order.cliente}</p></div>
      <button autoFocus type="button" className="close-modal" aria-label="Fechar detalhes" onClick={onClose}>×</button>
    </div>
    <div className="order-details-meta">
      <div><span>Status do pedido</span><Status value={order.status} /></div>
      <div><span>Data do pedido</span><strong>{dateLabel(order.data_pedido)}</strong></div>
      <div><span>Previsão de entrega</span><strong>{dateLabel(order.previsao_entrega)}</strong></div>
    </div>
    <h3>Itens do pedido</h3>
    <div className="table-wrap"><table className="order-details-items">
      <thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th><th scope="col">Valor unitário</th><th scope="col">Subtotal</th></tr></thead>
      <tbody>{items.length ? items.map(item => <tr key={item.id}>
        <td><strong>{item.materiais?.nome || "Produto"}</strong>{item.subtitulo && <small>{item.subtitulo}</small>}</td>
        <td>{formatNumber(item.quantidade)}</td><td>{formatMoney(item.preco_unitario)}</td><td>{formatMoney(Number(item.quantidade) * Number(item.preco_unitario))}</td>
      </tr>) : <tr><td colSpan="4">Nenhum item neste pedido.</td></tr>}</tbody>
    </table></div>
    <dl className="order-details-totals">
      <div><dt>Desconto</dt><dd>{formatMoney(order.desconto || 0)}</dd></div>
      <div><dt>Total do pedido</dt><dd>{formatMoney(order.valor_total)}</dd></div>
      <div><dt>Status pagamento</dt><dd><StatusBadge value={financial.status}>{financial.status === "pago" ? "Quitado" : financial.status === "parcial" ? "Parcial" : "Pendente"}</StatusBadge></dd></div>
      <div><dt>Pago</dt><dd>{formatMoney(financial.paid)}</dd></div>
      <div><dt>Restante</dt><dd className={financial.balance ? "negative" : ""}>{formatMoney(financial.balance)}</dd></div>
    </dl>
    {order.observacao && <section className="order-details-note"><h3>Observação / personalização</h3><p>{order.observacao}</p></section>}
    <div className="actions"><button type="button" onClick={onClose}>Fechar</button></div>
  </dialog>;
}
