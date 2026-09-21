export const taskAssignees = ["Richard", "Xandy", "Ambos"];
export function taskAssigneeLabel(task) { return task.pessoa_encarregada || task.responsavel || "Não informado"; }
export const taskStatuses = [["pendente", "Pendentes"], ["fazendo", "Fazendo"], ["terminado", "Terminado"]];
export const taskHistoryStatuses = [...taskStatuses, ["concluido", "Concluídas"]];
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterTasks(tasks, status = "", search = "") {
  const term = normalize(search.trim());
  return tasks.filter(task => (!status || task.status === status) &&
    (!term || normalize([task.titulo, task.descricao, task.pessoa_encarregada, task.responsavel].join(" ")).includes(term)))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || String(a.id).localeCompare(String(b.id)));
}
