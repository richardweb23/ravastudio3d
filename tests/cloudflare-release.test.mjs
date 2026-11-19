import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseEnvironment } from '../scripts/build-cloudflare-release.mjs';

const env = { RAVA_RELEASE_CONFIRMED:'production', RAVA_PRODUCTION_SUPABASE_URL:'https://producao.supabase.co', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY:'sb_publishable_teste', RAVA_STAGING_SUPABASE_URL:'https://teste.supabase.co', RAVA_INSTAGRAM_SUPABASE_URL:'https://instagram.supabase.co', RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY:'sb_publishable_insta' };

test('produção exige autorização explícita, projetos separados e Instagram configurado', () => {
  const value = releaseEnvironment(env);
  assert.equal(value.VITE_SUPABASE_URL, env.RAVA_PRODUCTION_SUPABASE_URL);
  assert.equal(value.VITE_INSTAGRAM_SUPABASE_URL, env.RAVA_INSTAGRAM_SUPABASE_URL);
  assert.throws(() => releaseEnvironment({ ...env, RAVA_RELEASE_CONFIRMED:'' }), /não habilitado/);
  assert.throws(() => releaseEnvironment({ ...env, RAVA_STAGING_SUPABASE_URL:env.RAVA_PRODUCTION_SUPABASE_URL }), /diferentes/);
  assert.throws(() => releaseEnvironment({ ...env, RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY:'sb_secret_invalida' }), /somente/);
});
