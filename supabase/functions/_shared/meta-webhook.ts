import { verifyMetaSignature } from './meta-signature.ts';

type Options = {
  verifyToken: string;
  appSecret: string;
  persist: (digest: string, payload: unknown) => Promise<void>;
  wakeWorker?: () => void;
};

export async function handleMetaWebhook(request: Request, options: Options): Promise<Response> {
  if (!options.verifyToken || !options.appSecret) return new Response('Not configured', { status: 503 });
  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== options.verifyToken || !params.has('hub.challenge')) return new Response('Forbidden', { status: 403 });
    return new Response(params.get('hub.challenge'), { status: 200 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 262144) return new Response('Too large', { status: 413 });
  if (!request.body) return new Response('Invalid payload', { status: 400 });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 262144) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  if (!await verifyMetaSignature(body, request.headers.get('x-hub-signature-256'), options.appSecret)) return new Response('Forbidden', { status: 403 });
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { return new Response('Invalid payload', { status: 400 }); }
  const entries = Array.isArray(payload) ? payload : [payload];
  if (!entries.length || entries.some(item => !item || typeof item !== 'object' || item.object !== 'instagram')) return new Response('Invalid payload', { status: 400 });
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
  const digest = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
  try { await options.persist(digest, payload); }
  catch { return new Response('Temporarily unavailable', { status: 503 }); }
  // The durable event is already saved; a wake-up failure is recovered by the scheduler.
  try { options.wakeWorker?.(); } catch { /* Scheduler remains the fallback. */ }
  return new Response('EVENT_RECEIVED');
}
