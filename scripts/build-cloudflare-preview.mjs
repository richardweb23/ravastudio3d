import { spawnSync } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function projectUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} deve ser a URL HTTPS do projeto Supabase.`); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} deve ser a URL HTTPS de um projeto Supabase hospedado.`);
  }
  return url.origin;
}

export function previewEnvironment(env) {
  const production = projectUrl(env.RAVA_PRODUCTION_SUPABASE_URL, 'RAVA_PRODUCTION_SUPABASE_URL');
  const mode = env.RAVA_PREVIEW_MODE || 'staging';
  if (!['staging', 'public'].includes(mode)) throw new Error('RAVA_PREVIEW_MODE deve ser staging ou public.');
  const target = mode === 'public' ? production : projectUrl(env.RAVA_STAGING_SUPABASE_URL, 'RAVA_STAGING_SUPABASE_URL');
  if (mode === 'staging' && target === production) throw new Error('O Supabase de homologação deve ser diferente do projeto de produção.');
  const key = ((mode === 'public' ? env.RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY : env.RAVA_STAGING_SUPABASE_PUBLIC_KEY) || '').trim();
  let legacyAnon = false;
  if (key.split('.').length === 3) {
    try { legacyAnon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* invalid JWT */ }
  }
  if (!key.startsWith('sb_publishable_') && !legacyAnon) throw new Error('Informe somente a chave publishable ou anon do Supabase de homologação.');
  return { ...env, VITE_SUPABASE_URL: target, VITE_SUPABASE_PUBLISHABLE_KEY: key, VITE_SUPABASE_ANON_KEY: '', VITE_INSTAGRAM_SUPABASE_URL: '', VITE_INSTAGRAM_SUPABASE_PUBLISHABLE_KEY: '' };
}

function run(args, env) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`A etapa ${args[0]} falhou.`);
}

export async function buildPreview(env = process.env) {
  const safeEnv = previewEnvironment(env);
  run(['node_modules/vite/bin/vite.js', 'build'], safeEnv);
  run(['scripts/gerar-paginas-catalogo.mjs'], safeEnv);
  await writeFile('dist/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
  await writeFile('dist/__rava_homologacao.json', JSON.stringify({ mode: env.RAVA_PREVIEW_MODE || 'staging', supabaseUrl: safeEnv.VITE_SUPABASE_URL }));
  if (env.RAVA_PREVIEW_MODE === 'public') {
    await writeFile('dist/gestao/index.html', '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Gestão indisponível na prévia</title><body><main><h1>Gestão indisponível nesta prévia</h1><p>Esta versão serve apenas para validar o site público.</p><a href="/">Voltar ao site</a></main></body></html>');
  }
  await rm('dist/CNAME', { force: true });
  console.log('Prévia preparada para homologação; confirme o cabeçalho noindex após publicar.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildPreview().catch(error => { console.error(error.message); process.exitCode = 1; });
}
