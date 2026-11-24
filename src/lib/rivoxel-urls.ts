import { HOST_PREVIA_RIVOXEL } from './marcas.js';

/**
 * Endereços públicos da Rivoxel. O hostname define apenas links de navegação;
 * não concede acesso nem substitui a validação no Worker ou no banco.
 */
export function rivoxelUrls(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  const base = host === "rivoxel.com.br" || host === HOST_PREVIA_RIVOXEL ? "/" : "/rivoxel-preview/";
  const catalog = base + "catalogo/";
  return {
    home: base,
    catalog,
    links: base + "links/",
    product: (slug: string) => catalog + "?produto=" + encodeURIComponent(slug),
  };
}
