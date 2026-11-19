import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { previewEnvironment } from './build-cloudflare-preview.mjs';

export async function validateArtifact(env = process.env, root = 'dist') {
  if (env.RAVA_PREVIEW_MODE !== 'staging') throw Error('A Rivoxel de teste exige modo staging.');
  const safe = previewEnvironment(env);
  let marker, headers;
  try { marker = JSON.parse(await readFile(`${root}/__rava_homologacao.json`, 'utf8')); headers = await readFile(`${root}/_headers`, 'utf8'); }
  catch { throw Error('Artefato de homologação ausente; execute o build de prévia.'); }
  if (marker.mode !== 'staging' || marker.supabaseUrl !== safe.VITE_SUPABASE_URL || !/X-Robots-Tag:\s*noindex/i.test(headers)) throw Error('O artefato não corresponde ao ambiente de homologação.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateArtifact().then(() => {
    const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', 'wrangler.rivoxel-homologacao.jsonc'], { env: process.env, stdio: 'inherit' });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
