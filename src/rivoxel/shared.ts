import type { CatalogProduct, CatalogResult } from '../catalogTypes';

import { catalogImageUrl } from '../services/catalogo.js';

export const home = '/rivoxel-preview/';
export const catalog = home + 'catalogo/';
export const links = home + 'links/';
export const instagram = 'https://www.instagram.com/rivoxel.3d/';
export const whatsapp = (message: string) => 'https://wa.me/5521984470594?text=' + encodeURIComponent(message);
export const productUrl = (slug: string) => catalog + '?produto=' + encodeURIComponent(slug);
export const empty: CatalogResult = { produtos: [], categorias: [], total: 0 };
export const photo = (product: CatalogProduct, size: 'principal' | 'miniatura' = 'miniatura') => {
  const image = product.imagens?.[0];
  return image ? catalogImageUrl(size === 'principal' ? image.caminho : image.miniatura) : product.imagem_externa || '';
};