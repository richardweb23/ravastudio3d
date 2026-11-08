import { authorizeMainUser } from './main-auth.ts';

type Payload = { action?: unknown; data?: unknown };
type Dependencies = {
  authorize: (authorization: string) => Promise<boolean>;
  execute: (action: string, data: Record<string, unknown>) => Promise<unknown>;
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const actions = new Set(['overview', 'summary', 'settings', 'monitor', 'link', 'unlink', 'activity']);
export async function handleInstagramAdmin(request: Request, deps: Dependencies): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return new Response('Forbidden', { status: 403, headers: cors });
  try {
    if (!await deps.authorize(authorization)) return new Response('Forbidden', { status: 403, headers: cors });
    if (Number(request.headers.get('content-length') || 0) > 32768) return new Response('Payload too large', { status: 413, headers: cors });
    if (!request.body) return new Response('Invalid request', { status: 400, headers: cors });
    const reader = request.body.getReader();
    const parts: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); return new Response('Payload too large', { status: 413, headers: cors }); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const raw = new TextDecoder().decode(bytes);
    let payload: Payload;
    try { payload = JSON.parse(raw); } catch { return new Response('Invalid request', { status: 400, headers: cors }); }
    if (!payload || typeof payload.action !== 'string' || !actions.has(payload.action) || (payload.data != null && (typeof payload.data !== 'object' || Array.isArray(payload.data)))) return new Response('Invalid request', { status: 400, headers: cors });
    const result = await deps.execute(payload.action, (payload.data || {}) as Record<string, unknown>);
    return Response.json(result, { headers: cors });
  } catch { return new Response('Serviço indisponível', { status: 503, headers: cors }); }
}

export function mainAuthorization(url: string, publishableKey: string) {
  return (authorization: string) => authorizeMainUser({ url, publishableKey, authorization });
}
