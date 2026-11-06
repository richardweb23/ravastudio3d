import type { AdminData, Order, Task, TaskChange } from "../../adminTypes";
import type { OrderActions } from "../../adminTypes";
import { orderStages, orderSituations, orderTooltip } from '../../lib/orderBoard.js';
import { deliveryAlert } from '../../lib/deliveryAlert.js';
import StageHelp from './StageHelp.tsx';
import OrderSubtasks from '../pedidos/OrderSubtasks.tsx';
import { saleTotal } from "../../lib/vendas.js";
import { CashBalances } from "../financeiro/CashPanel.tsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatMoney as fmtMoney } from "../../lib/formatters.js";
import TaskBoard from "../tarefas/TaskBoard.tsx";
import Header from "../Header.tsx";
import Metric from "../Metric.tsx";
import PedidoDetalhes from "../pedidos/PedidoDetalhes.tsx";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthResetLabel(date: Date) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const minutes = Math.max(0, Math.ceil((nextMonth.getTime() - date.getTime()) / 60000));
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
  onDescriptionSave,
  onLinksSave,
  onSituationSave,
  onSubtaskChange,
  tarefas, taskError, onTaskStatusChange,
}: Required<OrderActions> & { data: AdminData; onNavigate: (page: string, options?: { createTask?: boolean }) => void; onPriorityChange: (status: Order["status"], ids: string[]) => Promise<unknown>; tarefas: Task[]; taskError: unknown; onTaskStatusChange: TaskChange }) {
  const { materiais, vendas, pedidos } = data;
  const [dragged, setDragged] = useState<Order | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: string; index: number } | null>(null);
  const [savingPriority, setSavingPriority] = useState(false);
  const boardRef = useRef<HTMLElement>(null);
  const priorityAnimation = useRef<{ status: string; ids: string[]; positions: Map<string | undefined, number> } | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [selectedOrder, setDetailOrder] = useState<Order | null>(null);
  const detailOrder = selectedOrder
    ? pedidos.find((order) => order.id === selectedOrder.id) ?? null
    : null;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const byPriority = (items: Order[]) =>
    [...items].sort((a, b) =>
      (a.prioridade ?? Infinity) - (b.prioridade ?? Infinity) ||
      (a.previsao_entrega || "9999-12-31").localeCompare(
        b.previsao_entrega || "9999-12-31",
      ),
    );
  useLayoutEffect(() => {
    const pending = priorityAnimation.current;
    if (!pending) return;
    const ordered = [...pedidos].filter(order => order.status === pending.status).sort((a, b) =>
      (a.prioridade ?? Infinity) - (b.prioridade ?? Infinity) ||
      (a.previsao_entrega || '9999-12-31').localeCompare(b.previsao_entrega || '9999-12-31'));
    if (ordered.map(order => order.id).join('|') !== pending.ids.join('|')) return;
    priorityAnimation.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    boardRef.current?.querySelectorAll<HTMLElement>('[data-order-id]').forEach(card => {
      const previousTop = pending.positions.get(card.dataset.orderId);
      if (previousTop == null) return;
      const offset = previousTop - card.getBoundingClientRect().top;
      if (Math.abs(offset) < 1) return;
      card.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], { duration: 350, easing: 'ease-out' });
    });
  }, [pedidos]);
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
  async function savePriority(status: Order["status"], reordered: Order[]) {
    const positions = new Map<string | undefined, number>();
    boardRef.current?.querySelectorAll<HTMLElement>('[data-order-id]').forEach(card => positions.set(card.dataset.orderId, card.getBoundingClientRect().top));
    priorityAnimation.current = { status, ids: reordered.map(order => order.id), positions };
    setSavingPriority(true);
    try {
      const saved = await onPriorityChange(status, reordered.map((order) => order.id));
      if (!saved) priorityAnimation.current = null;
    } finally {
      setSavingPriority(false);
    }
  }
  async function movePriority(cards: Order[], index: number, direction: number) {
    if (savingPriority) return;
    const reordered = [...cards];
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await savePriority(cards[index].status, reordered);
  }
  const low = materiais.filter((item) => Number(item.quantidade_atual) <= 0);
  async function drop(status: Order["status"], cards: Order[]) {
    const target = dropTarget;
    setDropTarget(null);
    if (savingPriority || !dragged) return setDragged(null);
    const order = dragged;
    setDragged(null);
    if (order.status === status) {
      if (target?.status !== status) return;
      const reordered = cards.filter(card => card.id !== order.id);
      reordered.splice(target.index, 0, order);
      if (reordered.every((card, index) => card.id === cards[index].id)) return;
      await savePriority(status, reordered);
      return;
    }
    await onStatusChange(order, status);
  }
  async function deliver(order: Order) {
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
      <section ref={boardRef} className="panel kanban order-board">
        <div className="panel-title">
          <h2>Pedidos em andamento</h2>
          <button className="link" onClick={() => onNavigate("pedidos")}>
            Ver todos
          </button>
        </div>
        <p className="kanban-help">
          Arraste os pedidos ou use as setas para ajustar a prioridade: 1 é a maior.
          Arraste para outra coluna para alterar a etapa.
        </p>
        <div className="kanban-columns">
          {orderStages.map(([status, label, help]) => {
            const cards = byPriority(
              open.filter((order) => order.status === status),
            );
            const isTarget = dragged && dropTarget?.status === status;
            const sameColumn = isTarget && dragged.status === status;
            const remaining = sameColumn ? cards.filter(card => card.id !== dragged.id) : [];
            const displayedCards = isTarget && !sameColumn ? byPriority(open
              .filter(order => order.status === status || order.id === dragged.id)
              .map(order => order.id === dragged.id ? { ...order, status, prioridade: null } : order)) : cards;
            return (
              <section
                className={`kanban-column ${dragged ? "drop-enabled" : ""} ${isTarget ? "drop-target" : ""}`}
                key={status}
                onDragOver={event => { if (!dragged) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-order-id]')].filter(card => card.dataset.orderId !== dragged.id); const index = dragged.status === status ? nodes.findIndex(card => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2) : -1; const next = index < 0 ? nodes.length : index; setDropTarget(current => current?.status === status && current.index === next ? current : { status, index: next }); }}
                onDragLeave={event => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDropTarget(current => current?.status === status ? null : current); }}
                onDrop={event => { event.preventDefault(); drop(status, cards); }}
              >
                <div className="kanban-title">
                  <span>{label} <StageHelp label={label}>{help}</StageHelp></span>
                  <b>{cards.length}</b>
                </div>
                {displayedCards.map((order) => {
                  if (order.id === dragged?.id && isTarget && !sameColumn) return <div key={`placeholder-${order.id}`} className="order-drop-placeholder" aria-hidden="true"><strong>Solte para mover</strong><span>{order.cliente}</span></div>;
                  const index = cards.findIndex(card => card.id === order.id);
                  return (
                  <article
                    draggable={!savingPriority}
                    className={`kanban-card situation-${order.situacao || "normal"} ${deliveryAlert(order.previsao_entrega, order.status === "pronto", clock)} ${dragged?.id === order.id ? "dragging" : ""} ${sameColumn && remaining[dropTarget.index]?.id === order.id ? "drop-before" : ""}`}
                    key={order.id}
                    data-order-id={order.id}
                    onDragStart={event => { if (event.target instanceof Element && event.target.closest(".order-subtasks, .order-priority")) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', order.id); setDragged(order); }}
                    onDragEnd={() => { setDragged(null); setDropTarget(null); }}
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
                      title={orderTooltip(order, data)}
                      onClick={() => setDetailOrder(order)}
                    >
                      <strong>{order.cliente}</strong>
                      <span className="order-situation">{order.situacao === 'bloqueado' ? '⛔' : order.situacao === 'aguardando' ? '◷' : '○'} {orderSituations[order.situacao || 'normal']}</span>
                      {order.situacao_descricao && <small className="order-situation-description">{order.situacao_descricao}</small>}
                      {deliveryAlert(order.previsao_entrega, order.status === 'pronto', clock) && <small className="order-deadline">{deliveryAlert(order.previsao_entrega, order.status === 'pronto', clock) === 'overdue' ? 'Entrega atrasada' : 'Entrega próxima'}</small>}
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
                    <OrderSubtasks order={order} tasks={data.subtarefas.filter(task => task.pedido_id === order.id)} onChange={onSubtaskChange} />
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
                  );
                })}
                {sameColumn && dropTarget.index === remaining.length && <div className="order-drop-end" aria-hidden="true" />}
                {!displayedCards.length && <p className="kanban-empty">Solte aqui</p>}
              </section>
            );
          })}
        </div>
      </section>
      <TaskBoard tarefas={tarefas} error={taskError} onStatusChange={onTaskStatusChange} onCreate={() => onNavigate("tarefas", { createTask: true })} />
      {detailOrder && (
        <PedidoDetalhes key={detailOrder.id} subtasks={data.subtarefas.filter(task => task.pedido_id === detailOrder.id)} onSubtaskChange={onSubtaskChange} onSituationSave={onSituationSave} onStatusChange={onStatusChange} order={detailOrder} items={detailItems} financial={detailFinancial}
          onItemStatusChange={onItemStatusChange} onDescriptionSave={onDescriptionSave} onLinksSave={onLinksSave} onClose={() => setDetailOrder(null)} />
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


