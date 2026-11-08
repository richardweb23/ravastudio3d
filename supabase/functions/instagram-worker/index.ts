import { runInstagramWorker } from '../_shared/assemble-worker.ts';
import { createInstagramDatabaseAdapter } from '../_shared/database-adapter.ts';
import { handleInstagramWorker } from '../_shared/worker-handler.ts';
import { diagnoseMetaComment } from '../_shared/meta-comments.ts';
import { instagramWorkerMode } from '../_shared/instagram-worker-mode.ts';

Deno.serve((request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '', serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '', accountId = Deno.env.get('INSTAGRAM_ACCOUNT_ID') || '', apiVersion = Deno.env.get('INSTAGRAM_API_VERSION') || '';
  const mainCatalogUrl = Deno.env.get('MAIN_SUPABASE_URL') || '', mainCatalogKey = Deno.env.get('MAIN_SUPABASE_PUBLISHABLE_KEY') || '';
  const testCommentId = Deno.env.get('INSTAGRAM_TEST_COMMENT_ID') || '';
  const workerSecret = Deno.env.get('INSTAGRAM_WORKER_SECRET') || '';
  const mode = instagramWorkerMode(Deno.env.get('INSTAGRAM_PROCESSING_MODE'), testCommentId);
  return handleInstagramWorker(request, {
    secret: workerSecret, sendEnabled: Deno.env.get('INSTAGRAM_SEND_ENABLED'),
    ready: Boolean(supabaseUrl && serviceKey && token && accountId && apiVersion && mainCatalogUrl && mainCatalogKey && mode.ready),
    run: () => runInstagramWorker({ supabaseUrl, serviceKey, token, accountId, apiVersion, mainCatalogUrl, mainCatalogKey, testCommentId: mode.testCommentId }),
    clean: () => createInstagramDatabaseAdapter(supabaseUrl, serviceKey).clean(),
    setupVault: () => createInstagramDatabaseAdapter(supabaseUrl, serviceKey).installWorkerVault(workerSecret),
    diagnose: mode.testCommentId ? () => diagnoseMetaComment({ apiVersion, token }, mode.testCommentId!) : undefined,
  });
});
