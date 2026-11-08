type Dependencies = { authorize: (bearer: string) => Promise<boolean>; sync: () => Promise<number> };
export async function handleInstagramSync(request: Request, dependencies: Dependencies): Promise<Response> {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length <= 7) return new Response('Forbidden', { status: 403, headers: cors });
  try {
    if (!await dependencies.authorize(authorization)) return new Response('Forbidden', { status: 403, headers: cors });
    return Response.json({ total: await dependencies.sync() }, { headers: cors });
  } catch { return new Response('Sincronização indisponível', { status: 503, headers: cors }); }
}
