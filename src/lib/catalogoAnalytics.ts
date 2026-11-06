export function catalogClickParameters(product: { id: string; nome: string; categoria?: string | null }, action: string, location: string) {
  return {
    produto_id: String(product.id),
    produto_nome: product.nome,
    produto_categoria: product.categoria || 'Sem categoria',
    tipo_clique: action,
    local_clique: location,
  };
}

export function trackCatalogClick(product: { id: string; nome: string; categoria?: string | null }, action: string, location: string) {
  trackCatalogEvent('catalogo_clique_produto', catalogClickParameters(product, action, location));
}

export function trackCatalogEvent(name: string, parameters: Record<string, unknown> = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', name, parameters);
}

// Avoid sending obvious contact details or URLs entered in the search field.
export function catalogSearchTerm(value: string) {
  const term = value.trim().slice(0, 100);
  if (!term || /@|https?:|www\.|\d[\d\s().+-]{6,}\d/i.test(term)) return null;
  return term;
}
