/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase.js";
import Header from "../Header.jsx";
import DataTable from "../DataTable.jsx";
import Empty from "../Empty.jsx";
import {
  centsToInput,
  currentMonthKey,
  formatBRLCents,
  installmentStatus,
  monthKey,
  monthLabel,
  reaisToCents,
  settlementSuggestion,
  shiftMonth,
  splitAmount,
  summarizeInstallments,
} from "../../lib/financeiro.js";

const pageTitles = {
  financeiro: ["Financeiro", "Visão geral da saúde financeira da RAVA."],
  financeiroContas: ["Contas a pagar", "Veja quanto a RAVA e cada sócio precisam pagar no mês."],
  financeiroDespesas: ["Compras e despesas", "Cadastre compras à vista ou parceladas sem misturar com entradas de estoque."],
  financeiroParcelas: ["Parcelas", "Consulte vencimentos e registre quem realizou cada pagamento."],
  financeiroFaturas: ["Faturas", "Parcelas de crédito agrupadas automaticamente por cartão e mês."],
  financeiroCartoes: ["Cartões", "Cadastre somente os dados necessários para organizar as faturas."],
  financeiroCategorias: ["Categorias", "Organize as despesas em categorias ativas e reutilizáveis."],
};

const paymentLabels = {
  pix: "Pix", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito",
  boleto: "Boleto", transferencia: "Transferência", outro: "Outro",
};

const statusLabels = { pago: "Pago", pendente: "Pendente", vencido: "Vencido" };
const dateBR = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const today = () => new Date().toISOString().slice(0, 10);

function payerLabel(item) {
  if (!item.pago) return "—";
  if (item.financeiro_pagamentos_parcela?.length) {
    return item.financeiro_pagamentos_parcela.map((payment) => {
      const name = payment.pago_por_tipo === "socio"
        ? payment.financeiro_socios?.nome || "Sócio"
        : payment.pago_por_tipo === "caixa"
          ? "Caixa da RAVA"
          : payment.observacao || "Outro";
      return `${name}: ${formatBRLCents(payment.valor_centavos)}`;
    }).join(" · ");
  }
  if (item.pago_por_tipo === "caixa") return "Caixa da RAVA";
  if (item.pago_por_tipo === "outro") return item.pago_por_observacao || "Outro";
  return item.financeiro_socios?.nome || "Sócio";
}

function paymentDatesLabel(item) {
  const dates = [...new Set(
    (item.financeiro_pagamentos_parcela || []).map((payment) => payment.data_pagamento),
  )];
  return dates.length ? dates.map(dateBR).join(" · ") : dateBR(item.data_pagamento);
}

function matchesPayer(item, payer) {
  if (!payer) return true;
  const payments = item.financeiro_pagamentos_parcela;
  if (payments?.length) {
    return payments.some((payment) => (
      payer === "caixa"
        ? payment.pago_por_tipo === "caixa"
        : payer === "outro"
          ? payment.pago_por_tipo === "outro"
          : payment.socio_id === payer
    ));
  }
  return payer === "caixa"
    ? item.pago_por_tipo === "caixa"
    : payer === "outro"
      ? item.pago_por_tipo === "outro"
      : item.pago_por_socio_id === payer;
}

