export function sugestaoRecebimento(valorCentavos, totalCentavos, custoCentavos) {
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || !Number.isSafeInteger(totalCentavos) || totalCentavos <= 0 || custoCentavos == null || custoCentavos < 0) return null;
  const materiais = Math.min(valorCentavos, Math.round(valorCentavos * Math.min(custoCentavos, totalCentavos) / totalCentavos));
  return { materiais, restante: valorCentavos - materiais };
}
export function custoItensPedido(items, materiais) {
  if (!items.length) return null;
  let sum = 0;
  for (const item of items) {
    const product = materiais.find(row => row.id === item.material_id);
    if (product?.custo_medio == null || !Number.isFinite(Number(product.custo_medio))) return null;
    sum += Number(item.quantidade) * Number(product.custo_medio);
  }
  return Math.round(sum * 100);
}
