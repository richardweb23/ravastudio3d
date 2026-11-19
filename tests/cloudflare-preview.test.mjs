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

test('modo público usa somente chave pública e desativa integração Instagram', () => {
  const env = previewEnvironment({ ...valid, RAVA_PREVIEW_MODE: 'public', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_publishable_publica' });
  assert.equal(env.VITE_SUPABASE_URL, valid.RAVA_PRODUCTION_SUPABASE_URL);
  assert.equal(env.VITE_INSTAGRAM_SUPABASE_URL, '');
  assert.throws(() => previewEnvironment({ ...valid, RAVA_PREVIEW_MODE: 'public', RAVA_PRODUCTION_SUPABASE_PUBLIC_KEY: 'sb_secret_real' }), /somente/);
});
