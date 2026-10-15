import { useRef, useState } from "react";
import { supabase } from "../../supabase.js";
import { formatMoney, formatNumber } from "../../lib/formatters.js";

export default function CorrecaoValorPedido({ order, items, paid, onClose, onSaved, show }) {
  const [itemId, setItemId] = useState(items[0]?.id || "");
  const [price, setPrice] = useState(String(items[0]?.preco_unitario ?? ""));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const item = items.find(row => row.id === itemId);
  const total = Math.round((items.reduce((sum, row) => sum + Number(row.quantidade) * Number(row.id === itemId ? price : row.preco_unitario), 0) - Number(order.desconto || 0)) * 100) / 100;
  const invalid = price === "" || !Number.isFinite(Number(price)) || Number(price) < 0 || total < 0 || Math.round(total * 100) < Math.round(paid * 100);

  async function save(event) {
    event.preventDefault();
    if (pending.current || !item || invalid || !reason.trim()) return;
    pending.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("corrigir_valor_item_pedido", {
        p_item_id: item.id, p_preco_unitario: Number(price),
        p_preco_anterior: Number(item.preco_unitario), p_motivo: reason.trim(),
      });
      if (error) return show(error.message, "error");
      show("Valor corrigido e total do pedido atualizado.");
      onSaved();
    } catch {
      show("Não foi possível confirmar a correção. Atualize o pedido antes de tentar novamente.", "error");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <div className="modal-backdrop">
    <form className="panel form modal-card" role="dialog" aria-modal="true" aria-labelledby="correcao-valor-title" onSubmit={save}>
      <div className="modal-heading"><h2 id="correcao-valor-title">Corrigir valores</h2><button type="button" className="close-modal" disabled={saving} onClick={onClose} aria-label="Fechar">×</button></div>
      <p>{order.cliente} · Pedido entregue</p>
      <label>Item<select value={itemId} disabled={saving} onChange={event => { const selected = items.find(row => row.id === event.target.value); setItemId(selected.id); setPrice(String(selected.preco_unitario)); }}>
        {items.map(row => <option key={row.id} value={row.id}>{row.materiais?.nome || "Produto"}{row.subtitulo ? ` — ${row.subtitulo}` : ""} · {formatNumber(row.quantidade)} un. · {formatMoney(row.preco_unitario)}</option>)}
      </select></label>
      <label>Novo valor unitário<input autoFocus type="number" min="0" max="10000000" step="0.01" required value={price} disabled={saving} onChange={event => setPrice(event.target.value)} /></label>
      <p>Total atual: <strong>{formatMoney(order.valor_total)}</strong> · Novo total: <strong>{formatMoney(total)}</strong><br />Desconto mantido: {formatMoney(order.desconto)} · Já recebido: {formatMoney(paid)}</p>
      {total < paid && <p role="alert">O novo total é menor que o valor recebido. Estorne o recebimento em Financeiro antes de corrigir.</p>}
      {total < 0 && <p role="alert">O desconto não pode ser maior que o subtotal corrigido.</p>}
      <label>Motivo da correção<input required value={reason} disabled={saving} onChange={event => setReason(event.target.value)} /></label>
      <div className="actions"><button className="primary" disabled={saving || invalid || !item || !reason.trim()}>{saving ? "Salvando…" : "Salvar correção"}</button><button type="button" disabled={saving} onClick={onClose}>Cancelar</button></div>
    </form>
  </div>;
}
