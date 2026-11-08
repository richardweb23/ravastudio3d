import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instagramWorkerMode } from '../../supabase/functions/_shared/instagram-worker-mode.ts';

test('worker exige modo explícito e limita modo de teste ao comentário informado', () => {
  assert.equal(instagramWorkerMode(undefined, '123').ready, false);
  assert.equal(instagramWorkerMode('unknown', '123').ready, false);
  assert.equal(instagramWorkerMode('test', '').ready, false);
  assert.equal(instagramWorkerMode('test', 'not-a-number').ready, false);
  assert.deepEqual(instagramWorkerMode('test', '123'), { ready: true, testCommentId: '123' });
  assert.deepEqual(instagramWorkerMode('continuous', '123'), { ready: true, testCommentId: undefined });
});
