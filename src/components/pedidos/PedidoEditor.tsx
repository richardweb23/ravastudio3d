import type { AdminData, Show, Order, OrderItem } from "../../adminTypes";
import type { DraftItem } from "../../adminTypes";
import SearchSelect from '../SearchSelect.tsx';
import { useState } from "react";
import { requireSupabase } from "../../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber } from "../../lib/formatters.js";
import { OrderItemModal } from "../ui/OrderItemModal.tsx";
import Empty from "../Empty.tsx";

export default function PedidoEditor({
  order,
  initialItems,
  materiais,
  locais,
  vendedores,
  onClose,
  onSaved,
  show,
}: Pick<AdminData, "materiais" | "locais" | "vendedores"> & { order: Order | null; initialItems: OrderItem[]; onClose: () => void; onSaved: () => void; show: Show }) {
  const blank = {
    cliente: "",
    local_estoque_id: "",
    vendedor_id: "",
    previsao_entrega: "",
    desconto: "",
    observacao: "",
    links: [] as string[],
    caixa_padrao: "",
  };
  const [draft, setDraft] = useState(() => ({
    ...blank,
    ...(order || {}),
    links: order?.links || [],
    items: initialItems.map<DraftItem>((item) => ({ ...item, key: item.id })),
  }));
  const [itemModal, setItemModal] = useState<DraftItem | null>(null);
  const [saving, setSaving] = useState(false);
  const subtotal = draft.items.reduce(
    (sum, item) => sum + Number(item.quantidade) * Number(item.preco_unitario),
    0,
  );
  const total = Math.max(0, subtotal - Number(draft.desconto || 0));
  const update = (values: Partial<Omit<typeof draft, "desconto">> & { desconto?: number | string }) => setDraft((current) => ({ ...current, ...values }));
  const saveItem = (item: DraftItem) =>
    setDraft((current) => ({
      ...current,
      items: item.key
        ? current.items.map((entry) => (entry.key === item.key ? item : entry))
        : [...current.items, { ...item, key: `draft-${Date.now()}` }],
    }));

  async function save(event: React.FormEvent<HTMLFormElement>) {
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
      links: draft.links.map((link) => link.trim()).filter(Boolean),
    };
    const rows = draft.items.map((item) => ({
      material_id: item.material_id,
      subtitulo: item.subtitulo || null,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
      local_estoque_id: item.local_estoque_id || null,
      caixa: item.caixa || null,
    }));
    const { error } = await requireSupabase().rpc("salvar_pedido", {
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
        <section className="order-editor-section" aria-labelledby="order-customer-title">
        <h3 id="order-customer-title">Dados do pedido</h3>
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
            Local de saída padrão
            <SearchSelect
              value={draft.local_estoque_id || ""}
              onChange={(e) => update({ local_estoque_id: e.target.value })}
            >
              <option value="">Estoque principal</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </SearchSelect>
          </label>
          <label>
            Vendedor
            <SearchSelect
              value={draft.vendedor_id || ""}
              onChange={(e) => update({ vendedor_id: e.target.value })}
            >
              <option value="">Não informado</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nome}
                </option>
              ))}
            </SearchSelect>
          </label>
        </div>
        <div className="form-grid">
        <label>Caixa padrão para novos itens<SearchSelect value={draft.caixa_padrao || ""} onChange={e => update({ caixa_padrao: e.target.value })}><option value="">Definir na entrega</option><option value="Rava">Rava</option><option value="Rivoxel">Rivoxel</option><option value="Bonecos">Bonecos</option></SearchSelect></label>
        <label>
          Previsão de entrega
          <input
            type="date"
            value={draft.previsao_entrega || ""}
            onChange={(e) => update({ previsao_entrega: e.target.value })}
          />
        </label>
        </div>
        </section>
        <section className="order-editor-section" aria-labelledby="order-notes-title">
        <h3 id="order-notes-title">Observações e links</h3>
        <label>
          Observação / personalização
          <textarea
            value={draft.observacao || ""}
            onChange={(e) => update({ observacao: e.target.value })}
          />
        </label>
        <section className="order-links-editor" aria-labelledby="order-links-title">
          <div className="order-section-heading">
            <h3 id="order-links-title">Links do pedido</h3>
            <button className="order-add-button" type="button" disabled={draft.links.length >= 20} onClick={() => update({ links: [...draft.links, ""] })}><span aria-hidden="true">+</span> Adicionar link</button>
          </div>
          {draft.links.map((link, index) => <div className="order-link-row" key={index}>
            <label>Link {index + 1}
              <input type="url" placeholder="https://exemplo.com" value={link} maxLength={2048}
                pattern="https?://[^\s@/]+([/?#][^\s]*)?" title="Informe um link começando com http:// ou https://"
                onChange={event => update({ links: draft.links.map((value, position) => position === index ? event.target.value : value) })} />
            </label>
            <button type="button" className="danger-text" aria-label={`Remover link ${index + 1}`} onClick={() => update({ links: draft.links.filter((_, position) => position !== index) })}>Remover</button>
          </div>)}
        </section>
        </section>
        <section className="order-editor-section draft-items" aria-labelledby="order-items-editor-title">
          <div className="order-section-heading">
            <h3 id="order-items-editor-title">Itens <span className="order-item-count">{draft.items.length}</span></h3>
            <button
              className="order-add-button"
              type="button"
              onClick={() =>
                setItemModal({
                  material_id: "",
                  subtitulo: "",
                  quantidade: "1",
                  preco_unitario: "",
                  caixa: draft.caixa_padrao || "",
                })
              }
            >
              <span aria-hidden="true">+</span> Adicionar item
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
                <small>Estoque: {locais.find(local => local.id === (item.local_estoque_id || draft.local_estoque_id))?.nome || "Estoque principal"} · Caixa: {item.caixa || "Definir na entrega"}</small>
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
        <section className="order-editor-section order-pricing" aria-labelledby="order-pricing-title">
        <h3 id="order-pricing-title">Resumo do pedido</h3>
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
        </section>
        <div className="actions order-editor-actions">
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
          locais={locais}
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


