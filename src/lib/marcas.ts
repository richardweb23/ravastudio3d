export type MarcaPublica = 'rava' | 'rivoxel';

/** Alias exclusivo da branch de homologação, sem efeito nos domínios públicos. */
export const HOST_PREVIA_RIVOXEL = 'feat-multi-brand-ravastudio3d.studiorava3d.workers.dev';

/** Identifica apenas domínios explicitamente autorizados; não concede acesso a dados. */
export function marcaDoHostname(hostname: string): MarcaPublica | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (host === 'ravastudio3d.com.br') return 'rava';
  if (host === 'rivoxel.com.br') return 'rivoxel';
  return null;
}
