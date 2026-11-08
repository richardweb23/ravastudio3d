import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instagramSendEnabled } from '../../supabase/functions/_shared/send-gate.ts';
test('envios exigem habilitação explícita no servidor', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1']) assert.equal(instagramSendEnabled(value), false);
  assert.equal(instagramSendEnabled('true'), true);
});
