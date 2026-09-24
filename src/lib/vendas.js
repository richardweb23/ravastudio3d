export function saleTotal(sale) {
  return sale.devolvida_em ? 0 : Number(sale.quantidade || 0) * Number(sale.preco_unitario || 0);
}
export function saleQuantity(sale) {
  return sale.devolvida_em ? 0 : Number(sale.quantidade || 0);
}

export const SALES_BOXES = ['Rivoxel', 'Rava', 'Bonecos'];
export function salesByBox(sales, month) {
  const totals = Object.fromEntries(SALES_BOXES.map(box => [box, 0]));
  for (const sale of sales) {
    if (sale.pago !== true) continue;
    if (month && !sale.data?.startsWith(month)) continue;
    const box = sale.caixa || 'Rivoxel';
    if (Object.hasOwn(totals, box)) totals[box] += saleTotal(sale);
  }
  return totals;
}
