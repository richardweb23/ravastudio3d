export type SitePrincipal = 'rava' | 'rivoxel';
export type SiteSubcategoria = { id: string; principal_id: SitePrincipal; nome: string; ativa: boolean };
export type SiteConfiguracao = {
  principais: { id: SitePrincipal; nome: string }[];
  subcategorias: SiteSubcategoria[];
  produtos: { produto_id: string; principal_id: SitePrincipal; subcategoria_id: string | null }[];
  indicacoes: { indicacao_id: string; principal_id: SitePrincipal; subcategoria_id: string | null }[];
};
