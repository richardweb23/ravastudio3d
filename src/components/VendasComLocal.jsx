import CaixaSelect from "./CaixaSelect.jsx";
import VendaActionModal from "./VendaActionModal.jsx";
import { saleTotal } from "../lib/vendas.js";
import { useState } from "react";
import { supabase } from "../supabase.js";
import { formatMoney as fmtMoney, formatNumber as fmtNumber, today } from "../lib/formatters.js";
import Header from "./Header.jsx";
import MaterialSelect from "./MaterialSelect.jsx";
import Info from "./Info.jsx";
import DataTable from "./DataTable.jsx";

export default function VendasComLocal({
  materiais,
  locais,
  vendedores,
  estoqueLocal,
  vendas,
  onSaved,
  show,
}) {
  const [action, setAction] = useState(null);
  const [filters, setFilters] = useState({ inicio: "", fim: "", produto: "", local: "", vendedor: "" });
  const updateFilter = (event) => setFilters(current => ({ ...current, [event.target.name]: event.target.value }));
  const invalidPeriod = filters.inicio && filters.fim && filters.inicio > filters.fim;
  const filteredSales = invalidPeriod ? [] : vendas.filter(sale =>
    (!filters.inicio || sale.data >= filters.inicio) &&
    (!filters.fim || sale.data <= filters.fim) &&
    (!filters.produto || sale.material_id === filters.produto) &&
    (!filters.local || sale.local_estoque_id === filters.local) &&
    (!filters.vendedor || (filters.vendedor === "sem-vendedor" ? !sale.vendedor_id : sale.vendedor_id === filters.vendedor))
  );
  const [form, setForm] = useState({
    caixa: "",
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
      p_caixa: form.caixa,
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
      caixa: "", material_id: "", local_estoque_id: "", vendedor_id: "",
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
          <CaixaSelect value={form.caixa} onChange={event => setForm({ ...form, caixa: event.target.value })} />
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
              {vendedores.filter(vendedor => vendedor.ativo !== false).map((vendedor) => (
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
        <h2>Vendas</h2>
        <div className="sales-filters">
          <label>De<input type="date" name="inicio" value={filters.inicio} onChange={updateFilter} /></label>
          <label>Até<input type="date" name="fim" value={filters.fim} onChange={updateFilter} /></label>
          <label>Produto<select name="produto" value={filters.produto} onChange={updateFilter}><option value="">Todos os produtos</option>{materiais.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Local<select name="local" value={filters.local} onChange={updateFilter}><option value="">Todos os locais</option>{locais.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Vendedor<select name="vendedor" value={filters.vendedor} onChange={updateFilter}><option value="">Todos os vendedores</option><option value="sem-vendedor">Não informado</option>{vendedores.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <button type="button" className="link" onClick={() => setFilters({ inicio: "", fim: "", produto: "", local: "", vendedor: "" })}>Limpar filtros</button>
        </div>
        {invalidPeriod && <p className="negative" role="alert">A data inicial deve ser anterior ou igual à data final.</p>}
        <p>Total das vendas filtradas: <strong>{fmtMoney(filteredSales.reduce((total, sale) => total + saleTotal(sale), 0))}</strong></p>
        <DataTable
          heads={["Data", "Produto", "Local", "Vendedor", "Quantidade", "Total", "Caixa", "Status", "Ações"]}
          rows={filteredSales.map((item) => (
            <tr key={item.id}>
              <td>
                {new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td>{item.materiais?.nome}</td>
              <td>{item.locais_estoque?.nome || "—"}</td>
              <td>{item.vendedores?.nome || "—"}</td>
              <td>{fmtNumber(item.quantidade)}</td>
              <td>
                {fmtMoney(
                  saleTotal(item),
                )}
              </td>
              <td><button type="button" className="link" title="Alterar caixa da venda" aria-label={"Alterar caixa da venda de " + item.materiais?.nome} onClick={() => setAction({ sale: item, mode: "caixa" })}>{item.caixa || "Rivoxel"} ✎</button></td>
              <td>{item.devolvida_em ? <><span className="status">Devolvida</span><small>Retorno: {locais.find(local => local.id === item.retorno_local_id)?.nome || "Local registrado"}</small></> : "Ativa"}</td>
              <td><div className="product-table-actions">
                <button type="button" className="registration-icon-button" title={item.devolvida_em ? "Venda devolvida" : item.consignacao_vendas?.pagamento_id ? "Repasse já pago" : item.pedido_id ? "Venda vinculada a pedido" : "Editar venda"} aria-label={"Editar venda de " + item.materiais?.nome} disabled={Boolean(item.devolvida_em || item.consignacao_vendas?.pagamento_id || item.pedido_id)} onClick={() => setAction({ sale: item, mode: "edicao" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></svg></button>
                <button type="button" className="registration-icon-button" title={item.devolvida_em ? "Venda já devolvida" : item.consignacao_vendas?.pagamento_id ? "Repasse já pago" : "Retornar venda ao estoque"} aria-label={"Retornar venda de " + item.materiais?.nome + " ao estoque"} disabled={Boolean(item.devolvida_em || item.consignacao_vendas?.pagamento_id)} onClick={() => setAction({ sale: item, mode: "devolucao" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12" /></svg></button>
              </div></td>
            </tr>
          ))}
          empty="Nenhuma venda encontrada para os filtros selecionados."
        />
      </section>
      {action && <VendaActionModal {...action} locais={locais} vendedores={vendedores} onClose={() => setAction(null)} onSaved={onSaved} show={show} />}
    </>
  );
}

