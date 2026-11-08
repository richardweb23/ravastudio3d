import { handleMetaWebhook } from '../_shared/meta-webhook.ts';

// JWT is disabled for this function only: Meta authenticates POSTs by HMAC and
// verifies the callback with the separate verify token. Never log request data.
Deno.serve((request: Request) => handleMetaWebhook(request, {
  verifyToken: Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || '',
  appSecret: Deno.env.get('META_APP_SECRET') || '',
  wakeWorker: () => {
    const base = Deno.env.get('SUPABASE_URL'), secret = Deno.env.get('INSTAGRAM_WORKER_SECRET');
    const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (!base || !secret || !runtime) return;
    runtime.waitUntil(fetch(`${base}/functions/v1/instagram-worker`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: '{}',
    }).then(response => { if (!response.ok) console.error('Instagram worker wake-up failed', response.status); })
      .catch(() => console.error('Instagram worker wake-up unavailable')));
  },
  persist: async (digest, payload) => {
    const base = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!base || !key) throw new Error('Missing backend configuration');
    const response = await fetch(`${base}/rest/v1/instagram_eventos_brutos?on_conflict=digest`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ digest, payload }),
    });
    if (!response.ok) throw new Error('Unable to persist event');
  },
}));
