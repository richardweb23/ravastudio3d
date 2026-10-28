import { saleTotal } from "../../lib/vendas.js";
import { CashBalances } from "../financeiro/CashPanel.jsx";
import { useEffect, useState } from "react";
import { formatMoney as fmtMoney } from "../../lib/formatters.js";
import TaskBoard from "../tarefas/TaskBoard.jsx";
import Header from "../Header.jsx";
import Metric from "../Metric.jsx";
import PedidoDetalhes from "../pedidos/PedidoDetalhes.jsx";

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
  onPriorityChange,
  onItemStatusChange,
  tarefas, taskError, onTaskStatusChange,
}) {
  const { materiais, vendas, pedidos } = data;
  const [dragged, setDragged] = useState(null);
  const [savingPriority, setSavingPriority] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [selectedOrder, setDetailOrder] = useState(null);
  const detailOrder = selectedOrder
    ? pedidos.find((order) => order.id === selectedOrder.id) ?? null
    : null;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const byPriority = (items) =>
    [...items].sort((a, b) =>
      (a.prioridade ?? Infinity) - (b.prioridade ?? Infinity) ||
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
        sum + saleTotal(item),
      0,
    );

  const open = byPriority(pedidos.filter((item) => item.status !== "entregue"));
  async function movePriority(cards, index, direction) {
    if (savingPriority) return;
    const reordered = [...cards];
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSavingPriority(true);
    try {
      await onPriorityChange(cards[index].status, reordered.map((order) => order.id));
    } finally {
      setSavingPriority(false);
    }
  }
  const low = materiais.filter((item) => Number(item.quantidade_atual) <= 0);
  async function drop(status) {
    if (savingPriority || !dragged || dragged.status === status) return setDragged(null);
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
  const paid = detailOrder ? data.pagamentos
    .filter(payment => payment.pedido_id === detailOrder.id && !payment.estornado_em)
    .reduce((sum, payment) => sum + Number(payment.valor), 0) : 0;
  const total = Number(detailOrder?.valor_total || 0);
  const detailFinancial = { paid, balance: Math.max(0, total - paid),
    status: paid >= total ? "pago" : paid > 0 ? "parcial" : "pendente" };
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
      <CashBalances refreshKey={data} />
      <section className="panel kanban">
        <div className="panel-title">
          <h2>Pedidos em andamento</h2>
          <button className="link" onClick={() => onNavigate("pedidos")}>
            Ver todos
          </button>
        </div>
        <p className="kanban-help">
          Use as setas para definir a prioridade em cada coluna: 1 é a maior
          prioridade. Arraste um pedido para alterar sua etapa.
        </p>
        <div className="kanban-columns">
          {[
            ["recebido", "Recebidos"],
            ["em_producao", "Em produção"],
            ["pronto", "Prontos"],
          ].map(([status, label]) => {
            const cards = byPriority(
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
                {cards.map((order, index) => (
                  <article
                    draggable={!savingPriority}
                    className={`kanban-card ${dragged?.id === order.id ? "dragging" : ""}`}
                    key={order.id}
                    data-order-id={order.id}
                    onDragStart={() => setDragged(order)}
                    onDragEnd={() => setDragged(null)}
                  >
                    <div className="order-priority">
                      <span aria-label={`Prioridade ${index + 1}`}>#{index + 1} · Prioridade</span>
                      <div>
                        <button type="button" disabled={savingPriority || index === 0} onClick={() => movePriority(cards, index, -1)} aria-label={`Subir pedido de ${order.cliente}`} title="Aumentar prioridade">↑</button>
                        <button type="button" disabled={savingPriority || index === cards.length - 1} onClick={() => movePriority(cards, index, 1)} aria-label={`Descer pedido de ${order.cliente}`} title="Diminuir prioridade">↓</button>
                      </div>
                    </div>
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
                        disabled={savingPriority}
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
      <TaskBoard tarefas={tarefas} error={taskError} onStatusChange={onTaskStatusChange} onCreate={() => onNavigate("tarefas", { createTask: true })} />
      {detailOrder && (
        <PedidoDetalhes order={detailOrder} items={detailItems} financial={detailFinancial}
          onItemStatusChange={onItemStatusChange} onClose={() => setDetailOrder(null)} />
      )}
      <section className="panel shortcut">
        <h2>Atalhos</h2>
        <button onClick={() => onNavigate("compras")}>Registrar entrada</button>
        <button onClick={() => onNavigate("vendas")}>Registrar venda</button>
        <button onClick={() => onNavigate("pedidos")}>Novo pedido</button>
      </section>
    </>
  );
}


