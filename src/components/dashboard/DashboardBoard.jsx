import { useEffect, useState } from "react";
import { formatMoney as fmtMoney, formatNumber as fmtNumber } from "../../lib/formatters.js";
import Header from "../Header.jsx";
import Metric from "../Metric.jsx";
import Empty from "../Empty.jsx";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthResetLabel(date) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const minutes = Math.max(0, Math.ceil((nextMonth - date) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  return `Reinicia em ${days}d ${hours}h ${remainingMinutes}min`;
}

export default function DashboardBoard({
  data,
  onNavigate,
  onStatusChange,
  onItemStatusChange,
}) {
  const { materiais, vendas, pedidos } = data;
  const [dragged, setDragged] = useState(null);
  const [clock, setClock] = useState(() => new Date());
  const [detailOrder, setDetailOrder] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const byDelivery = (items) =>
    [...items].sort((a, b) =>
      (a.previsao_entrega || "9999-12-31").localeCompare(
        b.previsao_entrega || "9999-12-31",
      ),
    );
  const stockValue = materiais.reduce(
    (sum, item) =>
      sum + Number(item.quantidade_atual) * Number(item.custo_medio),
    0,
  );
  const month = monthKey(clock);
  const revenue = vendas
    .filter((item) => item.data?.startsWith(month))
    .reduce(
      (sum, item) =>
        sum + Number(item.quantidade) * Number(item.preco_unitario),
      0,
    );
  const open = byDelivery(pedidos.filter((item) => item.status !== "entregue"));
  const low = materiais.filter((item) => Number(item.quantidade_atual) <= 0);
  async function drop(status) {
    if (!dragged || dragged.status === status) return setDragged(null);
    await onStatusChange(dragged, status);
    setDragged(null);
  }
  async function deliver(order) {
    if (
      !window.confirm(
        `Confirmar a entrega do pedido de ${order.cliente}? O estoque será baixado e o pedido sairá deste quadro.`,
      )
    )
      return;
    await onStatusChange(order, "entregue");
  }
  const detailItems = detailOrder
    ? data.pedidoItens.filter((item) => item.pedido_id === detailOrder.id)
    : [];
  return (
    <>
      <Header
        title="Visão geral"
        subtitle="Acompanhe o que está acontecendo na RAVA."
      />
      <div className="metrics">
        <Metric label="Valor em estoque" value={fmtMoney(stockValue)} />
        <Metric
          label={`Vendas no mês atual · ${monthResetLabel(clock)}`}
          value={fmtMoney(revenue)}
        />
        <Metric label="Pedidos em aberto" value={open.length} />
        <Metric
          label="Produtos sem saldo"
          value={low.length}
          danger={low.length > 0}
        />
      </div>
      <section className="panel kanban">
        <div className="panel-title">
          <h2>Pedidos em andamento</h2>
          <button className="link" onClick={() => onNavigate("pedidos")}>
            Ver todos
          </button>
        </div>
        <p className="kanban-help">
          Arraste um pedido para alterar sua etapa. Cada coluna está ordenada
          pela entrega mais próxima.
        </p>
        <div className="kanban-columns">
          {[
            ["recebido", "Recebidos"],
            ["em_producao", "Em produção"],
            ["pronto", "Prontos"],
          ].map(([status, label]) => {
            const cards = byDelivery(
              open.filter((order) => order.status === status),
            );
            return (
              <section
                className={`kanban-column ${dragged ? "drop-enabled" : ""}`}
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(status)}
              >
                <div className="kanban-title">
                  <span>{label}</span>
                  <b>{cards.length}</b>
                </div>
                {cards.map((order) => (
                  <article
                    draggable
                    className={`kanban-card ${dragged?.id === order.id ? "dragging" : ""}`}
                    key={order.id}
                    onDragStart={() => setDragged(order)}
                    onDragEnd={() => setDragged(null)}
                  >
                    <button
                      className="kanban-card-main"
                      onClick={() => setDetailOrder(order)}
                    >
                      <strong>{order.cliente}</strong>
                      <small>
                        {order.previsao_entrega
                          ? `Entrega: ${new Date(order.previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR")}`
                          : "Sem previsão de entrega"}
                      </small>
                      <span>{fmtMoney(order.valor_total)}</span>
                      <em>
                        {data.pedidoItens.filter((item) => item.pedido_id === order.id && item.concluido).length}/
                        {data.pedidoItens.filter((item) => item.pedido_id === order.id).length} itens concluídos
                      </em>
                    </button>
                    {status === "pronto" && (
                      <button
                        className="deliver-button"
                        onClick={() => deliver(order)}
                      >
                        Entregar
                      </button>
                    )}
                  </article>
                ))}
                {!cards.length && <p className="kanban-empty">Solte aqui</p>}
              </section>
            );
          })}
        </div>
      </section>
      {detailOrder && (
        <div className="modal-backdrop" role="presentation">
          <section className="panel modal-card production-detail" role="dialog" aria-modal="true" aria-labelledby="production-detail-title">
            <div className="modal-heading">
              <div>
                <h2 id="production-detail-title">Pedido de {detailOrder.cliente}</h2>
                <p>Entrega: {detailOrder.previsao_entrega ? new Date(`${detailOrder.previsao_entrega}T12:00:00`).toLocaleDateString("pt-BR") : "não informada"} · {fmtMoney(detailOrder.valor_total)}</p>
              </div>
              <button className="close-modal" onClick={() => setDetailOrder(null)} aria-label="Fechar detalhes">×</button>
            </div>
            {detailOrder.observacao && <p className="order-note">{detailOrder.observacao}</p>}
            <div className="production-progress"><strong>{detailItems.filter((item) => item.concluido).length} de {detailItems.length} itens concluídos</strong><span>{detailItems.length ? Math.round((detailItems.filter((item) => item.concluido).length / detailItems.length) * 100) : 0}%</span></div>
            <div className="production-items">{detailItems.map((item) => <label key={item.id} className={item.concluido ? "production-item done" : "production-item"}><input type="checkbox" checked={Boolean(item.concluido)} disabled={detailOrder.status === "entregue"} onChange={(event) => onItemStatusChange(item, event.target.checked)} /><span><strong>{item.materiais?.nome || "Produto"}{item.subtitulo ? ` — ${item.subtitulo}` : ""}</strong><small>{fmtNumber(item.quantidade)} × {fmtMoney(item.preco_unitario)} · subtotal {fmtMoney(Number(item.quantidade) * Number(item.preco_unitario))}</small></span><b>{item.concluido ? "Concluído" : "Pendente"}</b></label>)}</div>
            {!detailItems.length && <Empty text="Este pedido não possui itens cadastrados." />}
          </section>
        </div>
      )}
      <section className="panel products-overview">
        <div className="panel-title">
          <h2>Produtos em estoque</h2>
          <button className="link" onClick={() => onNavigate("estoque")}>
            Gerenciar
          </button>
        </div>
        {materiais.slice(0, 5).map((item) => (
          <div className="list-row" key={item.id}>
            <div>
              <strong>{item.nome}</strong>
              <small>
                {fmtMoney(item.custo_medio)}
              </small>
            </div>
            <b className={Number(item.quantidade_atual) <= 0 ? "negative" : ""}>
              {fmtNumber(item.quantidade_atual)}
            </b>
          </div>
        ))}
        {!materiais.length && <Empty text="Cadastre seu primeiro produto." />}
      </section>
      <section className="panel shortcut">
        <h2>Atalhos</h2>
        <button onClick={() => onNavigate("compras")}>Registrar entrada</button>
        <button onClick={() => onNavigate("vendas")}>Registrar venda</button>
        <button onClick={() => onNavigate("pedidos")}>Novo pedido</button>
      </section>
    </>
  );
}


