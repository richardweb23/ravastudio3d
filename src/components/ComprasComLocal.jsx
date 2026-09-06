import { useState } from "react";
import { supabase } from "../supabase.js";
import { formatNumber as fmtNumber, today } from "../lib/formatters.js";
import Header from "./Header.jsx";
import MaterialSelect from "./MaterialSelect.jsx";
import Info from "./Info.jsx";
import DataTable from "./DataTable.jsx";

export default function ComprasComLocal({
  materiais,
  locais,
  compras,
  onSaved,
  show,
}) {
  const [form, setForm] = useState({
    material_id: "",
    local_estoque_id: "",
    fornecedor: "",
    quantidade: "",
    custo_unitario: "",
    data: today(),
  });
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
        title="Entradas de produtos"
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
        <Info
          title="Produtos prontos"
          text="Use esta tela quando finalizar uma produção ou receber produtos prontos. A quantidade entra no local selecionado."
        />
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


