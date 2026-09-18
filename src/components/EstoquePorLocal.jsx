import { useMemo, useState } from "react";
import { formatMoney, formatNumber } from "../lib/formatters.js";
import DataTable from "./DataTable.jsx";
import Header from "./Header.jsx";
import Metric from "./Metric.jsx";

const ALL_LOCATIONS = "__all__";

export default function EstoquePorLocal({ materiais, locais, estoqueLocal }) {
  const [localId, setLocalId] = useState(ALL_LOCATIONS);
  const [materialId, setMaterialId] = useState("");
  const activeLocalId = localId;

  const localRows = useMemo(
    () =>
      estoqueLocal
        .filter(
          (item) =>
            activeLocalId === ALL_LOCATIONS || item.local_id === activeLocalId,
        )
        .map((item) => ({
          ...item,
          material: materiais.find((material) => material.id === item.material_id),
          local: locais.find((local) => local.id === item.local_id),
        }))
        .filter((item) => item.material)
        .sort((a, b) =>
          Number(b.quantidade || 0) - Number(a.quantidade || 0) ||
          a.material.nome.localeCompare(b.material.nome) ||
          (a.local?.nome || "").localeCompare(b.local?.nome || ""),
        ),
    [estoqueLocal, activeLocalId, materiais, locais],
  );

  const rows = materialId
    ? localRows.filter((item) => item.material_id === materialId)
    : localRows;

  const totalItems = rows.reduce(
    (sum, item) => sum + Number(item.quantidade || 0),
    0,
  );
  const totalValue = rows.reduce(
    (sum, item) =>
      sum + Number(item.quantidade || 0) * Number(item.material.custo_medio || 0),
    0,
  );
  const selectedLocal = locais.find((local) => local.id === activeLocalId);

  return (
    <>
      <Header
        title="Saldo por local"
        subtitle="Consulte os produtos disponíveis em cada local de armazenamento."
      />
      <section className="location-stock-metrics">
        <Metric
          label="Local selecionado"
          value={selectedLocal?.nome || "Todos os locais"}
        />
        <Metric label="Produtos diferentes" value={formatNumber(new Set(rows.map(item => item.material_id)).size)} />
        <Metric label="Unidades no local" value={formatNumber(totalItems)} />
        <Metric label="Valor em estoque" value={formatMoney(totalValue)} />
      </section>
      <section className="panel local-stock-controls">
        <label>
          Local atual
          <select
            value={activeLocalId}
            onChange={(event) => {
              setLocalId(event.target.value);

            }}
          >

            <option value={ALL_LOCATIONS}>Todos os locais</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>{local.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Produto
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            <option value="">Todos os produtos</option>
            {materiais.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel table-panel">
        <h2>Saldo por local</h2>
        <p>Quantidade: do maior para o menor.</p>
        <DataTable
          heads={["Produto", "Local atual", "Tipo", "Quantidade"]}
          rows={rows.map((item) => (
            <tr key={`${item.material_id}-${item.local_id}`}>
              <td><strong>{item.material.nome}</strong></td>
              <td>{item.local?.nome || item.locais_estoque?.nome || "—"}</td>
              <td>{item.local?.tipo || item.locais_estoque?.tipo || "—"}</td>
              <td>{formatNumber(item.quantidade)}</td>

            </tr>
          ))}
          empty="Nenhum saldo encontrado para os filtros selecionados."
        />
      </section>
    </>
  );
}

