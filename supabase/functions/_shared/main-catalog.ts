type Product = { id: string; nome: string; slug: string; preco_centavos: number; promocional_centavos: number | null };

/** Read only the existing public catalogue; never use the primary service role. */
export async function readMainCatalog(options: { url: string; publishableKey: string; ids: readonly string[]; request?: typeof fetch }): Promise<Product[]> {
  const base = new URL(options.url);
  if (base.protocol !== 'https:' || base.username || base.password || !options.publishableKey) throw new Error('Catálogo principal não configurado');
  const requested = new Set(options.ids);
  if (!requested.size) return [];
  const found = new Map<string, Product>();
  let total: number | null = null;
  for (let offset = 0; offset < 24000; offset += 24) {
    const response = await (options.request || fetch)(`${base.origin}/rest/v1/rpc/catalogo_publico`, {
      method: 'POST', headers: { apikey: options.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ordem: 'novos', p_offset: offset }),
    });
    if (!response.ok) throw new Error(`Catálogo principal indisponível (${response.status})`);
    const page = await response.json() as { total?: unknown; produtos?: unknown };
    if (!Number.isSafeInteger(page.total) || Number(page.total) < 0 || !Array.isArray(page.produtos)) throw new Error('Resposta do catálogo inválida');
    if (total !== null && page.total !== total) throw new Error('Catálogo alterado durante consulta; tente novamente');
    total = Number(page.total);
    for (const item of page.produtos) {
      if (!item || typeof item.id !== 'string') throw new Error('Produto do catálogo inválido');
      if (requested.has(item.id)) found.set(item.id, item as Product);
    }
    if (offset + page.produtos.length >= total) return [...found.values()];
    if (page.produtos.length !== 24) throw new Error('Consulta do catálogo incompleta');
  }
  throw new Error('Limite de consulta do catálogo excedido');
}
