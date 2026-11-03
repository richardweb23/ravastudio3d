import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePages, loadProducts } from '../scripts/gerar-paginas-catalogo.mjs';

test('gera páginas seguras e sitemap com os produtos fornecidos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rava-seo-'));
  try {
    await mkdir(join(dir, 'catalogo'));
    await writeFile(join(dir, 'catalogo/index.html'), '<script type="module" src="../assets/catalogo.js"></script><link rel="stylesheet" href="../assets/catalogo.css">');
    await generatePages([{ slug: 'vaso-verde', nome: 'Vaso & verde', descricao: 'Peça </script><script>teste</script>', imagens: [{ caminho: 'vasos/um.webp' }] }, { slug: 'indicacao', nome: 'Indicação', marketplace: true, imagem_externa: 'https://example.com/foto.jpg' }], 'https://example.supabase.co', dir);
    const html = await readFile(join(dir, 'produto/vaso-verde/index.html'), 'utf8');
    assert.match(html, /<title>Vaso &amp; verde/);
    assert.match(html, /href="https:\/\/ravastudio3d.com.br\/produto\/vaso-verde\/"/);
    assert.match(html, /src="\/assets\/catalogo.js"/);
    assert.doesNotMatch(html, /<script>teste/);
    assert.match(html, /catalogo-produtos\/vasos\/um.webp/);
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'catalogo-paginas.json'), 'utf8')), ['vaso-verde', 'indicacao']);
    assert.match(await readFile(join(dir, 'sitemap.xml'), 'utf8'), /produto\/indicacao\//);
    await assert.rejects(generatePages([{ slug: '../escape', nome: 'Inválido' }], 'https://example.com', dir));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('interrompe geração se a paginação estiver incompleta', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ total: 1, produtos: [] }) });
  try { await assert.rejects(loadProducts('https://example.com', 'public-key'), /Paginação/); }
  finally { globalThis.fetch = original; }
});
