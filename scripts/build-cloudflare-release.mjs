import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { previewEnvironment } from './build-cloudflare-preview.mjs';

export function releaseEnvironment(env) {
  if (env.RAVA_RELEASE_CONFIRMED !== 'production') throw new Error('Build de produção não habilitado.');
  const base = previewEnvironment({ ...env, RAVA_PREVIEW_MODE: 'public' });
  let staging;
  try { staging = new URL(env.RAVA_STAGING_SUPABASE_URL); } catch { throw new Error('Informe a URL do Supabase de homologação para comparação.'); }
  if (staging.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(staging.hostname) || staging.pathname !== '/' || staging.search || staging.hash || staging.username || staging.password || staging.port) throw new Error('URL de homologação inválida.');
  if (staging.origin === base.VITE_SUPABASE_URL) throw new Error('Produção e homologação devem ser projetos diferentes.');
  const instagram = env.RAVA_INSTAGRAM_SUPABASE_URL || '';
  let instagramUrl;
  try { instagramUrl = new URL(instagram); } catch { throw new Error('Configure o Supabase de produção do Instagram.'); }
  if (instagramUrl.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(instagramUrl.hostname) || instagramUrl.pathname !== '/' || instagramUrl.search || instagramUrl.hash || instagramUrl.username || instagramUrl.password || instagramUrl.port) throw new Error('URL do Instagram inválida.');
  const instagramKey = (env.RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY || '').trim();
  const instagramChecked = previewEnvironment({ ...env, RAVA_PREVIEW_MODE: 'public', RAVA_PRODUCTION_SUPABASE_URL: instagramUrl.origin, RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: instagramKey });
  return { ...base, VITE_INSTAGRAM_SUPABASE_URL: instagramUrl.origin, VITE_INSTAGRAM_SUPABASE_PUBLISHABLE_KEY: instagramChecked.VITE_SUPABASE_PUBLISHABLE_KEY };
}

export async function buildRelease(env = process.env) {
  const release = releaseEnvironment(env);
  for (const args of [['node_modules/vite/bin/vite.js', 'build'], ['scripts/gerar-paginas-catalogo.mjs']]) {
    const result = spawnSync(process.execPath, args, { env: release, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('Falha ao preparar o build de produção.');
  }
  await rm('dist/CNAME', { force: true });
  console.log('Build de produção preparado; nenhuma publicação foi realizada.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildRelease().catch(error => { console.error(error.message); process.exitCode = 1; });
}
