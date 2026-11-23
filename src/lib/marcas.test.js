import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcaDoHostname } from './marcas.ts';

test('domínios públicos identificam marca sem aceitar sufixos ou subdomínios arbitrários', () => {
  assert.equal(marcaDoHostname('ravastudio3d.com.br'), 'rava');
  assert.equal(marcaDoHostname('RIVOXEL.COM.BR.'), 'rivoxel');
  for (const host of ['localhost', 'rivoxel.com.br.exemplo.com', 'outra.rivoxel.com.br', '', 'ravastudio3d.com.br:443']) {
    assert.equal(marcaDoHostname(host), null);
  }
});
