import { formatMoney } from "./formatters.js";
export const orderStages = [
  ['recebido', 'Recebidos', 'Pedido cadastrado, aguardando preparação.'],
  ['em_preparacao', 'Em preparação', 'Conferir peças do kit, cores, arquivos e materiais antes de produzir.'],
  ['em_producao', 'Em produção', 'Impressão, acabamento e montagem em andamento.'],
  ['pronto', 'Prontos para entrega', 'Pedido conferido, embalado e disponível para entregar.'],
];
export const orderSituations = { normal: 'Normal', aguardando: 'Aguardando', bloqueado: 'Bloqueado' };
export function orderAdvanceWarning(order, subtasks, status) {
  if (!['pronto', 'entregue'].includes(status)) return '';
  const pending = subtasks.filter(task => task.pedido_id === order.id && !task.concluido).length;
  return [pending ? `${pending} subtarefa(s) pendente(s).` : '',
    order.situacao === 'bloqueado' ? `Pedido bloqueado: ${order.situacao_descricao}` : ''].filter(Boolean).join('\n');
}

export function orderTooltip(order, data) {
  const paid = data.pagamentos.filter(p => p.pedido_id === order.id && !p.estornado_em).reduce((sum, p) => sum + Number(p.valor || 0), 0);
  const total = Number(order.valor_total || 0);
  const items = data.pedidoItens.filter(item => item.pedido_id === order.id).map(item =>
    `${item.materiais?.nome || 'Produto'}${item.subtitulo ? ' — ' + item.subtitulo : ''}: ${item.quantidade} × ${formatMoney(item.preco_unitario)}`).join('\n');
  return `Cliente: ${order.cliente}\nTotal: ${formatMoney(total)}\nPagamento: ${paid >= total ? 'Quitado' : paid > 0 ? 'Pagamento parcial' : 'Sem pagamentos'}\nValor pago: ${formatMoney(paid)}\nSaldo pendente: ${formatMoney(Math.max(0, total - paid))}\n\nItens:\n${items || 'Nenhum item'}`;
}
