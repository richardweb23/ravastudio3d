import { summarizeLocations } from "../lib/consignacao.js";
import { supabase } from "../supabase.js";
/** @typedef {import('../lib/consignacao').ConsignmentSale} ConsignmentSale */
/** Busca todas as páginas para não truncar o histórico no limite do Supabase. */
async function allRows(table, field, value) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select("*");
    if (field) query = query.eq(field, value);
    query = table === "estoque_por_local" ? query.order("material_id").order("local_id") : table === "consignacao_produtos" ? query.order("material_id").order("local_id") : query.order("id");
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
export async function loadConsignment(type, id) {
  const { data: entity, error } = await supabase.from(type === "vendedor" ? "vendedores" : "locais_estoque").select("*").eq("id", id).single();
  if (error) throw error;
  const localId = type === "local" ? id : entity.local_estoque_id;
  const [materiais, locais, vendedores, acordos, estoque, vendas, movimentos, pagamentos] = await Promise.all([
    allRows("materiais"), allRows("locais_estoque"), allRows("vendedores"),
    ...["consignacao_produtos", "estoque_por_local", "consignacao_vendas", "consignacao_movimentos", "consignacao_pagamentos"].map(table => localId ? allRows(table, "local_id", localId) : Promise.resolve([])),
  ]);
  vendas.sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at));
  movimentos.sort((a, b) => b.created_at.localeCompare(a.created_at));
  pagamentos.sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento));
  return { entity, localId, materiais, locais, vendedores, acordos, estoque, vendas, movimentos, pagamentos };
}
export async function consignmentAction(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export async function loadLocationSummaries() {
  const [estoque, vendas] = await Promise.all([allRows("estoque_por_local"), allRows("consignacao_vendas")]);
  return summarizeLocations({ estoque, vendas });
}
