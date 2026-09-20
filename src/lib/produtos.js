export const PRODUCT_CATEGORIES = ['Rivoxel', 'Rava', 'Bonecos'];
export function saleProductCategory(sale) {
  return sale.materiais?.categoria || 'Rivoxel';
}
export function matchesProductCategory(sale, category) {
  return !category || saleProductCategory(sale) === category;
}
