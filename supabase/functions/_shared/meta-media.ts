type Media = { id: string; caption?: string; permalink?: string; media_url?: string; thumbnail_url?: string; timestamp?: string };
export async function syncMetaMedia(options: { accountId: string; apiVersion: string; token: string; save: (items: Media[]) => Promise<void>; request?: typeof fetch }) {
  if (!/^\d+$/.test(options.accountId) || !/^v\d+\.\d+$/.test(options.apiVersion) || !options.token) throw new Error('Configuração inválida');
  let after = ''; const visited = new Set<string>(); let total = 0;
  for (let page = 0; page < 200; page++) {
    const url = new URL(`https://graph.facebook.com/${options.apiVersion}/${options.accountId}/media`);
    url.searchParams.set('fields', 'id,caption,permalink,media_url,thumbnail_url,timestamp');
    url.searchParams.set('limit', '50'); if (after) url.searchParams.set('after', after);
    const response = await (options.request || fetch)(url, { headers: { Authorization: `Bearer ${options.token}` } });
    if (!response.ok) throw new Error(`Falha ao consultar publicações (${response.status})`);
    const result = await response.json() as { data?: Media[]; paging?: { next?: string; cursors?: { after?: string } } };
    if (!Array.isArray(result.data) || result.data.some(item => typeof item.id !== 'string' || !/^\d+$/.test(item.id))) throw new Error('Resposta de publicações inválida');
    await options.save(result.data); total += result.data.length;
    if (!result.paging?.next) return total;
    const cursor = result.paging.cursors?.after;
    if (!cursor || visited.has(cursor)) throw new Error('Paginação incompleta');
    visited.add(cursor); after = cursor;
  }
  throw new Error('Limite de páginas atingido; sincronização incompleta');
}
