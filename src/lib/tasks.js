export const taskStatuses = [["pendente", "Pendentes"], ["fazendo", "Fazendo"], ["terminado", "Terminado"]];
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterTasks(tasks, status = "", search = "") {
  const term = normalize(search.trim());
  return tasks.filter(task => (!status || task.status === status) &&
    (!term || normalize([task.titulo, task.descricao, task.responsavel].join(" ")).includes(term)))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || String(a.id).localeCompare(String(b.id)));
}
