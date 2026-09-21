import { useState } from "react";
import DataTable from "../DataTable.jsx";
import { filterTasks, taskHistoryStatuses, taskAssigneeLabel } from "../../lib/tasks.js";

export default function TaskHistory({ tarefas = [], error, onEdit }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const filtered = filterTasks(tarefas, status, search);
  const labels = Object.fromEntries(taskHistoryStatuses);
  return <section className="panel table-panel task-history" aria-labelledby="task-history-title">
    <div className="panel-title"><h2 id="task-history-title">Histórico de tarefas</h2></div>
    <p>Consulte todas as tarefas, incluindo as concluídas e retiradas do quadro. Os registros permanecem disponíveis após a conclusão.</p>
    <div className="task-history-filters">
      <div className="task-status-filters" role="group" aria-label="Filtrar tarefas por etapa">
        {[["", "Todas"], ...taskHistoryStatuses].map(([value, label]) => <button type="button" key={value} className={"task-status-filter " + (status === value ? "selected" : "")} aria-pressed={status === value} onClick={() => setStatus(value)}>
          <span className={"task-status-dot " + (value || "all")} aria-hidden="true" />{label}<span className="task-filter-count">{value ? tarefas.filter(task => task.status === value).length : tarefas.length}</span>
        </button>)}
      </div>
      <div className="task-search-row">
        <label className="task-search-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input aria-label="Buscar tarefa por título, descrição ou responsável" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por título, descrição ou responsável…" />
        </label>
        <button type="button" className="task-clear-filters" disabled={!status && !search} onClick={() => { setStatus(""); setSearch(""); }}>Limpar filtros</button>
      </div>
    </div>
    {error ? <p role="alert">Não foi possível carregar o histórico de tarefas. Tente atualizar a página.</p> : <>
      <p role="status">{filtered.length} tarefa(s) encontrada(s)</p>
      <DataTable heads={["Tarefa", "Responsável", "Etapa", "Previsão de entrega", "Cadastrada em", "Ações"]} empty="Nenhuma tarefa encontrada para os filtros selecionados." rows={filtered.map(task => <tr key={task.id}>
        <td className="task-history-description"><strong>{task.titulo || task.descricao?.slice(0, 150)}</strong><details><summary>Ver descrição</summary><p>{task.descricao}</p></details></td>
        <td>{taskAssigneeLabel(task)}</td><td><span className={"task-status-badge " + task.status}><span className={"task-status-dot " + task.status} aria-hidden="true" />{labels[task.status] || task.status}</span></td>
        <td>{task.previsao_entrega ? new Date(task.previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
        <td>{task.created_at ? new Date(task.created_at).toLocaleDateString("pt-BR") : "—"}</td>
        <td><button className="link" onClick={() => onEdit(task)}>Editar</button></td>
      </tr>)} />
    </>}
  </section>;
}
