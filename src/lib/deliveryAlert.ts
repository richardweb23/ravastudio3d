// Mantém a mesma janela de alerta utilizada no quadro de pedidos.
export function deliveryAlert(date: string | null | undefined, completed = false, now = new Date()) {
  if (completed || !date) return '';
  const days = Math.ceil((new Date(date + 'T12:00:00').getTime() - now.getTime()) / 86400000);
  return days < 0 ? 'overdue' : days <= 1 ? 'due-soon' : '';
}
