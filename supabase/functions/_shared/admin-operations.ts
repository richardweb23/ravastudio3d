import { readMainCatalog } from './main-catalog.ts';
type Options = { url: string; serviceKey: string; mainUrl: string; mainKey: string; request?: typeof fetch };
const postId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,128}$/.test(v);
const productId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fields = new Set(['ativa', 'palavras_chave', 'resposta_publica', 'mensagem_produto', 'mensagem_alternativa', 'catalogo_url', 'whatsapp_url', 'sem_produto']);

export function instagramAdminOperations(options: Options) {
  const base = new URL(options.url);
  if (base.protocol !== 'https:' || !options.serviceKey || !options.mainUrl || !options.mainKey) throw new Error('Backend não configurado');
  const request = options.request || fetch;
  async function db(path: string, init: RequestInit = {}) {
    const response = await request(`${base.origin}/rest/v1/${path}`, { ...init, headers: { apikey: options.serviceKey, Authorization: `Bearer ${options.serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    if (!response.ok) throw new Error(`Banco indisponível (${response.status})`);
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }
  async function count(statuses: string[] | null, since: string) {
    const query = new URLSearchParams({ select: 'id', created_at: `gte.${since}` });
    if (statuses) query.set('status', `in.(${statuses.join(',')})`);
    const response = await request(`${base.origin}/rest/v1/instagram_atividade?${query}`, { method: 'HEAD', headers: { apikey: options.serviceKey, Authorization: `Bearer ${options.serviceKey}`, Prefer: 'count=exact' } });
    if (!response.ok) throw new Error('Métricas indisponíveis');
    const match = /\/(\d+)$/.exec(response.headers.get('content-range') || '');
    if (!match) throw new Error('Métricas incompletas');
    return Number(match[1]);
  }
  async function allRows(table: string, order: string) {
    const all: unknown[] = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const params = new URLSearchParams({ select: '*', order, limit: '500', offset: String(offset) });
      const rows = await db(`${table}?${params}`);
      if (!Array.isArray(rows)) throw new Error('Lista inválida');
      all.push(...rows);
      if (rows.length < 500) return all;
    }
    throw new Error('Lista de publicações excede o limite');
  }
  return async (action: string, data: Record<string, unknown>): Promise<unknown> => {
    if (action === 'overview') {
      const [settings, posts, bindings] = await Promise.all([db('instagram_configuracao?select=*'), allRows('instagram_publicacoes', 'publicada_em.desc.nullslast,id.asc'), allRows('instagram_publicacao_produtos', 'publicacao_id.asc,material_id.asc')]);
      return { settings: settings?.[0] || null, posts, bindings };
    }
    if (action === 'summary') {
      const days = Number(data.days);
      if (![7, 30, 90].includes(days)) throw new Error('Período inválido');
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const sent = ['envio_privado_confirmado', 'resposta_publica_iniciada', 'resposta_publica_incerta', 'resposta_publica_recusada', 'enviado'];
      const attempted = [...sent, 'envio_privado_iniciado', 'envio_privado_incerto', 'envio_privado_recusado'];
      const failures = ['falha', 'envio_privado_incerto', 'envio_privado_recusado', 'resposta_publica_incerta', 'resposta_publica_recusada'];
      const [identified, messages, attempts, failed] = await Promise.all([count(null, since), count(sent, since), count(attempted, since), count(failures, since)]);
      return { identified, messages, attempts, failed };
    }
    if (action === 'activity') {
      const page = Number(data.page ?? 0);
      if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new Error('Página inválida');
      const status = data.status ?? '';
      if (typeof status !== 'string' || (status && !/^[a-z_]{1,64}$/.test(status))) throw new Error('Filtro inválido');
      const params = new URLSearchParams({ select: '*', order: 'created_at.desc,id.desc', limit: '21', offset: String(page * 20) });
      if (status) params.set('status', `eq.${status}`);
      const rows = await db(`instagram_atividade?${params}`) as unknown[];
      return { rows: rows.slice(0, 20), hasMore: rows.length > 20 };
    }
    if (action === 'settings') {
      const values = data.values;
      if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length || Object.keys(values).some(key => !fields.has(key))) throw new Error('Configuração inválida');
      const updated = await db('instagram_configuracao?id=eq.true', { method: 'PATCH', body: JSON.stringify(values), headers: { Prefer: 'return=representation' } });
      if (!Array.isArray(updated) || updated.length !== 1) throw new Error('Configuração não encontrada');
      return { ok: true };
    }
    if (action === 'monitor') {
      if (!postId(data.postId) || typeof data.enabled !== 'boolean') throw new Error('Publicação inválida');
      const updated = await db(`instagram_publicacoes?id=eq.${encodeURIComponent(data.postId)}`, { method: 'PATCH', body: JSON.stringify({ monitorada: data.enabled }), headers: { Prefer: 'return=representation' } });
      if (!Array.isArray(updated) || updated.length !== 1) throw new Error('Publicação não encontrada');
      return { ok: true };
    }
    if (action === 'link' || action === 'unlink') {
      if (!postId(data.postId) || !productId(data.productId)) throw new Error('Vínculo inválido');
      if (action === 'link') {
        const products = await readMainCatalog({ url: options.mainUrl, publishableKey: options.mainKey, ids: [data.productId], request });
        if (!products.length) throw new Error('Produto não publicado');
        await db('instagram_publicacao_produtos', { method: 'POST', body: JSON.stringify({ publicacao_id: data.postId, material_id: data.productId }), headers: { Prefer: 'return=minimal' } });
      } else {
        await db(`instagram_publicacao_produtos?publicacao_id=eq.${encodeURIComponent(data.postId)}&material_id=eq.${encodeURIComponent(data.productId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
      return { ok: true };
    }
    throw new Error('Operação inválida');
  };
}
