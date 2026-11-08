import { test } from "node:test";
import assert from "node:assert/strict";
import { decideInstagramReply, defaultInstagramKeywords, formatInstagramProducts, matchesInstagramKeyword, normalizeInstagramText, renderInstagramTemplate } from "./instagram.js";

test("identifica expressões completas independentemente de acentos e pontuação", () => {
  for (const text of ["QUAL O PREÇO?", "Quanto custa?!", "Tem valor?", "R$ 10", "qual o VALOR..."]) {
    assert.equal(matchesInstagramKeyword(text, defaultInstagramKeywords), true, text);
  }
  for (const text of ["valorizo seu trabalho", "apreço", "precioso", "", "obrigado!"]) {
    assert.equal(matchesInstagramKeyword(text, defaultInstagramKeywords), false, text);
  }
  assert.equal(matchesInstagramKeyword("olá, tudo bem?", ["", "!!!"]), false);
  assert.equal(normalizeInstagramText("R $  20,00"), "moeda 20 00");
});

test("decisão respeita elegibilidade, monitoramento e preço vigente", () => {
  const input = { comment: 'Qual o valor?', automationEnabled: true, postEnabled: true, metaEligible: true, keywords: defaultInstagramKeywords, products: [{ nome: 'Peça', slug: 'peca-001', preco_centavos: 5000, promocional_centavos: 3900, disponivel: true }], missingProduct: 'ignorar', productTemplate: 'Confira {produtos}', fallbackTemplate: 'Catálogo {catalogo}; contato {whatsapp}', publicReply: 'Enviado', catalogUrl: 'https://example.com/', whatsappUrl: 'https://wa.me/5511999999999', maxLength: 1000 };
  assert.match(decideInstagramReply(input).message, /39,00/);
  for (const field of ['automationEnabled', 'postEnabled', 'metaEligible']) assert.equal(decideInstagramReply({ ...input, [field]: false }).eligible, false);
  assert.equal(decideInstagramReply({ ...input, comment: 'que legal' }).eligible, false);
  assert.equal(decideInstagramReply({ ...input, products: [] }).eligible, false);
  assert.equal(decideInstagramReply({ ...input, products: [], missingProduct: 'catalogo' }).eligible, true);
  assert.throws(() => decideInstagramReply({ ...input, products: [], missingProduct: 'catalogo', whatsappUrl: '' }));
});

test("formata produtos disponíveis com preço vigente sem truncar mensagens", () => {
  const products = [{ nome: "Peça", slug: "peca-001", preco_centavos: 5000, promocional_centavos: 4500, disponivel: true }, { nome: "Oculta", slug: "oculta", preco_centavos: 100, promocional_centavos: null, disponivel: false }];
  const list = formatInstagramProducts(products);
  assert.match(list, /45,00/); assert.match(list, /catalogo\/\?produto=peca-001/); assert.doesNotMatch(list, /Oculta/);
  assert.equal(renderInstagramTemplate("Confira {produtos}", { produtos: list }), `Confira ${list}`);
  assert.throws(() => renderInstagramTemplate("{produtos}", { produtos: "x".repeat(11) }, 10), /limite/);
  assert.throws(() => formatInstagramProducts([{ ...products[0], slug: "../errado" }]), /inválido/);
});
