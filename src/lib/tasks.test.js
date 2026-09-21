import assert from "node:assert/strict";
import { test } from "node:test";
import { filterTasks, taskAssigneeLabel, taskStatuses, taskHistoryStatuses } from "./tasks.js";
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

test('concluídas saem de todas as colunas e continuam disponíveis no histórico', () => {
  const completed={...tasks[2],id:'4',status:'concluido'};
  const all=[...tasks,completed];
  assert.ok(!taskStatuses.some(([status]) => status === completed.status));
  assert.ok(taskHistoryStatuses.some(([status]) => status === completed.status));
  assert.equal(filterTasks(all).length,4);
  assert.deepEqual(filterTasks(all,'concluido','Jose').map(task=>task.id),['4']);
  assert.deepEqual(filterTasks(all,'terminado').map(task=>task.id),['3']);
});

test('responsáveis estruturados e antigos continuam legíveis e pesquisáveis', () => {
 const rows=[{id:'a',pessoa_encarregada:'Richard'},{id:'b',responsavel:'Nome antigo'},{id:'c'}];
 assert.equal(taskAssigneeLabel(rows[0]),'Richard');
 assert.equal(taskAssigneeLabel(rows[1]),'Nome antigo');
 assert.equal(taskAssigneeLabel(rows[2]),'Não informado');
 assert.equal(filterTasks(rows,'','Richard').length,1);
 assert.equal(filterTasks(rows,'','antigo').length,1);
});
