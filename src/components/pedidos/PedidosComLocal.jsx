import { useEffect, useState } from "react";
import { supabase } from "../../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber, today } from "../../lib/formatters.js";
import Header from "../Header.jsx";
import Empty from "../Empty.jsx";
import Status from "../Status.jsx";
import PedidoEditor from "./PedidoEditor.jsx";

export default function PedidosComLocal({
  materiais,
  locais,
  vendedores,
  pedidos,
  itens,
  pagamentos,
  onSaved,
  show,
}) {
  const [editor, setEditor] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [payment, setPayment] = useState({
    valor: "",
    data: today(),
    metodo: "pix",
    observacao: "",
  });

  useEffect(() => {
    const handler = (event) => setStatusFilter(event.detail);
    window.addEventListener("rava:pedido-status-filter", handler);
    return () =>
      window.removeEventListener("rava:pedido-status-filter", handler);
  }, []);

  const financial = (order) => {
    const paid = pagamentos
      .filter((item) => item.pedido_id === order.id)
      .reduce((sum, item) => sum + Number(item.valor), 0);
    const balance = Math.max(0, Number(order.valor_total || 0) - paid);
    return {
      paid,
      balance,
      status:
        paid >= Number(order.valor_total || 0)
          ? "pago"
          : paid > 0
            ? "parcial"
            : "pendente",
    };
  };
  const visible = pedidos
    .filter(
      (order) => statusFilter === "todos" || order.status === statusFilter,
    )
    .sort((a, b) =>
      (a.previsao_entrega || "9999-12-31").localeCompare(
        b.previsao_entrega || "9999-12-31",
      ),
    );

  async function changeStatus(order, status) {
    if (order.status === "entregue")
      return show("Pedidos entregues não podem voltar de status.", "error");
    if (status === "entregue") {
      const info = financial(order);
      if (info.balance > 0 && !window.confirm(`Restam ${fmtMoney(info.balance)}. Entregar mesmo assim?`))
        return;
      if (!window.confirm("Confirmar entrega e baixa de estoque?")) return;
    }
    const { error } = await supabase.rpc("alterar_status_pedido", {
      p_pedido_id: order.id,
      p_status: status,
    });
    if (error) show(error.message, "error");
    else {
      show("Status atualizado.");
      onSaved();
    }
  }
  async function removeOrder(order) {
    if (order.status === "entregue")
      return show("Pedidos entregues não podem ser excluídos.", "error");
    if (
      !window.confirm(
        `Excluir o pedido de ${order.cliente}? Os itens e pagamentos também serão excluídos.`,
      )
    )
      return;
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", order.id);
    if (error) show(error.message, "error");
    else {
      show("Pedido excluído.");
      onSaved();
    }
  }
  async function savePayment(event) {
    event.preventDefault();
    const info = financial(paymentOrder),
      value = Number(payment.valor);
    if (!value || value > info.balance)
      return show("Informe um valor válido, até o saldo pendente.", "error");
    const { error } = await supabase.from("pedido_pagamentos").insert({
      pedido_id: paymentOrder.id,
      valor: value,
      data: payment.data,
      metodo: payment.metodo,
      observacao: payment.observacao || null,
    });
    if (error) return show(error.message, "error");
    show("Pagamento registrado.");
    setPaymentOrder(null);
    setPayment({ valor: "", data: today(), metodo: "pix", observacao: "" });
    onSaved();
  }

  return (
    <>
      <Header
        title="Pedidos"
        subtitle="Encomendas, descontos, personalizações e pagamentos."
      />
      <section className="panel order-editor-launch">
        <div>
          <h2>Novo pedido</h2>
          <p>Monte os itens em um rascunho e salve tudo de uma vez.</p>
        </div>
        <button className="primary" onClick={() => setEditor({})}>
          Criar pedido
        </button>
      </section>
      {editor && (
        <PedidoEditor
          order={editor.id ? editor : null}
          initialItems={
            editor.id
              ? itens.filter((item) => item.pedido_id === editor.id)
              : []
          }
          materiais={materiais}
          locais={locais}
          vendedores={vendedores}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onSaved();
          }}
          show={show}
        />
      )}
      {paymentOrder && (
        <div className="modal-backdrop" role="presentation">
          <form className="panel form modal-card" onSubmit={savePayment}>
            <div className="modal-heading">
              <h2>Registrar pagamento</h2>
              <button
                type="button"
                className="close-modal"
                onClick={() => setPaymentOrder(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <p className="payment-client">
              {paymentOrder.cliente} · saldo:{" "}
              <strong>{fmtMoney(financial(paymentOrder).balance)}</strong>
            </p>
            <label>
              Valor
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={payment.valor}
                onChange={(e) =>
                  setPayment({ ...payment, valor: e.target.value })
                }
                required
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={payment.data}
                onChange={(e) =>
                  setPayment({ ...payment, data: e.target.value })
                }
              />
            </label>
            <label>
              Forma
              <select
                value={payment.metodo}
                onChange={(e) =>
                  setPayment({ ...payment, metodo: e.target.value })
                }
              >
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              Observação
              <input
                value={payment.observacao}
                onChange={(e) =>
                  setPayment({ ...payment, observacao: e.target.value })
                }
              />
            </label>
            <div className="actions">
              <button className="primary">Registrar</button>
              <button type="button" onClick={() => setPaymentOrder(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
      <section className="panel orders">
        <div className="panel-title">
          <h2>Pedidos em aberto</h2>
        </div>
        {visible.map((order) => {
          const info = financial(order);
          return (
            <article className="order-card" key={order.id}>
              <div>
                <div className="order-top">
                  <strong>{order.cliente}</strong>
                  <Status value={order.status} />
                  <span className={`financial-status ${info.status}`}>
                    {info.status === "pago"
                      ? "Quitado"
                      : info.status === "parcial"
                        ? "Parcial"
                        : "Pendente"}
                  </span>
                </div>
                <small>
                  Entrega:{" "}
                  {order.previsao_entrega
                    ? new Date(
                        order.previsao_entrega + "T12:00:00",
                      ).toLocaleDateString("pt-BR")
                    : "não informada"}
                </small>
                {order.observacao && (
                  <p className="order-note">{order.observacao}</p>
                )}
                <div className="order-items">
                  {itens
                    .filter((item) => item.pedido_id === order.id)
                    .map((item) => (
                      <span key={item.id}>
                        {item.materiais?.nome}
                        {item.subtitulo ? ` — ${item.subtitulo}` : ""}:{" "}
                        {fmtNumber(item.quantidade)}
                      </span>
                    ))}
                </div>
                <div className="payment-summary">
                  Pago: <strong>{fmtMoney(info.paid)}</strong> · Restante:{" "}
                  <strong className={info.balance ? "negative" : ""}>
                    {fmtMoney(info.balance)}
                  </strong>
                </div>
              </div>
              <div className="order-side">
                <strong>{fmtMoney(order.valor_total)}</strong>
                {order.status !== "entregue" && (
                  <>
                    <button onClick={() => setEditor(order)}>Editar</button>
                    <button
                      onClick={() => removeOrder(order)}
                      className="delete-order"
                    >
                      Excluir
                    </button>
                  </>
                )}
                {info.balance > 0 && (
                  <button onClick={() => setPaymentOrder(order)}>
                    Pagamento
                  </button>
                )}
                <select
                  aria-label="Alterar status"
                  value={order.status}
                  disabled={order.status === "entregue"}
                  onChange={(e) => changeStatus(order, e.target.value)}
                >
                  <option value="recebido">Recebido</option>
                  <option value="em_producao">Em produção</option>
                  <option value="pronto">Pronto</option>
                  <option value="entregue">Entregue</option>
                </select>
              </div>
            </article>
          );
        })}
        {!visible.length && <Empty text="Nenhum pedido neste filtro." />}
      </section>
    </>
  );
}



