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

/** Destino de um item publicado a partir da gestão, limitado aos ambientes conhecidos. */
export function catalogSiteLink(site: 'rava' | 'rivoxel', slug: string, managementOrigin: string): string | null {
  let origin: URL;
  try { origin = new URL(managementOrigin); } catch { return null; }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash) return null;
  const host = origin.hostname.toLowerCase();
  const isPreview = host === 'feat-multi-brand.rivoxel.com.br' || host === HOST_PREVIA_RIVOXEL;
  if (!isPreview && host !== 'ravastudio3d.com.br' && host !== 'rivoxel.com.br') return null;
  const destination = isPreview
    ? site === 'rava' ? 'https://feat-multi-brand.rivoxel.com.br' : `https://${HOST_PREVIA_RIVOXEL}`
    : site === 'rava' ? 'https://ravastudio3d.com.br' : 'https://rivoxel.com.br';
  return `${destination}/catalogo/?produto=${encodeURIComponent(slug)}`;
}
