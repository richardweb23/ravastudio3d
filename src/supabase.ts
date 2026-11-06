import type { CashSummary, Movement } from "./cashTypes";
import type { Database } from "./database.types";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const browserKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Postgres reports JSONB for this RPC; its public fields are defined by the catalog migrations.
type PublicSchema = Database["public"];
// These arguments explicitly accept SQL NULL in the project migrations.
type NullArgs<T, K extends string> = T extends { Args: infer A }
  ? Omit<T, "Args"> & { Args: { [P in keyof A]: P extends K ? A[P] | null : A[P] } } : T;
type Functions = PublicSchema["Functions"];
type NullableRpc = {
  vincular_local_vendedor: "p_local_id";
  movimentar_consignacao: "p_outro_local_id" | "p_preco_centavos" | "p_repasse_centavos";
  salvar_despesa_financeira: "p_despesa_id";
  registrar_entrada: "p_fornecedor";
  salvar_material: "p_material_id" | "p_local_id";
  salvar_pedido: "p_pedido_id";
  registrar_venda: "p_vendedor_id";
  editar_venda: "p_vendedor_id";
};
type CatalogRpc = PublicSchema["Functions"]["catalogo_publico"];
export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: Omit<Functions, "catalogo_publico" | "financeiro_resumo" | "financeiro_extrato" | keyof NullableRpc> & { [K in keyof NullableRpc]: NullArgs<Functions[K], NullableRpc[K]> } & {
      financeiro_resumo: Omit<Functions["financeiro_resumo"], "Returns"> & { Returns: CashSummary };
      financeiro_extrato: Omit<Functions["financeiro_extrato"], "Returns"> & { Returns: Movement[] };
      catalogo_publico: Omit<CatalogRpc, "Returns"> & { Returns: import("./catalogTypes").CatalogResult };
    };
  };
};
export const isSupabaseConfigured = Boolean(
  url &&
    browserKey &&
    !url.includes("seu-projeto") &&
    !browserKey.includes("sua-chave"),
);

export const supabase = isSupabaseConfigured
  ? createClient<AppDatabase>(url, browserKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function managementUrl() {
  return `${window.location.origin}${window.location.pathname.replace(/\/?$/, "/")}`;
}

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}
