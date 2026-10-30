import { useRef, useState } from 'react';

function SubtaskRow({ task, editable, disabled, run, onChange }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.titulo);
  return <li className="order-subtask-row">
    <label><input type="checkbox" checked={task.concluido} disabled={disabled} onChange={event => run(() => onChange('update', task, { concluido: event.target.checked }))} /><span className={task.concluido ? 'subtask-done' : ''}>{task.titulo}</span></label>
    {editable && !disabled && !editing && <div className="subtask-buttons"><button type="button" onClick={() => { setTitle(task.titulo); setEditing(true); }}>Renomear</button><button type="button" onClick={() => { if (window.confirm(`Excluir a subtarefa “${task.titulo}”?`)) run(() => onChange('delete', task)); }}>Excluir</button></div>}
    {editing && <form onSubmit={event => { event.preventDefault(); run(async () => { await onChange('update', task, { titulo: title.trim() }); setEditing(false); }); }}><input aria-label="Título da subtarefa" required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} disabled={disabled} /><button className="primary" disabled={disabled || !title.trim()}>Salvar</button><button type="button" disabled={disabled} onClick={() => setEditing(false)}>Cancelar</button></form>}
  </li>;
}
export default function OrderSubtasks({ order, tasks = [], onChange, editable = false }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const disabled = busy || order.status === 'entregue' || !onChange;
  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (err) { setError(err.message || 'Não foi possível salvar a subtarefa.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const content = <>
    <ul>{tasks.map(task => <SubtaskRow key={task.id} task={task} editable={editable} disabled={disabled} run={run} onChange={onChange} />)}</ul>
    {!tasks.length && <p>Nenhuma subtarefa cadastrada.</p>}
    {editable && order.status !== 'entregue' && onChange && <form className="subtask-add" onSubmit={event => { event.preventDefault(); run(async () => { await onChange('create', { pedido_id: order.id }, { titulo: title.trim() }); setTitle(''); }); }}><input aria-label="Nova subtarefa" placeholder="Ex.: Imprimir tampa do kit" required maxLength={150} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /><button className="primary" disabled={busy || !title.trim()}>Adicionar</button></form>}
    {busy && <p role="status">Salvando subtarefa…</p>}
    {error && <p role="alert">{error}</p>}
  </>;
  const count = `${tasks.filter(task => task.concluido).length} de ${tasks.length} subtarefas concluídas`;
  return <section className="order-subtasks" aria-busy={busy} draggable={false} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
    {editable ? <><h3>Subtarefas do pedido</h3><p>{count}</p>{content}</> : <details><summary>{count}</summary>{content}</details>}
  </section>;
}
