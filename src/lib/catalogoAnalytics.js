export function catalogClickParameters(product, action, location) {
  return {
    produto_id: String(product.id),
    produto_nome: product.nome,
    produto_categoria: product.categoria || 'Sem categoria',
    tipo_clique: action,
    local_clique: location,
  };
}

export function trackCatalogClick(product, action, location) {
  trackCatalogEvent('catalogo_clique_produto', catalogClickParameters(product, action, location));
}

export function trackCatalogEvent(name, parameters = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', name, parameters);
}

// Avoid sending obvious contact details or URLs entered in the search field.
export function catalogSearchTerm(value) {
  const term = value.trim().slice(0, 100);
  if (!term || /@|https?:|www\.|\d[\d\s().+-]{6,}\d/i.test(term)) return null;
  return term;
}
