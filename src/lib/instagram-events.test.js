import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetaCommentEvents } from '../../supabase/functions/_shared/meta-events.ts';

test('extrai comentários do Login Unificado e rejeita eventos incompletos', () => {
  const payload = { object: 'instagram', entry: [{ id: '123', changes: [{ field: 'comments', value: { comment_id: '456', from: { id: '789' }, text: 'Valor?', media: { id: '101' } } }] }] };
  assert.deepEqual(parseMetaCommentEvents(payload, '123'), [{ id: '456', authorId: '789', mediaId: '101', text: 'Valor?' }]);
  assert.equal(parseMetaCommentEvents([payload], '123').length, 1);
  const sample = { object: 'instagram', entry: [{ id: '123', changes: [{ field: 'comments', value: { id: '17865799348089039', from: { id: '232323232' }, media: { id: '123123123', media_product_type: 'FEED' }, parent_id: '1231231234', text: 'This is an example.' } }] }] };
  assert.equal(parseMetaCommentEvents(sample, '123')[0].id, '17865799348089039');
  assert.throws(() => parseMetaCommentEvents({ object: 'instagram', entry: [{ id: '123', changes: [{ field: 'comments', value: { id: '1', comment_id: '2' } }] }] }, '123'), /conflitantes/);
  assert.throws(() => parseMetaCommentEvents(payload, '999'));
  assert.throws(() => parseMetaCommentEvents({ object: 'instagram', entry: [{ id: '123', changes: [{ field: 'comments', value: {} }] }] }, '123'));
});
