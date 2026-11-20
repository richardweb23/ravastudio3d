import { pathToFileURL } from 'node:url';

const expectedHost = 'api.cloudflare.com';

export async function triggerBuild(hook, fetcher = fetch) {
  let url;
  try { url = new URL(hook); } catch { throw new Error('Deploy hook da Cloudflare inválido ou ausente.'); }
  if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.port || url.username || url.password || url.search || url.hash || !/^\/client\/v4\/workers\/builds\/deploy_hooks\/[0-9a-f-]{36}$/i.test(url.pathname)) {
    throw new Error('Deploy hook da Cloudflare inválido ou ausente.');
  }
  let response;
  try { response = await fetcher(url.href, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('Não foi possível chamar o deploy hook da Cloudflare.'); }
  if (!response.ok) throw new Error(`Deploy hook retornou HTTP ${response.status}.`);
  let body;
  try { body = await response.json(); } catch { throw new Error('Resposta inválida do deploy hook da Cloudflare.'); }
  if (body?.success !== true || !body?.result?.build_uuid) throw new Error('A Cloudflare não confirmou o build.');
  return body.result.build_uuid;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  triggerBuild(process.env.CLOUDFLARE_CATALOGO_HOOK).then(id => console.log(`Build solicitado: ${id}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
