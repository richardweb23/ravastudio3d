/** Normalize only for matching: preserve the original comment for display. */
export function normalizeInstagramText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/r\s*\$/g, " moeda ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function matchesInstagramKeyword(comment: string, keywords: readonly string[]) {
  const text = normalizeInstagramText(comment);
  if (!text) return false;
  const padded = ` ${text} `;
  return keywords.some(keyword => {
    const normalized = normalizeInstagramText(keyword);
    return normalized.length > 0 && padded.includes(` ${normalized} `);
  });
}

export const defaultInstagramKeywords = ["preço", "valor", "qual valor", "quanto custa", "quanto fica", "qual o preço", "tem valor", "R$"];

export type InstagramProduct = { nome: string; slug: string; preco_centavos: number; promocional_centavos: number | null; disponivel: boolean };
export function formatInstagramProducts(products: readonly InstagramProduct[], origin = "https://ravastudio3d.com.br") {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.username || base.password) throw new Error("Origem inválida");
  return products.filter(product => product.disponivel).map(product => {
    const cents = product.promocional_centavos ?? product.preco_centavos;
    if (!product.nome.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || !Number.isSafeInteger(cents) || cents < 0) throw new Error("Produto inválido");
    const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
    return `${product.nome} — ${amount}\n${base.origin}/catalogo/?produto=${encodeURIComponent(product.slug)}`;
  }).join("\n\n");
}

export function renderInstagramTemplate(template: string, fields: Record<string, string>, maxLength = 1000) {
  const rendered = template.replace(/\{(produtos|catalogo|whatsapp)\}/g, (_, key: string) => fields[key] ?? "");
  if (Array.from(rendered).length > maxLength) throw new Error("Mensagem excede o limite configurado; reduza o texto ou a quantidade de produtos.");
  return rendered;
}

export type InstagramDecisionInput = {
  comment: string;
  automationEnabled: boolean;
  postEnabled: boolean;
  metaEligible: boolean;
  keywords: readonly string[];
  products: readonly InstagramProduct[];
  missingProduct: 'ignorar' | 'catalogo';
  productTemplate: string;
  fallbackTemplate: string;
  publicReply: string;
  catalogUrl: string;
  whatsappUrl: string;
  maxLength: number;
};

/** Pure decision logic: the caller must independently verify Meta eligibility. */
export function decideInstagramReply(input: InstagramDecisionInput): { eligible: boolean; reason?: string; message?: string; publicReply?: string } {
  if (!input.automationEnabled || !input.postEnabled) return { eligible: false, reason: 'Automação desativada' };
  if (!input.metaEligible) return { eligible: false, reason: 'Elegibilidade não confirmada pela Meta' };
  if (!matchesInstagramKeyword(input.comment, input.keywords)) return { eligible: false, reason: 'Sem palavra-chave' };
  const products = formatInstagramProducts(input.products);
  if (products) {
    if (!input.productTemplate.includes('{produtos}')) throw new Error('Inclua {produtos} na mensagem.');
    return { eligible: true, message: renderInstagramTemplate(input.productTemplate, { produtos: products }, input.maxLength), publicReply: input.publicReply };
  }
  if (input.missingProduct === 'ignorar') return { eligible: false, reason: 'Sem produto disponível' };
  for (const link of [input.catalogUrl, input.whatsappUrl]) {
    const parsed = new URL(link);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Link comercial inválido');
  }
  if (!input.fallbackTemplate.includes('{catalogo}') || !input.fallbackTemplate.includes('{whatsapp}')) throw new Error('Inclua {catalogo} e {whatsapp} na mensagem alternativa.');
  return { eligible: true, message: renderInstagramTemplate(input.fallbackTemplate, { catalogo: input.catalogUrl, whatsapp: input.whatsappUrl }, input.maxLength), publicReply: input.publicReply };
}
