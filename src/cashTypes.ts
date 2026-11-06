import type { Database, Tables } from "./database.types";
export interface CashSummary {
  abertura: string | null;
  caixas: { nome: string; saldo_centavos: number }[];
  socios: Database["public"]["Functions"]["financeiro_saldos_socios"]["Returns"];
  entradas_centavos: number;
  saidas_centavos: number;
}
export type Movement = Tables<"financeiro_movimentos"> & {
  estornado: boolean;
  origem?: {
    titulo?: string;
    data?: string;
    valor_centavos?: number;
    parcela?: string;
    metodo?: string;
    quantidade?: number;
    devolvida?: boolean;
    rateio?: { caixa: string; valor_centavos: number }[];
  } | null;
  reembolso?: { socio: string; itens: { pagamento_id: string; despesa: string; parcela: number; valor_centavos: number }[] } | null;
};
