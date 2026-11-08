type Comment = { id: string; mediaId: string; authorId: string };
type Config = { apiVersion: string; token: string; request?: typeof fetch };
function endpoint(config: Config, id: string, suffix = '') {
  if (!/^v\d+\.\d+$/.test(config.apiVersion) || !/^\d+$/.test(id) || !config.token) throw new Error('Configuração da Meta inválida');
  return `https://graph.facebook.com/${config.apiVersion}/${id}${suffix}`;
}

/** Return only metadata needed to diagnose a test comment, never the token. */
export async function diagnoseMetaComment(config: Config, commentId: string) {
  const checks = ['id', 'from', 'hidden', 'media', 'parent_id', 'timestamp', 'media{media_product_type}'];
  return Object.fromEntries(await Promise.all(checks.map(async field => {
    const url = new URL(endpoint(config, commentId));
    url.searchParams.set('fields', field);
    const response = await (config.request || fetch)(url, { headers: { Authorization: `Bearer ${config.token}` } });
    const value = await response.json() as Record<string, unknown> & { error?: { code?: unknown; error_subcode?: unknown }; media?: { media_product_type?: unknown } };
    const result: Record<string, unknown> = { status: response.status };
    if (!response.ok) {
      if (typeof value.error?.code === 'number') result.code = value.error.code;
      if (typeof value.error?.error_subcode === 'number') result.subcode = value.error.error_subcode;
    } else if (field === 'hidden') result.value = typeof value.hidden === 'boolean' ? value.hidden : null;
    else if (field === 'timestamp') result.value = typeof value.timestamp === 'string' ? value.timestamp : null;
    else if (field === 'media{media_product_type}') result.value = typeof value.media?.media_product_type === 'string' ? value.media.media_product_type : null;
    else result.present = value[field] != null;
    return [field, result];
  })));
}

export async function verifyMetaComment(config: Config, comment: Comment) {
  const url = new URL(endpoint(config, comment.id));
  url.searchParams.set('fields', 'id,from,hidden,media{id,media_product_type},parent_id,timestamp');
  const response = await (config.request || fetch)(url, { headers: { Authorization: `Bearer ${config.token}` } });
  if (!response.ok) throw new Error(`Falha ao verificar comentário (${response.status})`);
  const value = await response.json() as { id?: string; from?: { id?: string }; hidden?: boolean; parent_id?: string; timestamp?: string; media?: { id?: string; media_product_type?: string } };
  const type = value.media?.media_product_type;
  return { createdAt: value.timestamp || '', mediaType: type === 'FEED' ? 'POST' : type === 'REELS' ? 'REEL' : 'UNKNOWN',
    belongsToAccount: value.id === comment.id && value.media?.id === comment.mediaId && value.from?.id === comment.authorId && value.hidden === false && !value.parent_id };
}

export async function replyToMetaComment(config: Config, comment: Comment, message: string): Promise<{ status: 'confirmed' | 'rejected' | 'unknown' }> {
  const url = new URL(endpoint(config, comment.id, '/replies'));
  url.searchParams.set('message', message);
  if (!message.trim()) throw new Error('Resposta pública vazia');
  try {
    const response = await (config.request || fetch)(url, { method: 'POST', headers: { Authorization: `Bearer ${config.token}` } });
    if (response.status >= 500 || response.status === 429) return { status: 'unknown' };
    if (!response.ok) return { status: 'rejected' };
    const body = await response.json() as { id?: unknown };
    return typeof body.id === 'string' && !!body.id ? { status: 'confirmed' } : { status: 'unknown' };
  } catch { return { status: 'unknown' }; }
}
