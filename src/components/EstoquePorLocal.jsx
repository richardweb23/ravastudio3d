import { useMemo, useState } from "react";
import { formatMoney, formatNumber } from "../lib/formatters.js";
import DataTable from "./DataTable.jsx";
import Header from "./Header.jsx";
import Metric from "./Metric.jsx";

const ALL_LOCATIONS = "__all__";

export default function EstoquePorLocal({ materiais, locais, estoqueLocal }) {
  const [localId, setLocalId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const defaultLocal =
    locais.find((local) => local.tipo === "principal") ||
    locais.find((local) => local.nome.toLowerCase() === "estoque principal") ||
    locais[0];
  const activeLocalId =
    localId === ALL_LOCATIONS || locais.some((local) => local.id === localId)
    ? localId
    : defaultLocal?.id || "";

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
          a.material.nome.localeCompare(b.material.nome) ||
          (a.local?.nome || "").localeCompare(b.local?.nome || ""),
        ),
    [estoqueLocal, activeLocalId, materiais, locais],
  );

  const rows = materialId
    ? localRows.filter((item) => item.material_id === materialId)
    : localRows;

  const totalItems = localRows.reduce(
    (sum, item) => sum + Number(item.quantidade || 0),
    0,
  );
  const totalValue = localRows.reduce(
    (sum, item) =>
      sum + Number(item.quantidade || 0) * Number(item.material.custo_medio || 0),
    0,
  );
  const selectedLocal = locais.find((local) => local.id === activeLocalId);

  return (
    <>
      <Header
        title="Estoque por local"
        subtitle="Consulte os produtos disponíveis em cada local de armazenamento."
      />
      <section className="location-stock-metrics">
        <Metric
          label="Local selecionado"
          value={selectedLocal?.nome || "Todos os locais"}
        />
        <Metric label="Produtos diferentes" value={formatNumber(localRows.length)} />
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
              setMaterialId("");
            }}
          >
            <option value="">Selecione um local</option>
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
            {localRows.map((item) => (
              <option key={item.material_id} value={item.material_id}>
                {item.material.nome}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel table-panel">
        <h2>{selectedLocal ? `Produtos em ${selectedLocal.nome}` : "Produtos por local"}</h2>
        <DataTable
          heads={["Produto", "Local atual", "Custo", "Quantidade", "Valor"]}
          rows={rows.map((item) => (
            <tr key={`${item.material_id}-${item.local_id}`}>
              <td><strong>{item.material.nome}</strong></td>
              <td>{item.local?.nome || item.locais_estoque?.nome || "—"}</td>
              <td>{formatMoney(item.material.custo_medio)}</td>
              <td>{formatNumber(item.quantidade)}</td>
              <td>{formatMoney(Number(item.quantidade) * Number(item.material.custo_medio || 0))}</td>
            </tr>
          ))}
          empty={activeLocalId ? "Nenhum produto com saldo neste local." : "Selecione um local para visualizar o estoque."}
        />
      </section>
    </>
  );
}

