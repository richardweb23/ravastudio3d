import assert from "node:assert/strict";
import { test } from "node:test";
import { filterTasks } from "./tasks.js";
const tasks = [
  { id: "1", titulo: "Organização", descricao: "Separar materiais", responsavel: "José", status: "pendente", created_at: "2026-09-15" },
  { id: "2", titulo: "Imprimir", descricao: "Peças azuis", responsavel: "Ana", status: "fazendo", created_at: "2026-09-14" },
  { id: "3", titulo: "Entrega antiga", descricao: "Concluída", responsavel: "José", status: "terminado", created_at: "2025-01-01" },
];
test("mantém tarefas antigas e concluídas disponíveis sem alterar os registros", () => {
  assert.equal(filterTasks(tasks).length, 3);
  assert.deepEqual(filterTasks(tasks, "terminado").map(task => task.id), ["3"]);
  assert.equal(tasks.length, 3);
});
test("filtra cada etapa e combina busca por título, descrição e responsável", () => {
  assert.deepEqual(filterTasks(tasks, "pendente", "organizacao").map(task => task.id), ["1"]);
  assert.deepEqual(filterTasks(tasks, "fazendo", "pecas").map(task => task.id), ["2"]);
  assert.equal(filterTasks(tasks, "", " JOSE ").length, 2);
  assert.equal(filterTasks(tasks, "terminado", "Ana").length, 0);
});
