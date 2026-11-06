import type { Tables } from "./database.types";
import type { loadSales } from "./services/vendas";

type Local = Tables<"locais_estoque">;
type Nome = { nome: string } | null;
export interface AdminData {
  subtarefas: Tables<"pedido_subtarefas">[];
  materiais: Tables<"materiais">[];
  compras: (Tables<"compras"> & { materiais: Nome; locais_estoque: Nome })[];
  vendas: NonNullable<Awaited<ReturnType<typeof loadSales>>["data"]>;
  pedidos: (Tables<"pedidos"> & { locais_estoque: Nome })[];
  pedidoItens: (Tables<"pedido_itens"> & { materiais: Nome; locais_estoque: Nome })[];
  pagamentos: Tables<"pedido_pagamentos">[];
  locais: Local[];
  vendedores: Tables<"vendedores">[];
  locaisTodos: Local[];
  vendedoresTodos: Tables<"vendedores">[];
  estoqueLocal: (Tables<"estoque_por_local"> & { locais_estoque: Pick<Local, "nome" | "tipo"> | null })[];
}
export type Task = Tables<"tarefas">;
export type Show = (message: string, type?: "success" | "error") => void;
export type TaskChange = (task: Task, status: string) => Promise<unknown>;

export function errorMessage(error: unknown, fallback: string) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
    ? error.message : fallback;
}

export type Order = AdminData["pedidos"][number];
export type OrderItem = AdminData["pedidoItens"][number];
export type Sale = AdminData["vendas"][number];
export type Subtask = AdminData["subtarefas"][number];
export type ChangeEvent = { target: { name?: string; value: string } };

export type ChangeSubtask = (...args:
  | ["create", Pick<Subtask, "pedido_id">, { titulo: string }]
  | ["update", Subtask, Partial<Pick<Subtask, "titulo" | "concluido">>]
  | ["delete", Subtask]
) => Promise<void>;
export interface OrderActions {
  onStatusChange?: (order: Order, status: Order["status"]) => Promise<unknown>;
  onDescriptionSave?: (order: Order, description: string) => Promise<void>;
  onLinksSave?: (order: Order, links: string[], colors: string[]) => Promise<void>;
  onItemStatusChange?: (item: OrderItem, checked: boolean) => Promise<unknown>;
  onSituationSave?: (order: Order, situation: string, description: string) => Promise<void>;
  onSubtaskChange?: ChangeSubtask;
}
export interface DraftItem {
  key?: string;
  material_id: string;
  quantidade: string | number;
  preco_unitario: string | number;
  subtitulo?: string | null;
  local_estoque_id?: string | null;
  caixa?: string | null;
  materiais?: { nome: string } | null;
}
