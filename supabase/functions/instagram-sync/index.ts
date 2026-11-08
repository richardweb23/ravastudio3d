import { createInstagramDatabaseAdapter } from '../_shared/database-adapter.ts';
import { syncMetaMedia } from '../_shared/meta-media.ts';
import { handleInstagramSync } from '../_shared/sync-handler.ts';
import { authorizeMainUser } from '../_shared/main-auth.ts';

Deno.serve((request: Request) => handleInstagramSync(request, {
  async authorize(authorization) {
    const base = Deno.env.get('MAIN_SUPABASE_URL') || '', key = Deno.env.get('MAIN_SUPABASE_PUBLISHABLE_KEY') || '';
    if (!base || !key) throw new Error('Not configured');
    return authorizeMainUser({ url: base, publishableKey: key, authorization });
  },
  async sync() {
    const base = Deno.env.get('SUPABASE_URL') || '', key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const token = Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '', accountId = Deno.env.get('INSTAGRAM_ACCOUNT_ID') || '', apiVersion = Deno.env.get('INSTAGRAM_API_VERSION') || '';
    if (!base || !key || !token || !accountId || !apiVersion) throw new Error('Not configured');
    const db = createInstagramDatabaseAdapter(base, key);
    return syncMetaMedia({ accountId, apiVersion, token, save: db.saveMedia });
  },
}));
