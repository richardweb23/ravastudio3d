import type { Tables } from "../database.types";

type Task = Tables<"tarefas">;

export const taskAssignees = ["Richard", "Xandy", "Ambos"] as const;
export function taskAssigneeLabel(task: Pick<Task, "pessoa_encarregada" | "responsavel">) { return task.pessoa_encarregada || task.responsavel || "Não informado"; }
export const taskStatuses = [["pendente", "Pendentes"], ["fazendo", "Fazendo"], ["terminado", "Terminado"]];
export const taskHistoryStatuses = [...taskStatuses, ["concluido", "Concluídas"]];
const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterTasks<T extends Task>(tasks: readonly T[], status = "", search = "") {
  const term = normalize(search.trim());
  return tasks.filter(task => (!status || task.status === status) &&
    (!term || normalize([task.titulo, task.descricao, task.pessoa_encarregada, task.responsavel].join(" ")).includes(term)))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || String(a.id).localeCompare(String(b.id)));
}
