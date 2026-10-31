import { orderAdvanceWarning } from "../../lib/orderBoard.js";
import StatusBadge from '../StatusBadge.jsx';
import RecebimentoModal from "./RecebimentoModal.jsx";
import useCaixaPedido from "../../hooks/useCaixaPedido.js";
import CaixaPedidoModal from "../CaixaPedidoModal.jsx";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase.js";
import { formatMoney as fmtMoney } from "../../lib/formatters.js";
import Header from "../Header.jsx";
import DataTable from "../DataTable.jsx";
import Status from "../Status.jsx";
import PedidoEditor from "./PedidoEditor.jsx";
import PedidoDetalhes from "./PedidoDetalhes.jsx";

const statusPriority = { recebido: 0, em_preparacao: 1, em_producao: 2, pronto: 3, entregue: 4 };

export default function PedidosComLocal({
  subtarefas = [],
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
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [paymentFilter, setPaymentFilter] = useState("pendente");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);
  const detailOrder = pedidos.find(order => order.id === detailId);


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
      (order) => (statusFilter === "todos" || order.status === statusFilter) &&
        (paymentFilter === "todos" || financial(order).status === paymentFilter) &&
        order.cliente.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      ((statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3)) ||
      (a.previsao_entrega || "9999-12-31").localeCompare(
        b.previsao_entrega || "9999-12-31",
      ),
    );

  async function changeStatus(order, status) {
    if (order.status === "entregue")
      return show("Pedidos entregues não podem voltar de status.", "error");
    const warning = orderAdvanceWarning(order, subtarefas, status);
    if (status === 'pronto' && warning && !window.confirm(warning + '\n\nAvançar mesmo assim?')) return;
    if (status === "entregue") {
      const info = financial(order);
      if (info.balance > 0 && !window.confirm(`Restam ${fmtMoney(info.balance)}. Entregar mesmo assim?`))
        return;
      if (!window.confirm([warning, "Confirmar entrega e baixa de estoque?"].filter(Boolean).join("\n\n"))) return;
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
      {detailOrder && <PedidoDetalhes key={detailOrder.id} subtasks={subtarefas.filter(task => task.pedido_id === detailId)} order={detailOrder} items={itens.filter(item => item.pedido_id === detailId)} financial={financial(detailOrder)} onClose={() => setDetailId(null)} />}
      {paymentOrder && <RecebimentoModal key={paymentOrder.id} order={paymentOrder} items={itens.filter(item => item.pedido_id === paymentOrder.id)} materiais={materiais} balance={financial(paymentOrder).balance} onClose={() => setPaymentOrder(null)} onSaved={() => { setPaymentOrder(null); show('Pagamento registrado.'); onSaved(); }} />}
      <section className="panel table-panel orders-table">
        <div className="panel-title">
          <h2>Pedidos cadastrados <small className="order-result-count">{visible.length} de {pedidos.length}</small></h2>
        </div>
        <div className="order-filters">
          <label className="order-search">Buscar cliente<input type="search" placeholder="Nome do cliente" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label>
            Status do pedido
            <select className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="todos">Todos</option>
              <option value="recebido">Recebidos</option>
              <option value="em_preparacao">Em preparação</option><option value="em_producao">Em produção</option>
              <option value="pronto">Prontos para entrega</option>
              <option value="entregue">Entregues</option>
            </select>
          </label>
          <label>Status pagamento
            <select className="filter-select" value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}>
              <option value="todos">Todos</option><option value="pendente">Pendente</option><option value="parcial">Parcial</option><option value="pago">Quitado</option>
            </select>
          </label>
          <button type="button" disabled={statusFilter === "todos" && paymentFilter === "todos" && !search} onClick={() => { setStatusFilter("todos"); setPaymentFilter("todos"); setSearch(""); }}>Limpar filtros</button>
        </div>
        <DataTable heads={["Cliente", "Entrega", "Status do pedido", "Total", "Status pagamento", "Pago", "Restante", "Ações"]} empty="Nenhum pedido neste filtro." rows={visible.map((order) => {
          const info = financial(order);
          return (
            <tr key={order.id}>
              <td className="order-description">
                <strong>{order.cliente}</strong>
              </td>
              <td className="order-date">
                {order.previsao_entrega ? new Date(order.previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada"}
              </td>
              <td>
                <div className="order-table-status">
                  <Status value={order.status} />
                  <select className="filter-select" aria-label={`Alterar status do pedido de ${order.cliente}`} value={order.status} disabled={order.status === "entregue"} onChange={(e) => changeStatus(order, e.target.value)}>
                    <option value="recebido">Recebido</option>
                    <option value="em_preparacao">Em preparação</option><option value="em_producao">Em produção</option>
                    <option value="pronto">Pronto para entrega</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </div>
              </td>
              <td className="order-money"><strong>{fmtMoney(order.valor_total)}</strong></td>
              <td className="order-money">
                <StatusBadge value={info.status}>{info.status === "pago" ? "Quitado" : info.status === "parcial" ? "Parcial" : "Pendente"}</StatusBadge>

              </td>
              <td className="order-money">{fmtMoney(info.paid)}</td>
              <td className="order-money"><strong className={info.balance ? "negative" : ""}>{fmtMoney(info.balance)}</strong></td>
              <td>
                <div className="row-actions order-table-actions">
                  <button type="button" className="registration-icon-button" title="Ver detalhes" aria-label={`Ver detalhes do pedido de ${order.cliente}`} onClick={() => setDetailId(order.id)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                  {order.status !== "entregue" && <>
                    <button type="button" className="registration-icon-button" title="Editar pedido" aria-label={`Editar pedido de ${order.cliente}`} onClick={() => setEditor(order)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></svg>
                    </button>
                    <button type="button" className="registration-icon-button registration-icon-danger" title="Excluir pedido" aria-label={`Excluir pedido de ${order.cliente}`} onClick={() => removeOrder(order)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
                    </button>
                  </>}
                  {info.balance > 0 && <button type="button" className="registration-icon-button" title="Registrar pagamento" aria-label={`Registrar pagamento do pedido de ${order.cliente}`} onClick={() => {  setPaymentOrder(order); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 9h20M6 15h4M17 12v6M14 15h6" /></svg>
                  </button>}
                </div>
              </td>
            </tr>
          );
        })} />
      </section>
    </>
  );
}



