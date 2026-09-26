import CaixaSelect from "./CaixaSelect.jsx";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { formatMoney, formatNumber, today } from "../lib/formatters.js";

export default function VendaActionModal({ sale, mode, locais, vendedores, onClose, onSaved, show }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ pago: String(sale.pago === true), data_recebimento: sale.data_recebimento || today(), caixa: sale.caixa || "Rivoxel", local_id: "", preco_unitario: String(sale.preco_unitario), data: sale.data, vendedor_id: sale.vendedor_id || "", motivo: "" });
  const paymentOnly = mode === "pagamento";
  const categoryOnly = mode === "caixa";
  const returning = mode === "devolucao";
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!paymentOnly && !categoryOnly && !form.motivo.trim()) return setError("Informe o motivo da alteração.");
    const confirmation = paymentOnly ? "Confirmar pagamento como " + (form.pago === "true" ? "pago" : "pendente") + " e atualizar o caixa?" : returning
      ? "Devolver todas as " + formatNumber(sale.quantidade) + " unidades ao local selecionado e descontar " + formatMoney(Number(sale.quantidade) * Number(sale.preco_unitario)) + " do total de vendas?"
      : categoryOnly ? "Mover esta venda para a caixa " + form.caixa + "?" : "Salvar a edição e atualizar o total desta venda?";
    if (!window.confirm(confirmation)) return;
    submitting.current = true;
    setBusy(true);
    try {
      const common = { p_venda_id: sale.id, p_motivo: form.motivo.trim(), p_versao: sale.versao || 0 };
      const { error: failure } = await supabase.rpc(paymentOnly ? "alterar_pagamento_venda" : categoryOnly ? "alterar_caixa_venda" : returning ? "devolver_venda" : "editar_venda", paymentOnly
        ? { p_venda_id: sale.id, p_pago: form.pago === "true", p_data_recebimento: form.data_recebimento, p_versao: sale.versao || 0 } : categoryOnly
        ? { p_venda_id: sale.id, p_caixa: form.caixa, p_versao: sale.versao || 0 } : returning
        ? { ...common, p_local_id: form.local_id }
        : { ...common, p_caixa: form.caixa, p_preco_unitario: Number(form.preco_unitario), p_data: form.data, p_vendedor_id: form.vendedor_id || null });
      if (failure) throw failure;
      show(returning ? "Venda devolvida e estoque atualizado." : "Venda atualizada.");
      await onSaved();
      onClose();
    } catch (failure) {
      setError(failure.message || "Não foi possível concluir a operação.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="modal-card registration-dialog" aria-labelledby="sale-action-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form className="panel form" onSubmit={submit} aria-busy={busy}>
      <div className="modal-heading"><h2 id="sale-action-title">{paymentOnly ? "Status do pagamento" : categoryOnly ? "Alterar caixa da venda" : returning ? "Retornar venda ao estoque" : "Editar venda"}</h2><button type="button" className="close-modal" aria-label="Fechar" disabled={busy} onClick={onClose}>×</button></div>
      <p><strong>{sale.materiais?.nome}</strong> · {formatNumber(sale.quantidade)} un.</p>
      <fieldset disabled={busy}>
        {paymentOnly && form.pago === "true" && <label>Data do recebimento<input type="date" name="data_recebimento" value={form.data_recebimento} min={sale.data} max={today()} onChange={update} required /></label>}
        {paymentOnly ? <label>Status do pagamento<select name="pago" value={form.pago} onChange={update}><option value="false">Pendente</option><option value="true">Pago</option></select><small>Marcar Pendente corrige um recebimento lançado por engano. Para devolver dinheiro ao cliente, use Caixa e extrato.</small></label> : categoryOnly ? <CaixaSelect value={form.caixa} onChange={update} /> : returning ? <>
          <label>Retornar para<select name="local_id" value={form.local_id} onChange={update} required autoFocus><option value="">Selecione o estoque de destino</option>{locais.filter(item => item.ativo !== false).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <p>A devolução é integral. A venda permanecerá no histórico como devolvida e deixará de somar nos totais e no repasse pendente.</p>
          {sale.pedido_id && <p>O pedido e seus pagamentos permanecem no histórico. Esta ação não realiza reembolso ao cliente.</p>}
        </> : <>
          <CaixaSelect value={form.caixa} onChange={update} />
          <label>Preço por produto (R$)<input autoFocus name="preco_unitario" type="number" min="0" max="10000000" step="0.01" required value={form.preco_unitario} onChange={update} /></label>
          <label>Data da venda<input name="data" type="date" max={today()} required value={form.data} onChange={update} /></label>
          <label>Vendedor<select name="vendedor_id" value={form.vendedor_id} onChange={update}><option value="">Não informado</option>{vendedores.filter(item => item.ativo !== false || item.id === sale.vendedor_id).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <p>Produto, quantidade e local de saída permanecem os mesmos. O repasse por unidade mantém o acordo registrado na venda.</p>
          <p>Novo total: <strong>{formatMoney(Number(form.preco_unitario) * Number(sale.quantidade))}</strong></p>
        </>}
        {!paymentOnly && !categoryOnly && <label>Motivo<textarea name="motivo" required maxLength={2000} value={form.motivo} onChange={update} /></label>}
      </fieldset>
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="actions"><button className="primary" disabled={busy}>{busy ? "Salvando…" : returning ? "Confirmar devolução" : "Salvar alterações"}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div>
    </form>
  </dialog>;
}
