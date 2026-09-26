import CaixaSelect from "../CaixaSelect.jsx";
import useCaixaPedido from "../../hooks/useCaixaPedido.js";
import CaixaPedidoModal from "../CaixaPedidoModal.jsx";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber, today } from "../../lib/formatters.js";
import Header from "../Header.jsx";
import DataTable from "../DataTable.jsx";
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
  const { open: caixaOpen, requestCaixa, finishCaixa } = useCaixaPedido();
  const [editor, setEditor] = useState(null);
  const paymentRequest=useRef(null);
  const [paying,setPaying]=useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [payment, setPayment] = useState({
    caixa: "",
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
      .filter((item) => item.pedido_id === order.id && !item.estornado_em)
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
    const caixa = status === "entregue" ? await requestCaixa() : null;
    if (status === "entregue" && !caixa) return;
    const { error } = await supabase.rpc("alterar_status_pedido", {
      p_pedido_id: order.id,
      p_status: status,
      ...(caixa ? { p_caixa: caixa } : {}),
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
    if(paying)return;
    const signature=JSON.stringify({payment,order:paymentOrder.id});
    if(paymentRequest.current?.signature!==signature)paymentRequest.current={signature,id:crypto.randomUUID()};
    const info = financial(paymentOrder),
      value = Number(payment.valor);
    if (!value || value > info.balance)
      return show("Informe um valor válido, até o saldo pendente.", "error");
    setPaying(true);
    const { error } = await supabase.rpc("financeiro_operar", { p_acao: "receber_pedido", p_requisicao: paymentRequest.current.id, p_dados: {
      pedido_id: paymentOrder.id,
      valor_centavos: Math.round(value * 100),
      caixa: payment.caixa,
      data: payment.data,
      metodo: payment.metodo,
      descricao: payment.observacao || "Recebimento de pedido",
    }});
    setPaying(false);
    if (error) return show(error.message, "error");
    paymentRequest.current=null;
    show("Pagamento registrado.");
    setPaymentOrder(null);
    setPayment({ caixa: "", valor: "", data: today(), metodo: "pix", observacao: "" });
    onSaved();
  }

  return (
    <>
      {caixaOpen && <CaixaPedidoModal onDone={finishCaixa} />}
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
            <CaixaSelect label="Caixa do recebimento" value={payment.caixa} onChange={e=>setPayment({...payment,caixa:e.target.value})} />
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
      <section className="panel table-panel orders-table">
        <div className="panel-title">
          <h2>Pedidos em aberto</h2>
        </div>
        <DataTable heads={["Cliente / itens", "Entrega", "Status", "Total", "Pagamento", "Ações"]} empty="Nenhum pedido neste filtro." rows={visible.map((order) => {
          const info = financial(order);
          return (
            <tr key={order.id}>
              <td className="order-description">
                <strong>{order.cliente}</strong>
                {itens.filter((item) => item.pedido_id === order.id).map((item) => (
                  <small key={item.id}>
                    {item.materiais?.nome}{item.subtitulo ? ` — ${item.subtitulo}` : ""}: {fmtNumber(item.quantidade)}
                  </small>
                ))}
                {order.observacao && <p className="order-note">{order.observacao}</p>}
              </td>
              <td className="order-date">
                {order.previsao_entrega ? new Date(order.previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada"}
              </td>
              <td>
                <div className="order-table-status">
                  <Status value={order.status} />
                  <select className="filter-select" aria-label={`Alterar status do pedido de ${order.cliente}`} value={order.status} disabled={order.status === "entregue"} onChange={(e) => changeStatus(order, e.target.value)}>
                    <option value="recebido">Recebido</option>
                    <option value="em_producao">Em produção</option>
                    <option value="pronto">Pronto</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </div>
              </td>
              <td className="order-money"><strong>{fmtMoney(order.valor_total)}</strong></td>
              <td className="order-money">
                <span className={`financial-status ${info.status}`}>{info.status === "pago" ? "Quitado" : info.status === "parcial" ? "Parcial" : "Pendente"}</span>
                <div className="payment-summary">
                  <div>Pago: <strong>{fmtMoney(info.paid)}</strong></div>
                  <div>Restante: <strong className={info.balance ? "negative" : ""}>{fmtMoney(info.balance)}</strong></div>
                </div>
              </td>
              <td>
                <div className="row-actions order-table-actions">
                  {order.status !== "entregue" && <>
                    <button type="button" className="registration-icon-button" title="Editar pedido" aria-label={`Editar pedido de ${order.cliente}`} onClick={() => setEditor(order)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></svg>
                    </button>
                    <button type="button" className="registration-icon-button registration-icon-danger" title="Excluir pedido" aria-label={`Excluir pedido de ${order.cliente}`} onClick={() => removeOrder(order)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
                    </button>
                  </>}
                  {info.balance > 0 && <button type="button" className="registration-icon-button" title="Registrar pagamento" aria-label={`Registrar pagamento do pedido de ${order.cliente}`} onClick={() => { setPayment(p=>({...p,requestId:crypto.randomUUID()})); setPaymentOrder(order); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 9h20M6 15h4M17 12v6M14 15h6" /></svg>
                  </button>}
                  {order.status === "entregue" && info.balance === 0 && <span aria-label="Nenhuma ação disponível">—</span>}
                </div>
              </td>
            </tr>
          );
        })} />
      </section>
    </>
  );
}



