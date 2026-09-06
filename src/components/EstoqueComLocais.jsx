import { useState } from "react";
import { supabase } from "../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber } from "../lib/formatters.js";
import Header from "./Header.jsx";
import MaterialSelect from "./MaterialSelect.jsx";
import DataTable from "./DataTable.jsx";

export default function EstoqueComLocais({
  materiais,
  locais,
  estoqueLocal,
  onSaved,
  show,
}) {
  const [form, setForm] = useState({
    nome: "",
    custo_medio: "",
    quantidade: "",
    local_id: "",
  });
  const [transfer, setTransfer] = useState({
    material_id: "",
    origem_id: "",
    destino_id: "",
    quantidade: "",
  });
  const [editing, setEditing] = useState(null);
  async function addMaterial(e) {
    e.preventDefault();
    const { error } = await supabase.rpc("salvar_material", {
      p_material_id: editing || null,
      p_nome: form.nome,
      p_custo_medio: Number(form.custo_medio || 0),
      p_quantidade: Number(form.quantidade || 0),
      p_local_id: form.local_id || null,
    });
    if (error) return show(error.message, "error");
    show(editing ? "Produto atualizado." : "Produto cadastrado no local selecionado.");
    setForm({ nome: "", custo_medio: "", quantidade: "", local_id: "" });
    setEditing(null);
    onSaved();
  }
  function editar(produto) {
    const productStock = estoqueLocal.filter(
      (item) => item.material_id === produto.id,
    );
    const preferredStock =
      productStock.find((item) => item.quantidade > 0) || productStock[0];
    setEditing(produto.id);
    setForm({
      nome: produto.nome,
      custo_medio: produto.custo_medio,
      quantidade: String(produto.quantidade_atual ?? 0),
      local_id: preferredStock?.local_id || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remover(produto) {
    if (
      !window.confirm(
        `Excluir o produto “${produto.nome}”? Essa ação não pode ser desfeita.`,
      )
    )
      return;
    const { error } = await supabase
      .from("materiais")
      .delete()
      .eq("id", produto.id);
    if (error)
      return show(
        "Não foi possível excluir. Este produto pode estar vinculado a entradas, vendas ou pedidos.",
        "error",
      );
    show("Produto excluído.");
    onSaved();
  }
  async function transferir(e) {
    e.preventDefault();
    const { error } = await supabase.rpc("transferir_estoque", {
      p_material_id: transfer.material_id,
      p_origem_id: transfer.origem_id,
      p_destino_id: transfer.destino_id,
      p_quantidade: Number(transfer.quantidade),
    });
    if (error) return show(error.message, "error");
    show("Estoque transferido entre locais.");
    setTransfer({ material_id: "", origem_id: "", destino_id: "", quantidade: "" });
    onSaved();
  }
  return (
    <>
      <Header
        title="Estoque de produtos"
        subtitle="Veja onde cada produto está e transfira entre locais."
      />
      <div className="split">
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
                onClick={() => {
                  setEditing(null);
                  setForm({
                    nome: "",
                    custo_medio: "",
                    quantidade: "",
                    local_id: "",
                  });
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        <form className="panel form" onSubmit={transferir}>
          <h2>Transferir produtos</h2>
          <MaterialSelect
            materiais={materiais}
            value={transfer.material_id}
            onChange={(material_id) =>
              setTransfer({
                ...transfer,
                material_id,
                origem_id: "",
                destino_id: "",
              })
            }
          />
          <label>
            De
            <select
              value={transfer.origem_id}
              onChange={(e) =>
                setTransfer({ ...transfer, origem_id: e.target.value })
              }
              required
            >
              <option value="">Local de origem</option>
              {estoqueLocal
                .filter(
                  (item) =>
                    item.material_id === transfer.material_id &&
                    Number(item.quantidade) > 0,
                )
                .map((item) => (
                  <option key={item.local_id} value={item.local_id}>
                    {item.locais_estoque?.nome} — {fmtNumber(item.quantidade)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Para
            <select
              value={transfer.destino_id}
              onChange={(e) =>
                setTransfer({ ...transfer, destino_id: e.target.value })
              }
              required
            >
              <option value="">Local de destino</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <input
              type="number"
              step="1"
              min="1"
              value={transfer.quantidade}
              onChange={(e) =>
                setTransfer({ ...transfer, quantidade: e.target.value })
              }
              required
            />
          </label>
          <button className="primary">Transferir</button>
        </form>
      </div>
      <section className="panel table-panel">
        <h2>Produtos cadastrados</h2>
        <DataTable
          heads={["Produto", "Custo", "Saldo total", ""]}
          rows={materiais.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.nome}</strong>
              </td>
              <td>{fmtMoney(item.custo_medio)}</td>
              <td>{fmtNumber(item.quantidade_atual)}</td>
              <td className="row-actions">
                <button onClick={() => editar(item)}>Editar</button>
                <button className="danger-text" onClick={() => remover(item)}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
          empty="Nenhum produto cadastrado."
        />
      </section>
      <section className="panel table-panel">
        <h2>Saldo por local</h2>
        <DataTable
          heads={["Produto", "Local atual", "Tipo", "Quantidade"]}
          rows={estoqueLocal.map((item) => (
            <tr key={`${item.material_id}-${item.local_id}`}>
              <td>
                {
                  materiais.find((material) => material.id === item.material_id)
                    ?.nome
                }
              </td>
              <td>{item.locais_estoque?.nome}</td>
              <td>{item.locais_estoque?.tipo}</td>
              <td>
                {fmtNumber(item.quantidade)}
              </td>
            </tr>
          ))}
          empty="Nenhum produto distribuído entre locais."
        />
      </section>
    </>
  );
}