function SplitValues({ total, socios, compact = false }) {
  const split = splitAmount(total, socios);
  return (
    <div className={compact ? "finance-split compact" : "finance-split"}>
      <div><span>Total</span><strong>{formatBRLCents(total)}</strong></div>
      {split.map((partner) => (
        <div key={partner.id}>
          <span>{partner.nome} — {(partner.percentual_bp / 100).toLocaleString("pt-BR")}%</span>
          <strong>{formatBRLCents(partner.valor_centavos)}</strong>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, tone, note }) {
  return (
    <section className={`metric finance-metric ${tone || ""}`}>
      <span>{label}</span><strong>{formatBRLCents(value)}</strong>{note && <small>{note}</small>}
    </section>
  );
}

function MonthPicker({ value, onChange }) {
  const [year, month] = value.split("-");
  return (
    <div className="month-picker" aria-label="Selecionar mês">
      <button type="button" onClick={() => onChange(shiftMonth(value, -1))}>← {monthLabel(shiftMonth(value, -1)).split(" de ")[0]}</button>
      <div>
        <select value={month} onChange={(event) => onChange(`${year}-${event.target.value}`)}>
          {Array.from({ length: 12 }, (_, index) => {
            const number = String(index + 1).padStart(2, "0");
            return <option key={number} value={number}>{monthLabel(`2026-${number}`).split(" de ")[0]}</option>;
          })}
        </select>
        <input aria-label="Ano" type="number" min="2000" max="2200" value={year} onChange={(event) => onChange(`${event.target.value}-${month}`)} />
      </div>
      <button type="button" onClick={() => onChange(shiftMonth(value, 1))}>{monthLabel(shiftMonth(value, 1)).split(" de ")[0]} →</button>
    </div>
  );
}

function PartnerSummary({ summary }) {
  const settlement = settlementSuggestion(summary);
  return (
    <section className="panel finance-partners">
      <div className="panel-title"><h2>Resumo dos sócios</h2><span>Responsabilidade × pagamento</span></div>
      <div className="partner-grid">
        {summary.responsibilities.map((partner) => {
          const paid = summary.paidByPartner[partner.id] || 0;
          const balance = paid - partner.valor_centavos;
          return (
            <article key={partner.id}>
              <h3>{partner.nome}</h3>
              <dl>
                <div><dt>Deveria pagar</dt><dd>{formatBRLCents(partner.valor_centavos)}</dd></div>
                <div><dt>Pagou</dt><dd>{formatBRLCents(paid)}</dd></div>
                <div className={balance >= 0 ? "positive" : "negative"}>
                  <dt>{balance >= 0 ? "Crédito" : "Falta"}</dt><dd>{balance > 0 ? "+" : ""}{formatBRLCents(balance)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      {settlement && (
        <div className="settlement"><strong>Acerto sugerido</strong><span>{settlement.debtor.nome} deve {formatBRLCents(settlement.amount)} para {settlement.creditor.nome}.</span><small>Nenhum pagamento é criado automaticamente.</small></div>
      )}
    </section>
  );
}

function AccountsTable({ items, onPay }) {
  return (
    <DataTable
      heads={["Vencimento", "Despesa", "Loja", "Parcela", "Cartão", "Valor", "Pago por", "Status", "Ações"]}
      rows={items.map((item) => {
        const status = installmentStatus(item);
        const expense = item.financeiro_despesas || {};
        return (
          <tr key={item.id}>
            <td>{dateBR(item.vencimento)}</td><td><strong>{expense.nome}</strong></td>
            <td>{expense.fornecedor || "—"}</td><td>{item.numero}/{item.total_parcelas}</td>
            <td>{expense.financeiro_cartoes?.nome || "—"}</td><td>{formatBRLCents(item.valor_centavos)}</td>
            <td>{payerLabel(item)}</td><td><span className={`status finance-${status}`}>{statusLabels[status]}</span></td>
            <td><button className="link" type="button" onClick={() => onPay([item.id], item.pago)}>{item.pago ? "Desfazer baixa" : "Marcar como paga"}</button></td>
          </tr>
        );
      })}
      empty="Nenhuma conta encontrada para este período."
    />
  );
}

function Overview({ data, socios, onNavigate }) {
  const current = currentMonthKey();
  const summary = summarizeInstallments(data.parcelas, socios, current);
  const next = summarizeInstallments(data.parcelas, socios, shiftMonth(current, 1));
  const purchased = data.despesas.reduce((sum, item) => sum + Number(item.valor_total_centavos), 0);
  const paid = data.parcelas.filter((item) => item.pago).reduce((sum, item) => sum + Number(item.valor_centavos), 0);
  const overdue = data.parcelas.filter((item) => installmentStatus(item) === "vencido").reduce((sum, item) => sum + Number(item.valor_centavos), 0);
  return (
    <>
      <div className="metrics finance-metrics five">
        <MetricCard label="Total comprado" value={purchased} />
        <MetricCard label="Total pago" value={paid} tone="success" />
        <MetricCard label="Total pendente" value={purchased - paid} />
        <MetricCard label="Total vencido" value={overdue} tone="danger" />
        <MetricCard label="Contas deste mês" value={summary.total} note={monthLabel(current)} />
      </div>
      <div className="two-columns finance-highlight-grid">
        <section className="panel finance-highlight">
          <div className="panel-title"><h2>Total do mês</h2><button className="link" onClick={() => onNavigate("financeiroContas")}>Ver contas</button></div>
          <SplitValues total={summary.total} socios={socios} />
          <div className="finance-paid-line"><span>Já pago</span><strong>{formatBRLCents(summary.paid)}</strong><span>Ainda a pagar</span><strong>{formatBRLCents(summary.pending)}</strong></div>
        </section>
        <section className="panel finance-highlight">
          <div className="panel-title"><h2>Próximo mês</h2><span>{monthLabel(shiftMonth(current, 1))}</span></div>
          <SplitValues total={next.total} socios={socios} />
          <div className="finance-paid-line"><span>Previsto</span><strong>{formatBRLCents(next.total)}</strong></div>
        </section>
      </div>
      <PartnerSummary summary={summary} />
    </>
  );
}

function Accounts({ data, socios, onPay, onNavigate }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const summary = useMemo(() => summarizeInstallments(data.parcelas, socios, selectedMonth), [data.parcelas, socios, selectedMonth]);
  const projections = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(selectedMonth, index);
    return { key, summary: summarizeInstallments(data.parcelas, socios, key) };
  });
  return (
    <>
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      <div className="metrics finance-metrics six">
        <MetricCard label="Total a pagar" value={summary.total} />
        {summary.responsibilities.map((partner) => <MetricCard key={partner.id} label={`${partner.nome} — ${partner.percentual_bp / 100}%`} value={partner.valor_centavos} />)}
        <MetricCard label="Já pago" value={summary.paid} tone="success" />
        <MetricCard label="Ainda falta pagar" value={summary.pending} />
        <MetricCard label="Vencido" value={summary.overdue} tone="danger" />
      </div>
      <PartnerSummary summary={summary} />
      <section className="panel table-panel">
        <div className="panel-title"><h2>Contas de {monthLabel(selectedMonth)}</h2><span>{summary.items.length} parcela(s)</span></div>
        <AccountsTable items={[...summary.items].sort((a, b) => a.vencimento.localeCompare(b.vencimento))} onPay={onPay} />
        <div className="table-summary"><SplitValues total={summary.total} socios={socios} compact /><div><span>Pago</span><strong>{formatBRLCents(summary.paid)}</strong><span>Pendente</span><strong>{formatBRLCents(summary.pending)}</strong></div></div>
      </section>
      <section className="panel table-panel">
        <h2>Próximos meses</h2>
        <DataTable heads={["Mês", "Total", ...socios.map((partner) => partner.nome), ""]} rows={projections.map(({ key, summary: row }) => (
          <tr key={key}><td><strong>{monthLabel(key)}</strong></td><td>{formatBRLCents(row.total)}</td>{row.responsibilities.map((partner) => <td key={partner.id}>{formatBRLCents(partner.valor_centavos)}</td>)}<td><button className="link" onClick={() => { setSelectedMonth(key); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Abrir detalhes</button></td></tr>
        ))} empty="Sem previsão." />
      </section>
      {!data.despesas.length && <section className="panel finance-empty-cta"><Empty text="Cadastre a primeira compra para preencher este painel." /><button className="primary" onClick={() => onNavigate("financeiroDespesas")}>Cadastrar compra</button></section>}
    </>
  );
}

const emptyExpense = {
  nome: "", categoria_id: "", descricao: "", numero_compra: "", data_compra: today(),
  fornecedor: "", valor: "", forma_pagamento: "pix", cartao_id: "",
  quantidade_parcelas: "1", primeiro_vencimento: today(), observacoes: "",
};

function Expenses({ data, socios, onReload, show }) {
  const [form, setForm] = useState(emptyExpense);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const totalCents = reaisToCents(form.valor);
  const filtered = data.despesas.filter((item) => {
    const query = search.toLocaleLowerCase("pt-BR");
    return (!query || `${item.nome} ${item.fornecedor || ""}`.toLocaleLowerCase("pt-BR").includes(query)) && (!category || item.categoria_id === category);
  });
  function edit(item) {
    setEditingId(item.id);
    setForm({
      nome: item.nome || "", categoria_id: item.categoria_id || "", descricao: item.descricao || "",
      numero_compra: item.numero_compra || "", data_compra: item.data_compra,
      fornecedor: item.fornecedor || "", valor: centsToInput(item.valor_total_centavos),
      forma_pagamento: item.forma_pagamento, cartao_id: item.cartao_id || "",
      quantidade_parcelas: String(item.quantidade_parcelas), primeiro_vencimento: item.primeiro_vencimento,
      observacoes: item.observacoes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reset() { setEditingId(null); setForm(emptyExpense); }
  async function save(event) {
    event.preventDefault();
    if (totalCents <= 0) return show("Informe um valor total válido.", "error");
    const quantity = form.forma_pagamento === "credito" ? Number(form.quantidade_parcelas) : 1;
    const payload = { ...form, valor_total_centavos: totalCents, quantidade_parcelas: quantity, cartao_id: form.forma_pagamento === "credito" ? form.cartao_id : null };
    delete payload.valor;
    const { error } = await supabase.rpc("salvar_despesa_financeira", { p_despesa_id: editingId, p_despesa: payload });
    if (error) return show(error.message, "error");
    show(editingId ? "Compra atualizada e parcelas recalculadas." : "Compra cadastrada e parcelas geradas.");
    reset(); onReload();
  }
  async function remove(item) {
    if (!window.confirm(`Excluir “${item.nome}” e todas as suas parcelas?`)) return;
    const { error } = await supabase.from("financeiro_despesas").delete().eq("id", item.id);
    if (error) return show(error.message, "error");
    show("Compra excluída."); if (editingId === item.id) reset(); onReload();
  }
  return (
    <>
      <div className="finance-expense-layout">
        <form className="panel form finance-expense-form" onSubmit={save}>
          <div className="panel-title"><h2>{editingId ? "Editar compra" : "Nova compra"}</h2>{editingId && <button type="button" className="link" onClick={reset}>Cancelar edição</button>}</div>
          <div className="form-grid"><label>Nome da compra<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></label><label>Categoria<select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}><option value="">Sem categoria</option>{data.categorias.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label></div>
          <label>Descrição<input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
          <div className="form-grid"><label>ID / número da compra<input value={form.numero_compra} onChange={(e) => setForm({ ...form, numero_compra: e.target.value })} /></label><label>Data da compra<input type="date" value={form.data_compra} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} required /></label></div>
          <div className="form-grid"><label>Loja / fornecedor<input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></label><label>Valor total (R$)<input inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></label></div>
          <div className="form-grid"><label>Forma de pagamento<select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value, quantidade_parcelas: e.target.value === "credito" ? form.quantidade_parcelas : "1", cartao_id: e.target.value === "credito" ? form.cartao_id : "" })}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Primeiro vencimento<input type="date" value={form.primeiro_vencimento} onChange={(e) => setForm({ ...form, primeiro_vencimento: e.target.value })} required /></label></div>
          {form.forma_pagamento === "credito" && <div className="form-grid"><label>Cartão<select value={form.cartao_id} onChange={(e) => setForm({ ...form, cartao_id: e.target.value })} required><option value="">Selecione</option>{data.cartoes.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Número de parcelas<input type="number" min="1" max="240" value={form.quantidade_parcelas} onChange={(e) => setForm({ ...form, quantidade_parcelas: e.target.value })} required /></label></div>}
          <label>Observações<textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></label>
          {totalCents > 0 && <SplitValues total={totalCents} socios={socios} compact />}
          <button className="primary">{editingId ? "Salvar alterações" : "Cadastrar e gerar parcelas"}</button>
        </form>
        <aside className="panel finance-form-aside"><span className="eyebrow">Prévia</span><h2>{form.quantidade_parcelas || 1} parcela(s)</h2><p>A soma das parcelas sempre será exatamente igual ao valor total, inclusive quando houver diferença de um centavo.</p><strong>{formatBRLCents(totalCents)}</strong></aside>
      </div>
      <section className="panel table-panel">
        <div className="panel-title finance-list-title"><h2>Compras cadastradas</h2><div className="finance-filters"><input placeholder="Pesquisar compra ou loja" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas as categorias</option>{data.categorias.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div></div>
        <DataTable heads={["Data", "Compra", "Loja", "Categoria", "Pagamento", "Parcelas", "Total", "Status", "Ações"]} rows={filtered.map((item) => {
          const installments = data.parcelas.filter((row) => row.despesa_id === item.id);
          const paid = installments.filter((row) => row.pago).length;
          const status = paid === installments.length && installments.length ? "Paga" : paid ? "Parcialmente paga" : installments.some((row) => installmentStatus(row) === "vencido") ? "Vencida" : "Pendente";
          return <tr key={item.id}><td>{dateBR(item.data_compra)}</td><td><strong>{item.nome}</strong>{item.numero_compra && <small>#{item.numero_compra}</small>}</td><td>{item.fornecedor || "—"}</td><td>{item.financeiro_categorias?.nome || "—"}</td><td>{paymentLabels[item.forma_pagamento]}</td><td>{paid}/{item.quantidade_parcelas}</td><td>{formatBRLCents(item.valor_total_centavos)}</td><td>{status}</td><td><div className="row-actions"><button onClick={() => edit(item)}>Editar</button><button className="danger-text" onClick={() => remove(item)}>Excluir</button></div></td></tr>;
        })} empty="Nenhuma compra cadastrada." />
      </section>
    </>
  );
}

function PaymentModal({ installments, socios, onClose, onSaved, show }) {
  const singleInstallment = installments.length === 1;
  const total = installments.reduce((sum, item) => sum + Number(item.valor_centavos), 0);
  const [payer, setPayer] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [note, setNote] = useState("");
  const [partnerAmounts, setPartnerAmounts] = useState(() => Object.fromEntries(
    (singleInstallment ? splitAmount(total, socios) : []).map((partner) => [
      partner.id,
      centsToInput(partner.valor_centavos),
    ]),
  ));
  const [cashAmount, setCashAmount] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const partnerTotal = socios.reduce(
    (sum, partner) => sum + reaisToCents(partnerAmounts[partner.id]),
    0,
  );
  const allocated = partnerTotal + reaisToCents(cashAmount) + reaisToCents(otherAmount);

  async function save(event) {
    event.preventDefault();
    let requests;
    if (singleInstallment) {
      if (allocated !== total) {
        return show("A soma dos pagamentos deve ser " + formatBRLCents(total) + ".", "error");
      }
      if (reaisToCents(otherAmount) > 0 && !note.trim()) {
        return show("Informe quem realizou o pagamento classificado como Outro.", "error");
      }
      const payments = [
        ...socios.map((partner) => ({
          valor_centavos: reaisToCents(partnerAmounts[partner.id]),
          data_pagamento: paymentDate,
          pago_por_tipo: "socio",
          socio_id: partner.id,
          observacao: null,
        })),
        {
          valor_centavos: reaisToCents(cashAmount),
          data_pagamento: paymentDate,
          pago_por_tipo: "caixa",
          socio_id: null,
          observacao: null,
        },
        {
          valor_centavos: reaisToCents(otherAmount),
          data_pagamento: paymentDate,
          pago_por_tipo: "outro",
          socio_id: null,
          observacao: note || null,
        },
      ].filter((payment) => payment.valor_centavos > 0);
      requests = [supabase.rpc("salvar_pagamentos_parcela", {
        p_parcela_id: installments[0].id,
        p_pagamentos: payments,
      })];
    } else {
      const partner = socios.find((item) => item.id === payer);
      const type = partner ? "socio" : payer;
      if (!type) return show("Informe quem realizou o pagamento.", "error");
      if (type === "outro" && !note.trim()) {
        return show("Informe quem realizou o pagamento.", "error");
      }
      requests = installments.map((item) => supabase.rpc("salvar_pagamentos_parcela", {
        p_parcela_id: item.id,
        p_pagamentos: [{
          valor_centavos: Number(item.valor_centavos),
          data_pagamento: paymentDate,
          pago_por_tipo: type,
          socio_id: partner?.id || null,
          observacao: note || null,
        }],
      }));
    }
    const results = await Promise.all(requests);
    const error = results.find((result) => result.error)?.error;
    if (error) return show(error.message, "error");
    show(installments.length + " parcela(s) marcada(s) como paga(s)."); onSaved();
  }
  return (
    <div className="modal-backdrop">
      <form className="panel form modal-card finance-payment-modal" onSubmit={save}>
        <div className="modal-heading">
          <div><h2>Registrar pagamento</h2><p>{installments.length} parcela(s) · {formatBRLCents(total)}</p></div>
          <button type="button" className="close-modal" onClick={onClose}>×</button>
        </div>
        <label>Data do pagamento<input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></label>
        {singleInstallment ? (
          <>
            <div className="payment-allocation-heading">
              <strong>Individualizar pagamento</strong>
              <span>Informe quanto cada origem pagou.</span>
            </div>
            <div className="payment-allocation-list">
              {socios.map((partner) => (
                <label key={partner.id}>{partner.nome}<input inputMode="decimal" value={partnerAmounts[partner.id] || ""} onChange={(e) => setPartnerAmounts({ ...partnerAmounts, [partner.id]: e.target.value })} /></label>
              ))}
              <label>Caixa da RAVA<input inputMode="decimal" placeholder="0,00" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} /></label>
              <label>Outro<input inputMode="decimal" placeholder="0,00" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} /></label>
            </div>
            {reaisToCents(otherAmount) > 0 && <label>Quem pagou / observação<input value={note} onChange={(e) => setNote(e.target.value)} required /></label>}
            <div className={allocated === total ? "payment-allocation-total complete" : "payment-allocation-total"}>
              <span>Informado</span><strong>{formatBRLCents(allocated)}</strong>
              <span>{allocated === total ? "Valor conferido" : "Falta " + formatBRLCents(total - allocated)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="payment-bulk-note">Na baixa em lote, todas as parcelas são atribuídas ao mesmo pagador. Para dividir entre os sócios, faça a baixa individual.</div>
            <label>Pago por<select value={payer} onChange={(e) => setPayer(e.target.value)} required><option value="">Selecione</option>{socios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}<option value="caixa">Caixa da RAVA</option><option value="outro">Outro</option></select></label>
            {payer === "outro" && <label>Quem pagou / observação<input value={note} onChange={(e) => setNote(e.target.value)} required /></label>}
          </>
        )}
        <div className="actions"><button className="primary">Confirmar pagamento</button><button type="button" onClick={onClose}>Cancelar</button></div>
      </form>
    </div>
  );
}

function Installments({ data, onPay }) {
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [card, setCard] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [payer, setPayer] = useState("");
  const [selected, setSelected] = useState([]);
  const suppliers = [...new Set(data.despesas.map((item) => item.fornecedor).filter(Boolean))].sort();
  const filtered = data.parcelas.filter((item) => {
    const expense = item.financeiro_despesas || {};
    const itemStatus = installmentStatus(item);
    return (!month || monthKey(item.vencimento) === month) && (!status || itemStatus === status)
      && (!card || expense.cartao_id === card) && (!category || expense.categoria_id === category)
      && (!supplier || expense.fornecedor === supplier)
      && matchesPayer(item, payer);
  });
  const unpaidSelected = selected.filter((id) => !data.parcelas.find((item) => item.id === id)?.pago);
  return (
    <section className="panel table-panel">
      <div className="finance-filter-grid"><label>Mês e ano<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="vencido">Vencido</option></select></label><label>Cartão<select value={card} onChange={(e) => setCard(e.target.value)}><option value="">Todos</option>{data.cartoes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Categoria<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{data.categorias.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Loja / fornecedor<select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">Todos</option>{suppliers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Pago por<select value={payer} onChange={(e) => setPayer(e.target.value)}><option value="">Todos</option>{data.socios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}<option value="caixa">Caixa da RAVA</option><option value="outro">Outro</option></select></label></div>
      <div className="selection-bar"><span>{selected.length} selecionada(s)</span><button className="primary" disabled={!unpaidSelected.length} onClick={() => onPay(unpaidSelected)}>Marcar selecionadas como pagas</button><button onClick={() => setSelected([])}>Limpar</button></div>
      <DataTable heads={["", "Vencimento", "Compra", "Loja", "Parcela", "Cartão", "Valor", "Pago por", "Pagamento", "Status", "Ações"]} rows={filtered.map((item) => { const expense = item.financeiro_despesas || {}; const itemStatus = installmentStatus(item); return <tr key={item.id}><td><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} aria-label={`Selecionar ${expense.nome}`} /></td><td>{dateBR(item.vencimento)}</td><td><strong>{expense.nome}</strong></td><td>{expense.fornecedor || "—"}</td><td>{item.numero}/{item.total_parcelas}</td><td>{expense.financeiro_cartoes?.nome || "—"}</td><td>{formatBRLCents(item.valor_centavos)}</td><td>{payerLabel(item)}</td><td>{paymentDatesLabel(item)}</td><td><span className={`status finance-${itemStatus}`}>{statusLabels[itemStatus]}</span></td><td><button className="link" onClick={() => onPay([item.id], item.pago)}>{item.pago ? "Desfazer" : "Pagar"}</button></td></tr>; })} empty="Nenhuma parcela encontrada." />
    </section>
  );
}

function Invoices({ data, socios }) {
  const [month, setMonth] = useState(currentMonthKey);
  const groups = data.parcelas.filter((item) => item.financeiro_despesas?.cartao_id && monthKey(item.vencimento) === month).reduce((result, item) => {
    const card = item.financeiro_despesas.financeiro_cartoes;
    const key = card?.nome || "Cartão removido";
    (result[key] ||= []).push(item); return result;
  }, {});
  return (
    <><MonthPicker value={month} onChange={setMonth} /><div className="invoice-grid">{Object.entries(groups).map(([card, items]) => { const total = items.reduce((sum, item) => sum + Number(item.valor_centavos), 0); const paid = items.filter((item) => item.pago).reduce((sum, item) => sum + Number(item.valor_centavos), 0); return <section className="panel invoice-card" key={card}><div className="panel-title"><div><span className="eyebrow">Fatura</span><h2>{card} — {monthLabel(month)}</h2></div><span className={`status ${paid === total ? "finance-pago" : "finance-pendente"}`}>{paid === total ? "Paga" : paid ? "Parcial" : "Pendente"}</span></div><div className="invoice-lines">{items.map((item) => <div key={item.id}><span>{item.financeiro_despesas.nome} — {item.numero}/{item.total_parcelas}</span><strong>{formatBRLCents(item.valor_centavos)}</strong></div>)}</div><SplitValues total={total} socios={socios} compact /><div className="finance-paid-line"><span>Total pago</span><strong>{formatBRLCents(paid)}</strong><span>Total pendente</span><strong>{formatBRLCents(total - paid)}</strong></div></section>; })}{!Object.keys(groups).length && <section className="panel"><Empty text="Nenhuma fatura encontrada neste mês." /></section>}</div></>
  );
}

function Cards({ data, onReload, show }) {
  const blank = { nome: "", banco: "", ultimos_quatro: "", dia_fechamento: "", dia_vencimento: "", ativo: true };
  const [form, setForm] = useState(blank); const [editing, setEditing] = useState(null);
  function edit(item) { setEditing(item.id); setForm({ nome: item.nome, banco: item.banco || "", ultimos_quatro: item.ultimos_quatro || "", dia_fechamento: item.dia_fechamento || "", dia_vencimento: item.dia_vencimento, ativo: item.ativo }); }
  async function save(e) { e.preventDefault(); const payload = { ...form, ultimos_quatro: form.ultimos_quatro || null, dia_fechamento: Number(form.dia_fechamento) || null, dia_vencimento: Number(form.dia_vencimento) }; const request = editing ? supabase.from("financeiro_cartoes").update(payload).eq("id", editing) : supabase.from("financeiro_cartoes").insert(payload); const { error } = await request; if (error) return show(error.message, "error"); show(editing ? "Cartão atualizado." : "Cartão cadastrado."); setEditing(null); setForm(blank); onReload(); }
  return <div className="split"><form className="panel form" onSubmit={save}><div className="panel-title"><h2>{editing ? "Editar cartão" : "Novo cartão"}</h2>{editing && <button className="link" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancelar</button>}</div><label>Nome<input placeholder="Ex.: Nubank Richard" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></label><label>Banco<input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></label><label>Últimos 4 dígitos<input inputMode="numeric" pattern="\d{4}" maxLength="4" value={form.ultimos_quatro} onChange={(e) => setForm({ ...form, ultimos_quatro: e.target.value.replace(/\D/g, "") })} /></label><div className="form-grid"><label>Dia de fechamento<input type="number" min="1" max="31" value={form.dia_fechamento} onChange={(e) => setForm({ ...form, dia_fechamento: e.target.value })} /></label><label>Dia de vencimento<input type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} required /></label></div><label className="checkbox-line"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Cartão ativo</label><button className="primary">{editing ? "Salvar alterações" : "Cadastrar cartão"}</button><p className="security-note">Nunca armazene número completo, CVV ou senha.</p></form><section className="panel"><h2>Cartões cadastrados</h2><div className="finance-card-list">{data.cartoes.map((item) => <article key={item.id}><div><strong>{item.nome}</strong><span>{item.banco || "Banco não informado"}{item.ultimos_quatro ? ` · final ${item.ultimos_quatro}` : ""}</span><small>Fecha dia {item.dia_fechamento || "—"} · vence dia {item.dia_vencimento}</small></div><span className={`status ${item.ativo ? "finance-pago" : ""}`}>{item.ativo ? "Ativo" : "Inativo"}</span><button className="link" onClick={() => edit(item)}>Editar</button></article>)}{!data.cartoes.length && <Empty text="Nenhum cartão cadastrado." />}</div></section></div>;
}

function Categories({ data, onReload, show }) {
  const [name, setName] = useState(""); const [editing, setEditing] = useState(null);
  async function save(e) { e.preventDefault(); const request = editing ? supabase.from("financeiro_categorias").update({ nome: name }).eq("id", editing) : supabase.from("financeiro_categorias").insert({ nome: name }); const { error } = await request; if (error) return show(error.message, "error"); show(editing ? "Categoria atualizada." : "Categoria cadastrada."); setName(""); setEditing(null); onReload(); }
  async function toggle(item) { const { error } = await supabase.from("financeiro_categorias").update({ ativo: !item.ativo }).eq("id", item.id); if (error) return show(error.message, "error"); show(`Categoria ${item.ativo ? "desativada" : "ativada"}.`); onReload(); }
  return <div className="split"><form className="panel form" onSubmit={save}><h2>{editing ? "Editar categoria" : "Nova categoria"}</h2><label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required /></label><div className="actions"><button className="primary">{editing ? "Salvar" : "Cadastrar"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName(""); }}>Cancelar</button>}</div></form><section className="panel"><h2>Categorias</h2><div className="finance-category-list">{data.categorias.map((item) => <div key={item.id}><span><strong>{item.nome}</strong><small>{item.ativo ? "Disponível nos formulários" : "Desativada"}</small></span><button className="link" onClick={() => { setEditing(item.id); setName(item.nome); }}>Editar</button><button className={item.ativo ? "danger-text" : "link"} onClick={() => toggle(item)}>{item.ativo ? "Desativar" : "Ativar"}</button></div>)}</div></section></div>;
}

export default function FinanceiroModule({ page, onNavigate, show }) {
  const [data, setData] = useState({ socios: [], categorias: [], cartoes: [], despesas: [], parcelas: [] });
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    const [socios, categorias, cartoes, despesas, parcelas] = await Promise.all([
      supabase.from("financeiro_socios").select("*").eq("ativo", true).order("created_at"),
      supabase.from("financeiro_categorias").select("*").order("nome"),
      supabase.from("financeiro_cartoes").select("*").order("nome"),
      supabase.from("financeiro_despesas").select("*, financeiro_categorias(nome), financeiro_cartoes(nome)").order("data_compra", { ascending: false }),
      supabase.from("financeiro_parcelas").select("*, financeiro_despesas(nome, fornecedor, categoria_id, cartao_id, financeiro_categorias(nome), financeiro_cartoes(nome)), financeiro_socios(nome), financeiro_pagamentos_parcela(*, financeiro_socios(nome))").order("vencimento"),
    ]);
    const error = [socios, categorias, cartoes, despesas, parcelas].find((result) => result.error)?.error;
    if (error) show(error.message.includes("financeiro_") ? "A migration do módulo Financeiro ainda não foi aplicada no Supabase." : error.message, "error");
    else setData({ socios: socios.data || [], categorias: categorias.data || [], cartoes: cartoes.data || [], despesas: despesas.data || [], parcelas: parcelas.data || [] });
    setLoading(false);
  }, [show]);
  useEffect(() => { load(); }, [load]);
  const title = pageTitles[page] || pageTitles.financeiro;
  async function handlePay(ids, isPaid = false) {
    if (!isPaid) return setPayment(ids.map((id) => data.parcelas.find((item) => item.id === id)).filter(Boolean));
    if (!window.confirm("Desfazer a baixa desta parcela?")) return;
    const { error } = await supabase.rpc("excluir_pagamentos_parcela", { p_parcela_id: ids[0] });
    if (error) return show(error.message, "error"); show("Baixa desfeita."); load();
  }
  let content;
  if (loading) content = <div className="loading">Atualizando financeiro…</div>;
  else if (!data.socios.length) content = <section className="panel"><Empty text="Nenhum sócio ativo configurado. Aplique a migration do Financeiro." /></section>;
  else if (page === "financeiroContas") content = <Accounts data={data} socios={data.socios} onPay={handlePay} onNavigate={onNavigate} />;
  else if (page === "financeiroDespesas") content = <Expenses data={data} socios={data.socios} onReload={load} show={show} />;
  else if (page === "financeiroParcelas") content = <Installments data={data} onPay={handlePay} />;
  else if (page === "financeiroFaturas") content = <Invoices data={data} socios={data.socios} />;
  else if (page === "financeiroCartoes") content = <Cards data={data} onReload={load} show={show} />;
  else if (page === "financeiroCategorias") content = <Categories data={data} onReload={load} show={show} />;
  else content = <Overview data={data} socios={data.socios} onNavigate={onNavigate} />;
  return <div className="finance-page"><Header title={title[0]} subtitle={title[1]} />{content}{payment && <PaymentModal installments={payment} socios={data.socios} onClose={() => setPayment(null)} onSaved={() => { setPayment(null); load(); }} show={show} />}</div>;
}
