import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeMainUser } from '../../supabase/functions/_shared/main-auth.ts';

test('autoriza somente sessão válida com perfil ativo no projeto principal', async () => {
  let requests = 0;
  const base = { url: 'https://principal.supabase.co', publishableKey: 'publica', authorization: 'Bearer jwt', request: async url => { requests++; return Response.json(url.endsWith('/auth/v1/user') ? { id: '10000000-0000-4000-8000-000000000001' } : [{ ativo: true }]); } };
  assert.equal(await authorizeMainUser(base), true); assert.equal(requests, 2);
  assert.equal(await authorizeMainUser({ ...base, authorization: '' }), false);
  assert.equal(await authorizeMainUser({ ...base, request: async url => Response.json(url.endsWith('/auth/v1/user') ? { id: '10000000-0000-4000-8000-000000000001' } : [{ ativo: false }]) }), false);
  assert.equal(await authorizeMainUser({ ...base, request: async () => new Response(null, { status: 401 }) }), false);
  await assert.rejects(authorizeMainUser({ ...base, request: async () => new Response(null, { status: 503 }) }), /indisponível/);
});
