import { useEffect, useState } from "react";
import DataTable from "../DataTable.jsx";
import { loadLocationSummaries } from "../../services/consignacao.js";
import { localDetailsPage } from "../../lib/consignacao.js";
import { formatBRLCents as money } from "../../lib/financeiro.js";
import { formatNumber } from "../../lib/formatters.js";

const emptySummary = { unidades: 0, vendido: 0, pendente: 0 };
export default function RegistrationTables({ locais, vendedores, onNavigate, onEditLocal, onEditSeller, onRemoveLocal }) {
  const [result, setResult] = useState({ loading: true, values: {}, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadLocationSummaries().then(values => {
      if (active) setResult({ loading: false, values, error: null });
    }).catch(error => {
      if (active) setResult({ loading: false, values: {}, error });
    });
    return () => { active = false; };
  }, [locais, vendedores, attempt]);
  return <div className="registration-tables">
    {result.error && <div className="panel" role="alert"><p>Não foi possível carregar os indicadores de estoque e repasse.</p><button className="link" onClick={() => { setResult({ loading: true, values: {}, error: null }); setAttempt(value => value + 1); }}>Tentar novamente</button></div>}
    {[{ type: "local", title: "Locais cadastrados", rows: locais }, { type: "vendedor", title: "Vendedores cadastrados", rows: vendedores }].map(group => <section key={group.type} className="panel table-panel" aria-busy={result.loading}>
      <h2>{group.title}</h2>
      {group.type === "vendedor" && <p>Os indicadores correspondem ao local de estoque vinculado ao vendedor.</p>}
      <DataTable heads={["Nome", "Tipo", "Contato / responsável", "Produtos no local", "Vendas realizadas", "Repasse pendente", "Ações"]} empty={group.type === "local" ? "Nenhum local cadastrado." : "Nenhum vendedor cadastrado."} rows={group.rows.map(item => {
        const localId = group.type === "local" ? item.id : item.local_estoque_id;
        const summary = result.values[localId] || emptySummary;
        const unavailable = result.loading ? "Carregando…" : result.error ? "Indisponível" : !localId ? "Sem local vinculado" : null;
        return <tr key={item.id}>
          <td><strong>{item.nome}</strong>{!item.ativo && <small>Inativo</small>}</td>
          <td>{group.type === "vendedor" ? "Vendedor" : ({ principal: "Estoque principal", vendedor: "Com vendedor", estabelecimento: "Estabelecimento", rua: "Venda na rua", outro: "Outro" }[item.tipo] || item.tipo)}</td>
          <td>{item.responsavel || item.telefone || "—"}{item.responsavel && item.telefone && <small>{item.telefone}</small>}</td>
          <td>{unavailable || formatNumber(summary.unidades) + " un."}</td>
          <td>{unavailable || money(summary.vendido)}</td>
          <td className={!unavailable && summary.pendente > 0 ? "consignment-due" : ""}>{unavailable || money(summary.pendente)}</td>
          <td><div className="row-actions">
            <button type="button" className="registration-icon-button" title="Detalhes" aria-label={"Ver detalhes de " + item.nome} onClick={() => onNavigate(localDetailsPage(group.type, item.id))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg></button>
            <button type="button" className="registration-icon-button" title="Editar" aria-label={"Editar " + item.nome} onClick={() => group.type === "local" ? onEditLocal(item) : onEditSeller(item)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" /></svg></button>
            {group.type === "local" && <button type="button" className="registration-icon-button registration-icon-danger" title="Excluir" aria-label={"Excluir " + item.nome} onClick={() => onRemoveLocal(item)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg></button>}
          </div></td>
        </tr>;
      })} />
    </section>)}
  </div>;
}
