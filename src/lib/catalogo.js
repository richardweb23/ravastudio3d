export const catalogCode = value => String(value ?? "").padStart(3, "0");
export const catalogSlug = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const catalogMoney = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents) / 100);
export function catalogCents(value) {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw Error("Informe um preço válido com até duas casas decimais.");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 1000000000) throw Error("Preço fora do limite permitido.");
  return cents;
}
export function catalogLink(slug, origin = window.location.origin) {
  return `${origin}/catalogo/?produto=${encodeURIComponent(slug)}`;
}
export function catalogWhatsapp(product, origin) {
  return "https://wa.me/5521984470594?text=" + encodeURIComponent(
    `Oi! Vi o produto ${product.nome} no catálogo da RAVA e gostaria de mais informações.\n\n${catalogLink(product.slug, origin)}`
  );
}
