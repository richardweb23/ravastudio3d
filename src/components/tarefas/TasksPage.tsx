import type { Task, TaskChange, Show } from "../../adminTypes";
import { useEffect, useRef, useState } from "react";
import Header from "../Header.tsx";
import TaskBoard from "./TaskBoard.jsx";
import TaskForm from "./TaskForm.jsx";
import TaskHistory from "./TaskHistory.jsx";

export default function TasksPage({ initialOpen = false, tarefas, error, onSaved, onStatusChange, show }: { initialOpen?: boolean; tarefas: Task[]; error?: unknown; onSaved: () => Promise<void>; onStatusChange: TaskChange; show: Show }) {
  const [open, setOpen] = useState(initialOpen);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previousFocus = document.activeElement;
    if (!element) return;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);
  const close = () => { setOpen(false); setEditing(null); };
  return <>
    <Header title="Tarefas" subtitle="Organize os responsáveis, acompanhe as etapas e os prazos de entrega." />
    <TaskBoard tarefas={tarefas} error={error} onStatusChange={onStatusChange} onCreate={() => { setEditing(null); setOpen(true); }} onEdit={task => { setEditing(task); setOpen(true); }} />
    <TaskHistory tarefas={tarefas} error={error} onEdit={task => { setEditing(task); setOpen(true); }} />
    {open && <dialog ref={dialog} className="task-dialog" aria-labelledby="task-form-title" onCancel={event => { event.preventDefault(); if (!saving) close(); }}>
      <button type="button" className="close-modal task-dialog-close" aria-label="Fechar cadastro de tarefa" disabled={saving} onClick={close}>×</button>
      <TaskForm key={editing?.id || "new"} task={editing} show={show} onSavingChange={setSaving} onCancel={close} onSaved={async () => { await onSaved(); close(); }} />
    </dialog>}
  </>;
}
