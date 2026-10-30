export function saleTotal(sale) {
  return sale.devolvida_em ? 0 : Number(sale.quantidade || 0) * Number(sale.preco_unitario || 0);
}
export function saleQuantity(sale) {
  return sale.devolvida_em ? 0 : Number(sale.quantidade || 0);
}

export const SALES_BOXES = ['Rivoxel', 'Rava', 'Bonecos'];
export const CASH_BOXES = [...SALES_BOXES, 'Materiais Bonecos'];

export function bonecosTransferCost(sale) {
  if (sale.caixa !== 'Bonecos' || sale.custo_producao_venda == null) return null;
  return { unit: Number(sale.custo_producao_venda), total: Math.round(Number(sale.custo_producao_venda) * Number(sale.quantidade || 0) * 100) / 100 };
}
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

// Cost uses the current product registration; returned units are back in stock.
export function saleCostCents(sale) {
  if (sale.devolvida_em) return 0;
  const cost = Number(sale.materiais?.custo_medio || 0);
  const quantity = Number(sale.quantidade || 0);
  return Math.round((cost * quantity + Number.EPSILON) * 100);
}
export function salesCostTotal(sales) {
  return sales.reduce((total, sale) => total + saleCostCents(sale), 0) / 100;
}