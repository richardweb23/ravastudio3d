import { useMemo, useState } from "react";
import Header from "../Header.jsx";
import Empty from "../Empty.jsx";
import { formatMoney, formatNumber } from "../../lib/formatters.js";

const all = "todos";

function saleMonth(sale) {
  return sale.data?.slice(0, 7) || "";
}

export default function HistoricoPage({
  vendas,
  materiais,
  locais,
  vendedores,
}) {
  const months = useMemo(
    () => [...new Set(vendas.map(saleMonth).filter(Boolean))].sort().reverse(),
    [vendas],
  );
  const [filters, setFilters] = useState({
    mes: new Date().toISOString().slice(0, 7),
    material: all,
    vendedor: all,
    local: all,
  });
  const updateFilter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value }));

  const filteredSales = useMemo(
    () =>
      vendas.filter(
        (sale) =>
          (!filters.mes || saleMonth(sale) === filters.mes) &&
          (filters.material === all || sale.material_id === filters.material) &&
          (filters.vendedor === all || sale.vendedor_id === filters.vendedor) &&
          (filters.local === all || sale.local_estoque_id === filters.local),
      ),
    [vendas, filters],
  );
  const total = filteredSales.reduce(
    (sum, sale) =>
      sum + Number(sale.quantidade || 0) * Number(sale.preco_unitario || 0),
    0,
  );
  const units = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.quantidade || 0),
    0,
  );

  return (
    <>
      <Header
        title="Histórico de vendas"
        subtitle="Entregas concluídas e vendas registradas, com filtros por período e origem."
      />
      <section className="panel history-filters">
        <div className="history-filter-grid">
          <label>
            Mês
            <select
              value={filters.mes}
              onChange={(event) => updateFilter("mes", event.target.value)}
            >
              <option value="">Todos os meses</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {new Date(`${month}-01T12:00:00`).toLocaleDateString(
                    "pt-BR",
                    { month: "long", year: "numeric" },
                  )}
                </option>
              ))}
            </select>
          </label>
          <label>
            Produto
            <select
              value={filters.material}
              onChange={(event) => updateFilter("material", event.target.value)}
            >
              <option value={all}>Todos os produtos</option>
              {materiais.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vendedor
            <select
              value={filters.vendedor}
              onChange={(event) => updateFilter("vendedor", event.target.value)}
            >
              <option value={all}>Todos os vendedores</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Local de venda
            <select
              value={filters.local}
              onChange={(event) => updateFilter("local", event.target.value)}
            >
              <option value={all}>Todos os locais</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="history-summary">
          <span>{filteredSales.length} venda(s)</span>
          <span>{formatNumber(units)} item(ns)</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </section>
      <section className="panel table-panel history-table">
        <h2>Itens entregues e vendidos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Vendedor</th>
                <th>Local</th>
                <th>Qtd.</th>
                <th>Valor unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    {sale.data
                      ? new Date(`${sale.data}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                        )
                      : "—"}
                  </td>
                  <td>
                    <strong>
                      {sale.materiais?.nome ||
                        materiais.find(
                          (material) => material.id === sale.material_id,
                        )?.nome ||
                        "Produto removido"}
                    </strong>
                  </td>
                  <td>
                    {sale.vendedores?.nome ||
                      vendedores.find(
                        (vendedor) => vendedor.id === sale.vendedor_id,
                      )?.nome ||
                      "Não informado"}
                  </td>
                  <td>
                    {sale.locais_estoque?.nome ||
                      locais.find((local) => local.id === sale.local_estoque_id)
                        ?.nome ||
                      "Estoque principal"}
                  </td>
                  <td>{formatNumber(sale.quantidade)}</td>
                  <td>{formatMoney(sale.preco_unitario)}</td>
                  <td>
                    <strong>
                      {formatMoney(
                        Number(sale.quantidade || 0) *
                          Number(sale.preco_unitario || 0),
                      )}
                    </strong>
                  </td>
                </tr>
              ))}
              {!filteredSales.length && (
                <tr>
                  <td colSpan="7">
                    <Empty text="Nenhuma venda encontrada para os filtros selecionados." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

