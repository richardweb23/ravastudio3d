import { PRODUCT_CATEGORIES } from "../lib/produtos.js";
import { useState } from "react";
import { supabase } from "../supabase.js";

export default function ProdutoForm({ materiais = [], locais, estoqueLocal = [], produto = null, onSaved, onCancel, show }) {
  const editing = produto?.id;
  const [form, setForm] = useState(() => {
    const productStock = estoqueLocal.filter(item => item.material_id === produto?.id);
    const preferredStock = productStock.find(item => item.quantidade > 0) || productStock[0];
    return produto ? {
      nome: produto.nome,
      categoria: produto.categoria || "Rivoxel",
      custo_medio: produto.custo_medio,
      quantidade: String(produto.quantidade_atual ?? 0),
      local_id: preferredStock?.local_id || "",
    } : { nome: "", categoria: "Rivoxel", custo_medio: "", quantidade: "", local_id: "" };
  });
  async function addMaterial(e) {
    e.preventDefault();
    const { error } = await supabase.rpc("salvar_material", {
      p_material_id: editing || null,
      p_nome: form.nome,
      p_categoria: form.categoria,
      p_custo_medio: Number(form.custo_medio || 0),
      p_quantidade: Number(form.quantidade || 0),
      p_local_id: form.local_id || null,
    });
    if (error) return show(error.message, "error");
    show(editing ? "Produto atualizado." : "Produto cadastrado no local selecionado.");
    setForm({ nome: "", categoria: "Rivoxel", custo_medio: "", quantidade: "", local_id: "" });
    onSaved();
  }
  return (
        <form className="panel form" onSubmit={addMaterial}>
          <h2>{editing ? "Editar produto" : "Novo produto"}</h2>
          <label>
            Nome do produto
            <input
              placeholder="Ex.: Chaveiro tema X"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </label>
          <label>Categoria do produto<select value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })} required>{PRODUCT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
          <div>
            <label>
              Custo de produção (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.custo_medio}
                onChange={(e) =>
                  setForm({ ...form, custo_medio: e.target.value })
                }
                required
              />
            </label>
          </div>
          {!editing && (
            <>
              <label>
                Local atual
                <select
                  value={form.local_id}
                  onChange={(e) =>
                    setForm({ ...form, local_id: e.target.value })
                  }
                  required
                >
                  <option value="">Selecione</option>
                  {locais.map((local) => (
                    <option value={local.id} key={local.id}>
                      {local.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade inicial de produtos
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.quantidade}
                  onChange={(e) =>
                    setForm({ ...form, quantidade: e.target.value })
                  }
                  required
                />
              </label>
            </>
          )}
          {editing && (
            <>
              <label>
                Saldo total de produtos
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.quantidade}
                  onChange={(e) =>
                    setForm({ ...form, quantidade: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Local para aplicar o ajuste
                <select
                  value={form.local_id}
                  onChange={(e) =>
                    setForm({ ...form, local_id: e.target.value })
                  }
                  required={Number(form.quantidade) !== Number(materiais.find((item) => item.id === editing)?.quantidade_atual || 0)}
                >
                  <option value="">Selecione</option>
                  {locais.map((local) => (
                    <option value={local.id} key={local.id}>
                      {local.nome}
                    </option>
                  ))}
                </select>
                <small>
                  A alteração será adicionada ou retirada somente deste local.
                </small>
              </label>
            </>
          )}
          <div className="actions">
            <button className="primary">
              {editing ? "Salvar alterações" : "Cadastrar produto"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
  );
}
