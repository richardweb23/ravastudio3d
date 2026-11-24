import { HOST_PREVIA_RIVOXEL, marcaDoHostname } from '../src/lib/marcas.ts';

type Assets = { fetch(request: Request): Promise<Response> };

// Apenas endereços de homologação conhecidos são aceitos; não confiar em
// cabeçalhos enviados pelo cliente para escolher a marca.
const previasRava = new Set([
  'feat-multi-brand.rivoxel.com.br',
  HOST_PREVIA_RIVOXEL,
]);

/** Roteamento da vitrine Rivoxel, ativo somente no alias de homologação. */
export async function atenderRivoxel(request: Request, assets: Assets): Promise<Response> {
  const url = new URL(request.url);
  const paginas: Record<string, string> = {
    '/': '/rivoxel-preview/',
    '/index.html': '/rivoxel-preview/',
    '/catalogo/': '/rivoxel-preview/catalogo/',
    '/catalogo/index.html': '/rivoxel-preview/catalogo/',
    '/links/': '/rivoxel-preview/links/',
    '/links/index.html': '/rivoxel-preview/links/',
  };
  if (url.pathname === '/catalogo' || url.pathname === '/links') {
    url.pathname += '/';
    return Response.redirect(url.toString(), 308);
  }
  const destino = paginas[url.pathname] ?? (url.pathname.startsWith('/assets/') ? url.pathname : null);
  if (!destino) return new Response('Página não encontrada.', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
  url.pathname = destino;
  const response = await assets.fetch(new Request(url, request));
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function atender(request: Request, assets: Assets): Promise<Response> {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (/^\/(?:rivoxel-preview)(?:\/|$)/i.test(url.pathname) && !previasRava.has(host)) {
    return new Response('Página não encontrada.', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
  }
  if (host === HOST_PREVIA_RIVOXEL) return atenderRivoxel(request, assets);
  const marca = marcaDoHostname(host) ?? (previasRava.has(host) ? 'rava' : null);
  if (!marca) return new Response('Domínio não configurado.', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });

  // O site Rivoxel ainda não está pronto. Não servir conteúdo ou gestão da
  // Rava sob esse domínio; remover este bloqueio somente após homologação.
  if (marca === 'rivoxel') return new Response('Site em preparação.', { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Retry-After': '3600' } });
  return assets.fetch(request);
}

export default { fetch(request: Request, env: { ASSETS: Assets }) { return atender(request, env.ASSETS); } };
