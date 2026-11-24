import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogSiteLink, rivoxelUrls } from "./rivoxel-urls.ts";

test("endereços da Rivoxel mantêm a prévia isolada e usam caminhos definitivos no domínio exato", () => {
  const preview = rivoxelUrls("feat-multi-brand.rivoxel.com.br");
  assert.equal(preview.home, "/rivoxel-preview/");
  assert.equal(preview.catalog, "/rivoxel-preview/catalogo/");
  assert.equal(preview.links, "/rivoxel-preview/links/");
  assert.equal(preview.product("peça & azul"), "/rivoxel-preview/catalogo/?produto=pe%C3%A7a%20%26%20azul");

  const production = rivoxelUrls("RIVOXEL.COM.BR.");
  assert.equal(production.home, "/");
  assert.equal(production.catalog, "/catalogo/");
  assert.equal(production.links, "/links/");
  assert.equal(production.product("peca"), "/catalogo/?produto=peca");

  const previewRoot = rivoxelUrls("feat-multi-brand-ravastudio3d.studiorava3d.workers.dev");
  assert.equal(previewRoot.home, "/");
  assert.equal(previewRoot.catalog, "/catalogo/");
  assert.equal(previewRoot.links, "/links/");
  assert.equal(previewRoot.product("peca"), "/catalogo/?produto=peca");

  assert.equal(rivoxelUrls("rivoxel.com.br.example.com").home, "/rivoxel-preview/");
  assert.equal(rivoxelUrls("ravastudio3d.com.br").home, "/rivoxel-preview/");
});

test('gestão abre produtos no site correspondente e não aceita host desconhecido', () => {
  const preview = 'https://feat-multi-brand.rivoxel.com.br';
  assert.equal(catalogSiteLink('rava', 'peça azul', preview), `${preview}/catalogo/?produto=pe%C3%A7a%20azul`);
  assert.equal(catalogSiteLink('rivoxel', 'peca', preview), 'https://feat-multi-brand-ravastudio3d.studiorava3d.workers.dev/catalogo/?produto=peca');
  assert.equal(catalogSiteLink('rivoxel', 'peca', 'https://ravastudio3d.com.br'), 'https://rivoxel.com.br/catalogo/?produto=peca');
  assert.equal(catalogSiteLink('rivoxel', 'peca', 'https://ravastudio3d.com.br.atacante.test'), null);
  assert.equal(catalogSiteLink('rivoxel', 'peca', 'http://localhost:5173'), null);
});
