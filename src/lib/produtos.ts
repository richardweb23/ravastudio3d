interface CategorizedSale { materiais?: { categoria?: string | null } | null }

export const PRODUCT_CATEGORIES = ['Rivoxel', 'Rava', 'Bonecos'];
export function saleProductCategory(sale: CategorizedSale) {
  return sale.materiais?.categoria || 'Rivoxel';
}
export function matchesProductCategory(sale: CategorizedSale, category: string) {
  return !category || saleProductCategory(sale) === category;
}
