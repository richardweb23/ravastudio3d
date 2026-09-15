import { useRef, useState } from "react";
import Header from "../Header.jsx";
import Metric from "../Metric.jsx";
import DataTable from "../DataTable.jsx";
import FilterButtons from "../ui/FilterButtons.jsx";
import ConsignmentModal from "./ConsignmentModal.jsx";
import useConsignment from "../../hooks/useConsignment.js";
import { summarizeConsignment, filterConsignmentSales, movementLabels, repasseStatus, repasseLabels } from "../../lib/consignacao.js";
import { formatBRLCents as money } from "../../lib/financeiro.js";
import { formatNumber as qty } from "../../lib/formatters.js";

const date = value => value ? new Date(value.length === 10 ? value + "T12:00:00" : value).toLocaleDateString("pt-BR") : "—";
export default function LocalDetails({ type, id, onNavigate, onSaved, show }) {
  const { data, loading, error, reload } = useConsignment(type, id);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [movementProduct, setMovementProduct] = useState("");
  const movementsRef = useRef(null);
  const back = <button className="link" onClick={() => onNavigate("cadastros")}>← Locais e vendedores</button>;
  if (loading && !data) return <>{back}<p className="loading" role="status">Carregando detalhes…</p></>;
  if (error) return <>{back}<section className="panel"><h2>Não foi possível carregar os detalhes</h2><p role="alert">{error.message}</p><button className="primary" onClick={reload}>Tentar novamente</button></section></>;
  if (!data) return null;
  const report = summarizeConsignment(data);
  const local = data.locais.find(row => row.id === data.localId);
  const active = data.entity.ativo && local?.ativo && !data.vendedores.some(row => row.local_estoque_id === data.localId && !row.ativo);
  const products = report.products.filter(row => row.nome.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const invalidPeriod = period.start && period.end && period.start > period.end;
  const sales = invalidPeriod ? [] : filterConsignmentSales(data.vendas, status, period.start, period.end);
  const movements = data.movimentos.filter(row => !movementProduct || row.material_id === movementProduct);
  const name = materialId => data.materiais.find(row => row.id === materialId)?.nome || "Produto indisponível";
  const pending = data.vendas.filter(row => repasseStatus(row) === "pendente");
  function viewMovements(productId) { setMovementProduct(productId); movementsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  return <div className="consignment-page" aria-busy={loading}>
    {back}
    <Header title={data.entity.nome} subtitle={type === "vendedor" ? "Vendedor · Estoque e repasses de consignação" : "Local · Estoque e repasses de consignação"} action={<button className="primary" disabled={!active || loading} onClick={() => setModal({ mode: "entrada" })}>Adicionar produtos</button>} />
    <section className="panel consignment-info">
      <div><span>Tipo</span><strong>{type === "vendedor" ? "Vendedor" : "Local"}</strong></div>
      <div><span>Status</span><strong>{data.entity.ativo ? "Ativo" : "Inativo"}</strong></div>
      <div><span>Cadastro</span><strong>{date(data.entity.created_at)}</strong></div>
      {data.entity.telefone && <div><span>Telefone</span><strong>{data.entity.telefone}</strong></div>}
      {data.entity.endereco && <div><span>Endereço</span><strong>{data.entity.endereco}</strong></div>}
      {data.entity.observacoes && <div><span>Observações</span><p>{data.entity.observacoes}</p></div>}
      {type === "vendedor" && local && <div><span>Estoque vinculado</span><strong>{local.nome}{!local.ativo ? " (inativo)" : ""}</strong></div>}
    </section>
    {!data.localId && <section className="panel"><h2>Vincule o estoque deste vendedor</h2><p>Escolha um local existente ou crie um local exclusivo antes de enviar produtos. O histórico será compartilhado com o local vinculado.</p><button className="primary" disabled={!data.entity.ativo} onClick={() => setModal({ mode: "vinculo" })}>Configurar local de consignação</button></section>}
    <div className="consignment-metrics">
      <Metric label="Produtos no local" value={qty(report.unidades) + " un."} />
      <Metric label="Valor potencial de venda" value={money(report.potencial)} />
      <Metric label="Vendas realizadas" value={money(report.vendido)} />
      <div className="consignment-pending"><Metric label="Repasse pendente" value={money(report.pendente)} danger={report.pendente > 0} /></div>
      <Metric label="Repasse pago" value={money(report.pago)} />
    </div>
    <section className="panel table-panel">
      <div className="panel-title"><h2>Produtos em consignação</h2><label className="consignment-search">Buscar produto<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do produto" /></label></div>
      {report.products.some(row => !row.acordo && row.disponivel > 0) && <p>Configure o preço e repasse dos produtos sem acordo para calcular seu valor potencial e registrar vendas.</p>}
      <DataTable heads={["Produto", "Enviada", "Vendida", "Disponível", "Preço sugerido", "Repasse / un.", "Total vendido", "Repasse pendente", "Ações"]} empty="Nenhum produto encontrado neste local." rows={products.map(product => <tr key={product.id}>
        <td><div className="consignment-product">{product.imagem_url && /^https?:\/\//i.test(product.imagem_url) && <img src={product.imagem_url} alt={product.nome} loading="lazy" />}<strong>{product.nome}</strong></div></td>
        <td>{qty(product.enviada)}{product.inicial > 0 && <small>Saldo inicial: {qty(product.inicial)}</small>}</td><td>{qty(product.vendida)}</td><td><strong>{qty(product.disponivel)}</strong></td>
        <td>{product.acordo ? money(product.acordo.preco_centavos) : "Sem acordo"}</td><td>{product.acordo ? money(product.acordo.repasse_centavos) : "—"}</td><td>{money(product.totalVendido)}</td><td className={product.pendente ? "consignment-due" : ""}>{money(product.pendente)}</td>
        <td><div className="consignment-actions">
          <button type="button" className="registration-icon-button" title="Registrar venda" aria-label={"Registrar venda — " + product.nome} disabled={!active || !product.acordo || product.disponivel <= 0 || loading} onClick={() => setModal({ mode: "venda", product })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l3 12h11l2-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg></button>
          <button type="button" className="registration-icon-button" title="Adicionar estoque" aria-label={"Adicionar estoque — " + product.nome} disabled={!active || loading} onClick={() => setModal({ mode: "entrada", product })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 7v10M7 12h10" /></svg></button>
          <button type="button" className="registration-icon-button" title="Retirar produtos" aria-label={"Retirar produtos — " + product.nome} disabled={!active || product.disponivel <= 0 || loading} onClick={() => setModal({ mode: "retirada", product })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 12h10" /></svg></button>
          <button type="button" className="registration-icon-button" title="Preço e repasse" aria-label={"Preço e repasse — " + product.nome} disabled={!active || loading} onClick={() => setModal({ mode: "acordo", product })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 11 22 2 13V2h11l9 9-2 2Z" /><circle cx="7" cy="7" r="1.5" /></svg></button>
          <button type="button" className="registration-icon-button" title="Ajustar estoque" aria-label={"Ajustar estoque — " + product.nome} disabled={!active || loading} onClick={() => setModal({ mode: "ajuste", product })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7m4 0h5M4 17h3m4 0h9" /><circle cx="13" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg></button>
          <button type="button" className="registration-icon-button" title="Ver movimentações" aria-label={"Ver movimentações — " + product.nome} onClick={() => viewMovements(product.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></svg></button>
        </div></td>
      </tr>)} />
    </section>
    <section className="panel table-panel">
      <h2>Histórico de vendas</h2>
      <div className="consignment-filters"><FilterButtons label="Repasse" value={status} onChange={setStatus} options={[{ value: "", label: "Todos" }, { value: "pendente", label: "Repasse pendente" }, { value: "pago", label: "Repasse pago" }]} />
        <label>De<input type="date" value={period.start} onChange={event => setPeriod({ ...period, start: event.target.value })} /></label><label>Até<input type="date" value={period.end} min={period.start} onChange={event => setPeriod({ ...period, end: event.target.value })} /></label>
        <button className="link" onClick={() => { setStatus(""); setPeriod({ start: "", end: "" }); }}>Limpar filtros</button>
      </div>
      {invalidPeriod && <p className="negative" role="alert">A data inicial deve ser anterior ou igual à data final.</p>}
      {data.vendas.some(sale => !sale.acordo_registrado) && <p>Vendas sem acordo registrado não geram repasse presumido. Os valores históricos de venda foram preservados.</p>}
      <DataTable heads={["Data", "Produto", "Qtd.", "Venda / un.", "Total vendido", "Repasse / un.", "Total repasse", "Status", "Pagamento"]} empty="Nenhuma venda para os filtros selecionados." rows={sales.map(sale => <tr key={sale.id}>
        <td>{date(sale.data)}</td><td>{name(sale.material_id)}</td><td>{qty(sale.quantidade)}</td><td>{money(sale.preco_unitario_centavos)}</td><td>{money(sale.total_centavos)}</td><td>{money(sale.repasse_unitario_centavos)}</td><td>{money(sale.repasse_total_centavos)}</td>
        <td><span className={"status consignment-status-" + repasseStatus(sale)}>{repasseLabels[repasseStatus(sale)]}</span></td><td>{date(data.pagamentos.find(payment => payment.id === sale.pagamento_id)?.data_pagamento)}</td>
      </tr>)} />
    </section>
    <section className="panel table-panel">
      <div className="panel-title"><h2>Repasses</h2><button className="primary" disabled={!pending.length || loading} onClick={() => setModal({ mode: "pagamento" })}>Registrar pagamento</button></div>
      <div className="consignment-payment-summary"><span>Pendente <strong className="consignment-due">{money(report.pendente)}</strong></span><span>Já pago <strong>{money(report.pago)}</strong></span></div>
      <h3>Histórico de pagamentos</h3>
      <DataTable heads={["Data", "Valor pago", "Vendas quitadas", "Observações"]} empty="Nenhum pagamento de repasse registrado." rows={data.pagamentos.map(payment => <tr key={payment.id}>
        <td>{date(payment.data_pagamento)}</td><td>{money(payment.valor_centavos)}</td><td>{data.vendas.filter(sale => sale.pagamento_id === payment.id).map(sale => <div key={sale.id}>{name(sale.material_id)} · {qty(sale.quantidade)} un. · {date(sale.data)} · {money(sale.repasse_total_centavos)}</div>)}</td><td>{payment.observacoes || "—"}</td>
      </tr>)} />
    </section>
    <section className="panel table-panel" ref={movementsRef}>
      <div className="panel-title"><h2>Histórico de movimentações</h2><label className="consignment-search">Produto<select value={movementProduct} onChange={event => setMovementProduct(event.target.value)}><option value="">Todos os produtos</option>{report.products.map(product => <option key={product.id} value={product.id}>{product.nome}</option>)}</select></label></div>
      <DataTable heads={["Data", "Produto", "Tipo", "Quantidade", "Saldo após", "Motivo"]} empty="Nenhuma movimentação registrada." rows={movements.map(movement => <tr key={movement.id}>
        <td>{date(movement.created_at)}</td><td>{name(movement.material_id)}</td><td>{movementLabels[movement.tipo]}</td><td>{Number(movement.quantidade) > 0 ? "+" : ""}{qty(movement.quantidade)}</td><td>{qty(movement.saldo_apos)}</td><td>{movement.observacoes || "—"}</td>
      </tr>)} />
    </section>
    {modal && <ConsignmentModal {...modal} data={data} show={show} onClose={() => setModal(null)} onSaved={async () => { await reload(); await onSaved(); }} />}
  </div>;
}
