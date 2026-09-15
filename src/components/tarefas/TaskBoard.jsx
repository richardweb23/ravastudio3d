import { useEffect, useState } from "react";
import { deliveryAlert } from "../../lib/deliveryAlert.js";

import { taskStatuses } from "../../lib/tasks.js";

export default function TaskBoard({ tarefas = [], error, onStatusChange, onCreate, onEdit }) {
  const [dragged, setDragged] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  async function move(task, status) {
    setDragged(null);
    if (!task || busy || task.status === status) return;
    setBusy(true);
    try { await onStatusChange(task, status); } finally { setBusy(false); }
  }
  return <section className="panel kanban task-board" aria-label="Quadro de tarefas" aria-busy={busy}>
    <div className="panel-title"><h2>Tarefas</h2><button className="link" onClick={onCreate}>Cadastrar tarefas</button></div>
    {error ? <p role="alert">Não foi possível carregar as tarefas. Tente atualizar a página.</p> : <>
      <p className="kanban-help">Arraste uma tarefa ou selecione sua etapa. Ordenadas pela entrega mais próxima. Amarelo: entrega próxima. Vermelho: atraso.</p>
      <div className="kanban-columns">{taskStatuses.map(([status, label]) => {
        const cards = tarefas.filter(task => task.status === status).sort((a, b) => a.previsao_entrega.localeCompare(b.previsao_entrega) || a.created_at.localeCompare(b.created_at));
        return <section key={status} className={"kanban-column " + (dragged ? "drop-enabled" : "")} aria-label={label}
          onDragOver={event => { if (dragged) event.preventDefault(); }} onDrop={event => { event.preventDefault(); move(dragged, status); }}>
          <div className="kanban-title"><span>{label}</span><b>{cards.length}</b></div>
          {cards.map(task => {
            const alert = deliveryAlert(task.previsao_entrega, status === "terminado", now);
            return <article key={task.id} className={"kanban-card task-card " + alert + (dragged?.id === task.id ? " dragging" : "")} draggable={!busy}
              onDragStart={event => { event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; setDragged(task); }} onDragEnd={() => setDragged(null)}>
              <div className="kanban-card-main">
                <strong>{task.responsavel}</strong>
                <strong>{task.titulo || task.descricao?.slice(0, 150)}</strong>
                <small className="task-description">{task.descricao}</small>
                <small>Entrega: {new Date(task.previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR")}</small>
                {alert && <span>{alert === "overdue" ? "Entrega atrasada" : "Entrega próxima"}</span>}
              </div>
              <div className="task-actions"><label>Etapa<select value={task.status} disabled={busy} onChange={event => move(task, event.target.value)}>{taskStatuses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
                {onEdit && <button className="link" disabled={busy} onClick={() => onEdit(task)}>Editar</button>}
              </div>
            </article>;
          })}
          {!cards.length && <p className="kanban-empty">Nenhuma tarefa nesta etapa.</p>}
        </section>;
      })}</div>
    </>}
  </section>;
}
