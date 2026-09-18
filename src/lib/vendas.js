export function saleTotal(sale) {
  return sale.devolvida_em ? 0 : Number(sale.quantidade || 0) * Number(sale.preco_unitario || 0);
}
export function saleQuantity(sale) {
  return sale.devolvida_em ? 0 : Number(sale.quantidade || 0);
}
