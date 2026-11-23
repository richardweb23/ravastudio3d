import type { CatalogProduct } from '../catalogTypes';
import { catalogMoney } from '../lib/catalogo.js';
import { photo, productUrl } from './shared';

export function ProductCard({ product }: { product: CatalogProduct }) {
  const image = photo(product);
  const price = product.promocional_centavos ?? product.preco_centavos;
  return <a className="rv-product" href={productUrl(product.slug)}>
    <div className="rv-product-image">{image ? <img src={image} alt="" loading="lazy" /> : <span>Imagem indisponível</span>}</div>
    <div className="rv-product-info">
      <small>{product.categoria}</small><h3>{product.nome}</h3>
      {price != null && <strong>{catalogMoney(price)}</strong>}
    </div>
  </a>;
}