import CaixaSelect from "../CaixaSelect.jsx";
import { useEffect, useRef, useState } from "react";
import { consignmentAction } from "../../services/consignacao.js";
import { moneyInputCents, repasseStatus, validQuantity } from "../../lib/consignacao.js";
import { centsToInput, formatBRLCents as money } from "../../lib/financeiro.js";
import { formatNumber } from "../../lib/formatters.js";

const titles = { entrada: "Adicionar produtos", retirada: "Retirar produtos", ajuste: "Ajustar estoque", acordo: "Preço e repasse", venda: "Registrar venda", pagamento: "Registrar pagamento", vinculo: "Local de consignação do vendedor" };
function localToday() { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function preview(value, count = 1) { try { return money(moneyInputCents(value) * Number(count || 0)); } catch { return "—"; } }

export default function ConsignmentModal({ mode, product, data, onClose, onSaved, show }) {
  const [form, setForm] = useState({ caixa: "", material_id: product?.id || "", quantidade: "1", outro_local_id: "", preco: centsToInput(product?.acordo?.preco_centavos || 0), repasse: centsToInput(product?.acordo?.repasse_centavos || 0), data: localToday(), observacoes: "", local_id: "" });
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const update = event => setForm({ ...form, [event.target.name]: event.target.value });
  const available = Number(data.estoque.find(row => row.material_id === form.material_id)?.quantidade || 0);
  const pending = data.vendas.filter(sale => repasseStatus(sale) === "pendente");
  const total = pending.filter(sale => selected.includes(sale.id)).reduce((sum, sale) => sum + Number(sale.repasse_total_centavos), 0);
  const agreement = data.acordos.find(row => row.material_id === form.material_id);
  const partnerLocations = new Set(data.vendedores.filter(row => row.id !== data.entity.id).map(row => row.local_estoque_id));
  function chooseProduct(event) {
    const found = data.acordos.find(row => row.material_id === event.target.value);
    setForm({ ...form, material_id: event.target.value, preco: centsToInput(found?.preco_centavos || 0), repasse: centsToInput(found?.repasse_centavos || 0) });
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    try {
      let name, params, confirmation;
      if (mode === "vinculo") {
        name = "vincular_local_vendedor";
        params = { p_vendedor_id: data.entity.id, p_local_id: form.local_id || null };
        confirmation = "Vincular este local ao vendedor? O estoque e os acordos desse local serão usados na consignação.";
      } else if (mode === "pagamento") {
        if (!selected.length || total <= 0) throw new Error("Selecione pelo menos uma venda pendente.");
        name = "pagar_repasses_consignacao";
        params = { p_local_id: data.localId, p_vendas_ids: selected, p_data: form.data, p_observacoes: form.observacoes };
        confirmation = "Confirmar o pagamento de " + money(total) + " para " + data.entity.nome + "?";
      } else {
        if (!form.material_id) throw new Error("Selecione um produto.");
        const common = { p_local_id: data.localId, p_material_id: form.material_id };
        if (mode === "acordo") {
          name = "salvar_acordo_consignacao";
          params = { ...common, p_preco_centavos: moneyInputCents(form.preco), p_repasse_centavos: moneyInputCents(form.repasse) };
          confirmation = "Salvar o acordo para as próximas vendas? As vendas anteriores manterão seus valores.";
        } else if (mode === "venda") {
          const qty = validQuantity(form.quantidade, available);
          if (!agreement) throw new Error("Configure o preço e repasse antes de registrar a venda.");
          name = "vender_consignacao";
          params = { ...common, p_caixa: form.caixa, p_quantidade: qty, p_preco_centavos: moneyInputCents(form.preco), p_data: form.data };
          confirmation = "Registrar " + qty + " unidade(s), no total de " + money(params.p_preco_centavos * qty) + ", e baixar o estoque? Repasse: " + money(Number(agreement.repasse_centavos) * qty) + ".";
        } else {
          const qty = validQuantity(form.quantidade, mode === "entrada" ? Infinity : available, mode === "ajuste");
          if (mode !== "ajuste" && !form.outro_local_id) throw new Error("Selecione o local de origem ou destino.");
          if (mode === "ajuste" && !form.observacoes.trim()) throw new Error("Informe o motivo do ajuste.");
          name = "movimentar_consignacao";
          params = { ...common, p_tipo: mode, p_quantidade: qty, p_outro_local_id: form.outro_local_id || null, p_observacoes: form.observacoes,
            p_preco_centavos: mode === "entrada" ? moneyInputCents(form.preco) : null, p_repasse_centavos: mode === "entrada" ? moneyInputCents(form.repasse) : null };
          confirmation = mode === "retirada" ? "Devolver " + qty + " unidade(s) ao local selecionado, sem gerar venda ou repasse?" : mode === "entrada" ? "Transferir " + qty + " unidade(s) da origem selecionada para consignação?" : "Confirmar ajuste de " + (qty > 0 ? "+" : "") + qty + " unidade(s)?";
        }
      }
      if (!window.confirm(confirmation)) return;
      setBusy(true);
      await consignmentAction(name, params);
      show("Operação registrada com sucesso.");
      await onSaved();
      onClose();
    } catch (failure) { setError(failure.message || "Não foi possível registrar a operação."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="consignment-modal" aria-labelledby="consignment-modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form className="panel form" onSubmit={submit} aria-busy={busy}>
      <div className="modal-heading"><h2 id="consignment-modal-title">{titles[mode]}</h2><button type="button" className="close-modal" aria-label="Fechar" disabled={busy} onClick={onClose}>×</button></div>
      <p>{data.entity.nome}</p>
      <fieldset disabled={busy}>
        {mode === "venda" && <CaixaSelect value={form.caixa} onChange={update} />}
        {mode === "vinculo" ? <>
          <p>Escolha um local já cadastrado ou crie um local exclusivo para este vendedor. Isso evita misturar o estoque de pessoas diferentes.</p>
          <label>Local<select name="local_id" value={form.local_id} onChange={update}><option value="">Criar local exclusivo para este vendedor</option>{data.locais.filter(row => row.ativo && !partnerLocations.has(row.id)).map(row => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
        </> : mode === "pagamento" ? <>
          <p>Selecione as vendas cujo repasse está sendo quitado integralmente.</p>
          <div className="consignment-payment-options">{pending.map(sale => <label key={sale.id} className="checkbox-line"><input type="checkbox" checked={selected.includes(sale.id)} onChange={event => setSelected(event.target.checked ? [...selected, sale.id] : selected.filter(id => id !== sale.id))} /><span><strong>{data.materiais.find(row => row.id === sale.material_id)?.nome || "Produto"}</strong><small>{new Date(sale.data + "T12:00:00").toLocaleDateString("pt-BR")} · {formatNumber(sale.quantidade)} un.</small></span><b>{money(sale.repasse_total_centavos)}</b></label>)}</div>
          <div className="consignment-preview">Total selecionado <strong>{money(total)}</strong></div>
        </> : <>
          <label>Produto<select name="material_id" value={form.material_id} onChange={chooseProduct} required disabled={Boolean(product)}><option value="">Selecione um produto</option>{data.materiais.map(row => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
          <p>Disponível neste local: <strong>{formatNumber(available)} un.</strong></p>
          {mode !== "acordo" && <label>{mode === "venda" ? "Quantidade vendida" : mode === "ajuste" ? "Variação de estoque (+ entrada / − saída)" : "Quantidade"}<input type="number" step="1" min={mode === "ajuste" ? -available : 1} max={mode === "venda" || mode === "retirada" ? available : 1000000} name="quantidade" value={form.quantidade} onChange={update} required /></label>}
          {["entrada", "retirada"].includes(mode) && <label>{mode === "entrada" ? "Retirar do estoque de origem" : "Devolver ao estoque de destino"}<select name="outro_local_id" value={form.outro_local_id} onChange={update} required><option value="">Selecione o local</option>{data.locais.filter(row => row.ativo && row.id !== data.localId).map(row => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>}
          {["entrada", "acordo", "venda"].includes(mode) && <label>{mode === "venda" ? "Valor de venda por unidade (R$)" : "Preço sugerido de venda (R$)"}<input inputMode="decimal" name="preco" value={form.preco} onChange={update} required /></label>}
          {["entrada", "acordo"].includes(mode) && <label>Repasse por unidade (R$)<input inputMode="decimal" name="repasse" value={form.repasse} onChange={update} required /></label>}
          {mode === "venda" && <div className="consignment-preview"><span>Valor total da venda <strong>{preview(form.preco, form.quantidade)}</strong></span><span>Repasse desta venda <strong>{money(Number(agreement?.repasse_centavos || 0) * Number(form.quantidade || 0))}</strong></span></div>}
          {mode === "entrada" && <p>O preço e o repasse serão usados nas próximas vendas deste produto neste local. Vendas anteriores não serão alteradas.</p>}
        </>}
        {["venda", "pagamento"].includes(mode) && <label>{mode === "venda" ? "Data da venda" : "Data do pagamento"}<input type="date" name="data" value={form.data} onChange={update} max={localToday()} required /></label>}
        {!["venda", "acordo", "vinculo"].includes(mode) && <label>{mode === "ajuste" ? "Motivo do ajuste" : "Observações"}<textarea name="observacoes" value={form.observacoes} onChange={update} required={mode === "ajuste"} maxLength={2000} /></label>}
      </fieldset>
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="actions"><button className="primary" disabled={busy || (mode === "pagamento" && !selected.length)}>{busy ? "Registrando…" : "Confirmar"}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div>
    </form>
  </dialog>;
}
