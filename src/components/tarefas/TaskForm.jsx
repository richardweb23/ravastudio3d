import { useState } from "react";
import { supabase } from "../../supabase.js";

export default function TaskForm({ task, onSaved, onCancel, show, onSavingChange }) {
  const [form, setForm] = useState(() => ({ titulo: task?.titulo || task?.descricao?.slice(0, 150) || "", responsavel: task?.responsavel || "", descricao: task?.descricao || "", previsao_entrega: task?.previsao_entrega || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const values = { ...form, titulo: form.titulo.trim(), responsavel: form.responsavel.trim(), descricao: form.descricao.trim() };
    if (!values.titulo || !values.responsavel || !values.descricao || !values.previsao_entrega) { setError("Preencha título, responsável, descrição e previsão de entrega."); return; }
    setSaving(true);
    onSavingChange?.(true);
    setError("");
    try {
      const query = task ? supabase.from("tarefas").update(values).eq("id", task.id) : supabase.from("tarefas").insert(values);
      const { error: saveError } = await query.select("id").single();
      if (saveError) throw saveError;
      show(task ? "Tarefa atualizada." : "Tarefa cadastrada.");
      await onSaved();
    } catch (failure) { setError(failure.message || "Não foi possível salvar a tarefa."); }
    finally { setSaving(false); onSavingChange?.(false); }
  }
  return <form className="panel form task-form" onSubmit={save}>
    <h2 id="task-form-title">{task ? "Editar tarefa" : "Nova tarefa"}</h2>
    <label>Título da tarefa<input name="titulo" value={form.titulo} onChange={update} required maxLength={150} placeholder="Ex.: Organizar materiais de impressão" /></label>
    <label>Pessoa encarregada<input name="responsavel" value={form.responsavel} onChange={update} required maxLength={150} placeholder="Nome da pessoa responsável" /></label>
    <label>Descrição da tarefa<textarea name="descricao" value={form.descricao} onChange={update} required maxLength={5000} rows={5} placeholder="Descreva o que precisa ser feito" /></label>
    <label>Previsão de entrega<input type="date" name="previsao_entrega" value={form.previsao_entrega} onChange={update} required /></label>
    {error && <p role="alert" className="negative">{error}</p>}
    <div className="task-form-actions"><button className="primary" disabled={saving}>{saving ? "Salvando…" : task ? "Salvar alterações" : "Cadastrar tarefa"}</button><button type="button" disabled={saving} onClick={onCancel}>Cancelar</button></div>
  </form>;
}
