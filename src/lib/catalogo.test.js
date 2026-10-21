/* global URL */
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogCents, catalogCode, catalogSlug, catalogWhatsapp, catalogLink } from "./catalogo.js";
test("catálogo: centavos, códigos permanentes e links de pedido", () => {
  assert.equal(catalogCents("13,50"),1350);
  assert.equal(catalogCents("0.01"),1);
  for (const invalid of ["-1","13.501","NaN","", "1e5","10000001"]) assert.throws(()=>catalogCents(invalid));
  assert.equal(catalogCode(1),"001");assert.equal(catalogCode(1000),"1000");
  assert.equal(catalogSlug("Coração & Café!"),"coracao-cafe");
  assert.equal(catalogLink("peca-001","https://ravastudio3d.com.br"),"https://ravastudio3d.com.br/catalogo/?produto=peca-001");
  const url=new URL(catalogWhatsapp({nome:"Peça & presente",codigo:7,descricao:"Descrição",slug:"peca-007",preco_centavos:2590,promocional_centavos:1990},"https://ravastudio3d.com.br"));
  assert.equal(url.hostname,"wa.me");assert.equal(url.pathname,"/5521984470594");
  const text=url.searchParams.get("text");
  assert.equal(text,"Oi! Vi o produto Peça & presente no catálogo da RAVA e gostaria de mais informações.\n\nhttps://ravastudio3d.com.br/catalogo/?produto=peca-007");
});
