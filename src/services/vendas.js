import { supabase } from "../supabase.js";

export async function loadSales() {
  const rows = [];
  const statuses = new Map();
  for (let offset=0; ; offset+=500) {
    const {data,error}=await supabase.from("pedidos_financeiro").select("id,status_financeiro").order("id").range(offset,offset+499);
    if(error)return {data:null,error};
    data.forEach(p=>statuses.set(p.id,p.status_financeiro));
    if(data.length<500)break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("vendas")
      .select("*, materiais(nome, categoria), locais_estoque!vendas_local_estoque_id_fkey(nome), vendedores(nome), consignacao_vendas(pagamento_id)")
      .order("data", { ascending: false }).order("id")
      .range(offset, offset + 499);
    if (error) return { data: null, error };
    rows.push(...data.map(s=>({...s,pagamento_pedido:statuses.get(s.pedido_id)})));
    if (data.length < 500) return { data: rows, error: null };
  }
}
