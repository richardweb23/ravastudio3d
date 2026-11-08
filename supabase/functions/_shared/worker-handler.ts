import { instagramSendEnabled } from './send-gate.ts';
type Result = 'empty' | 'processed' | 'failed' | 'lease_lost';
type Dependencies = { secret: string; ready: boolean; sendEnabled?: string; run: () => Promise<Result>; clean: () => Promise<void>; diagnose?: () => Promise<unknown>; setupVault?: () => Promise<void> };
async function sameSecret(actual: string, expected: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(actual)), crypto.subtle.digest('SHA-256', encoder.encode(expected))]);
  const first = new Uint8Array(a), second = new Uint8Array(b);
  return first.reduce((diff, value, index) => diff | (value ^ second[index]), 0) === 0;
}
export async function handleInstagramWorker(request: Request, deps: Dependencies): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const auth = request.headers.get('authorization') || '';
  if (!deps.secret || !auth.startsWith('Bearer ') || !await sameSecret(auth.slice(7), deps.secret)) return new Response('Forbidden', { status: 403 });
  if (!deps.ready) return new Response('Not configured', { status: 503 });
  try {
    if (new URL(request.url).searchParams.get('setup_vault') === '1') {
      if (!deps.setupVault) return new Response('Not configured', { status: 503 });
      await deps.setupVault(); return Response.json({ configured: true });
    }
    if (new URL(request.url).searchParams.get('maintenance') === '1') { await deps.clean(); return Response.json({ cleaned: true }); }
    if (new URL(request.url).searchParams.get('diagnostic') === '1') {
      if (!deps.diagnose) return new Response('Not configured', { status: 503 });
      return Response.json(await deps.diagnose());
    }
    if (!instagramSendEnabled(deps.sendEnabled)) return new Response('Send gate disabled', { status: 503 });
    let processed = 0;
    for (; processed < 20; processed++) {
      const outcome = await deps.run();
      if (outcome === 'empty') break;
      if (outcome === 'failed' || outcome === 'lease_lost') return Response.json({ status: outcome, processed }, { status: 503 });
    }
    return Response.json({ processed });
  } catch { return new Response('Worker unavailable', { status: 503 }); }
}
