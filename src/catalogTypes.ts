import type { Tables } from "./database.types";

export type CatalogImage = Pick<Tables<"catalogo_imagens">, "id" | "caminho" | "miniatura" | "alt">;
export type CatalogProduct = Pick<Tables<"catalogo_produtos">,
  "slug" | "descricao" | "resumo" | "promocional_centavos" | "material" | "dimensoes" | "peso_gramas" |
  "cores" | "personalizavel" | "prazo" | "destaque" | "link_marketplace"
> & {
  id: string;
  nome: string;
  codigo: number | null;
  categoria: string | null;
  preco_centavos: number | null;
  marketplace: boolean;
  imagem_externa?: string | null;
  imagens: CatalogImage[];
  pagina_publicada?: boolean;
};
export interface CatalogResult {
  produtos: CatalogProduct[];
  categorias: Pick<Tables<"catalogo_categorias">, "id" | "nome">[];
  total: number;
}
