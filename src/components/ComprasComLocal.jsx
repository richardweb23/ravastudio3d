import { useState } from "react";
import { supabase } from "../supabase.js";
import { formatNumber as fmtNumber, today } from "../lib/formatters.js";
import Header from "./Header.jsx";
import MaterialSelect from "./MaterialSelect.jsx";

import DataTable from "./DataTable.jsx";

export default function ComprasComLocal({
  materiais,
  locais,
  compras,
  estoqueLocal,
  onSaved,
  show,
}) {

  const [transfer, setTransfer] = useState({
    material_id: "",
    origem_id: "",
    destino_id: "",
    quantidade: "",
  });
  const [form, setForm] = useState({
    material_id: "",
    local_estoque_id: "",
    fornecedor: "",
    quantidade: "",
    custo_unitario: "",
    data: today(),
  });
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
  async function save(e) {
    e.preventDefault();
    const { error } = await supabase.rpc("registrar_entrada", {
      p_material_id: form.material_id,
      p_local_id: form.local_estoque_id,
      p_fornecedor: form.fornecedor || null,
      p_quantidade: Number(form.quantidade),
      p_custo_unitario: Number(form.custo_unitario),
      p_data: form.data,
    });
    if (error) return show(error.message, "error");
    show("Entrada registrada no local selecionado.");
    setForm({
      material_id: "", local_estoque_id: "", fornecedor: "",
      quantidade: "", custo_unitario: "", data: today(),
    });
    onSaved();
  }
  return (
    <>
      <Header
        title="Entrada de produtos no estoque"
        subtitle="Registre produtos prontos e o local onde foram guardados."
      />
      <div className="split">
        <form className="panel form" onSubmit={save}>
          <h2>Nova entrada</h2>
          <MaterialSelect
            materiais={materiais}
            value={form.material_id}
            onChange={(material_id) => setForm({ ...form, material_id })}
          />
          <label>
            Guardar em
            <select
              value={form.local_estoque_id}
              onChange={(e) =>
                setForm({ ...form, local_estoque_id: e.target.value })
              }
              required
            >
              <option value="">Selecione o local</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origem / observação
            <input
              placeholder="Ex.: Produção própria"
              value={form.fornecedor}
              onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Quantidade de produtos
              <input
                type="number"
                step="1"
                min="1"
                value={form.quantidade}
                onChange={(e) =>
                  setForm({ ...form, quantidade: e.target.value })
                }
                required
              />
            </label>
            <label>
              Custo por produto (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.custo_unitario}
                onChange={(e) =>
                  setForm({ ...form, custo_unitario: e.target.value })
                }
                required
              />
            </label>
          </div>
          <label>
            Data
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              required
            />
          </label>
          <button className="primary">Registrar entrada</button>
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
        <h2>Últimas entradas</h2>
        <DataTable
          heads={["Data", "Produto", "Local", "Origem", "Quantidade"]}
          rows={compras.map((item) => (
            <tr key={item.id}>
              <td>
                {new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td>{item.materiais?.nome}</td>
              <td>{item.locais_estoque?.nome || "—"}</td>
              <td>{item.fornecedor || "—"}</td>
              <td>
                {fmtNumber(item.quantidade)}
              </td>
            </tr>
          ))}
          empty="Nenhuma entrada registrada."
        />
      </section>
    </>
  );
}


