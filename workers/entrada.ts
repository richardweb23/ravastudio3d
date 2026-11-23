import { marcaDoHostname } from '../src/lib/marcas.ts';

type Assets = { fetch(request: Request): Promise<Response> };

// Apenas endereços de homologação conhecidos são aceitos; não confiar em
// cabeçalhos enviados pelo cliente para escolher a marca.
const previasRava = new Set([
  'feat-multi-brand.rivoxel.com.br',
  'feat-multi-brand-ravastudio3d.studiorava3d.workers.dev',
]);

export async function atender(request: Request, assets: Assets): Promise<Response> {
  const host = new URL(request.url).hostname.toLowerCase();
  const marca = marcaDoHostname(host) ?? (previasRava.has(host) ? 'rava' : null);
  if (!marca) return new Response('Domínio não configurado.', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });

  // O site Rivoxel ainda não está pronto. Não servir conteúdo ou gestão da
  // Rava sob esse domínio; remover este bloqueio somente após homologação.
  if (marca === 'rivoxel') return new Response('Site em preparação.', { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Retry-After': '3600' } });
  return assets.fetch(request);
}

export default { fetch(request: Request, env: { ASSETS: Assets }) { return atender(request, env.ASSETS); } };
