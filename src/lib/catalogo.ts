export const catalogCode = (value: unknown) => String(value ?? "").padStart(3, "0");
export const catalogSlug = (value: unknown) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const catalogMoney = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents) / 100);
export function catalogCents(value: unknown) {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw Error("Informe um preço válido com até duas casas decimais.");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 1000000000) throw Error("Preço fora do limite permitido.");
  return cents;
}
export function catalogLink(slug: string, origin = window.location.origin, publishedPage = false) {
  return publishedPage ? `${origin}/produto/${encodeURIComponent(slug)}/` : `${origin}/catalogo/?produto=${encodeURIComponent(slug)}`;
}
export function catalogWhatsapp(product: { nome: string; slug: string; pagina_publicada?: boolean }, origin?: string) {
  return "https://wa.me/5521984470594?text=" + encodeURIComponent(
    `Oi! Vi o produto ${product.nome} no catálogo da RAVA e gostaria de mais informações.\n\n${catalogLink(product.slug, origin, product.pagina_publicada)}`
  );
}

export function marketplaceUrl(value: unknown) {
  try { const u = new URL(String(value || '').trim()); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
