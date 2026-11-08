import { handleInstagramAdmin, mainAuthorization } from '../_shared/admin-handler.ts';
import { instagramAdminOperations } from '../_shared/admin-operations.ts';

Deno.serve((request: Request) => {
  const mainUrl = Deno.env.get('MAIN_SUPABASE_URL') || '', mainKey = Deno.env.get('MAIN_SUPABASE_PUBLISHABLE_KEY') || '';
  const url = Deno.env.get('SUPABASE_URL') || '', serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return handleInstagramAdmin(request, {
    authorize: mainAuthorization(mainUrl, mainKey),
    execute: (action, data) => instagramAdminOperations({ url, serviceKey, mainUrl, mainKey })(action, data),
  });
});
