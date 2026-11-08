import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instagramAdminOperations } from '../../supabase/functions/_shared/admin-operations.ts';

test('operações administrativas limitam campos e não permitem consultas arbitrárias', async () => {
  const calls = [];
  const execute = instagramAdminOperations({ url: 'https://instagram.supabase.co', serviceKey: 'segredo', mainUrl: 'https://principal.supabase.co', mainKey: 'publica', request: async (url, init) => { calls.push([url, init]); return Response.json([{ id: '123' }]); } });
  await assert.rejects(execute('settings', { values: { secret: 'x' } }), /inválida/);
  await assert.rejects(execute('monitor', { postId: '../foo', enabled: true }), /inválida/);
  await assert.rejects(execute('link', { postId: '123', productId: 'não-é-uuid' }), /inválido/);
  await assert.rejects(execute('qualquer', {}), /inválida/);
  assert.equal(calls.length, 0);
  assert.deepEqual(await execute('monitor', { postId: '123', enabled: false }), { ok: true });
  assert.equal(new URL(calls[0][0]).pathname, '/rest/v1/instagram_publicacoes');
  const empty = instagramAdminOperations({ url: 'https://instagram.supabase.co', serviceKey: 'segredo', mainUrl: 'https://principal.supabase.co', mainKey: 'publica', request: async () => Response.json([]) });
  await assert.rejects(empty('monitor', { postId: '123', enabled: true }), /não encontrada/);
});

test('resumo usa contagens reais e falha quando o servidor não fornece total', async () => {
  const options = { url: 'https://instagram.supabase.co', serviceKey: 'segredo', mainUrl: 'https://principal.supabase.co', mainKey: 'publica', request: async () => new Response(null, { status: 200, headers: { 'content-range': '0-0/5' } }) };
  const execute = instagramAdminOperations(options);
  assert.deepEqual(await execute('summary', { days: 30 }), { identified: 5, messages: 5, attempts: 5, failed: 5 });
  await assert.rejects(execute('summary', { days: 1 }), /inválido/);
  await assert.rejects(instagramAdminOperations({ ...options, request: async () => new Response(null, { status: 200 }) })('summary', { days: 30 }), /incompletas/);
});
