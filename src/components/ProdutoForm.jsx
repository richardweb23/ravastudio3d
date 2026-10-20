import { formatMoney } from "../lib/formatters.js";
import { PRODUCT_CATEGORIES } from "../lib/produtos.js";
import { filamentProductionCost, updateProductFilament } from "../lib/productCost.js";
import { useId, useState } from "react";
import { supabase } from "../supabase.js";

export default function ProdutoForm({ materiais = [], locais, estoqueLocal = [], produto = null, onSaved, onCancel, show }) {
  const editing = produto?.id;
  const costHelpId = useId();
  const [form, setForm] = useState(() => {
    const productStock = estoqueLocal.filter(item => item.material_id === produto?.id);
    const preferredStock = productStock.find(item => item.quantidade > 0) || productStock[0];
    return produto ? {
      nome: produto.nome,
      categoria: produto.categoria || "Rivoxel",
      custo_medio: produto.custo_medio,
      filamento_gramas: produto.filamento_gramas ?? 0,
      filamento_valor_kg: produto.filamento_valor_kg ?? 0,
      quantidade: String(produto.quantidade_atual ?? 0),
      local_id: preferredStock?.local_id || "",
    } : { nome: "", categoria: "Rivoxel", custo_medio: "", filamento_gramas: 0, filamento_valor_kg: 100, quantidade: "", local_id: "" };
  });
  let automaticCost = null;
  try { automaticCost = filamentProductionCost(form.filamento_gramas, form.filamento_valor_kg); } catch { /* Validated when saving. */ }
  function editManualCost() {
    const value = window.prompt("Custo de produção (R$)", String(form.custo_medio || 0).replace(".", ","));
    if (value === null) return;
    const normalized = value.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) >= 10000000000) {
      return show("Informe um custo válido, com até duas casas decimais.", "error");
    }
    setForm(current => ({ ...current, custo_medio: Number(normalized).toFixed(2) }));
  }
  async function addMaterial(e) {
    e.preventDefault();
    let calculated;
    try { calculated = filamentProductionCost(form.filamento_gramas, form.filamento_valor_kg); }
    catch (error) { return show(error.message, "error"); }
    const { data: savedId, error } = await supabase.rpc("salvar_material", {
      p_material_id: editing || null,
      p_nome: form.nome,
      p_categoria: form.categoria,
      p_custo_medio: Number(calculated ?? (form.custo_medio || 0)),
      p_filamento_gramas: Number(form.filamento_gramas || 0),
      p_filamento_valor_kg: Number(form.filamento_valor_kg || 0),
      p_quantidade: Number(form.quantidade || 0),
      p_local_id: form.local_id || null,
    });
    if (error) return show(error.message, "error");
    show(editing ? "Produto atualizado." : "Produto cadastrado no local selecionado.");
    setForm({ nome: "", categoria: "Rivoxel", custo_medio: "", filamento_gramas: 0, filamento_valor_kg: 100, quantidade: "", local_id: "" });
    onSaved(savedId);
  }
  return (
        <form className="panel form" onSubmit={addMaterial}>
          <h2>{editing ? "Editar produto" : "Novo produto"}</h2>
          <div className="form-grid">
          {editing && produto.codigo != null && <p style={{ gridColumn: "1 / -1" }}>Código do produto: <strong>{String(produto.codigo).padStart(3, "0")}</strong></p>}
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
          </div>
          <fieldset className="product-cost-fields">
            <legend>Custos do produto</legend>
            <div className="product-cost-grid">
              <label>Filamento utilizado (g)<input type="number" min="0" max="10000000" step="0.001" value={form.filamento_gramas} onChange={event => setForm(current => updateProductFilament(current, "filamento_gramas", event.target.value))} /></label>
              <label>Valor do filamento (R$/kg)<input type="number" min="0" max="10000000" step="0.01" value={form.filamento_valor_kg} onChange={event => setForm(current => updateProductFilament(current, "filamento_valor_kg", event.target.value))} /></label>
              <div className="product-cost-result">
                <span id={costHelpId + "-label"}>Custo de produção (R$)</span>
                <output aria-labelledby={costHelpId + "-label"} aria-describedby={automaticCost !== null ? costHelpId : undefined}>{formatMoney(automaticCost ?? (form.custo_medio || 0))}</output>
                {automaticCost === null && <button type="button" className="product-cost-edit" onClick={editManualCost}>Editar custo</button>}
              </div>
            </div>
            {automaticCost !== null && <small id={costHelpId} aria-live="polite">Calculado automaticamente pelo consumo de filamento.</small>}
          </fieldset>
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
