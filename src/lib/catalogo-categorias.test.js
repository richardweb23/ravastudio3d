import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogCategories } from './catalogo.ts';

test('categorias do site agrupam subcategorias com a categoria principal', () => {
  const categories = [{ id: 'child', pai_id: 'parent' }, { id: 'other' }, { id: 'parent' }, { id: 'orphan', pai_id: 'missing' }];
  assert.deepEqual(catalogCategories(categories).map(c => c.id), ['other', 'parent', 'child', 'orphan']);
  assert.deepEqual(catalogCategories([{ id: 'a' }, { id: 'b' }]).map(c => c.id), ['a', 'b']);
});
