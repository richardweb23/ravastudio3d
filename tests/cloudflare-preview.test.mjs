import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewEnvironment } from '../scripts/build-cloudflare-preview.mjs';

const valid = { RAVA_STAGING_SUPABASE_URL: 'https://teste.supabase.co', RAVA_PRODUCTION_SUPABASE_URL: 'https://producao.supabase.co', RAVA_STAGING_SUPABASE_PUBLIC_KEY: 'sb_publishable_teste', VITE_INSTAGRAM_SUPABASE_URL: 'https://real.supabase.co' };

test('prévia exige projetos distintos e desativa configuração do Instagram', () => {
  const env = previewEnvironment(valid);
  assert.equal(env.VITE_SUPABASE_URL, valid.RAVA_STAGING_SUPABASE_URL);
  assert.equal(env.VITE_INSTAGRAM_SUPABASE_URL, '');
  assert.throws(() => previewEnvironment({ ...valid, RAVA_STAGING_SUPABASE_URL: valid.RAVA_PRODUCTION_SUPABASE_URL }), /diferente/);
  assert.throws(() => previewEnvironment({ ...valid, RAVA_STAGING_SUPABASE_URL: 'http://localhost:54321' }), /HTTPS/);
  assert.throws(() => previewEnvironment({ ...valid, RAVA_PRODUCTION_SUPABASE_URL: '' }), /RAVA_PRODUCTION/);
});

test('prévia aceita somente chave pública identificável', () => {
  assert.throws(() => previewEnvironment({ ...valid, RAVA_STAGING_SUPABASE_PUBLIC_KEY: 'sb_secret_real' }), /somente/);
  const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(previewEnvironment({ ...valid, RAVA_STAGING_SUPABASE_PUBLIC_KEY: jwt('anon') }).VITE_SUPABASE_PUBLISHABLE_KEY, jwt('anon'));
  assert.throws(() => previewEnvironment({ ...valid, RAVA_STAGING_SUPABASE_PUBLIC_KEY: jwt('service_role') }), /somente/);
});

test('categorias experimentais só são habilitadas explicitamente no ambiente isolado', () => {
  assert.equal(previewEnvironment(valid).VITE_SITE_CATEGORIAS_EXPERIMENTAL, 'false');
  assert.equal(previewEnvironment({ ...valid, VITE_SITE_CATEGORIAS_EXPERIMENTAL: 'true' }).VITE_SITE_CATEGORIAS_EXPERIMENTAL, 'true');
  assert.equal(previewEnvironment({ ...valid, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feat/multi-brand' }).VITE_SITE_CATEGORIAS_EXPERIMENTAL, 'true');
  assert.equal(previewEnvironment({ ...valid, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'outra' }).VITE_SITE_CATEGORIAS_EXPERIMENTAL, 'false');
  assert.equal(previewEnvironment({ ...valid, RAVA_PREVIEW_MODE: 'public', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_publishable_publica', VITE_SITE_CATEGORIAS_EXPERIMENTAL: 'true' }).VITE_SITE_CATEGORIAS_EXPERIMENTAL, 'false');
});

test('modo público usa somente chave pública e desativa integração Instagram', () => {
  const env = previewEnvironment({ ...valid, RAVA_PREVIEW_MODE: 'public', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_publishable_publica' });
  assert.equal(env.VITE_SUPABASE_URL, valid.RAVA_PRODUCTION_SUPABASE_URL);
  assert.equal(env.VITE_INSTAGRAM_SUPABASE_URL, '');
  assert.throws(() => previewEnvironment({ ...valid, RAVA_PREVIEW_MODE: 'public', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_secret_real' }), /somente/);
});

test('teste com dados reais exige confirmação e chave pública de produção', () => {
  const live = { ...valid, RAVA_PREVIEW_MODE: 'live', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_publishable_producao' };
  assert.throws(() => previewEnvironment(live), /confirmação explícita/);
  const result = previewEnvironment({ ...live, RAVA_LIVE_TEST_CONFIRMED: 'allow-real-data' });
  assert.equal(result.VITE_SUPABASE_URL, valid.RAVA_PRODUCTION_SUPABASE_URL);
  assert.equal(result.VITE_INSTAGRAM_SUPABASE_URL, '');
  assert.throws(() => previewEnvironment({ ...live, RAVA_LIVE_TEST_CONFIRMED: 'allow-real-data', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_secret_proibida' }), /somente/);
});

test('Instagram só é ativado explicitamente no modo live com configuração pública válida', () => {
  const env = { ...valid, RAVA_PREVIEW_MODE: 'live', RAVA_LIVE_TEST_CONFIRMED: 'allow-real-data', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_publishable_producao', RAVA_LIVE_INSTAGRAM_ENABLED: 'true', RAVA_INSTAGRAM_SUPABASE_URL: 'https://instagram.supabase.co', RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY: 'sb_publishable_instagram' };
  assert.equal(previewEnvironment(env).VITE_INSTAGRAM_SUPABASE_URL, env.RAVA_INSTAGRAM_SUPABASE_URL);
  assert.equal(previewEnvironment(env).VITE_INSTAGRAM_SUPABASE_PUBLISHABLE_KEY, env.RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY);
  assert.equal(previewEnvironment({ ...env, RAVA_PREVIEW_MODE: 'staging' }).VITE_INSTAGRAM_SUPABASE_URL, '');
  assert.throws(() => previewEnvironment({ ...env, RAVA_INSTAGRAM_SUPABASE_PUBLIC_KEY:'sb_secret_privada' }), /somente/);
});
