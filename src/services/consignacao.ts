import type { Database } from "../database.types";
import { summarizeLocations } from "../lib/consignacao";
import { requireSupabase } from "../supabase";
import { loadAllTableRows } from "./tableRows";

async function rows<T>(request: Parameters<typeof loadAllTableRows<T>>[0], keys?: string[]) {
  const result = await loadAllTableRows(request, keys);
  if (result.error) throw result.error;
  return result.data;
}
export async function loadConsignment(type: string, id: string) {
  const client = requireSupabase();
  const { data: entity, error } = await client.from(type === "vendedor" ? "vendedores" : "locais_estoque").select("*").eq("id", id).single();
  if (error) throw error;
  const localId = type === "local" ? id : "local_estoque_id" in entity ? entity.local_estoque_id : null;
  const keys = ["material_id", "local_id"];
  const [materiais, locais, vendedores, acordos, estoque, vendas, movimentos, pagamentos] = await Promise.all([
    rows(client.from("materiais").select("*")), rows(client.from("locais_estoque").select("*")), rows(client.from("vendedores").select("*")),
    localId ? rows(client.from("consignacao_produtos").select("*").eq("local_id", localId), keys) : [],
    localId ? rows(client.from("estoque_por_local").select("*").eq("local_id", localId), keys) : [],
    localId ? rows(client.from("consignacao_vendas").select("*").eq("local_id", localId)) : [],
    localId ? rows(client.from("consignacao_movimentos").select("*").eq("local_id", localId)) : [],
    localId ? rows(client.from("consignacao_pagamentos").select("*").eq("local_id", localId).is("estornado_em", null)) : [],
  ]);
  vendas.sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at));
  movimentos.sort((a, b) => b.created_at.localeCompare(a.created_at));
  pagamentos.sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento));
  return { entity, localId, materiais, locais, vendedores, acordos, estoque, vendas, movimentos, pagamentos };
}
export type Consignment = Awaited<ReturnType<typeof loadConsignment>>;
type Action = "salvar_acordo_consignacao" | "pagar_repasses_consignacao" | "movimentar_consignacao" | "vincular_local_vendedor" | "vender_consignacao";
export async function consignmentAction<K extends Action>(name: K, params: Database["public"]["Functions"][K]["Args"]) {
  const {data, error} = await requireSupabase().rpc(name, params);
  if (error) throw error;
  return data;
}
export async function loadLocationSummaries() {
  const client = requireSupabase();
  const [estoque, vendas] = await Promise.all([
    rows(client.from("estoque_por_local").select("*"), ["material_id", "local_id"]),
    rows(client.from("consignacao_vendas").select("*")),
  ]);
  return summarizeLocations({ estoque, vendas });
}
