import DashboardBoard from "./DashboardBoard.jsx";
import { useEffect } from "react";
import { formatMoney as fmtMoney } from "../../lib/formatters.js";

export default function Dashboard({ data, onNavigate, onStatusChange, onItemStatusChange }) {
  useEffect(() => {
    const cards = document.querySelectorAll(".kanban-card");
    cards.forEach((card) => {
      const order = data.pedidos.find((item) =>
        card.textContent.includes(item.cliente),
      );
      if (!order) return;
      const items = data.pedidoItens
        .filter((item) => item.pedido_id === order.id)
        .map(
          (item) =>
            `${item.materiais?.nome || "Produto"}${item.subtitulo ? ` — ${item.subtitulo}` : ""}: ${item.quantidade} × ${fmtMoney(item.preco_unitario)}`,
        )
        .join("\n");
      card.title = `Cliente: ${order.cliente}\nEntrega: ${order.previsao_entrega ? new Date(`${order.previsao_entrega}T12:00:00`).toLocaleDateString("pt-BR") : "não informada"}\nTotal: ${fmtMoney(order.valor_total)}${order.observacao ? `\nObservação: ${order.observacao}` : ""}\n\nItens:\n${items || "Nenhum item"}`;
      const paid = data.pagamentos
        .filter((payment) => payment.pedido_id === order.id)
        .reduce((sum, payment) => sum + Number(payment.valor || 0), 0);
      const total = Number(order.valor_total || 0);
      const balance = Math.max(0, total - paid);
      const paymentStatus =
        total > 0 && paid >= total
          ? "Quitado"
          : paid > 0
            ? "Pagamento parcial"
            : "Sem pagamentos";
      card.title = `Cliente: ${order.cliente}\nTotal: ${fmtMoney(total)}\nPagamento: ${paymentStatus}\nValor pago: ${fmtMoney(paid)}\nSaldo pendente: ${fmtMoney(balance)}\n\nItens:\n${items || "Nenhum item"}`;
      if (order.status === "pronto" || !order.previsao_entrega) return;
      const days = Math.ceil(
        (new Date(`${order.previsao_entrega}T12:00:00`) - new Date()) /
          86400000,
      );
      if (days < 0) card.classList.add("overdue");
      else if (days <= 1) card.classList.add("due-soon");
    });
  }, [data]);
  return (
    <DashboardBoard
      data={data}
      onNavigate={onNavigate}
      onStatusChange={onStatusChange}
      onItemStatusChange={onItemStatusChange}
    />
  );
}


