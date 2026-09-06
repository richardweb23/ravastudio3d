import { useState } from "react";
import { supabase } from "../../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber } from "../../lib/formatters.js";
import { OrderItemModal } from "../ui/OrderItemModal.jsx";
import Empty from "../Empty.jsx";

export default function PedidoEditor({
  order,
  initialItems,
  materiais,
  locais,
  vendedores,
  onClose,
  onSaved,
  show,
}) {
  const blank = {
    cliente: "",
    local_estoque_id: "",
    vendedor_id: "",
    previsao_entrega: "",
    desconto: "",
    observacao: "",
  };
  const [draft, setDraft] = useState(() => ({
    ...blank,
    ...(order || {}),
    items: initialItems.map((item) => ({ ...item, key: item.id })),
  }));
  const [itemModal, setItemModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const subtotal = draft.items.reduce(
    (sum, item) => sum + Number(item.quantidade) * Number(item.preco_unitario),
    0,
  );
  const total = Math.max(0, subtotal - Number(draft.desconto || 0));
  const update = (values) => setDraft((current) => ({ ...current, ...values }));
  const saveItem = (item) =>
    setDraft((current) => ({
      ...current,
      items: item.key
        ? current.items.map((entry) => (entry.key === item.key ? item : entry))
        : [...current.items, { ...item, key: `draft-${Date.now()}` }],
    }));

  async function save(event) {
    event.preventDefault();
    if (!draft.items.length)
      return show("Adicione pelo menos um produto.", "error");
    if (Number(draft.desconto || 0) > subtotal)
      return show("O desconto não pode ser maior que o subtotal.", "error");
    setSaving(true);
    const payload = {
      cliente: draft.cliente,
      local_estoque_id: draft.local_estoque_id || null,
      vendedor_id: draft.vendedor_id || null,
      previsao_entrega: draft.previsao_entrega || null,
      desconto: Number(draft.desconto || 0),
      observacao: draft.observacao || null,
    };
    const rows = draft.items.map((item) => ({
      material_id: item.material_id,
      subtitulo: item.subtitulo || null,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
    }));
    const { error } = await supabase.rpc("salvar_pedido", {
      p_pedido_id: order?.id || null,
      p_pedido: payload,
      p_itens: rows,
    });
    setSaving(false);
    if (error) return show(error.message, "error");
    show(order ? "Pedido atualizado." : "Pedido criado.");
    onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="panel form modal-card order-editor" onSubmit={save}>
        <div className="modal-heading">
          <div>
            <h2>{order ? "Editar pedido" : "Novo pedido"}</h2>
            <p>As alterações ficam no rascunho até salvar o pedido.</p>
          </div>
          <button
            type="button"
            className="close-modal"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <label>
          Cliente
          <input
            value={draft.cliente}
            onChange={(e) => update({ cliente: e.target.value })}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Local de saída
            <select
              value={draft.local_estoque_id || ""}
              onChange={(e) => update({ local_estoque_id: e.target.value })}
            >
              <option value="">Estoque principal</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vendedor
            <select
              value={draft.vendedor_id || ""}
              onChange={(e) => update({ vendedor_id: e.target.value })}
            >
              <option value="">Não informado</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Previsão de entrega
          <input
            type="date"
            value={draft.previsao_entrega || ""}
            onChange={(e) => update({ previsao_entrega: e.target.value })}
          />
        </label>
        <label>
          Observação / personalização
          <textarea
            value={draft.observacao || ""}
            onChange={(e) => update({ observacao: e.target.value })}
          />
        </label>
        <section className="draft-items">
          <div className="panel-title">
            <h3>Itens ({draft.items.length})</h3>
            <button
              type="button"
              onClick={() =>
                setItemModal({
                  material_id: "",
                  subtitulo: "",
                  quantidade: "1",
                  preco_unitario: "",
                })
              }
            >
              Adicionar item
            </button>
          </div>
          {draft.items.map((item) => (
            <div className="item-line" key={item.key}>
              <span>
                {materiais.find((product) => product.id === item.material_id)
                  ?.nome ||
                  item.materiais?.nome ||
                  "Produto"}
                {item.subtitulo ? ` — ${item.subtitulo}` : ""} ·{" "}
                {fmtNumber(item.quantidade)} × {fmtMoney(item.preco_unitario)}
              </span>
              <span>
                <button type="button" onClick={() => setItemModal(item)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() =>
                    update({
                      items: draft.items.filter(
                        (entry) => entry.key !== item.key,
                      ),
                    })
                  }
                >
                  Remover
                </button>
              </span>
            </div>
          ))}
          {!draft.items.length && <Empty text="Nenhum item adicionado." />}
        </section>
        <div className="discount-row">
          <span>
            Subtotal: <strong>{fmtMoney(subtotal)}</strong>
          </span>
          <label>
            Desconto (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.desconto || ""}
              onChange={(e) => update({ desconto: e.target.value })}
            />
          </label>
        </div>
        <div className="order-total">
          Total do pedido: <strong>{fmtMoney(total)}</strong>
        </div>
        <div className="actions">
          <button className="primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar pedido"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
      {itemModal && (
        <OrderItemModal
          item={itemModal}
          materiais={materiais}
          onClose={() => setItemModal(null)}
          onSave={(item) => {
            saveItem(item);
            setItemModal(null);
          }}
        />
      )}
    </div>
  );
}


