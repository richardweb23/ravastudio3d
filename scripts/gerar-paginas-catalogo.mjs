import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const site = 'https://ravastudio3d.com.br';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const imageUrl = (product, supabaseUrl) => product.imagens?.[0]?.caminho
  ? `${supabaseUrl}/storage/v1/object/public/catalogo-produtos/${product.imagens[0].caminho.split('/').map(encodeURIComponent).join('/')}`
  : safeUrl(product.imagem_externa) || `${site}/rava-compartilhamento.png`;

export async function loadProducts(url, key) {
  const products = [];
  let total;
  for (let offset = 0; ; offset += 24) {
    const response = await fetch(`${url}/rest/v1/rpc/catalogo_publico`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_ordem: 'novos', p_offset: offset }) });
    if (!response.ok) throw new Error(`Falha ao consultar catálogo (HTTP ${response.status}).`);
    const page = await response.json();
    if (!Array.isArray(page.produtos) || !Number.isSafeInteger(page.total) || page.total < 0 || (total !== undefined && total !== page.total)) throw new Error('O catálogo mudou ou retornou dados inválidos; tente gerar novamente.');
    total = page.total;
    products.push(...page.produtos);
    if (products.length === total) break;
    if (!page.produtos.length || products.length > total) throw new Error('Paginação do catálogo incompleta.');
  }
  if (new Set(products.map(product => product.slug)).size !== products.length) throw new Error('O catálogo contém endereços duplicados.');
  return products;
}

export async function generatePages(products, supabaseUrl, output = 'dist') {
  const template = await readFile(`${output}/catalogo/index.html`, 'utf8');
  const assets = [...template.matchAll(/<(?:script|link)\b[^>]*(?:\.\.\/assets\/)[^>]*>(?:<\/script>)?/g)].map(match => match[0].replaceAll('../assets/', '/assets/')).join('\n');
  if (!assets.includes('<script')) throw new Error('Arquivos do catálogo não encontrados no build.');
  const urls = [`${site}/`, `${site}/catalogo/`, `${site}/links`];
  for (const product of products) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || !product.nome) throw new Error('Produto com endereço ou nome inválido.');
    const url = `${site}/produto/${product.slug}/`;
    const title = `${product.nome} | RAVA Studio 3D`;
    const description = String(product.resumo || product.descricao || `Conheça ${product.nome} no catálogo da RAVA Studio 3D.`).replace(/\s+/g, ' ').trim().slice(0, 200);
    const image = imageUrl(product, supabaseUrl);
    const data = { '@context': 'https://schema.org', '@type': 'Product', name: product.nome, description: product.descricao || description, image: [image], url };
    const json = JSON.stringify(data).replaceAll('<', '\\u003c');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f4efe8"><link rel="icon" href="/favicon-48.png"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="product"><meta property="og:site_name" content="RAVA Studio 3D"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><script type="application/ld+json">${json}</script>${assets}</head><body><div id="root"><main><h1>${escapeHtml(product.nome)}</h1><p>${escapeHtml(product.descricao || description)}</p><img src="${escapeHtml(image)}" alt="${escapeHtml(product.nome)}"><p><a href="/catalogo/">Ver catálogo da RAVA</a></p></main></div></body></html>`;
    await mkdir(`${output}/produto/${product.slug}`, { recursive: true });
    await writeFile(`${output}/produto/${product.slug}/index.html`, html);
    urls.push(url);
  }
  await writeFile(`${output}/catalogo-paginas.json`, JSON.stringify(products.map(product => product.slug)));
  await writeFile(`${output}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!safeUrl(url) || !key) throw new Error('Configure a URL e a chave pública do Supabase para gerar as páginas.');
  const products = await loadProducts(url, key);
  await generatePages(products, url);
  console.log(`${products.length} páginas de produtos geradas.`);
}
