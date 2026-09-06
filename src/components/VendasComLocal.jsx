import { useState } from "react";
import { supabase } from "../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber, today } from "../lib/formatters.js";
import Header from "./Header.jsx";
import MaterialSelect from "./MaterialSelect.jsx";
import Info from "./Info.jsx";
import DataTable from "./DataTable.jsx";

export default function VendasComLocal({
  materiais,
  vendedores,
  estoqueLocal,
  vendas,
  onSaved,
  show,
}) {
  const [form, setForm] = useState({
    material_id: "",
    local_estoque_id: "",
    vendedor_id: "",
    quantidade: "",
    preco_unitario: "",
    data: today(),
  });
  async function save(e) {
    e.preventDefault();
    const { error } = await supabase.rpc("registrar_venda", {
      p_material_id: form.material_id,
      p_local_id: form.local_estoque_id,
      p_vendedor_id: form.vendedor_id || null,
      p_quantidade: Number(form.quantidade),
      p_preco_unitario: Number(form.preco_unitario),
      p_data: form.data,
    });
    if (error) return show(error.message, "error");
    show("Venda registrada com vendedor e local.");
    setForm({
      material_id: "", local_estoque_id: "", vendedor_id: "",
      quantidade: "", preco_unitario: "", data: today(),
    });
    onSaved();
  }
  return (
    <>
      <Header
        title="Vendas"
        subtitle="Registre quem vendeu, de onde saiu e por qual valor."
      />
      <div className="split">
        <form className="panel form" onSubmit={save}>
          <h2>Nova venda</h2>
          <MaterialSelect
            materiais={materiais}
            value={form.material_id}
            onChange={(material_id) =>
              setForm({ ...form, material_id, local_estoque_id: "" })
            }
          />
          <label>
            Vendido a partir de
            <select
              value={form.local_estoque_id}
              onChange={(e) =>
                setForm({ ...form, local_estoque_id: e.target.value })
              }
              required
            >
              <option value="">Selecione o local</option>
              {estoqueLocal
                .filter(
                  (item) =>
                    item.material_id === form.material_id &&
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
            Quem vendeu
            <select
              value={form.vendedor_id}
              onChange={(e) =>
                setForm({ ...form, vendedor_id: e.target.value })
              }
            >
              <option value="">Não informado</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nome}
                </option>
              ))}
            </select>
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
              Preço por produto (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.preco_unitario}
                onChange={(e) =>
                  setForm({ ...form, preco_unitario: e.target.value })
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
          <button className="primary">Registrar venda</button>
        </form>
        <Info
          title="Pedidos entregues"
          text="Na tela de pedidos também é possível escolher o local de saída e o vendedor. Ao entregar, o Supabase gera a venda automaticamente."
        />
      </div>
      <section className="panel table-panel">
        <h2>Últimas vendas</h2>
        <DataTable
          heads={["Data", "Produto", "Local", "Vendedor", "Total"]}
          rows={vendas.map((item) => (
            <tr key={item.id}>
              <td>
                {new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td>{item.materiais?.nome}</td>
              <td>{item.locais_estoque?.nome || "—"}</td>
              <td>{item.vendedores?.nome || "—"}</td>
              <td>
                {fmtMoney(
                  Number(item.quantidade) * Number(item.preco_unitario),
                )}
              </td>
            </tr>
          ))}
          empty="Nenhuma venda registrada."
        />
      </section>
    </>
  );
}

