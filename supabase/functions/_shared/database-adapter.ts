type Comment = { id: string; text: string; mediaId: string; authorId: string };
type Event = { digest: string; tentativa_id: string; payload: unknown };

/** Backend-only RPC adapter. The supplied key must never enter browser code. */
export function createInstagramDatabaseAdapter(baseUrl: string, secretKey: string, request: typeof fetch = fetch, testCommentId?: string) {
  const base = new URL(baseUrl);
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)))) throw new Error('Invalid Supabase URL');
  if (!secretKey) throw new Error('Missing backend credentials');
  async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await request(`${base.origin}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Database request failed (${response.status})`);
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  return {
    async claim(): Promise<Event | null> { const rows = testCommentId
      ? await rpc<Event[]>('instagram_reservar_evento_teste', { p_comentario_id: testCommentId })
      : await rpc<Event[]>('instagram_reservar_evento', {}); return rows[0] || null; },
    async finish(event: Event, state: 'concluido' | 'falha') { return rpc<boolean>('instagram_concluir_evento', { p_digest: event.digest, p_tentativa_id: event.tentativa_id, p_estado: state }); },
    async reserve(comment: Comment) { return rpc<boolean>('instagram_reservar_comentario', { p_id: comment.id, p_publicacao_id: comment.mediaId, p_comentario: comment.text }); },
    async record(comment: Comment, state: string, detail?: string) { await rpc('instagram_registrar_estado', { p_id: comment.id, p_estado: state, p_detalhe: detail ?? null }); },
    async products(mediaId: string) { return rpc<Array<{ nome: string; slug: string; preco_centavos: number; promocional_centavos: number | null }>>('instagram_produtos_publicos', { p_publicacao_id: mediaId }); },
    async productIds(mediaId: string) { const rows = await rpc<Array<{ material_id: string }>>('instagram_vinculos', { p_publicacao_id: mediaId }); return rows.map(row => row.material_id); },
    async context(mediaId: string) { return rpc<{ configuracao: Record<string, unknown>; monitorada: boolean }>('instagram_contexto', { p_publicacao_id: mediaId }); },
    async saveMedia(items: unknown[]) { await rpc('instagram_sincronizar_publicacoes', { p_items: items }); },
    async clean() { await rpc('instagram_limpar_registros', {}); },
    async installWorkerVault(secret: string) { await rpc('instagram_instalar_vault_worker', { p_secret: secret }); },
  };
}
