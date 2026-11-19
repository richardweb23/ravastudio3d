import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateArtifact } from '../scripts/deploy-rivoxel-homologacao.mjs';

test('deployment de teste exige artefato staging correto e noindex', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rava-preview-'));
  const env = { RAVA_PREVIEW_MODE:'staging', RAVA_PRODUCTION_SUPABASE_URL:'https://producao.supabase.co', RAVA_STAGING_SUPABASE_URL:'https://teste.supabase.co', RAVA_STAGING_SUPABASE_PUBLIC_KEY:'sb_publishable_teste' };
  try {
    await assert.rejects(validateArtifact(env,dir), /ausente/);
    await writeFile(join(dir,'__rava_homologacao.json'), JSON.stringify({mode:'staging',supabaseUrl:env.RAVA_STAGING_SUPABASE_URL}));
    await writeFile(join(dir,'_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
    await validateArtifact(env,dir);
    await assert.rejects(validateArtifact({...env,RAVA_PREVIEW_MODE:'public'},dir), /staging/);
    await writeFile(join(dir,'_headers'), '');
    await assert.rejects(validateArtifact(env,dir), /não corresponde/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
