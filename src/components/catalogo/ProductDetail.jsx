import { useState } from "react";
import CatalogDialog from "./CatalogDialog.jsx";
import { catalogCode, catalogMoney, catalogWhatsapp, marketplaceUrl } from "../../lib/catalogo.js";
import { catalogImageUrl } from "../../services/catalogo.js";
export default function ProductDetail({ product, onClose, preview = false }) {
  const [selected, setSelected] = useState(0);
  const images = product.imagens || [];
  const image = images[selected] || images[0];
  return <CatalogDialog title={product.nome} onClose={onClose}>
    {preview && <p role="status">Prévia — as alterações precisam ser salvas para aparecer no site.</p>}
    <div className="catalog-detail-grid">
      <div>
        {image || product.imagem_externa ? <img className="catalog-detail-image" src={image ? catalogImageUrl(image.caminho) : product.imagem_externa} alt={image?.alt || product.nome} /> : <div className="catalog-no-image">Imagem em breve</div>}
        <div className="catalog-thumbnails">{images.map((item, index) => <button type="button" key={item.id} aria-label={`Ver foto ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={catalogImageUrl(item.miniatura)} alt="" /></button>)}</div>
      </div>
      <div className="catalog-detail-info">
        <p className="catalog-eyebrow">{product.categoria || "RAVA Studio 3D"}{product.codigo != null && ` · ${catalogCode(product.codigo)}`}</p>
        {!product.marketplace && <div className="catalog-price">{product.promocional_centavos != null && <del>{catalogMoney(product.preco_centavos)}</del>}<strong>{catalogMoney(product.promocional_centavos ?? product.preco_centavos)}</strong></div>}
        <p className="catalog-description">{product.descricao}</p>
        <dl>{[["Material", product.material], ["Dimensões", product.dimensoes], ["Peso", product.peso_gramas != null && `${product.peso_gramas} g`], ["Cores", product.cores], ["Prazo de produção", product.prazo], ["Personalização", product.personalizavel && (product.marketplace ? "Disponível — consulte o anúncio" : "Disponível — consulte pelo WhatsApp")]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {product.marketplace ? (marketplaceUrl(product.link_marketplace) ? <a className="catalog-cta" href={marketplaceUrl(product.link_marketplace)} target="_blank" rel="noopener noreferrer">Comprar produto ↗</a> : <p>Link de compra indisponível.</p>) : <a className="catalog-cta" href={catalogWhatsapp(product)} target="_blank" rel="noopener noreferrer">Quero este produto ↗</a>}
      </div>
    </div>
  </CatalogDialog>;
}
