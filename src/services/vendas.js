import { supabase } from "../supabase.js";

export async function loadSales() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("vendas")
      .select("*, materiais(nome), locais_estoque!vendas_local_estoque_id_fkey(nome), vendedores(nome), consignacao_vendas(pagamento_id)")
      .order("data", { ascending: false }).order("id")
      .range(offset, offset + 499);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < 500) return { data: rows, error: null };
  }
}
