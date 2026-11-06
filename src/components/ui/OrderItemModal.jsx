import ProductSearchSelect from "../ProductSearchSelect.tsx";
import { useState } from "react";
import SearchSelect from "../SearchSelect.tsx";

export function OrderItemModal({ item, materiais, locais = [], onClose, onSave }) {
  const [draft, setDraft] = useState({ ...item });
  function submit(event) {
    event.preventDefault();
    if (
      !draft.material_id ||
      Number(draft.quantidade) <= 0 ||
      Number(draft.preco_unitario) < 0
    )
      return;
    onSave(draft);
  }

  return (
    <div className="item-modal-backdrop" role="presentation">
      <form className="panel form item-modal" onSubmit={submit}>
        <div className="modal-heading">
          <h3>{item.key ? "Editar item" : "Adicionar item"}</h3>
          <button
            type="button"
            className="close-modal"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <ProductSearchSelect items={materiais} value={draft.material_id} onChange={material_id => setDraft({ ...draft, material_id })} required />
        <label>
          Detalhe / variação
          <input
            value={draft.subtitulo || ""}
            onChange={(e) => setDraft({ ...draft, subtitulo: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>Estoque de saída<SearchSelect value={draft.local_estoque_id || ""} onChange={e => setDraft({ ...draft, local_estoque_id: e.target.value })}><option value="">Usar local padrão do pedido</option>{locais.map(local => <option key={local.id} value={local.id}>{local.nome}</option>)}</SearchSelect></label>
          <label>Caixa da venda<SearchSelect value={draft.caixa || ""} onChange={e => setDraft({ ...draft, caixa: e.target.value })}><option value="">Definir na entrega</option><option value="Rava">Rava</option><option value="Rivoxel">Rivoxel</option><option value="Bonecos">Bonecos</option></SearchSelect></label>
        </div>
        <div className="form-grid">
          <label>
            Quantidade
            <input
              type="number"
              min="1"
              step="1"
              value={draft.quantidade}
              onChange={(e) =>
                setDraft({ ...draft, quantidade: e.target.value })
              }
              required
            />
          </label>
          <label>
            Preço unitário
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.preco_unitario}
              onChange={(e) =>
                setDraft({ ...draft, preco_unitario: e.target.value })
              }
              required
            />
          </label>
        </div>
        <div className="actions">
          <button className="primary">Confirmar item</button>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

