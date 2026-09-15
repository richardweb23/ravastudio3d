import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryAlert } from './deliveryAlert.js';
import { getAdminPage, getAdminPageHref } from './adminNavigation.js';

test('alertas de tarefas e pedidos respeitam a janela de entrega existente', () => {
  const now = new Date('2026-09-15T12:00:00');
  assert.equal(deliveryAlert('2026-09-13', false, now), 'overdue');
  assert.equal(deliveryAlert('2026-09-15', false, now), 'due-soon');
  assert.equal(deliveryAlert('2026-09-16', false, now), 'due-soon');
  assert.equal(deliveryAlert('2026-09-17', false, now), '');
  assert.equal(deliveryAlert('2026-09-13', true, now), '');
  assert.equal(deliveryAlert(null, false, now), '');
});

test('tarefas e cadastro funcionam em links diretos e hospedagem estatica', () => {
  const location = 'https://example.com/gestao/';
  for (const page of ['tarefas']) {
    assert.equal(getAdminPage(new URL(getAdminPageHref(page, location), location).href), page);
  }
  assert.equal(getAdminPage('https://example.com/gestao/tarefas/cadastrar'), 'tarefas');
});
