import { HOST_PREVIA_RIVOXEL, marcaDoHostname } from '../src/lib/marcas.ts';

type Assets = { fetch(request: Request): Promise<Response> };

/** Confere a classificação atual antes de entregar páginas geradas no último build. */
export async function produtoRavaPublicado(request: Request, assets: Assets, consultar: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(request.url);
  const match = /^\/produto\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|\/index\.html)?$/.exec(url.pathname);
  if (!match) return new Response('Página não encontrada.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  try {
    const configUrl = new URL('/site-catalog-config.json', url);
    const configResponse = await assets.fetch(new Request(configUrl));
    if (!configResponse.ok) throw new Error('Configuração indisponível');
    const config = await configResponse.json() as { url?: string; key?: string };
    const supabase = new URL(config.url || '');
    if (supabase.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(supabase.hostname) || supabase.pathname !== '/' || supabase.search || supabase.hash || supabase.username || supabase.password || supabase.port || !config.key) throw new Error('Configuração inválida');
    const response = await consultar(`${supabase.origin}/rest/v1/rpc/site_catalogo_publico`, {
      method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_principal_id: 'rava', p_slug: match[1] }),
    });
    if (!response.ok) throw new Error('Catálogo indisponível');
    const resultado = await response.json() as { produtos?: unknown; total?: unknown };
    if (!Array.isArray(resultado.produtos) || !Number.isSafeInteger(resultado.total) || resultado.total as number < 0) throw new Error('Resposta inválida');
    if (resultado.total === 0 || resultado.produtos.length === 0) return new Response('Produto não encontrado.', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    return null;
  } catch {
    return new Response('Catálogo temporariamente indisponível.', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
}

// Apenas endereços de homologação conhecidos são aceitos; não confiar em
// cabeçalhos enviados pelo cliente para escolher a marca.
const previasRava = new Set([
  'feat-multi-brand.rivoxel.com.br',
  HOST_PREVIA_RIVOXEL,
]);

/** A versão pública exige ativação explícita; a prévia continua isolada. */
export async function atenderRivoxel(request: Request, assets: Assets, publicacao = false): Promise<Response> {
  const url = new URL(request.url);
  const base = publicacao ? '/rivoxel-site' : '/rivoxel-preview';
  const paginas: Record<string, string> = {
    '/': `${base}/`,
    '/index.html': `${base}/`,
    '/catalogo/': `${base}/catalogo/`,
    '/catalogo/index.html': `${base}/catalogo/`,
    '/links/': `${base}/links/`,
    '/links/index.html': `${base}/links/`,
    ...(publicacao ? { '/robots.txt': `${base}/robots.txt`, '/sitemap.xml': `${base}/sitemap.xml` } : {}),
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
  if (!publicacao) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function atender(request: Request, assets: Assets, rivoxelAtiva = false): Promise<Response> {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (url.pathname === '/site-catalog-config.json') return new Response('Página não encontrada.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (/^\/rivoxel-site(?:\/|$)/i.test(url.pathname) || (/^\/rivoxel-preview(?:\/|$)/i.test(url.pathname) && !previasRava.has(host))) {
    return new Response('Página não encontrada.', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
  }
  if (host === HOST_PREVIA_RIVOXEL) return atenderRivoxel(request, assets);
  const marca = marcaDoHostname(host) ?? (previasRava.has(host) ? 'rava' : null);
  if (!marca) return new Response('Domínio não configurado.', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });

  if (marca === 'rivoxel') return rivoxelAtiva ? atenderRivoxel(request, assets, true) : new Response('Site em preparação.', { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Retry-After': '3600' } });
  if (rivoxelAtiva && host === 'ravastudio3d.com.br' && url.pathname.startsWith('/produto/')) {
    const bloqueio = await produtoRavaPublicado(request, assets);
    if (bloqueio) return bloqueio;
    const response = await assets.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return assets.fetch(request);
}

export default { fetch(request: Request, env: { ASSETS: Assets; RIVOXEL_SITE_ENABLED?: string }) { return atender(request, env.ASSETS, env.RIVOXEL_SITE_ENABLED === 'true'); } };
